import { PDFDocument } from 'pdf-lib';
import { icon } from '../../../icons.js';
import { mergePdfBytes } from './mergePdf.js';

export function pdfMergeTemplate() {
  return `
    <header class="topbar">
      <button id="menu-button" class="menu-button" type="button" aria-label="開啟選單">${icon('menu')}</button>
      <a href="/" data-link class="mobile-brand"><img src="/logo.svg" alt="" />Toolbox</a>
    </header>
    <main class="main-content tool-page">
      <nav class="breadcrumbs" aria-label="麵包屑"><a href="/" data-link>所有工具</a><span>/</span><a href="/category/pdf" data-link>PDF 工具</a><span>/</span><span>合併 PDF</span></nav>
      <header class="tool-hero">
        <div class="tool-heading-icon">${icon('merge')}</div>
        <div><p class="eyebrow">PDF TOOL</p><h1>合併 PDF</h1><p>選取多個 PDF、安排順序，幾秒內合併成一個檔案。</p></div>
      </header>

      <section class="workspace" aria-labelledby="workspace-title">
        <h2 id="workspace-title" class="sr-only">PDF 合併工作區</h2>
        <div id="drop-zone" class="drop-zone" tabindex="0" role="button" aria-controls="file-input">
          <div class="upload-icon">${icon('pdf')}</div>
          <p class="drop-title">拖放 PDF 到這裡</p>
          <p class="drop-hint">或從裝置中選擇兩個以上的檔案</p>
          <button id="choose-button" class="secondary-button" type="button">選擇 PDF 檔案</button>
          <input id="file-input" type="file" accept="application/pdf,.pdf" multiple hidden />
        </div>
        <div id="file-panel" class="file-panel" hidden>
          <div class="panel-heading">
            <div><p class="section-label">合併順序</p><p id="file-summary" class="file-summary"></p></div>
            <button id="add-button" class="text-button" type="button">＋ 新增檔案</button>
          </div>
          <ol id="file-list" class="file-list" aria-label="待合併的 PDF 檔案"></ol>
          <div class="output-row">
            <label for="output-name">輸出檔名</label>
            <div class="filename-field"><input id="output-name" type="text" value="合併文件" maxlength="80" autocomplete="off" /><span>.pdf</span></div>
          </div>
          <div id="status" class="status" role="status" aria-live="polite"></div>
          <button id="merge-button" class="primary-button" type="button">${icon('merge')}<span>合併並下載 PDF</span></button>
        </div>
      </section>
      <div class="privacy-line">${icon('shield')}<span>檔案只在你的瀏覽器中處理，不會上傳到任何伺服器。</span></div>
    </main>`;
}

export function bindPdfMerge() {
  const dropZone = document.querySelector('#drop-zone');
  const fileInput = document.querySelector('#file-input');
  const filePanel = document.querySelector('#file-panel');
  const fileList = document.querySelector('#file-list');
  const fileSummary = document.querySelector('#file-summary');
  const outputName = document.querySelector('#output-name');
  const mergeButton = document.querySelector('#merge-button');
  const status = document.querySelector('#status');
  let selectedFiles = [];

  const formatSize = (bytes) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  const isPdf = (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const setStatus = (message = '', type = '') => { status.textContent = message; status.className = `status ${type}`.trim(); };

  async function getPageCount(file, element) {
    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
      element.textContent = `${pdf.getPageCount()} 頁 · ${formatSize(file.size)}`;
    } catch {
      element.textContent = `無法讀取 · ${formatSize(file.size)}`;
      element.classList.add('file-error');
    }
  }

  function iconButton(label, path, onClick, disabled = false) {
    const button = document.createElement('button');
    button.className = 'icon-button';
    button.type = 'button';
    button.ariaLabel = label;
    button.disabled = disabled;
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
    button.addEventListener('click', onClick);
    return button;
  }

  function renderFiles() {
    fileList.replaceChildren();
    filePanel.hidden = selectedFiles.length === 0;
    dropZone.hidden = selectedFiles.length > 0;
    fileSummary.textContent = `${selectedFiles.length} 個檔案 · ${formatSize(selectedFiles.reduce((sum, file) => sum + file.size, 0))}`;
    mergeButton.disabled = selectedFiles.length < 2;
    setStatus(selectedFiles.length === 1 ? '再加入一個 PDF 就能開始合併。' : '');

    selectedFiles.forEach((file, index) => {
      const item = document.createElement('li');
      item.className = 'file-item';
      item.innerHTML = `<span class="file-order">${index + 1}</span><span class="pdf-icon">PDF</span><div class="file-details"><p class="file-name"></p><p class="file-meta">讀取中 · ${formatSize(file.size)}</p></div>`;
      item.querySelector('.file-name').textContent = file.name;
      item.querySelector('.file-name').title = file.name;
      const actions = document.createElement('div');
      actions.className = 'file-actions';
      actions.append(
        iconButton('向上移動', 'm18 15-6-6-6 6', () => moveFile(index, -1), index === 0),
        iconButton('向下移動', 'm6 9 6 6 6-6', () => moveFile(index, 1), index === selectedFiles.length - 1),
        iconButton('移除檔案', 'M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6', () => { selectedFiles.splice(index, 1); renderFiles(); })
      );
      item.append(actions);
      fileList.append(item);
      getPageCount(file, item.querySelector('.file-meta'));
    });
  }

  function moveFile(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= selectedFiles.length) return;
    [selectedFiles[index], selectedFiles[target]] = [selectedFiles[target], selectedFiles[index]];
    renderFiles();
  }

  function addFiles(collection) {
    const files = [...collection];
    const pdfFiles = files.filter(isPdf);
    selectedFiles.push(...pdfFiles);
    renderFiles();
    if (pdfFiles.length !== files.length) setStatus('已略過非 PDF 檔案。', 'warning');
    fileInput.value = '';
  }

  const openPicker = () => fileInput.click();
  document.querySelector('#choose-button').addEventListener('click', (event) => { event.stopPropagation(); openPicker(); });
  document.querySelector('#add-button').addEventListener('click', openPicker);
  dropZone.addEventListener('click', openPicker);
  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); }
  });
  fileInput.addEventListener('change', () => addFiles(fileInput.files));
  ['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); }));
  dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));

  mergeButton.addEventListener('click', async () => {
    mergeButton.disabled = true;
    mergeButton.classList.add('loading');
    setStatus('正在合併 PDF，請稍候…', 'working');
    try {
      const mergedBytes = await mergePdfBytes(selectedFiles);
      const downloadUrl = URL.createObjectURL(new Blob([mergedBytes], { type: 'application/pdf' }));
      const link = document.createElement('a');
      const safeName = outputName.value.trim().replace(/[\\/:*?"<>|]/g, '-') || '合併文件';
      link.href = downloadUrl;
      link.download = `${safeName}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
      setStatus(`完成！已合併 ${selectedFiles.length} 個檔案。`, 'success');
    } catch (error) {
      console.error(error);
      setStatus('合併失敗。請確認檔案未加密且能正常開啟。', 'error');
    } finally {
      mergeButton.classList.remove('loading');
      mergeButton.disabled = selectedFiles.length < 2;
    }
  });

  renderFiles();
}
