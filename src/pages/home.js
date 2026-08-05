import { categories, getCategory, tools } from '../catalog.js';
import { icon } from '../icons.js';

function toolCard(tool) {
  const wrapper = tool.available ? 'a' : 'article';
  const linkAttrs = tool.available ? `href="${tool.path}" data-link` : '';
  return `
    <${wrapper} class="tool-card ${tool.available ? '' : 'planned'}" ${linkAttrs} data-search="${[tool.title, tool.description, ...tool.keywords].join(' ').toLowerCase()}">
      <div class="tool-icon ${tool.color}">${icon(tool.icon)}</div>
      <div class="tool-card-copy">
        <div class="tool-title-row"><h3>${tool.title}</h3>${tool.available ? '' : '<span class="coming-badge">規劃中</span>'}</div>
        <p>${tool.description}</p>
      </div>
      ${tool.available ? icon('arrow', 'card-arrow') : ''}
    </${wrapper}>`;
}

export function homeTemplate(categoryId = null) {
  const activeCategory = getCategory(categoryId);
  const visibleTools = activeCategory ? tools.filter((tool) => tool.category === categoryId) : tools;
  const filterChips = [
    `<a href="/" data-link class="filter-chip ${activeCategory ? '' : 'active'}">全部</a>`,
    ...categories.map((category) => `<a href="/category/${category.id}" data-link class="filter-chip ${category.id === categoryId ? 'active' : ''}">${category.shortLabel}</a>`)
  ].join('');

  return `
    <header class="topbar">
      <button id="menu-button" class="menu-button" type="button" aria-label="開啟選單">${icon('menu')}</button>
      <span class="mobile-brand"><img src="/logo.svg" alt="" />Toolbox</span>
    </header>
    <main class="main-content home-page">
      <section class="home-hero">
        <p class="eyebrow">SIMPLE · PRIVATE · USEFUL</p>
        <h1>${activeCategory ? activeCategory.label : '你的日常檔案工具箱'}</h1>
        <p>${activeCategory ? activeCategory.description : '不必安裝軟體，打開瀏覽器就能完成常見的檔案處理工作。'}</p>
        <label class="search-box">
          ${icon('search')}
          <span class="sr-only">搜尋工具</span>
          <input id="tool-search" type="search" placeholder="搜尋你需要的工具…" autocomplete="off" />
        </label>
      </section>

      <section class="tool-directory" aria-labelledby="directory-title">
        <div class="directory-heading">
          <div><p class="section-kicker">工具目錄</p><h2 id="directory-title">${activeCategory ? activeCategory.label : '探索所有工具'}</h2></div>
          <div class="filter-chips" aria-label="工具分類">${filterChips}</div>
        </div>
        <div id="tool-grid" class="tool-grid">${visibleTools.map(toolCard).join('')}</div>
        <p id="empty-search" class="empty-search" hidden>找不到符合的工具，換個關鍵字試試看。</p>
      </section>
    </main>`;
}

export function bindHome() {
  const input = document.querySelector('#tool-search');
  const cards = [...document.querySelectorAll('.tool-card')];
  const empty = document.querySelector('#empty-search');
  input?.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    let matches = 0;
    cards.forEach((card) => {
      const visible = card.dataset.search.includes(query);
      card.hidden = !visible;
      if (visible) matches += 1;
    });
    empty.hidden = matches > 0;
  });
}
