import { bindFilePicker, filePickerTemplate, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob, formatBytes, safeBaseName } from '../../../utils/download.js';
import { unlockPdf } from './unlockPdf.js';

export function pdfUnlockTemplate() {
  return toolPageTemplate({
    category: 'PDF 工具', categoryPath: '/category/pdf', eyebrow: 'PDF SECURITY', title: '移除 PDF 密碼', iconName: 'unlock',
    description: '輸入目前密碼，產生一份不需要密碼即可開啟的新 PDF。',
    content: `<section class="workspace tool-workspace unlock-workspace">
      ${filePickerTemplate({ accept: 'application/pdf,.pdf', title: '選擇受密碼保護的 PDF', hint: '或將 PDF 拖放到這裡' })}
      <div id="tool-controls" class="tool-controls" hidden>
        <div class="selected-file"><span class="pdf-icon">PDF</span><div><strong id="selected-name"></strong><small id="selected-meta"></small></div><button id="replace-file" class="text-button" type="button">更換檔案</button></div>
        <label class="field-label" for="pdf-password">目前的 PDF 密碼</label>
        <div class="password-field"><input id="pdf-password" class="setting-input" type="password" autocomplete="current-password" placeholder="輸入開啟這份 PDF 的密碼" /><button id="toggle-password" class="secondary-action" type="button">顯示</button></div>
        <div class="unlock-notice"><strong>處理方式說明</strong><p>檔案只在瀏覽器本機解密。輸出會重建成圖片型 PDF，因此可搜尋文字、連結與互動表單不會保留。</p></div>
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <button id="action-button" class="primary-button" type="button">移除密碼並下載 PDF</button>
      </div>
    </section>`
  });
}

export function bindPdfUnlock() {
  const controls = document.querySelector('#tool-controls');
  const dropZone = document.querySelector('#drop-zone');
  const status = document.querySelector('#status');
  const action = document.querySelector('#action-button');
  const passwordInput = document.querySelector('#pdf-password');
  let selectedFile = null;

  function selectFiles(files) {
    const file = files.find((item) => item.type === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf'));
    if (!file) return;
    selectedFile = file;
    document.querySelector('#selected-name').textContent = file.name;
    document.querySelector('#selected-meta').textContent = formatBytes(file.size);
    dropZone.hidden = true;
    controls.hidden = false;
    status.textContent = '';
    passwordInput.focus();
  }

  bindFilePicker(selectFiles);
  document.querySelector('#replace-file').addEventListener('click', () => document.querySelector('#file-input').click());
  document.querySelector('#toggle-password').addEventListener('click', (event) => {
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    event.currentTarget.textContent = showing ? '顯示' : '隱藏';
  });
  action.addEventListener('click', async () => {
    if (!passwordInput.value) {
      status.className = 'status error';
      status.textContent = '請輸入目前的 PDF 密碼。';
      return;
    }
    action.disabled = true;
    status.className = 'status working';
    status.textContent = '正在驗證密碼…';
    try {
      const result = await unlockPdf(selectedFile, passwordInput.value, (current, total) => {
        status.textContent = `正在重建第 ${current} / ${total} 頁…`;
      });
      downloadBlob(new Blob([result.bytes], { type: 'application/pdf' }), `${safeBaseName(selectedFile.name)}-已解鎖.pdf`);
      passwordInput.value = '';
      status.className = 'status success';
      status.textContent = `完成！已建立 ${result.pageCount} 頁未加密 PDF。`;
    } catch (error) {
      console.error(error);
      status.className = 'status error';
      status.textContent = error?.name === 'PasswordException' ? '密碼不正確，請重新輸入。' : '無法移除密碼，請確認檔案能正常開啟。';
    } finally {
      action.disabled = false;
    }
  });
}
