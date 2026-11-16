// 共用彈窗：英文小標＋標題＋內容。兩顆鈕靠右；只有一顆鈕時置中。
// tone: 'main'（主要鈕芥末黃）或 'danger'（刪除、放棄這類，主要鈕黑色）
import { esc, el } from '../util.js';

export function openDialog({ eyebrow, heading, item = '', body = '', bodyHTML = '', secondary = '', primary = '我知道了', tone = 'main' }) {
  return new Promise((resolve) => {
    const content = bodyHTML || `
      <div class="dialog__body">
        ${item ? `<b class="dialog__item">${esc(item)}</b>` : ''}
        <span class="dialog__text">${esc(body)}</span>
      </div>`;
    const actions = secondary
      ? `<div class="dialog__actions">
           <button class="btn" data-act="secondary">${esc(secondary)}</button>
           <button class="btn ${tone === 'danger' ? 'btn--dark' : 'btn--primary'}" data-act="primary">${esc(primary)}</button>
         </div>`
      : `<div class="dialog__actions dialog__actions--single">
           <button class="btn btn--primary" data-act="primary">${esc(primary)}</button>
         </div>`;
    const scrim = el(`
      <div class="scrim">
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
          <div class="eyebrow">${esc(eyebrow)}</div>
          <h2 class="dialog__title" id="dlg-title">${esc(heading)}</h2>
          ${content}
          ${actions}
        </div>
      </div>`);
    const close = (result) => {
      document.removeEventListener('keydown', onKey);
      scrim.remove();
      resolve(result);
    };
    const onKey = (e) => { if (e.key === 'Escape' && secondary) close('secondary'); };
    scrim.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act) close(act);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(scrim);
    scrim.querySelector('[data-act="primary"]').focus();
  });
}
