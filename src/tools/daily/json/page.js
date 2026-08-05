import { setToolStep, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob } from '../../../utils/download.js';
import { sortJson } from '../../../utils/text.js';

export function jsonFormatterTemplate() {
  return toolPageTemplate({ category: '日常工具', categoryPath: '/category/daily', eyebrow: 'DATA TOOL', title: 'JSON 格式化', iconName: 'json', description: '格式化、壓縮、排序並驗證 JSON，錯誤位置會直接提示。', steps: ['貼上 JSON', '格式化與驗證', '複製或下載'], content: `<section class="workspace text-workspace"><div class="tool-controls"><label class="field-label" for="json-input">JSON 內容</label><textarea id="json-input" class="large-textarea code-textarea" spellcheck="false" placeholder='例如：{"name":"Toolbox","tools":23}'></textarea><div class="settings-grid compact-settings"><label><span class="field-label">縮排</span><select id="json-indent" class="setting-input"><option value="2">2 個空白</option><option value="4">4 個空白</option><option value="0">壓縮成一行</option></select></label><label class="check-label json-sort"><input id="sort-keys" type="checkbox" />依鍵名排序</label></div><div id="status" class="status" role="status" aria-live="polite"></div><div class="action-pair"><button id="format-button" class="primary-button" type="button">格式化並驗證</button><button id="copy-button" class="secondary-action" type="button">複製</button><button id="download-button" class="secondary-action" type="button">下載 JSON</button></div></div></section>` });
}

export function bindJsonFormatter() {
  const input = document.querySelector('#json-input'); const status = document.querySelector('#status');
  input.addEventListener('input', () => { status.textContent = ''; setToolStep(input.value.trim() ? 2 : 1); });
  function format() { try { let value = JSON.parse(input.value); if (document.querySelector('#sort-keys').checked) value = sortJson(value); const indent = Number(document.querySelector('#json-indent').value); input.value = JSON.stringify(value, null, indent || undefined); status.className = 'status success'; status.textContent = `JSON 格式正確 · ${Array.isArray(value) ? `${value.length} 筆資料` : `${Object.keys(value ?? {}).length} 個頂層欄位`}`; setToolStep(3); return true; } catch (error) { status.className = 'status error'; status.textContent = `JSON 格式錯誤：${error.message}`; return false; } }
  document.querySelector('#format-button').addEventListener('click', format);
  document.querySelector('#copy-button').addEventListener('click', async () => { if (!format()) return; await navigator.clipboard.writeText(input.value); status.textContent = 'JSON 格式正確，並已複製。'; });
  document.querySelector('#download-button').addEventListener('click', () => { if (!format()) return; downloadBlob(new Blob([input.value], { type: 'application/json;charset=utf-8' }), 'formatted.json'); status.textContent = 'JSON 格式正確，檔案已下載。'; });
}
