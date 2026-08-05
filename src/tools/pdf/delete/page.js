import { PDFDocument } from 'pdf-lib';
import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { deletePdfPages } from './deletePages.js';

export function pdfDeleteTemplate() {
  return toolPageTemplate({
    category: 'PDF 工具', categoryPath: '/category/pdf', eyebrow: 'PDF TOOL', title: '刪除 PDF 頁面', iconName: 'delete',
    description: '移除不需要的頁面，下載保留其餘內容的新 PDF。',
    content: `<section class="workspace tool-workspace">
      ${filePickerTemplate({ accept: 'application/pdf,.pdf', title: '拖放一個 PDF 到這裡', hint: '選取後輸入要刪除的頁碼' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="selected-file"><span class="pdf-icon">PDF</span><div><strong id="selected-name"></strong><small id="selected-meta"></small></div><button id="replace-file" class="text-button" type="button">更換檔案</button></div>
        <label class="field-label" for="page-selection">要刪除的頁面</label>
        <input id="page-selection" class="setting-input" type="text" placeholder="例如：2, 4-6" autocomplete="off" />
        <div class="quick-options" aria-label="快速選擇"><span>快速選擇：</span><button type="button" data-preset="first">第一頁</button><button type="button" data-preset="last">最後一頁</button><button type="button" data-preset="even">偶數頁</button></div>
        <p class="field-help">可使用逗號分隔頁碼，連續頁面請使用半形減號。</p>
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">刪除並下載 PDF</button>
      </div>
    </section>`
  });
}

export function bindPdfDelete() {
  const controls = document.querySelector('#tool-controls');
  const dropZone = document.querySelector('#drop-zone');
  const status = document.querySelector('#status');
  const action = document.querySelector('#action-button');
  let selectedFile = null;
  let pageCount = 0;

  async function selectFiles(files) {
    const file = files.find((item) => item.type === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf'));
    if (!file) return;
    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
      selectedFile = file;
      pageCount = pdf.getPageCount();
      document.querySelector('#selected-name').textContent = file.name;
      document.querySelector('#selected-meta').textContent = `${pdf.getPageCount()} 頁 · ${formatBytes(file.size)}`;
      dropZone.hidden = true;
      controls.hidden = false;
      status.textContent = '';
    } catch {
      dropZone.querySelector('.drop-hint').textContent = '無法讀取這份 PDF，請選擇其他檔案。';
    }
  }

  bindFilePicker(selectFiles);
  document.querySelector('#replace-file').addEventListener('click', () => document.querySelector('#file-input').click());
  document.querySelector('.quick-options').addEventListener('click', (event) => {
    const preset = event.target.dataset.preset; if (!preset) return;
    document.querySelector('#page-selection').value = preset === 'first' ? '1' : preset === 'last' ? String(pageCount) : Array.from({ length: pageCount }, (_, index) => index + 1).filter((number) => number % 2 === 0).join(', ');
  });
  action.addEventListener('click', async () => {
    action.disabled = true;
    status.className = 'status working';
    status.textContent = '正在移除頁面…';
    try {
      const result = await deletePdfPages(selectedFile, document.querySelector('#page-selection').value);
      downloadBlob(new Blob([result.bytes], { type: 'application/pdf' }), `${safeBaseName(selectedFile.name)}-刪除頁面.pdf`);
      status.className = 'status success';
      status.textContent = `完成！已刪除 ${result.deletedPages} 頁，保留 ${result.remainingPages} 頁。`;
    } catch (error) {
      status.className = 'status error';
      status.textContent = error.message;
    } finally {
      action.disabled = false;
    }
  });
}
