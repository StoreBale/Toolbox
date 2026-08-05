import { categories } from './catalog.js';
import { icon } from './icons.js';

export function sidebarTemplate(pathname) {
  const categoryLinks = categories.map((category) => {
    const active = pathname.startsWith(`/${category.id}`) || pathname === `/category/${category.id}`;
    return `
      <a class="nav-link ${active ? 'active' : ''}" href="/category/${category.id}" data-link>
        ${icon(category.id)}<span>${category.label}</span>
      </a>`;
  }).join('');

  return `
    <div id="nav-backdrop" class="nav-backdrop"></div>
    <aside id="sidebar" class="sidebar">
      <a class="site-brand" href="/" data-link aria-label="工具箱首頁">
        <span class="brand-symbol"><img src="/logo.svg" alt="" /></span>
        <span><strong>Toolbox</strong><small>實用工具箱</small></span>
      </a>
      <nav aria-label="主要導覽">
        <p class="nav-label">瀏覽工具</p>
        <a class="nav-link ${pathname === '/' ? 'active' : ''}" href="/" data-link>${icon('home')}<span>所有工具</span></a>
        ${categoryLinks}
      </nav>
      <div class="sidebar-note">
        ${icon('shield')}
        <p><strong>隱私優先</strong><span>檔案只在瀏覽器本機處理</span></p>
      </div>
    </aside>`;
}

export function bindSidebar() {
  const sidebar = document.querySelector('#sidebar');
  const backdrop = document.querySelector('#nav-backdrop');
  const menuButton = document.querySelector('#menu-button');

  const close = () => document.body.classList.remove('nav-open');
  menuButton?.addEventListener('click', () => document.body.classList.toggle('nav-open'));
  backdrop?.addEventListener('click', close);
  sidebar?.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
}
