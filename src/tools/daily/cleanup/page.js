import { setToolStep, toolPageTemplate } from '../../../components/toolLayout.js';
import { downloadBlob } from '../../../utils/download.js';
import { cleanText } from '../../../utils/text.js';

export function textCleanupTemplate() {
  return toolPageTemplate({ category: '日常工具', categoryPath: '/category/daily', eyebrow: 'TEXT TOOL', title: '文字清理', iconName: 'cleanup', description: '快速清除多餘空白、空行與重複行，整理複製來的文字。', steps: ['貼上文字', '選擇清理項目', '複製或下載'], content: `<section class="workspace text-workspace"><div class="tool-controls"><div class="cleanup-columns"><label><span class="field-label">原始文字</span><textarea id="source-text" class="large-textarea" placeholder="貼上需要整理的文字…"></textarea></label><label><span class="field-label">清理結果</span><textarea id="result-text" class="large-textarea" readonly placeholder="結果會即時顯示在這裡"></textarea></label></div><div class="option-grid"><label class="check-label"><input id="trim-lines" type="checkbox" checked />移除行首尾空白</label><label class="check-label"><input id="collapse-spaces" type="checkbox" checked />合併連續空白</label><label class="check-label"><input id="remove-blank-lines" type="checkbox" />移除空白行</label><label class="check-label"><input id="remove-duplicate-lines" type="checkbox" />移除重複行</label></div><p id="cleanup-summary" class="choice-summary">等待輸入文字</p><div id="status" class="status" role="status"></div><div class="action-pair"><button id="copy-button" class="primary-button" type="button">複製清理結果</button><button id="download-button" class="secondary-action" type="button">下載 TXT</button></div></div></section>` });
}

export function bindTextCleanup() {
  const source = document.querySelector('#source-text'); const result = document.querySelector('#result-text'); const status = document.querySelector('#status');
  function update() { result.value = cleanText(source.value, { trimLines: document.querySelector('#trim-lines').checked, collapseSpaces: document.querySelector('#collapse-spaces').checked, removeBlankLines: document.querySelector('#remove-blank-lines').checked, removeDuplicateLines: document.querySelector('#remove-duplicate-lines').checked }); document.querySelector('#cleanup-summary').textContent = source.value ? `由 ${source.value.length.toLocaleString()} 個字元整理為 ${result.value.length.toLocaleString()} 個字元` : '等待輸入文字'; setToolStep(source.value ? 2 : 1); }
  source.addEventListener('input', update); document.querySelectorAll('.option-grid input').forEach((input) => input.addEventListener('change', update)); update();
  document.querySelector('#copy-button').addEventListener('click', async () => { await navigator.clipboard.writeText(result.value); status.className = 'status success'; status.textContent = '清理結果已複製。'; setToolStep(3); });
  document.querySelector('#download-button').addEventListener('click', () => { downloadBlob(new Blob([result.value], { type: 'text/plain;charset=utf-8' }), '清理後文字.txt'); status.className = 'status success'; status.textContent = 'TXT 已下載。'; setToolStep(3); });
}
