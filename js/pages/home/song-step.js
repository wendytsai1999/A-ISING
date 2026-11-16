// 03 選歌：真的可以打字，用歌名或歌手找；找不到就顯示紅框。
import { esc } from '../../util.js';

const COUNT_NOTE = '目前收錄 20 首華語歌';

function mark(text, q) {
  const i = text.indexOf(q);
  if (!q || i < 0) return esc(text);
  return `${esc(text.slice(0, i))}<b>${esc(q)}</b>${esc(text.slice(i + q.length))}`;
}

export class SongStep {
  constructor(root, ctx) {
    this.root = root;
    this.ctx = ctx;
    this.songs = ctx.songs;
    this.active = 0;
    this.open = false;
    const picked = this.song;
    this.root.innerHTML = `
      <div class="card__head"><span class="card__no">03</span><span class="card__name">選歌</span><span data-ref="pill"></span></div>
      <label class="song-label" for="song-input">想練哪一首歌？</label>
      <div class="song-field">
        <input id="song-input" class="song-input" placeholder="輸入歌名或歌手" autocomplete="off"
          role="combobox" aria-expanded="false" aria-controls="song-list"
          value="${picked ? esc(`${picked.title} － ${picked.artist}`) : ''}">
        <div data-ref="drop"></div>
      </div>
      <div data-ref="below"></div>`;
    this.input = this.root.querySelector('input');
    this.input.addEventListener('input', () => this.onInput());
    this.input.addEventListener('focus', () => { if (!this.song && this.input.value.trim()) { this.open = true; this.renderBelow(); } });
    this.input.addEventListener('blur', () => setTimeout(() => { this.open = false; this.renderBelow(); }, 120));
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.root.addEventListener('mousedown', (e) => {
      const li = e.target.closest('[data-id]');
      if (li) { e.preventDefault(); this.pick(li.dataset.id); }
    });
    this.renderBelow();
  }

  get song() {
    const id = this.ctx.getDraft().song;
    return this.songs.find((s) => s.id === id) || null;
  }

  matches() {
    const q = this.input.value.trim();
    if (!q) return [];
    return this.songs.filter((s) => s.title.includes(q) || s.artist.includes(q)).slice(0, 6);
  }

  onInput() {
    if (this.ctx.getDraft().song) this.ctx.setDraft('song', null);
    this.active = 0;
    this.open = true;
    this.renderBelow();
  }

  onKey(e) {
    const list = this.matches();
    if (!this.open || !list.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.active = (this.active + 1) % list.length; this.renderBelow(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); this.active = (this.active - 1 + list.length) % list.length; this.renderBelow(); }
    if (e.key === 'Enter') { e.preventDefault(); this.pick(list[this.active].id); }
    if (e.key === 'Escape') { this.open = false; this.renderBelow(); }
  }

  pick(id) {
    const s = this.songs.find((x) => x.id === id);
    this.input.value = `${s.title} － ${s.artist}`;
    this.open = false;
    this.ctx.setDraft('song', id);
    this.renderBelow();
  }

  renderBelow() {
    const below = this.root.querySelector('[data-ref="below"]');
    const s = this.song;
    const q = this.input.value.trim();
    this.root.querySelector('[data-ref="pill"]').outerHTML = `<span data-ref="pill" ${s ? 'class="pill"' : ''}>${s ? '完成' : ''}</span>`;
    this.root.querySelector('[data-ref="pill"]').style.marginLeft = 'auto';
    let html = '';
    let drop = '';   // 建議清單蓋在輸入框下面，不撐高卡片
    let error = false;
    if (s) {
      html = `<div class="song-pick"><span>原曲音域 <b>${s.low} － ${s.high}</b></span><span class="demo-mark">音域為估計值（示意資料）</span></div>
              <div class="song-meta">${COUNT_NOTE}</div>`;
    } else if (q && this.open) {
      const list = this.matches();
      if (list.length) {
        drop = `<ul class="song-list" id="song-list" role="listbox">${list.map((m, i) => `
          <li role="option" data-id="${m.id}" class="${i === this.active ? 'is-active' : ''}" aria-selected="${i === this.active}">
            ${mark(m.title, q)} － ${mark(m.artist, q)}</li>`).join('')}</ul>`;
        html = `<div class="song-meta">${COUNT_NOTE}</div>`;
      } else {
        error = true;
        html = `<div class="song-empty" role="status"><b>找不到「${esc(q)}」</b><span>${COUNT_NOTE}，<br>試試其他關鍵字</span></div>`;
      }
    } else if (q && !this.matches().length) {
      error = true;
      html = `<div class="song-empty" role="status"><b>找不到「${esc(q)}」</b><span>${COUNT_NOTE}，<br>試試其他關鍵字</span></div>`;
    } else {
      html = `<div class="song-meta">${COUNT_NOTE}</div>`;
    }
    this.input.classList.toggle('is-error', error);
    this.input.setAttribute('aria-expanded', String(!!(q && this.open && !s)));
    below.innerHTML = html;
    this.root.querySelector('[data-ref="drop"]').innerHTML = drop;
    below.style.display = 'contents';
  }

  /** 外面清掉資料時用 */
  refresh() {
    const s = this.song;
    this.input.value = s ? `${s.title} － ${s.artist}` : this.input.value;
    this.renderBelow();
  }
}
