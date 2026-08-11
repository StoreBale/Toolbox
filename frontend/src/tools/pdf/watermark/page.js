import { PDFDocument } from 'pdf-lib';
import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { addPdfWatermark } from './addPdfWatermark.js';

export function pdfWatermarkTemplate() {
  return toolPageTemplate({
    category: 'PDF 工具', categoryPath: '/category/pdf', eyebrow: 'PDF EDITOR', title: 'PDF 浮水印', iconName: 'pdfWatermark',
    description: '在每一頁加入自訂文字，可調整位置、顏色與透明度。',
    content: `<section class="workspace tool-workspace">
      ${filePickerTemplate({ accept: 'application/pdf,.pdf', title: '拖放一個 PDF 到這裡', hint: '浮水印會套用到文件的每一頁' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="selected-file"><span class="pdf-icon">PDF</span><div><strong id="selected-name"></strong><small id="selected-meta"></small></div><button id="replace-file" class="text-button" type="button">更換檔案</button></div>
        <label><span class="field-label">浮水印文字</span><input id="watermark-text" class="setting-input" type="text" value="CONFIDENTIAL" maxlength="60" /></label>
        <div class="settings-grid watermark-settings">
          <label><span class="field-label">位置</span><select id="watermark-position" class="setting-input"><option value="center">頁面中央（斜向）</option><option value="topLeft">左上</option><option value="topRight">右上</option><option value="bottomLeft">左下</option><option value="bottomRight">右下</option></select></label>
          <label><span class="field-label">顏色</span><input id="watermark-color" class="setting-input color-input" type="color" value="#1769d3" /></label>
        </div>
        <label class="range-label" for="watermark-opacity"><span>透明度</span><strong id="opacity-value">35%</strong></label><input id="watermark-opacity" class="range-input" type="range" min="10" max="90" value="35" />
        <label class="range-label" for="watermark-size"><span>文字大小</span><strong id="size-value">48 px</strong></label><input id="watermark-size" class="range-input" type="range" min="20" max="120" value="48" />
        <div id="status" class="status" role="status" aria-live="polite"></div><button id="action-button" class="primary-button" type="button">加入浮水印並下載</button>
      </div>
    </section>`
  });
}

export function bindPdfWatermark() {
  const dropZone = document.querySelector('#drop-zone'); const controls = document.querySelector('#tool-controls'); const status = document.querySelector('#status'); let selectedFile = null;
  async function selectFiles(files) { const file = files.find((item) => item.type === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf')); if (!file) return; try { const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false }); selectedFile = file; document.querySelector('#selected-name').textContent = file.name; document.querySelector('#selected-meta').textContent = `${pdf.getPageCount()} 頁 · ${formatBytes(file.size)}`; dropZone.hidden = true; controls.hidden = false; status.textContent = ''; } catch { dropZone.querySelector('.drop-hint').textContent = '這份 PDF 無法讀取，請更換檔案。'; } }
  bindFilePicker(selectFiles); document.querySelector('#replace-file').addEventListener('click', () => document.querySelector('#file-input').click());
  const opacity = document.querySelector('#watermark-opacity'); const size = document.querySelector('#watermark-size'); opacity.addEventListener('input', () => { document.querySelector('#opacity-value').textContent = `${opacity.value}%`; }); size.addEventListener('input', () => { document.querySelector('#size-value').textContent = `${size.value} px`; });
  document.querySelector('#action-button').addEventListener('click', async (event) => { const text = document.querySelector('#watermark-text').value.trim(); if (!text) { status.className = 'status error'; status.textContent = '請輸入浮水印文字。'; return; } const button = event.currentTarget; button.disabled = true; status.className = 'status working'; status.textContent = '正在套用浮水印…'; try { const result = await addPdfWatermark(selectedFile, { text, position: document.querySelector('#watermark-position').value, opacity: Number(opacity.value) / 100, fontSize: Number(size.value), color: document.querySelector('#watermark-color').value }); downloadBlob(new Blob([result.bytes], { type: 'application/pdf' }), `${safeBaseName(selectedFile.name)}-浮水印.pdf`); status.className = 'status success'; status.textContent = `完成！已套用到 ${result.pageCount} 頁。`; } catch (error) { console.error(error); status.className = 'status error'; status.textContent = '加入浮水印失敗，請更換 PDF 後再試一次。'; } finally { button.disabled = false; } });
}
