import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { extensionFor, imageTypes, watermarkImage } from '../../../utils/image.js';

export function imageWatermarkTemplate() {
  return toolPageTemplate({
    category: '圖片工具', categoryPath: '/category/image', eyebrow: 'IMAGE TOOL', title: '圖片浮水印', iconName: 'watermark',
    description: '加入文字浮水印，設定位置、大小、顏色與透明度。',
    content: `<section class="workspace tool-workspace">
      ${filePickerTemplate({ accept: 'image/jpeg,image/png,image/webp', title: '選擇要加浮水印的圖片', hint: '或將 JPG、PNG、WebP 拖放到這裡' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="selected-file"><span class="image-file-icon">IMG</span><div><strong id="selected-name"></strong><small id="selected-meta"></small></div><button id="replace-file" class="text-button" type="button">更換圖片</button></div>
        <label class="field-label" for="watermark-text">浮水印文字</label><input id="watermark-text" class="setting-input" type="text" value="Toolbox" maxlength="80" />
        <div class="settings-grid watermark-settings">
          <label><span class="field-label">位置</span><select id="watermark-position" class="setting-input"><option value="bottomRight">右下</option><option value="bottomLeft">左下</option><option value="center">中央</option><option value="topRight">右上</option><option value="topLeft">左上</option></select></label>
          <label><span class="field-label">文字顏色</span><input id="watermark-color" class="setting-input color-input" type="color" value="#ffffff" /></label>
        </div>
        <label class="range-label" for="watermark-size"><span>文字大小</span><strong id="size-value">48 px</strong></label><input id="watermark-size" class="range-input" type="range" min="16" max="160" value="48" />
        <label class="range-label" for="watermark-opacity"><span>透明度</span><strong id="opacity-value">60%</strong></label><input id="watermark-opacity" class="range-input" type="range" min="10" max="100" value="60" />
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">加入浮水印並下載</button>
      </div>
    </section>`
  });
}

export function bindImageWatermark() {
  const controls = document.querySelector('#tool-controls');
  const dropZone = document.querySelector('#drop-zone');
  const status = document.querySelector('#status');
  const size = document.querySelector('#watermark-size');
  const opacity = document.querySelector('#watermark-opacity');
  let selectedFile = null;

  async function selectFiles(files) {
    const file = files.find((item) => imageTypes.has(item.type));
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    selectedFile = file;
    document.querySelector('#selected-name').textContent = file.name;
    document.querySelector('#selected-meta').textContent = `${bitmap.width} × ${bitmap.height} · ${formatBytes(file.size)}`;
    bitmap.close();
    dropZone.hidden = true; controls.hidden = false; status.textContent = '';
  }

  bindFilePicker(selectFiles);
  document.querySelector('#replace-file').addEventListener('click', () => document.querySelector('#file-input').click());
  size.addEventListener('input', () => { document.querySelector('#size-value').textContent = `${size.value} px`; });
  opacity.addEventListener('input', () => { document.querySelector('#opacity-value').textContent = `${opacity.value}%`; });
  document.querySelector('#action-button').addEventListener('click', async (event) => {
    const text = document.querySelector('#watermark-text').value.trim();
    if (!text) { status.className = 'status error'; status.textContent = '請輸入浮水印文字。'; return; }
    const button = event.currentTarget;
    button.disabled = true; status.className = 'status working'; status.textContent = '正在加入浮水印…';
    try {
      const blob = await watermarkImage(selectedFile, { text, position: document.querySelector('#watermark-position').value, opacity: Number(opacity.value) / 100, fontSize: Number(size.value), color: document.querySelector('#watermark-color').value });
      downloadBlob(blob, `${safeBaseName(selectedFile.name)}-浮水印.${extensionFor(selectedFile.type)}`);
      status.className = 'status success'; status.textContent = '完成！已加入文字浮水印。';
    } catch (error) {
      console.error(error); status.className = 'status error'; status.textContent = '浮水印處理失敗，請更換圖片後再試。';
    } finally { button.disabled = false; }
  });
}
