// 使用導覽：第一次進入首頁自動跳出，一步一步把畫面上的區塊框起來說明（像第一次用新網頁時的新手教學）。
// 畫面變暗，只留目前說明的區塊亮著；亮框和說明卡會滑到下一個位置。
// steps: [{ target: '選擇器'（沒有＝畫面正中間的歡迎卡）, title, text, place: 'right'|'left'|'bottom'|'top' }]
import { esc, el } from '../util.js';

const PAD = 10;   // 亮框比區塊大一圈
const GAP = 18;   // 說明卡和亮框的距離

export function startTour(allSteps) {
  // 畫面上沒有的區塊（例如還沒有報告）就跳過
  const steps = allSteps.filter((s) => !s.target || document.querySelector(s.target));
  if (!steps.length) return Promise.resolve();
  return new Promise((resolve) => {
    const layer = el(`
      <div class="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <div class="tour__hole"></div>
        <div class="tour__card">
          <div class="tour__top"><span class="eyebrow">GUIDE</span><span class="tour__count"></span></div>
          <h2 class="tour__title" id="tour-title"></h2>
          <p class="tour__text"></p>
          <div class="tour__dots"></div>
          <div class="tour__actions">
            <button class="tour__skip" data-act="skip">略過導覽</button>
            <span class="tour__grow"></span>
            <button class="btn" data-act="prev">上一步</button>
            <button class="btn btn--primary" data-act="next">下一步</button>
          </div>
        </div>
      </div>`);
    const hole = layer.querySelector('.tour__hole');
    const card = layer.querySelector('.tour__card');
    const $ = (s) => layer.querySelector(s);
    let i = 0;

    function place() {
      const s = steps[i];
      const target = s.target && document.querySelector(s.target);
      const vw = layer.clientWidth, vh = layer.clientHeight;   // 蓋版的大小＝畫面大小（和頁面同一套單位）
      card.classList.toggle('is-center', !target);
      if (!target) {
        hole.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0;outline:none;`;
        card.style.left = `${(vw - card.offsetWidth) / 2}px`;
        card.style.top = `${(vh - card.offsetHeight) / 2}px`;
        return;
      }
      const r = target.getBoundingClientRect();
      const box = { x: r.left / zoomFix() - PAD, y: r.top / zoomFix() - PAD, w: r.width / zoomFix() + PAD * 2, h: r.height / zoomFix() + PAD * 2 };
      hole.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;`;
      const cw = card.offsetWidth, ch = card.offsetHeight;
      let x, y;
      const side = box.h > ch ? box.y + 40 : box.y + box.h / 2 - ch / 2;   // 放旁邊時：高的區塊對齊上面，矮的對齊中間
      const midX = box.x + box.w / 2 - cw / 2;
      const spots = {
        right: [box.x + box.w + GAP, side, box.x + box.w + GAP + cw <= vw - 16],
        left: [box.x - cw - GAP, side, box.x - GAP - cw >= 16],
        top: [midX, box.y - ch - GAP, box.y - GAP - ch >= 16],
        bottom: [midX, box.y + box.h + GAP, box.y + box.h + GAP + ch <= vh - 16]
      };
      const opposite = { right: 'left', left: 'right', top: 'bottom', bottom: 'top' };
      // 先試指定的位置，放不下就換對面、再換其他邊；都放不下（區塊太大）就疊在區塊裡的右下角
      const order = [s.place ?? 'bottom', opposite[s.place ?? 'bottom'], 'bottom', 'top', 'right', 'left'];
      const ok = order.find((k) => spots[k][2]);
      if (ok) [x, y] = spots[ok];
      else { x = box.x + box.w - cw - 24; y = Math.min(box.y + box.h, vh) - ch - 24; }
      // 不要超出畫面
      x = Math.max(16, Math.min(x, vw - cw - 16));
      y = Math.max(16, Math.min(y, vh - ch - 16));
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
    }
    // 整頁縮小（fit.js 的 zoom）時，getBoundingClientRect 量到的可能是縮小後的數字（各瀏覽器不同）：
    // 用一個已知 100px 寬的東西量一次，換算回頁面上的單位
    let fixCache = null;
    function zoomFix() {
      if (fixCache !== null) return fixCache;
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:0;top:0;width:100px;height:1px;visibility:hidden';
      document.body.appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      fixCache = w / 100 || 1;
      return fixCache;
    }

    function show() {
      const s = steps[i];
      const last = i === steps.length - 1;
      $('.tour__count').textContent = s.target ? `${steps.filter((x) => x.target).indexOf(s) + 1} / ${steps.filter((x) => x.target).length}` : '';
      $('.tour__title').textContent = s.title;
      $('.tour__text').innerHTML = esc(s.text);
      $('.tour__dots').innerHTML = steps.map((_, k) => `<i class="${k === i ? 'is-on' : ''}"></i>`).join('');
      $('[data-act="prev"]').classList.toggle('is-hidden', i === 0);
      $('[data-act="next"]').textContent = i === 0 && !s.target ? '開始導覽' : last ? (s.done ?? '開始使用') : '下一步';
      $('[data-act="skip"]').classList.toggle('is-hidden', last);
      card.classList.remove('is-in');
      void card.offsetWidth;          // 重新觸發淡入
      card.classList.add('is-in');
      layer.classList.remove('is-follow');   // 換步驟：恢復滑動動畫
      const t = s.target && document.querySelector(s.target);
      if (t) t.scrollIntoView({ block: 'nearest' });
      place();
      $('[data-act="next"]').focus();
    }

    const finish = () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKey);
      layer.classList.add('is-out');
      setTimeout(() => { layer.remove(); resolve(); }, 220);
    };
    const go = (d) => { i = Math.max(0, Math.min(steps.length - 1, i + d)); show(); };
    // 捲動、改視窗大小時：亮框和說明卡要立刻貼著區塊，不要有滑動的動畫（才不會延遲跟上）
    const onResize = () => { fixCache = null; layer.classList.add('is-follow'); place(); };
    const onScroll = () => { layer.classList.add('is-follow'); place(); };
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') (i === steps.length - 1 ? finish() : go(1));
      else if (e.key === 'ArrowLeft') go(-1);
    };

    layer.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'skip') finish();
      else if (act === 'prev') go(-1);
      else if (act === 'next') (i === steps.length - 1 ? finish() : go(1));
    });
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);   // 頁面捲動時亮框跟著走
    document.addEventListener('keydown', onKey);
    document.body.appendChild(layer);
    show();
  });
}

/**
 * 練唱、報告、紀錄頁：標題列右邊的「使用導覽」（不自動播放，按了才開始）。
 * 頁面會重畫，所以按鈕用 TOUR_BUTTON 這段 HTML 放進標題列，點擊在 document 上統一接。
 */
export const TOUR_BUTTON = '<button class="link-arrow tour-again tour-again--inline" data-tour>使用導覽</button>';
export function bindTourButton(steps) {
  document.addEventListener('click', (e) => { if (e.target.closest('[data-tour]')) startTour(steps); });
}
