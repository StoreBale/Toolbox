import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { organizePdf } from './organizePdf.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export function pdfOrganizeTemplate() {
  return toolPageTemplate({
    category: 'PDF 工具', categoryPath: '/category/pdf', eyebrow: 'PDF ORGANIZER', title: '整理 PDF 頁面', iconName: 'organize',
    description: '直接看縮圖拖曳排序，也能旋轉或移除個別頁面。',
    content: `<section class="workspace tool-workspace organize-workspace">
      ${filePickerTemplate({ accept: 'application/pdf,.pdf', title: '拖放一個 PDF 到這裡', hint: '選取後會顯示每一頁的縮圖' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="panel-heading"><div><p class="section-label">頁面縮圖</p><p id="selected-meta" class="file-summary"></p></div><button id="replace-file" class="text-button" type="button">更換檔案</button></div>
        <div class="organize-help">拖曳縮圖調整順序；紅色標記的頁面不會出現在輸出 PDF。</div>
        <div id="page-grid" class="page-thumbnail-grid"></div>
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">套用順序並下載 PDF</button>
      </div>
    </section>`
  });
}

export function bindPdfOrganize() {
  const dropZone = document.querySelector('#drop-zone'); const controls = document.querySelector('#tool-controls'); const grid = document.querySelector('#page-grid'); const status = document.querySelector('#status');
  let selectedFile = null; let items = []; let dragged = -1;
  function render() {
    grid.innerHTML = items.map((item, index) => `<article class="page-thumbnail ${item.deleted ? 'deleted' : ''}" draggable="true" data-index="${index}"><div class="page-image-wrap"><img src="${item.thumbnail}" alt="第 ${item.originalIndex + 1} 頁縮圖" style="transform:rotate(${item.rotation}deg)" /><span class="deleted-label">已移除</span></div><strong>第 ${item.originalIndex + 1} 頁</strong><div class="page-actions"><button type="button" data-rotate aria-label="旋轉第 ${item.originalIndex + 1} 頁">↻</button><button type="button" data-delete>${item.deleted ? '復原' : '移除'}</button></div></article>`).join('');
    const kept = items.filter((item) => !item.deleted).length; document.querySelector('#selected-meta').textContent = `${items.length} 頁 · 將保留 ${kept} 頁`;
  }
  async function selectFiles(files) {
    const file = files.find((item) => item.type === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf')); if (!file) return;
    status.className = 'status working'; status.textContent = '正在建立頁面縮圖…';
    try {
      const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const next = [];
      for (let number = 1; number <= document.numPages; number += 1) {
        const page = await document.getPage(number); const viewport = page.getViewport({ scale: .34 }); const canvas = window.document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
        next.push({ originalIndex: number - 1, rotation: 0, deleted: false, thumbnail: canvas.toDataURL('image/jpeg', .72) }); page.cleanup(); status.textContent = `正在建立縮圖 ${number} / ${document.numPages}…`;
      }
      selectedFile = file; items = next; dropZone.hidden = true; controls.hidden = false; status.textContent = ''; render();
    } catch (error) { console.error(error); status.className = 'status error'; status.textContent = '無法讀取這份 PDF，請確認文件沒有密碼保護。'; }
  }
  bindFilePicker(selectFiles); document.querySelector('#replace-file').addEventListener('click', () => document.querySelector('#file-input').click());
  grid.addEventListener('click', (event) => { const card = event.target.closest('.page-thumbnail'); if (!card) return; const item = items[Number(card.dataset.index)]; if (event.target.closest('[data-rotate]')) item.rotation = (item.rotation + 90) % 360; if (event.target.closest('[data-delete]')) item.deleted = !item.deleted; render(); });
  grid.addEventListener('dragstart', (event) => { dragged = Number(event.target.closest('.page-thumbnail')?.dataset.index); event.target.closest('.page-thumbnail')?.classList.add('dragging'); });
  grid.addEventListener('dragend', (event) => event.target.closest('.page-thumbnail')?.classList.remove('dragging'));
  grid.addEventListener('dragover', (event) => event.preventDefault());
  grid.addEventListener('drop', (event) => { event.preventDefault(); const target = Number(event.target.closest('.page-thumbnail')?.dataset.index); if (dragged >= 0 && target >= 0 && dragged !== target) { const [item] = items.splice(dragged, 1); items.splice(target, 0, item); render(); } });
  document.querySelector('#action-button').addEventListener('click', async (event) => { const button = event.currentTarget; button.disabled = true; status.className = 'status working'; status.textContent = '正在整理頁面…'; try { const result = await organizePdf(selectedFile, items); downloadBlob(new Blob([result.bytes], { type: 'application/pdf' }), `${safeBaseName(selectedFile.name)}-已整理.pdf`); status.className = 'status success'; status.textContent = `完成！輸出 PDF 共 ${result.pageCount} 頁。`; } catch (error) { status.className = 'status error'; status.textContent = error.message; } finally { button.disabled = false; } });
}
