// 「展示情境」面板：左下角小按鈕。
// 正常流程永遠正常；異常情境只在這裡點了之後，用蓋版動畫展示，按「結束展示」回原畫面、不影響進度。
import { esc, el } from '../util.js';

/**
 * groups: [{ title, items: [{ where, what, run(stage) }] }]
 */
export function initDemoPanel({ groups }) {
  const toggle = el(`<button class="demo-toggle" aria-expanded="false">展示情境</button>`);
  const panel = el(`
    <div class="demo-panel is-hidden" role="menu">
      <div class="demo-panel__head"><span class="demo-panel__title">展示情境</span><button class="alert__close" style="position:static" data-act="close" aria-label="關閉">✕</button></div>
      ${groups.map((g, gi) => `
        <div class="demo-panel__group">${esc(g.title)}</div>
        ${g.items.map((it, ii) => `
          <button class="demo-panel__item" role="menuitem" data-g="${gi}" data-i="${ii}">
            <span class="where">${esc(it.where)}</span><span class="arrow">→</span><span>${esc(it.what)}</span>
          </button>`).join('')}`).join('')}
    </div>`);
  document.body.append(panel, toggle);

  const setOpen = (open) => {
    panel.classList.toggle('is-hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(panel.classList.contains('is-hidden')));
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'close') return setOpen(false);
    const item = groups[b.dataset.g]?.items[b.dataset.i];
    if (item) {
      setOpen(false);
      openStage(item);
    }
  });
}

let closeCurrent = null;
function closeStage() { closeCurrent?.(); }

/** 蓋版舞台：上方顯示正在展示什麼，「結束展示」關閉。一次只開一個，點新的會先關掉舊的。 */
function openStage(item) {
  closeStage();
  const stage = el(`
    <div class="stage" role="dialog" aria-modal="true" aria-label="展示情境">
      <div class="stage__bar">
        <span class="stage__tag">展示中</span>
        <span class="stage__label"><b>${esc(item.where)}</b>→ ${esc(item.what)}</span>
        <button class="btn btn--dark" data-act="end">結束展示</button>
      </div>
      <div class="stage__body"></div>
    </div>`);
  document.body.appendChild(stage);
  const cleanups = [];
  const api = { body: stage.querySelector('.stage__body'), onEnd: (fn) => cleanups.push(fn) };
  const end = () => {
    cleanups.forEach((fn) => fn());
    stage.remove();
    document.removeEventListener('keydown', onKey);
    if (closeCurrent === end) closeCurrent = null;
  };
  closeCurrent = end;
  const onKey = (e) => { if (e.key === 'Escape') end(); };
  stage.querySelector('[data-act="end"]').addEventListener('click', end);
  document.addEventListener('keydown', onKey);
  item.run(api);
}
