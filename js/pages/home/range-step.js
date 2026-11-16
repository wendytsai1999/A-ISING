// 01 測音域
// 正常流程：按開始 → 假的哼唱聲從低唱到高 → 按停止或 15 秒自動停 → 顯示結果。
// scenario：'noVoice'（沒偵測到聲音）、'narrow'（範圍太窄），只在「展示情境」裡用。
import { esc, makeRun, CANCEL } from '../../util.js';
import { alertHTML } from '../../components/alert.js';
import { toMidi, toName } from '../../music.js';
import { Voice, track } from '../../audio/synth.js';

const HINT = '請用平常唱歌的聲音，不要用假音，從最低音慢慢唱到最高音。';
const HINT_REC = '從最低音慢慢唱到最高音，唱完按停止。';
const BARS = 14;
const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** 假的唱法：先從低一點滑到最低音，再一個音一個音往上唱，最後停在最高音 */
function buildPath(low, high, stepSec) {
  const lo = toMidi(low), hi = toMidi(high);
  const notes = [];
  for (let m = lo; m <= hi; m++) if (C_MAJOR.includes(m % 12) || m === lo || m === hi) notes.push(m);
  const path = [{ t: 0, m: lo + 4 }, { t: 0.6, m: lo }];
  let t = 1.4;
  notes.slice(1).forEach((m) => { path.push({ t, m }); t += stepSec; });
  path.push({ t: t + 0.8, m: hi, end: true }); // 唱完最高音之後就沒聲音了
  return path;
}

export class RangeStep {
  constructor(root, ctx, { scenario = null } = {}) {
    this.root = root;
    this.ctx = ctx;
    this.scenario = scenario;
    this.state = 'idle';
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.render();
  }

  get result() { return this.ctx.getDraft().range; }

  onClick(e) {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'start') this.start();
    if (act === 'stop') this.finish();
    if (act === 'close-alert') { this.state = 'done'; this.render(); }
  }

  render() {
    const r = this.result;
    const s = this.state;
    const pill = s === 'rec'
      ? '<span class="pill"><span class="rec-dot"></span>錄音中</span>'
      : (s === 'done' && r ? '<span class="pill">完成</span>' : '');
    let middle = '';
    let actions = '';
    if (s === 'rec') {
      middle = `
        <p class="card__hint">${HINT_REC}</p>
        <div class="readout readout--live">
          <div class="wave" aria-hidden="true">${'<span class="wave__bar"></span>'.repeat(BARS)}<span class="wave__time" data-ref="time">00:00</span></div>
          <div class="readout__row"><span>目前的音</span><b class="big" data-ref="now">－</b></div>
          <div class="readout__row"><span>目前範圍</span><b data-ref="range">－</b></div>
        </div>`;
      actions = '<button class="btn btn--dark" data-act="stop"><span class="stop-icon"></span>停止</button>';
    } else if (s === 'noVoice') {
      middle = `<p class="card__hint">${HINT}</p>
        ${alertHTML({ heading: '沒偵測到聲音', body: '請確認耳麥有接好，靠近麥克風一點，再按「重新」唱一次。', closable: false })}`;
      actions = '<button class="btn btn--primary" data-act="start" data-lock>重新</button>';
    } else if (s === 'narrow') {
      // 結果在上、提示框在下（按 ✕ 就沿用這個結果）
      middle = `${this.readout(r)}
        ${alertHTML({ heading: '範圍好像有點窄', body: '只測到不到一個八度，可能還沒唱到最低或最高音。', closable: true })}`;
      actions = '<button class="btn btn--primary" data-act="start" data-lock>重新</button>';
    } else if (r) {
      middle = `<p class="card__hint">${HINT}</p>${this.readout(r)}`;
      actions = '<button class="btn" data-act="start" data-lock>重新</button>';
    } else {
      middle = `<p class="card__hint">${HINT}</p>${this.readout(null)}`;
      actions = '<button class="btn btn--primary" data-act="start" data-lock>開始</button><button class="btn" disabled>重新</button>';
    }
    this.root.innerHTML = `
      <div class="card__head"><span class="card__no">01</span><span class="card__name">測音域</span>${pill}</div>
      ${middle}
      <div class="card__actions">${actions}</div>`;
    this.updateLock();
  }

  readout(r) {
    const v = (x) => (x ? `<b>${esc(x)}</b>` : '<span class="muted">尚未測量</span>');
    return `
      <div class="readout">
        <div class="readout__row"><span>最低音</span>${v(r?.low)}</div>
        <div class="readout__row"><span>最高音</span>${v(r?.high)}</div>
      </div>`;
  }

  updateLock() {
    const locked = this.ctx.isBusy() && this.ctx.isBusy() !== 'range';
    this.root.querySelectorAll('[data-lock]').forEach((b) => { b.disabled = locked; });
  }

  async start() {
    if (this.ctx.isBusy()) return;
    if (!(await this.ctx.ensureMic())) return;

    const plan = this.ctx.rangePlan(this.scenario); // { low, high, silent, autoStop }
    this.plan = plan;
    this.state = 'rec';
    this.ctx.setBusy('range');
    this.render();

    const run = (this.run = makeRun());
    const path = plan.silent ? [] : buildPath(plan.low, plan.high, plan.stepSec ?? 0.75);
    const voice = plan.silent ? null : track(new Voice(path[0].m));
    run.onCancel.push(() => voice?.stop());

    const t0 = performance.now();
    let seenLo = Infinity, seenHi = -Infinity, idx = 0, sounding = !plan.silent;
    const bars = [...this.root.querySelectorAll('.wave__bar')];
    const levels = new Array(BARS).fill(0);
    const $ = (r) => this.root.querySelector(`[data-ref="${r}"]`);

    const frame = () => {
      if (run.cancelled) return;
      const t = (performance.now() - t0) / 1000;
      // 照路徑換音
      while (idx < path.length && path[idx].t <= t) {
        const p = path[idx];
        if (p.end) { voice?.stop(0.4); sounding = false; }
        else {
          voice.glide(p.m, idx === 1 ? 0.6 : 0.12);
          seenLo = Math.min(seenLo, p.m); seenHi = Math.max(seenHi, p.m);
          $('now').textContent = toName(p.m);
          $('range').textContent = `${toName(seenLo)} － ${toName(seenHi)}`;
        }
        idx++;
      }
      if (!sounding && $('now')) $('now').textContent = '－';
      // 波形：有聲音時跳動，沒聲音時貼平
      levels.shift();
      levels.push(sounding ? 10 + Math.random() * 30 : 3 + Math.random() * 4);
      bars.forEach((b, i) => { b.style.height = `${levels[i].toFixed(0)}px`; b.classList.toggle('on', levels[i] > 8); });
      const sec = Math.floor(t);
      $('time').textContent = `00:${String(sec).padStart(2, '0')}`;
      if (t >= plan.autoStop) return this.finish();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /** 停止（使用者按停止或時間到） */
  finish() {
    if (this.state !== 'rec') return;
    this.run?.cancel();
    const p = this.plan;
    if (p.silent) {
      this.state = 'noVoice';
    } else {
      this.ctx.setDraft('range', { low: p.low, high: p.high });
      this.state = p.narrow ? 'narrow' : 'done';
      this.ctx.countRun?.('range');
    }
    this.ctx.setBusy(null);
    this.render();
  }

  destroy() { this.run?.cancel(); }
}

export { CANCEL };
