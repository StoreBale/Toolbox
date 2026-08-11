import { setToolStep, toolPageTemplate } from '../../../components/toolLayout.js';
import { analyzeText } from '../../../utils/text.js';

export function textCounterTemplate() {
  return toolPageTemplate({ category: '日常工具', categoryPath: '/category/daily', eyebrow: 'TEXT TOOL', title: '字數統計', iconName: 'counter', description: '即時統計中英文字數、行數、段落與預估閱讀時間。', steps: ['輸入文字', '查看統計', '複製結果'], content: `<section class="workspace text-workspace"><div class="tool-controls"><label class="field-label" for="text-input">輸入或貼上文字</label><textarea id="text-input" class="large-textarea" placeholder="在這裡輸入文字…"></textarea><div class="stat-grid"><article><strong id="stat-characters">0</strong><span>不含空白字元</span></article><article><strong id="stat-words">0</strong><span>中英文字數</span></article><article><strong id="stat-lines">0</strong><span>行數</span></article><article><strong id="stat-paragraphs">0</strong><span>段落</span></article><article><strong id="stat-reading">0</strong><span>閱讀分鐘</span></article><article><strong id="stat-spaces">0</strong><span>包含空白字元</span></article></div><div id="status" class="status" role="status"></div><button id="action-button" class="primary-button" type="button">複製統計摘要</button></div></section>` });
}

export function bindTextCounter() {
  const input = document.querySelector('#text-input'); const status = document.querySelector('#status'); let result = analyzeText('');
  function update() { result = analyzeText(input.value); for (const [key, value] of Object.entries({ characters: result.characters, words: result.words, lines: result.lines, paragraphs: result.paragraphs, reading: result.readingMinutes, spaces: result.charactersWithSpaces })) document.querySelector(`#stat-${key}`).textContent = value.toLocaleString(); setToolStep(input.value ? 2 : 1); }
  input.addEventListener('input', update); update();
  document.querySelector('#action-button').addEventListener('click', async () => { const summary = `字元（不含空白）：${result.characters}\n中英文字數：${result.words}\n行數：${result.lines}\n段落：${result.paragraphs}\n預估閱讀：${result.readingMinutes} 分鐘`; await navigator.clipboard.writeText(summary); status.className = 'status success'; status.textContent = '統計摘要已複製。'; setToolStep(3); });
}
