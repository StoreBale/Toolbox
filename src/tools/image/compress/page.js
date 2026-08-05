import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { createZip } from '../../../utils/archive.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { extensionFor, imageTypes, processImage } from '../../../utils/image.js';

export function imageCompressTemplate() {
  return toolPageTemplate({
    category: '圖片工具', categoryPath: '/category/image', eyebrow: 'IMAGE TOOL', title: '壓縮圖片', iconName: 'compressImage',
    description: '批次縮小圖片尺寸與檔案容量，完成後一次下載。',
    content: `<section class="workspace tool-workspace">
      ${filePickerTemplate({ accept: 'image/jpeg,image/png,image/webp', multiple: true, title: '拖放圖片到這裡', hint: '支援 JPG、PNG、WebP，可一次選擇多張' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="selected-file"><span class="image-file-icon">IMG</span><div><strong id="selected-name"></strong><small id="selected-meta"></small></div><button id="replace-file" class="text-button" type="button">重新選擇</button></div>
        <div class="settings-grid">
          <label><span class="field-label">輸出格式</span><select id="output-format" class="setting-input"><option value="image/webp">WebP（建議）</option><option value="image/jpeg">JPG</option></select></label>
          <label><span class="field-label">最長邊</span><select id="max-dimension" class="setting-input"><option value="1920">1920 px</option><option value="1280">1280 px</option><option value="0">維持原尺寸</option></select></label>
        </div>
        <label class="range-label" for="image-quality"><span>圖片品質</span><strong id="quality-value">80%</strong></label>
        <input id="image-quality" class="range-input" type="range" min="40" max="95" value="80" />
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">壓縮並下載</button>
      </div>
    </section>`
  });
}

export function bindImageCompress() {
  const controls = document.querySelector('#tool-controls');
  const dropZone = document.querySelector('#drop-zone');
  const status = document.querySelector('#status');
  const action = document.querySelector('#action-button');
  const quality = document.querySelector('#image-quality');
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
  quality.addEventListener('input', () => { document.querySelector('#quality-value').textContent = `${quality.value}%`; });
  action.addEventListener('click', async () => {
    action.disabled = true;
    status.className = 'status working';
    const type = document.querySelector('#output-format').value;
    const maxDimension = Number(document.querySelector('#max-dimension').value);
    try {
      const outputs = [];
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        status.textContent = `正在處理第 ${index + 1} / ${selectedFiles.length} 張…`;
        const result = await processImage(file, { type, quality: Number(quality.value) / 100, maxDimension });
        outputs.push({ name: `${safeBaseName(file.name)}.${extensionFor(type)}`, blob: result.blob });
      }
      const originalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
      const outputSize = outputs.reduce((sum, item) => sum + item.blob.size, 0);
      if (outputs.length === 1) downloadBlob(outputs[0].blob, outputs[0].name);
      else downloadBlob(await createZip(outputs), '壓縮圖片.zip');
      status.className = 'status success';
      status.textContent = outputSize < originalSize ? `完成！總容量縮小 ${Math.round((originalSize - outputSize) / originalSize * 100)}%。` : '完成！輸出尺寸或格式可能使容量增加。';
    } catch (error) {
      console.error(error);
      status.className = 'status error';
      status.textContent = '圖片處理失敗，請更換圖片後再試一次。';
    } finally {
      action.disabled = false;
    }
  });
}
