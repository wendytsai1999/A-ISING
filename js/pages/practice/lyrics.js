// 練唱頁的歌詞區：前兩句、目前這句（逐字＋音高線＋音名）、下一句。
// 目前這句：每個字下面一條灰色的正確音高；有錄到的字，上面疊綠色（準）或紅色（不準）的使用者音高。
import { esc } from '../../util.js';
import { toName } from '../../music.js';
import { lineAt } from '../../practice/song.js';
import { charStat, lookOf } from '../../practice/fake-user.js';

export class Lyrics {
  constructor(box, { song, singer }) {
    this.box = box;
    this.lines = box.querySelector('#lyr-lines');
    this.song = song;
    this.singer = singer;
    this.li = -2;
    this.key = 0;
  }

  setKey(key) { this.key = key; this.li = -2; }

  /** t＝歌的第幾秒；cov(li, ci)＝這個字錄到幾成（0～1） */
  update(t, cov) {
    const L = this.song.lines;
    // 前奏、還沒開始時也直接顯示第一句和它的灰色音高線（音高線開著就一直都在）
    const li = lineAt(this.song, t);
    if (li !== this.li) this.render(li);
    if (li < 0) return;
    const line = L[li];
    this.cur.classList.toggle('is-gap', t < line.start);
    this.cols.forEach((col, ci) => {
      const c = line.chars[ci];
      col.el.classList.toggle('is-past', t >= c.end);
      col.el.classList.toggle('is-now', t >= c.start && t < c.end);
      const k = Math.min(1, cov(li, ci));
      if (k <= 0.02) { col.user.style.width = '0'; return; }
      const s = charStat(this.singer, this.song, li, ci, k);
      if (s.unclear) { col.user.style.width = '0'; return; } // 聽不清楚：抓不到音高，不畫
      col.user.style.width = `${Math.round(k * col.w)}px`;
      col.user.style.top = `${col.y(c.midi + this.key + s.mean)}px`;
      col.user.classList.toggle('is-off', !s.ok);
      // 不穩：波浪線；沒氣：越後面越淡、斷斷續續（和報告頁同一套畫法）
      const look = lookOf(this.singer, this.song, li, ci);
      col.user.classList.toggle('is-shaky', look.shaky);
      col.user.classList.toggle('is-weak', look.weak > 0);
      col.user.style.opacity = look.weak ? (1 - 0.6 * look.weak).toFixed(2) : '';
    });
  }

  render(li) {
    this.li = li;
    const L = this.song.lines;
    // 有歌詞的句子帶 data-li，點了就跳到那句（practice.js 處理）
    const txt = (i, cls) => (i >= 0 && i < L.length
      ? `<div class="lyr__line lyr__line--${cls}" data-li="${i}">${esc(L[i].text)}</div>`
      : `<div class="lyr__line lyr__line--${cls}"></div>`);
    if (li < 0) {
      this.lines.innerHTML = `${txt(-1, 'p2')}${txt(-1, 'p1')}<div class="lyr__intro">（前奏）</div>${txt(0, 'n1')}${txt(1, 'n2')}`;
      this.cols = [];
      this.cur = null;
      return;
    }
    const line = L[li];
    const many = line.chars.length > 9;
    this.box.classList.toggle('many', many);
    const w = many ? 54 : 60;
    const targets = line.chars.map((c) => c.midi + this.key);
    const hi = Math.max(...targets) + 1.3, lo = Math.min(...targets) - 1.3;
    const pps = Math.min(7, 76 / (hi - lo));
    const mid = (hi + lo) / 2;
    const y = (m) => Math.max(0, Math.min(80, Math.round(40 - (m - mid) * pps)));
    this.lines.innerHTML = `
      ${txt(li - 2, 'p2')}${txt(li - 1, 'p1')}
      <div class="cur" data-li="${li}">${line.chars.map((c, ci) => `
        <div class="cur__ch" data-ci="${ci}">
          <span class="cur__t">${esc(c.t)}</span>
          <div class="cur__pitch">
            <div class="cur__bar cur__bar--target" style="top:${y(targets[ci])}px"></div>
            <div class="cur__bar cur__bar--user"></div>
          </div>
          <span class="cur__note">${toName(targets[ci])}</span>
        </div>`).join('')}
      </div>
      ${txt(li + 1, 'n1')}`;
    this.cur = this.lines.querySelector('.cur');
    this.cols = [...this.lines.querySelectorAll('.cur__ch')].map((el) => ({ el, user: el.querySelector('.cur__bar--user'), y, w }));
  }
}
