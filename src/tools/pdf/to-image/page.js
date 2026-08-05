import { PDFDocument } from 'pdf-lib';
import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { createZip } from '../../../utils/archive.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { convertPdfToImages } from './convertPdfToImages.js';

export function pdfToImageTemplate() {
  return toolPageTemplate({
    category: 'PDF 工具', categoryPath: '/category/pdf', eyebrow: 'PDF CONVERTER', title: 'PDF 轉 JPG', iconName: 'pdfToImage',
    description: '將每一頁 PDF 轉成清晰圖片，多頁文件會自動打包下載。',
    content: `<section class="workspace tool-workspace">
      ${filePickerTemplate({ accept: 'application/pdf,.pdf', title: '拖放一個 PDF 到這裡', hint: '每一頁都會轉成獨立圖片' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="selected-file"><span class="pdf-icon">PDF</span><div><strong id="selected-name"></strong><small id="selected-meta"></small></div><button id="replace-file" class="text-button" type="button">更換檔案</button></div>
        <div class="settings-grid">
          <label><span class="field-label">圖片格式</span><select id="output-format" class="setting-input"><option value="image/jpeg">JPG（檔案較小）</option><option value="image/png">PNG（畫質優先）</option></select></label>
          <label><span class="field-label">清晰度</span><select id="output-scale" class="setting-input"><option value="1.5">標準</option><option value="2">高清</option><option value="1">小檔案</option></select></label>
        </div>
        <p class="choice-summary" id="choice-summary"></p>
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">轉換並下載圖片</button>
      </div>
    </section>`
  });
}

export function bindPdfToImage() {
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
      document.querySelector('#selected-meta').textContent = `${pageCount} 頁 · ${formatBytes(file.size)}`;
      document.querySelector('#choice-summary').textContent = pageCount === 1 ? '將下載 1 張圖片。' : `將產生 ${pageCount} 張圖片並打包成 ZIP。`;
      dropZone.hidden = true; controls.hidden = false; status.textContent = '';
    } catch { dropZone.querySelector('.drop-hint').textContent = '這份 PDF 無法讀取，請更換檔案。'; }
  }

  bindFilePicker(selectFiles);
  document.querySelector('#replace-file').addEventListener('click', () => document.querySelector('#file-input').click());
  action.addEventListener('click', async () => {
    action.disabled = true; status.className = 'status working';
    try {
      const format = document.querySelector('#output-format').value;
      const extension = format === 'image/png' ? 'png' : 'jpg';
      const outputs = await convertPdfToImages(selectedFile, { format, scale: Number(document.querySelector('#output-scale').value) }, (current, total) => { status.textContent = `正在轉換第 ${current} / ${total} 頁…`; });
      const named = outputs.map((item) => ({ name: `${safeBaseName(selectedFile.name)}-${String(item.pageNumber).padStart(2, '0')}.${extension}`, blob: item.blob }));
      if (named.length === 1) downloadBlob(named[0].blob, named[0].name);
      else downloadBlob(await createZip(named), `${safeBaseName(selectedFile.name)}-圖片.zip`);
      status.className = 'status success'; status.textContent = `完成！已轉換 ${outputs.length} 頁。`;
    } catch (error) {
      console.error(error); status.className = 'status error'; status.textContent = '轉換失敗，請確認 PDF 沒有密碼保護。';
    } finally { action.disabled = false; }
  });
}
