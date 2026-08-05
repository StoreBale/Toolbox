import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { cropImage, extensionFor, imageTypes } from '../../../utils/image.js';

export function imageCropTemplate() {
  return toolPageTemplate({
    category: '圖片工具', categoryPath: '/category/image', eyebrow: 'IMAGE TOOL', title: '裁切圖片', iconName: 'crop',
    description: '視覺化選擇圖片區域，精確輸入座標與裁切尺寸。',
    content: `<section class="workspace tool-workspace crop-workspace">
      ${filePickerTemplate({ accept: 'image/jpeg,image/png,image/webp', title: '選擇要裁切的圖片', hint: '或將 JPG、PNG、WebP 拖放到這裡' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="selected-file"><span class="image-file-icon">IMG</span><div><strong id="selected-name"></strong><small id="selected-meta"></small></div><button id="replace-file" class="text-button" type="button">更換圖片</button></div>
        <div class="crop-stage"><img id="crop-preview" alt="待裁切圖片預覽" /><div id="crop-selection" class="crop-selection" title="拖曳移動裁切範圍"></div></div>
        <div class="crop-fields">
          <label><span class="field-label">X</span><input id="crop-x" class="setting-input" type="number" min="0" /></label>
          <label><span class="field-label">Y</span><input id="crop-y" class="setting-input" type="number" min="0" /></label>
          <label><span class="field-label">寬度</span><input id="crop-width" class="setting-input" type="number" min="1" /></label>
          <label><span class="field-label">高度</span><input id="crop-height" class="setting-input" type="number" min="1" /></label>
        </div>
        <p class="field-help">可拖曳藍色選取框移動範圍，或直接輸入原始圖片像素。</p>
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">裁切並下載圖片</button>
      </div>
    </section>`
  });
}

export function bindImageCrop() {
  const controls = document.querySelector('#tool-controls');
  const dropZone = document.querySelector('#drop-zone');
  const preview = document.querySelector('#crop-preview');
  const selection = document.querySelector('#crop-selection');
  const status = document.querySelector('#status');
  const fields = ['x', 'y', 'width', 'height'].reduce((result, name) => ({ ...result, [name]: document.querySelector(`#crop-${name}`) }), {});
  let selectedFile = null;
  let imageWidth = 0;
  let imageHeight = 0;
  let previewUrl = '';

  function values() {
    const x = Math.max(0, Math.min(imageWidth - 1, Number(fields.x.value) || 0));
    const y = Math.max(0, Math.min(imageHeight - 1, Number(fields.y.value) || 0));
    const width = Math.max(1, Math.min(imageWidth - x, Number(fields.width.value) || 1));
    const height = Math.max(1, Math.min(imageHeight - y, Number(fields.height.value) || 1));
    return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
  }

  function updateSelection() {
    if (!preview.clientWidth) return;
    const crop = values();
    Object.entries(crop).forEach(([name, value]) => { fields[name].value = value; });
    const scaleX = preview.clientWidth / imageWidth;
    const scaleY = preview.clientHeight / imageHeight;
    Object.assign(selection.style, { left: `${crop.x * scaleX}px`, top: `${crop.y * scaleY}px`, width: `${crop.width * scaleX}px`, height: `${crop.height * scaleY}px` });
  }

  async function selectFiles(files) {
    const file = files.find((item) => imageTypes.has(item.type));
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    selectedFile = file;
    imageWidth = bitmap.width;
    imageHeight = bitmap.height;
    bitmap.close();
    fields.x.value = 0; fields.y.value = 0; fields.width.value = imageWidth; fields.height.value = imageHeight;
    document.querySelector('#selected-name').textContent = file.name;
    document.querySelector('#selected-meta').textContent = `${imageWidth} × ${imageHeight} · ${formatBytes(file.size)}`;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.onload = updateSelection;
    dropZone.hidden = true;
    controls.hidden = false;
    status.textContent = '';
  }

  bindFilePicker(selectFiles);
  document.querySelector('#replace-file').addEventListener('click', () => document.querySelector('#file-input').click());
  Object.values(fields).forEach((field) => field.addEventListener('input', updateSelection));
  window.addEventListener('resize', updateSelection);
  selection.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    selection.setPointerCapture(event.pointerId);
    const start = { clientX: event.clientX, clientY: event.clientY, ...values() };
    const move = (moveEvent) => {
      const scaleX = imageWidth / preview.clientWidth;
      const scaleY = imageHeight / preview.clientHeight;
      fields.x.value = Math.round(start.x + (moveEvent.clientX - start.clientX) * scaleX);
      fields.y.value = Math.round(start.y + (moveEvent.clientY - start.clientY) * scaleY);
      updateSelection();
    };
    selection.addEventListener('pointermove', move);
    selection.addEventListener('pointerup', () => selection.removeEventListener('pointermove', move), { once: true });
  });
  document.querySelector('#action-button').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    status.className = 'status working';
    status.textContent = '正在裁切圖片…';
    try {
      const crop = values();
      const blob = await cropImage(selectedFile, crop);
      downloadBlob(blob, `${safeBaseName(selectedFile.name)}-${crop.width}x${crop.height}.${extensionFor(selectedFile.type)}`);
      status.className = 'status success';
      status.textContent = `完成！輸出尺寸為 ${crop.width} × ${crop.height}。`;
    } catch (error) {
      console.error(error);
      status.className = 'status error';
      status.textContent = '裁切失敗，請重新選擇範圍。';
    } finally { button.disabled = false; }
  });
}
