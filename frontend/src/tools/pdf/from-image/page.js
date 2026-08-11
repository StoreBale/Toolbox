import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob, formatBytes } from '../../../utils/download.js';
import { imageTypes, processImage } from '../../../utils/image.js';
import { imagesToPdf } from './imagesToPdf.js';

export function imageToPdfTemplate() {
  return toolPageTemplate({
    category: 'PDF 工具', categoryPath: '/category/pdf', eyebrow: 'PDF CONVERTER', title: '圖片轉 PDF', iconName: 'imageToPdf',
    description: '將多張 JPG、PNG 或 WebP 依照指定順序整理成一份 PDF。',
    content: `<section class="workspace tool-workspace">
      ${filePickerTemplate({ accept: 'image/jpeg,image/png,image/webp', multiple: true, title: '拖放圖片到這裡', hint: '可一次選擇多張，之後可調整順序' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="panel-heading"><div><p class="section-label">圖片順序</p><p id="selected-meta" class="file-summary"></p></div><button id="add-files" class="text-button" type="button">＋ 加入圖片</button></div>
        <div id="image-order-list" class="media-order-list"></div>
        <div class="settings-grid">
          <label><span class="field-label">頁面大小</span><select id="page-size" class="setting-input"><option value="fit">符合每張圖片</option><option value="a4">統一 A4</option></select></label>
          <label><span class="field-label">頁面方向</span><select id="orientation" class="setting-input"><option value="auto">自動判斷</option><option value="portrait">直向</option><option value="landscape">橫向</option></select></label>
        </div>
        <label class="range-label" for="page-margin"><span>頁面留白</span><strong id="margin-value">20 pt</strong></label><input id="page-margin" class="range-input" type="range" min="0" max="60" value="20" />
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">建立並下載 PDF</button>
      </div>
    </section>`
  });
}

export function bindImageToPdf() {
  const dropZone = document.querySelector('#drop-zone');
  const controls = document.querySelector('#tool-controls');
  const list = document.querySelector('#image-order-list');
  const status = document.querySelector('#status');
  const margin = document.querySelector('#page-margin');
  let items = [];

  function render() {
    list.innerHTML = items.map((item, index) => `<article class="media-order-item" draggable="true" data-index="${index}"><img src="${item.url}" alt="" /><div><strong>${item.file.name}</strong><small>${formatBytes(item.file.size)}</small></div><div class="mini-actions"><button type="button" data-move="up" aria-label="向前移動">↑</button><button type="button" data-move="down" aria-label="向後移動">↓</button><button type="button" data-remove aria-label="移除">×</button></div></article>`).join('');
    document.querySelector('#selected-meta').textContent = `${items.length} 張圖片 · 拖曳卡片或使用箭頭調整順序`;
  }
  async function addFiles(files) {
    for (const file of files.filter((item) => imageTypes.has(item.type))) {
      let usable = file;
      if (file.type === 'image/webp') {
        const converted = await processImage(file, { type: 'image/jpeg', quality: .94 });
        usable = new File([converted.blob], `${file.name}.jpg`, { type: 'image/jpeg' });
      }
      items.push({ file: usable, url: URL.createObjectURL(file) });
    }
    if (!items.length) return;
    dropZone.hidden = true; controls.hidden = false; status.textContent = ''; render();
  }
  bindFilePicker(addFiles);
  document.querySelector('#add-files').addEventListener('click', () => document.querySelector('#file-input').click());
  margin.addEventListener('input', () => { document.querySelector('#margin-value').textContent = `${margin.value} pt`; });
  list.addEventListener('click', (event) => {
    const card = event.target.closest('.media-order-item'); if (!card) return;
    const index = Number(card.dataset.index);
    if (event.target.closest('[data-remove]')) { URL.revokeObjectURL(items[index].url); items.splice(index, 1); }
    const direction = event.target.closest('[data-move]')?.dataset.move;
    const target = direction === 'up' ? index - 1 : direction === 'down' ? index + 1 : index;
    if (target >= 0 && target < items.length && target !== index) [items[index], items[target]] = [items[target], items[index]];
    render();
  });
  let dragged = -1;
  list.addEventListener('dragstart', (event) => { dragged = Number(event.target.closest('.media-order-item')?.dataset.index); });
  list.addEventListener('dragover', (event) => event.preventDefault());
  list.addEventListener('drop', (event) => { event.preventDefault(); const target = Number(event.target.closest('.media-order-item')?.dataset.index); if (dragged >= 0 && target >= 0 && dragged !== target) { const [item] = items.splice(dragged, 1); items.splice(target, 0, item); render(); } });
  document.querySelector('#action-button').addEventListener('click', async (event) => {
    if (!items.length) { status.className = 'status error'; status.textContent = '請至少加入一張圖片。'; return; }
    const button = event.currentTarget; button.disabled = true; status.className = 'status working'; status.textContent = '正在建立 PDF…';
    try {
      const bytes = await imagesToPdf(items, { pageSize: document.querySelector('#page-size').value, orientation: document.querySelector('#orientation').value, margin: Number(margin.value) });
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), '圖片合併.pdf');
      status.className = 'status success'; status.textContent = `完成！已建立 ${items.length} 頁 PDF。`;
    } catch (error) { console.error(error); status.className = 'status error'; status.textContent = '建立失敗，請更換圖片後再試一次。'; }
    finally { button.disabled = false; }
  });
}
