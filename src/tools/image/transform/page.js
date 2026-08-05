import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { extensionFor, imageTypes, transformImage } from '../../../utils/image.js';

export function imageTransformTemplate() {
  return toolPageTemplate({
    category: '圖片工具', categoryPath: '/category/image', eyebrow: 'IMAGE TOOL', title: '圖片旋轉與翻轉', iconName: 'flip',
    description: '修正圖片方向，或進行水平與垂直鏡像翻轉。',
    content: `<section class="workspace tool-workspace">
      ${filePickerTemplate({ accept: 'image/jpeg,image/png,image/webp', title: '拖放一張圖片到這裡', hint: '支援 JPG、PNG 與 WebP' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="selected-file"><span class="image-file-icon">IMG</span><div><strong id="selected-name"></strong><small id="selected-meta"></small></div><button id="replace-file" class="text-button" type="button">更換圖片</button></div>
        <label class="field-label" for="transform-operation">轉換方式</label>
        <select id="transform-operation" class="setting-input"><option value="rotate90">順時針旋轉 90°</option><option value="rotate180">旋轉 180°</option><option value="rotate270">逆時針旋轉 90°</option><option value="flipHorizontal">水平翻轉</option><option value="flipVertical">垂直翻轉</option></select>
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">轉換並下載圖片</button>
      </div>
    </section>`
  });
}

export function bindImageTransform() {
  const controls = document.querySelector('#tool-controls');
  const dropZone = document.querySelector('#drop-zone');
  const status = document.querySelector('#status');
  const action = document.querySelector('#action-button');
  let selectedFile = null;

  async function selectFiles(files) {
    const file = files.find((item) => imageTypes.has(item.type));
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    selectedFile = file;
    document.querySelector('#selected-name').textContent = file.name;
    document.querySelector('#selected-meta').textContent = `${bitmap.width} × ${bitmap.height} · ${formatBytes(file.size)}`;
    bitmap.close();
    dropZone.hidden = true;
    controls.hidden = false;
    status.textContent = '';
  }

  bindFilePicker(selectFiles);
  document.querySelector('#replace-file').addEventListener('click', () => document.querySelector('#file-input').click());
  action.addEventListener('click', async () => {
    action.disabled = true;
    status.className = 'status working';
    status.textContent = '正在轉換圖片…';
    try {
      const result = await transformImage(selectedFile, document.querySelector('#transform-operation').value);
      downloadBlob(result.blob, `${safeBaseName(selectedFile.name)}-轉換.${extensionFor(selectedFile.type)}`);
      status.className = 'status success';
      status.textContent = `完成！輸出尺寸為 ${result.width} × ${result.height}。`;
    } catch (error) {
      console.error(error);
      status.className = 'status error';
      status.textContent = '圖片轉換失敗，請更換圖片後再試一次。';
    } finally {
      action.disabled = false;
    }
  });
}
