import { PDFDocument } from 'pdf-lib';
import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { rotatePdf } from './rotatePdf.js';

export function pdfRotateTemplate() {
  return toolPageTemplate({
    category: 'PDF 工具', categoryPath: '/category/pdf', eyebrow: 'PDF TOOL', title: '旋轉 PDF', iconName: 'rotate',
    description: '旋轉全部或指定頁面，修正掃描文件的閱讀方向。',
    content: `<section class="workspace tool-workspace">
      ${filePickerTemplate({ accept: 'application/pdf,.pdf', title: '拖放一個 PDF 到這裡', hint: '選取後可設定頁碼與旋轉方向' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="selected-file"><span class="pdf-icon">PDF</span><div><strong id="selected-name"></strong><small id="selected-meta"></small></div><button id="replace-file" class="text-button" type="button">更換檔案</button></div>
        <div class="settings-grid">
          <label><span class="field-label">頁碼（留白代表全部）</span><input id="page-selection" class="setting-input" type="text" placeholder="例如：1-3, 5" /></label>
          <label><span class="field-label">旋轉角度</span><select id="rotation-angle" class="setting-input"><option value="90">順時針 90°</option><option value="180">旋轉 180°</option><option value="270">逆時針 90°</option></select></label>
        </div>
        <div class="quick-options" aria-label="快速選擇"><span>套用頁面：</span><button type="button" data-preset="all">全部</button><button type="button" data-preset="odd">奇數頁</button><button type="button" data-preset="even">偶數頁</button></div>
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">旋轉並下載 PDF</button>
      </div>
    </section>`
  });
}

export function bindPdfRotate() {
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
    document.querySelector('#page-selection').value = preset === 'all' ? '' : Array.from({ length: pageCount }, (_, index) => index + 1).filter((number) => preset === 'odd' ? number % 2 : number % 2 === 0).join(', ');
  });
  action.addEventListener('click', async () => {
    action.disabled = true;
    status.className = 'status working';
    status.textContent = '正在旋轉頁面…';
    try {
      const result = await rotatePdf(selectedFile, document.querySelector('#page-selection').value, document.querySelector('#rotation-angle').value);
      downloadBlob(new Blob([result.bytes], { type: 'application/pdf' }), `${safeBaseName(selectedFile.name)}-旋轉.pdf`);
      status.className = 'status success';
      status.textContent = `完成！已旋轉 ${result.rotatedPages} 頁。`;
    } catch (error) {
      status.className = 'status error';
      status.textContent = error.message;
    } finally {
      action.disabled = false;
    }
  });
}
