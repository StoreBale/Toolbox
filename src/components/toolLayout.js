import { icon } from '../icons.js';

export function toolPageTemplate({ category, categoryPath, eyebrow, title, description, iconName, content, steps = ['選擇檔案', '調整設定', '下載結果'] }) {
  return `
    <header class="topbar">
      <button id="menu-button" class="menu-button" type="button" aria-label="開啟選單">${icon('menu')}</button>
      <a href="/" data-link class="mobile-brand"><img src="/logo.svg" alt="" />Toolbox</a>
    </header>
    <main class="main-content tool-page">
      <nav class="breadcrumbs" aria-label="麵包屑"><a href="/" data-link>所有工具</a><span>/</span><a href="${categoryPath}" data-link>${category}</a><span>/</span><span>${title}</span></nav>
      <header class="tool-hero">
        <div class="tool-heading-icon">${icon(iconName)}</div>
        <div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div>
      </header>
      <ol class="tool-steps" aria-label="操作步驟">${steps.map((label, index) => `<li class="${index === 0 ? 'active' : ''}" data-step="${index + 1}"><span>${index + 1}</span><strong>${label}</strong></li>`).join('')}</ol>
      ${content}
      <div class="privacy-line">${icon('shield')}<span>檔案與內容只在你的瀏覽器中處理，不會上傳到任何伺服器。</span></div>
    </main>`;
}

export function filePickerTemplate({ accept, multiple = false, title, hint }) {
  return `
    <div id="drop-zone" class="drop-zone compact" tabindex="0" role="button" aria-controls="file-input">
      <div class="upload-icon">${icon('upload')}</div>
      <p class="drop-title">${title}</p>
      <p class="drop-hint">${hint}</p>
      <button id="choose-button" class="secondary-button" type="button">從電腦選擇</button>
      <input id="file-input" type="file" accept="${accept}" ${multiple ? 'multiple' : ''} hidden />
    </div>`;
}

export function bindFilePicker(onFiles) {
  const dropZone = document.querySelector('#drop-zone');
  const input = document.querySelector('#file-input');
  const openPicker = () => input.click();
  document.querySelector('#choose-button').addEventListener('click', (event) => { event.stopPropagation(); openPicker(); });
  dropZone.addEventListener('click', openPicker);
  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); }
  });
  const advanceToSettings = () => setToolStep(2);
  const handleFiles = async (files) => {
    if (!files.length) return;
    await onFiles(files);
    advanceToSettings();
  };
  input.addEventListener('change', () => { handleFiles([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); }));
  dropZone.addEventListener('drop', (event) => handleFiles([...event.dataTransfer.files]));
  const status = document.querySelector('#status');
  if (status) {
    new MutationObserver(() => {
      if (!status.classList.contains('success')) return;
      setToolStep(3);
    }).observe(status, { attributes: true, childList: true, subtree: true });
  }
}

export function setToolStep(step) {
  document.querySelectorAll('.tool-steps li').forEach((item) => item.classList.toggle('active', Number(item.dataset.step) <= step));
}
