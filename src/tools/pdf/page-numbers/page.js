import { PDFDocument } from 'pdf-lib';
import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { addPageNumbers } from './addPageNumbers.js';

export function pdfPageNumbersTemplate() {
  return toolPageTemplate({
    category: 'PDF 工具', categoryPath: '/category/pdf', eyebrow: 'PDF EDITOR', title: '加入 PDF 頁碼', iconName: 'pageNumbers',
    description: '選擇頁碼位置、起始數字與套用範圍，快速整理正式文件。',
    content: `<section class="workspace tool-workspace">
      ${filePickerTemplate({ accept: 'application/pdf,.pdf', title: '拖放一個 PDF 到這裡', hint: '選取後可設定頁碼位置與範圍' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="selected-file"><span class="pdf-icon">PDF</span><div><strong id="selected-name"></strong><small id="selected-meta"></small></div><button id="replace-file" class="text-button" type="button">更換檔案</button></div>
        <div class="settings-grid">
          <label><span class="field-label">頁碼位置</span><select id="number-position" class="setting-input"><option value="bottomCenter">下方置中</option><option value="bottomLeft">左下</option><option value="bottomRight">右下</option><option value="topCenter">上方置中</option><option value="topLeft">左上</option><option value="topRight">右上</option></select></label>
          <label><span class="field-label">第一個號碼</span><input id="start-number" class="setting-input" type="number" min="1" value="1" /></label>
        </div>
        <div class="settings-grid">
          <label><span class="field-label">從第幾頁開始</span><input id="from-page" class="setting-input" type="number" min="1" value="1" /></label>
          <label><span class="field-label">到第幾頁結束</span><input id="to-page" class="setting-input" type="number" min="1" /></label>
        </div>
        <div class="settings-grid compact-settings">
          <label><span class="field-label">字體大小</span><input id="font-size" class="setting-input" type="number" min="8" max="48" value="12" /></label>
          <label><span class="field-label">顏色</span><input id="font-color" class="setting-input color-input" type="color" value="#15233c" /></label>
        </div>
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">加入頁碼並下載</button>
      </div>
    </section>`
  });
}

export function bindPdfPageNumbers() {
  const dropZone = document.querySelector('#drop-zone'); const controls = document.querySelector('#tool-controls'); const status = document.querySelector('#status');
  let selectedFile = null; let pageCount = 0;
  async function selectFiles(files) {
    const file = files.find((item) => item.type === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf')); if (!file) return;
    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false }); selectedFile = file; pageCount = pdf.getPageCount();
      document.querySelector('#selected-name').textContent = file.name; document.querySelector('#selected-meta').textContent = `${pageCount} 頁 · ${formatBytes(file.size)}`;
      document.querySelector('#to-page').value = pageCount; document.querySelector('#to-page').max = pageCount; document.querySelector('#from-page').max = pageCount;
      dropZone.hidden = true; controls.hidden = false; status.textContent = '';
    } catch { dropZone.querySelector('.drop-hint').textContent = '這份 PDF 無法讀取，請更換檔案。'; }
  }
  bindFilePicker(selectFiles); document.querySelector('#replace-file').addEventListener('click', () => document.querySelector('#file-input').click());
  document.querySelector('#action-button').addEventListener('click', async (event) => {
    const fromPage = Number(document.querySelector('#from-page').value); const toPage = Number(document.querySelector('#to-page').value);
    if (fromPage < 1 || toPage > pageCount || fromPage > toPage) { status.className = 'status error'; status.textContent = `請輸入 1 到 ${pageCount} 之間的有效範圍。`; return; }
    const button = event.currentTarget; button.disabled = true; status.className = 'status working'; status.textContent = '正在加入頁碼…';
    try {
      const result = await addPageNumbers(selectedFile, { position: document.querySelector('#number-position').value, startAt: Number(document.querySelector('#start-number').value), fromPage, toPage, fontSize: Number(document.querySelector('#font-size').value), color: document.querySelector('#font-color').value });
      downloadBlob(new Blob([result.bytes], { type: 'application/pdf' }), `${safeBaseName(selectedFile.name)}-頁碼.pdf`); status.className = 'status success'; status.textContent = `完成！已為第 ${fromPage} 至 ${toPage} 頁加入頁碼。`;
    } catch (error) { console.error(error); status.className = 'status error'; status.textContent = '加入頁碼失敗，請更換 PDF 後再試一次。'; } finally { button.disabled = false; }
  });
}
