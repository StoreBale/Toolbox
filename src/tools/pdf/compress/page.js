import { PDFDocument } from 'pdf-lib';
import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { compressPdf } from './compressPdf.js';

export function pdfCompressTemplate() {
  return toolPageTemplate({
    category: 'PDF 工具', categoryPath: '/category/pdf', eyebrow: 'PDF TOOL', title: '壓縮 PDF', iconName: 'compressPdf',
    description: '將 PDF 頁面重新最佳化，縮小掃描檔與圖片型 PDF。',
    content: `<section class="workspace tool-workspace">
      ${filePickerTemplate({ accept: 'application/pdf,.pdf', title: '拖放一個 PDF 到這裡', hint: '特別適合掃描文件與圖片型 PDF' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="selected-file"><span class="pdf-icon">PDF</span><div><strong id="selected-name"></strong><small id="selected-meta"></small></div><button id="replace-file" class="text-button" type="button">更換檔案</button></div>
        <label class="field-label" for="quality-preset">壓縮品質</label>
        <select id="quality-preset" class="setting-input">
          <option value="small">檔案較小</option><option value="balanced" selected>平衡（建議）</option><option value="quality">畫質優先</option>
        </select>
        <p class="field-help">壓縮會將頁面轉為影像；可搜尋文字、連結與表單互動將不會保留。</p>
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">壓縮並下載 PDF</button>
      </div>
    </section>`
  });
}

export function bindPdfCompress() {
  const controls = document.querySelector('#tool-controls');
  const dropZone = document.querySelector('#drop-zone');
  const status = document.querySelector('#status');
  const action = document.querySelector('#action-button');
  let selectedFile = null;

  async function selectFiles(files) {
    const file = files.find((item) => item.type === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf'));
    if (!file) return;
    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
      selectedFile = file;
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
  action.addEventListener('click', async () => {
    action.disabled = true;
    status.className = 'status working';
    try {
      const bytes = await compressPdf(selectedFile, document.querySelector('#quality-preset').value, (current, total) => {
        status.textContent = `正在處理第 ${current} / ${total} 頁…`;
      });
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${safeBaseName(selectedFile.name)}-壓縮.pdf`);
      const difference = selectedFile.size - bytes.length;
      status.className = 'status success';
      status.textContent = difference > 0 ? `完成！縮小 ${Math.round(difference / selectedFile.size * 100)}%。` : '完成！這份文件原本已很精簡，輸出可能不會更小。';
    } catch (error) {
      console.error(error);
      status.className = 'status error';
      status.textContent = '壓縮失敗，請確認 PDF 未加密且能正常開啟。';
    } finally {
      action.disabled = false;
    }
  });
}
