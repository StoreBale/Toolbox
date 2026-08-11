import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { extensionFor, imageTypes, processImage } from '../../../utils/image.js';

export function imageResizeTemplate() {
  return toolPageTemplate({
    category: '圖片工具', categoryPath: '/category/image', eyebrow: 'IMAGE TOOL', title: '調整圖片尺寸', iconName: 'resize',
    description: '輸入寬度與高度，快速輸出指定像素尺寸的圖片。',
    content: `<section class="workspace tool-workspace">
      ${filePickerTemplate({ accept: 'image/jpeg,image/png,image/webp', title: '拖放一張圖片到這裡', hint: '支援 JPG、PNG 與 WebP' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="selected-file"><span class="image-file-icon">IMG</span><div><strong id="selected-name"></strong><small id="selected-meta"></small></div><button id="replace-file" class="text-button" type="button">更換圖片</button></div>
        <div class="dimension-grid">
          <label><span class="field-label">寬度（px）</span><input id="image-width" class="setting-input" type="number" min="1" max="12000" /></label>
          <span class="dimension-times">×</span>
          <label><span class="field-label">高度（px）</span><input id="image-height" class="setting-input" type="number" min="1" max="12000" /></label>
        </div>
        <label class="check-label"><input id="lock-ratio" type="checkbox" checked /><span>鎖定原始比例</span></label>
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">調整並下載圖片</button>
      </div>
    </section>`
  });
}

export function bindImageResize() {
  const controls = document.querySelector('#tool-controls');
  const dropZone = document.querySelector('#drop-zone');
  const status = document.querySelector('#status');
  const action = document.querySelector('#action-button');
  const widthInput = document.querySelector('#image-width');
  const heightInput = document.querySelector('#image-height');
  const ratioLock = document.querySelector('#lock-ratio');
  let selectedFile = null;
  let aspectRatio = 1;
  let updating = false;

  async function selectFiles(files) {
    const file = files.find((item) => imageTypes.has(item.type));
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    selectedFile = file;
    aspectRatio = bitmap.width / bitmap.height;
    widthInput.value = bitmap.width;
    heightInput.value = bitmap.height;
    document.querySelector('#selected-name').textContent = file.name;
    document.querySelector('#selected-meta').textContent = `${bitmap.width} × ${bitmap.height} · ${formatBytes(file.size)}`;
    bitmap.close();
    dropZone.hidden = true;
    controls.hidden = false;
    status.textContent = '';
  }

  function syncDimension(source) {
    if (!ratioLock.checked || updating) return;
    updating = true;
    if (source === widthInput) heightInput.value = Math.max(1, Math.round(Number(widthInput.value) / aspectRatio));
    else widthInput.value = Math.max(1, Math.round(Number(heightInput.value) * aspectRatio));
    updating = false;
  }

  bindFilePicker(selectFiles);
  document.querySelector('#replace-file').addEventListener('click', () => document.querySelector('#file-input').click());
  widthInput.addEventListener('input', () => syncDimension(widthInput));
  heightInput.addEventListener('input', () => syncDimension(heightInput));
  action.addEventListener('click', async () => {
    const width = Number(widthInput.value);
    const height = Number(heightInput.value);
    if (!width || !height || width > 12000 || height > 12000) {
      status.className = 'status error';
      status.textContent = '寬度與高度必須介於 1 到 12000 像素。';
      return;
    }
    action.disabled = true;
    status.className = 'status working';
    status.textContent = '正在調整圖片尺寸…';
    try {
      const result = await processImage(selectedFile, { type: selectedFile.type, quality: 0.9, targetWidth: width, targetHeight: height });
      downloadBlob(result.blob, `${safeBaseName(selectedFile.name)}-${width}x${height}.${extensionFor(selectedFile.type)}`);
      status.className = 'status success';
      status.textContent = `完成！輸出尺寸為 ${width} × ${height}。`;
    } catch (error) {
      console.error(error);
      status.className = 'status error';
      status.textContent = '圖片處理失敗，請更換圖片後再試一次。';
    } finally {
      action.disabled = false;
    }
  });
}
