// 共用導覽列
import { esc } from '../util.js';
import { showToast } from './toast.js';

const ITEMS = [
  { key: 'home', label: '首頁', href: 'home.html' },
  { key: 'practice', label: '練唱', href: 'practice.html' },
  { key: 'report', label: '報告', href: 'report.html' },
  { key: 'records', label: '紀錄', href: 'records.html' }
];

export function renderNav(mount, { active = 'home', initial = '' } = {}) {
  mount.outerHTML = `
    <nav class="nav" aria-label="主要導覽">
      <div class="nav__logo">LOGO</div>
      <div class="nav__name">A-ISING</div>
      <div class="nav__tag">個人練唱</div>
      <div class="nav__list">
        ${ITEMS.map((it) => `
          <a class="nav__item ${it.key === active ? 'is-active' : ''}" href="${it.href ?? '#'}" data-soon="${it.href ? '' : '1'}"
             ${it.key === active ? 'aria-current="page"' : ''}>${esc(it.label)}</a>`).join('')}
      </div>
      <div class="nav__foot">
        <div class="nav__avatar" aria-hidden="true">${esc(initial)}</div>
        <a class="nav__logout" href="index.html" data-act="logout">登出</a>
      </div>
    </nav>`;
  document.querySelector('.nav').addEventListener('click', (e) => {
    const a = e.target.closest('[data-soon="1"]');
    if (a) {
      e.preventDefault();
      showToast('這一頁下一階段再做');
    }
  });
}
