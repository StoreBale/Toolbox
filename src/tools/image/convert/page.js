import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { createZip } from '../../../utils/archive.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { extensionFor, imageTypes, processImage } from '../../../utils/image.js';

export function imageConvertTemplate() {
  return toolPageTemplate({
    category: '圖片工具', categoryPath: '/category/image', eyebrow: 'IMAGE TOOL', title: '圖片轉檔', iconName: 'convert',
    description: '將 JPG、PNG、WebP 圖片轉換成常用格式。',
    content: `<section class="workspace tool-workspace">
      ${filePickerTemplate({ accept: 'image/jpeg,image/png,image/webp', multiple: true, title: '拖放圖片到這裡', hint: '可一次轉換多張 JPG、PNG 或 WebP' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="selected-file"><span class="image-file-icon">IMG</span><div><strong id="selected-name"></strong><small id="selected-meta"></small></div><button id="replace-file" class="text-button" type="button">重新選擇</button></div>
        <label class="field-label" for="output-format">轉換成</label>
        <select id="output-format" class="setting-input"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select>
        <p class="field-help">轉為 JPG 時，透明背景會自動填成白色。</p>
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">轉換並下載</button>
      </div>
    </section>`
  });
}

export function bindImageConvert() {
  const controls = document.querySelector('#tool-controls');
  const dropZone = document.querySelector('#drop-zone');
  const status = document.querySelector('#status');
  const action = document.querySelector('#action-button');
  let selectedFiles = [];

  function selectFiles(files) {
    selectedFiles = files.filter((file) => imageTypes.has(file.type));
    if (!selectedFiles.length) return;
    document.querySelector('#selected-name').textContent = `${selectedFiles.length} 張圖片`;
    document.querySelector('#selected-meta').textContent = formatBytes(selectedFiles.reduce((sum, file) => sum + file.size, 0));
    dropZone.hidden = true;
    controls.hidden = false;
    status.textContent = '';
  }

  bindFilePicker(selectFiles);
  document.querySelector('#replace-file').addEventListener('click', () => document.querySelector('#file-input').click());
  action.addEventListener('click', async () => {
    action.disabled = true;
    status.className = 'status working';
    const type = document.querySelector('#output-format').value;
    try {
      const outputs = [];
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        status.textContent = `正在轉換第 ${index + 1} / ${selectedFiles.length} 張…`;
        const result = await processImage(file, { type, quality: 0.9 });
        outputs.push({ name: `${safeBaseName(file.name)}.${extensionFor(type)}`, blob: result.blob });
      }
      if (outputs.length === 1) downloadBlob(outputs[0].blob, outputs[0].name);
      else downloadBlob(await createZip(outputs), '轉換圖片.zip');
      status.className = 'status success';
      status.textContent = `完成！已轉換 ${outputs.length} 張圖片。`;
    } catch (error) {
      console.error(error);
      status.className = 'status error';
      status.textContent = '圖片轉換失敗，請更換圖片後再試一次。';
    } finally {
      action.disabled = false;
    }
  });
}
