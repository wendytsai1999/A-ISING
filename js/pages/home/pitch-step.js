// 02 聽音跟唱
// 每個音：播提示音 → 換你唱（假的哼唱聲）→ 出結果。共五個音。
// 沒收到聲音：先跳紅色提示「這個音再唱一次」，再唱一次還是沒有，就記成灰色「－」。
// 按停止：停在目前這個音，已唱完的音照常留下。可以按「繼續」從這個音接著測，或直接用這樣的結果。
// 沒測完不是沒收到聲音，所以不跳黃色提示框。
import { makeRun, CANCEL } from '../../util.js';
import { alertHTML } from '../../components/alert.js';
import { toMidi } from '../../music.js';
import { Voice, playTone, track } from '../../audio/synth.js';

const HINT = '聽到提示音後，跟著唱出同一個音，共五個音。';
const TARGET_Y = 46;
const SING_MS = 2000;   // 音高穩定 2 秒就判斷
const UNSTABLE_MS = 4000; // 一直不穩：唱滿 4 秒，取最接近的一段判斷
const LISTEN_MS = SING_MS + 300; // 提示音和使用者唱的一樣長
const SILENT_MS = 2300;

const centsToY = (c) => Math.max(8, Math.min(88, TARGET_Y - c * 0.11));
const isOk = (c) => Math.abs(c) <= 50;

function dotsHTML(results, current) {
  return `<div class="dots" aria-label="五個音的結果">${[0, 1, 2, 3, 4].map((i) => {
    const r = results[i];
    if (r?.result === 'ok') return '<span class="dot dot--ok" title="唱準">✓</span>';
    if (r?.result === 'off') return '<span class="dot dot--off" title="沒唱準">✗</span>';
    if (r?.result === 'none') return '<span class="dot dot--none" title="沒收到聲音">－</span>';
    if (i === current) return `<span class="dot dot--now">${i + 1}</span>`;
    return '<span class="dot"></span>';
  }).join('')}</div>`;
}

function tallyText(results) {
  const n = (k) => results.filter((r) => r.result === k).length;
  const parts = [`唱準 <b>${n('ok')}</b> 個`];
  if (n('off')) parts.push(`沒唱準 <b>${n('off')}</b> 個`);
  if (n('none')) parts.push(`沒收到聲音 <b>${n('none')}</b> 個`);
  if (results.length < 5) parts.push(`沒測 <b>${5 - results.length}</b> 個`);
  return parts.join('・');
}

export class PitchStep {
  constructor(root, ctx, { scenario = null } = {}) {
    this.root = root;
    this.ctx = ctx;
    this.scenario = scenario;
    this.state = 'idle';
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.render();
  }

  get result() { return this.ctx.getDraft().pitch; }

  onClick(e) {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'start') this.start();
    if (act === 'stop') this.stop();
    if (act === 'resume') this.resume();
    if (act === 'replay') this.playFrom(this.i);
    if (act === 'close-alert') { this.state = 'done'; this.render(); }
  }

  render() {
    const s = this.state;
    const r = this.result;
    let pill = '', body = '', actions = '';
    if (s === 'run') {
      pill = `<span class="pill">第 ${this.i + 1}／5 個音</span>`;
      const listen = this.phase === 'listen';
      body = `
        <div class="phase" aria-live="polite">
          <span class="phase__step ${listen ? 'is-on' : ''}">♪ 聽提示音</span><span>→</span>
          <span class="phase__step ${listen ? '' : 'is-on'}">換你唱</span>
        </div>
        <div class="retry-slot">${this.retrying ? alertHTML({ heading: '沒聽到聲音', body: '這個音再唱一次。', closable: false }) : ''}</div>
        <div class="pitchbox" data-ref="box">
          <svg data-ref="svg" aria-hidden="true"></svg>
          <span class="pitchbox__label">${this.plan.targets[this.i]}</span>
          ${listen ? '<span class="pitchbox__ring"></span>' : ''}
        </div>
        ${dotsHTML(this.results, this.i)}`;
      actions = `<button class="btn btn--dark" data-act="stop"><span class="stop-icon"></span>停止</button>
                 <button class="btn" data-act="replay">♪ 再聽一次</button>`;
    } else if (s === 'stopped' || (s !== 'manyNone' && r && r.results.length < 5)) {
      // 按了停止：停在這個音，可以繼續，也可以就用這樣的結果
      const done = this.results ?? r?.results ?? [];
      pill = `<span class="pill">已停止・${done.length}／5</span>`;
      body = `<p class="card__hint">${HINT}</p>
        <div class="pitchbox" data-ref="box"><svg data-ref="svg" aria-hidden="true"></svg></div>
        ${dotsHTML(done, -1)}
        <div class="tally">${done.length ? tallyText(done) : `還沒測完任何一個音・沒測 <b>5</b> 個`}</div>`;
      actions = '<button class="btn btn--primary" data-act="resume" data-lock>繼續</button><button class="btn" data-act="start" data-lock>重新</button>';
    } else if (s === 'manyNone') {
      body = `<p class="card__hint">${HINT}</p>${dotsHTML(r.results, -1)}
        ${alertHTML({ heading: '好像沒收到你的聲音', body: '5 個音裡有 3 個沒收到聲音。建議檢查麥克風或耳麥後重新測一次。', closable: true })}`;
      actions = '<button class="btn btn--primary" data-act="start" data-lock>重新</button>';
    } else if (r) {
      pill = '<span class="pill">完成</span>';
      body = `<p class="card__hint">${HINT}</p>
        <div class="pitchbox" data-ref="box"><svg data-ref="svg" aria-hidden="true"></svg></div>
        ${dotsHTML(r.results, -1)}
        <div class="tally">${tallyText(r.results)}</div>`;
      actions = '<button class="btn" data-act="start" data-lock>重新</button>';
    } else {
      body = `<p class="card__hint">${HINT}</p>
        <div class="pitchbox" data-ref="box"><svg data-ref="svg" aria-hidden="true"></svg></div>`;
      actions = '<button class="btn btn--primary" data-act="start" data-lock>開始</button><button class="btn" disabled>重新</button>';
    }
    this.root.innerHTML = `
      <div class="card__head"><span class="card__no">02</span><span class="card__name">聽音跟唱</span>${pill}</div>
      ${body}
      <div class="card__actions">${actions}</div>`;
    this.drawBase(s === 'run' ? null : s === 'stopped' ? this.results : r?.results);
    this.updateLock();
  }

  /** 畫目標虛線；完成時把五個音的結果畫成五小段 */
  drawBase(summary) {
    const svg = this.root.querySelector('[data-ref="svg"]');
    if (!svg) return;
    const w = svg.clientWidth || 280;
    this.w = w;
    const right = this.state === 'run' ? w - 52 : w - 16;
    svg.setAttribute('viewBox', `0 0 ${w} 96`);
    let html = `<line x1="16" y1="${TARGET_Y}" x2="${right}" y2="${TARGET_Y}" stroke="${this.state === 'run' ? '#1E1E1E' : '#8F877C'}" stroke-width="2" stroke-dasharray="6 5"/>`;
    if (summary) {
      const seg = (w - 32) / 5;
      summary.forEach((r, k) => {
        const x1 = 16 + seg * k + 6, x2 = 16 + seg * (k + 1) - 6;
        if (r.result === 'none') {
          html += `<line x1="${x1}" y1="${TARGET_Y + 30}" x2="${x2}" y2="${TARGET_Y + 30}" stroke="#CFC7B8" stroke-width="4" stroke-linecap="round"/>`;
        } else {
          const y = centsToY(r.cents);
          html += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${isOk(r.cents) ? '#3E8E5A' : '#C8553D'}" stroke-width="4" stroke-linecap="round"/>`;
        }
      });
    }
    svg.innerHTML = html;
  }

  updateLock() {
    const locked = this.ctx.isBusy() && this.ctx.isBusy() !== 'pitch';
    this.root.querySelectorAll('[data-lock]').forEach((b) => { b.disabled = locked; });
  }

  async start() {
    if (this.ctx.isBusy()) return;
    if (!(await this.ctx.ensureMic())) return;
    this.plan = this.ctx.pitchPlan(this.scenario); // { targets, outcomes, retry }
    this.results = [];
    this.state = 'run';
    this.ctx.setBusy('pitch');
    this.playFrom(0);
  }

  /** 從第 i 個音的提示音重新開始（「再聽一次」也用這個） */
  async playFrom(i) {
    this.run?.cancel();
    const run = (this.run = makeRun());
    this.results = this.results.slice(0, i);
    try {
      for (this.i = i; this.i < 5; this.i++) {
        this.retrying = false;
        const res = await this.oneNote(run, this.i);
        this.results.push(res);
        this.retrying = false;
        this.render();
        this.drawTraceFinal(res);
        await run.wait(600);
      }
      this.complete();
    } catch (err) {
      if (err !== CANCEL) throw err;
    }
  }

  async oneNote(run, i) {
    const target = toMidi(this.plan.targets[i]);
    const outcome = this.plan.outcomes[i];
    for (let attempt = 0; ; attempt++) {
      // 聽提示音
      this.phase = 'listen';
      this.render();
      playTone(target, SING_MS / 1000);
      await run.wait(LISTEN_MS);
      // 換你唱
      this.phase = 'sing';
      this.render();
      if (outcome.result === 'none') {
        await run.wait(SILENT_MS);
        if (attempt === 0 && this.plan.retry) {
          this.retrying = true; // 紅色提示：這個音再唱一次
          this.render();
          await run.wait(1500);
          continue;
        }
        return { result: 'none' };
      }
      await this.sing(run, target, outcome.cents, outcome.unstable);
      return { result: outcome.result, cents: outcome.cents };
    }
  }

  /** 假的哼唱聲＋畫出音高線（開頭從下面滑上來） */
  async sing(run, target, cents, unstable = false) {
    const dur = unstable ? UNSTABLE_MS : SING_MS;
    const voice = track(new Voice(target - 0.7));
    run.onCancel.push(() => voice.stop());
    voice.glide(target + (unstable ? cents - 70 : cents) / 100, 0.35);
    const svg = this.root.querySelector('[data-ref="svg"]');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(path);
    const t0 = performance.now();
    const x0 = 20, x1 = this.w - 64;
    let last = null, lastGlide = -1;
    await new Promise((resolve) => {
      const frame = () => {
        if (run.cancelled) return resolve();
        const el = performance.now() - t0;
        const p = Math.min(1, el / dur);
        let c;
        if (unstable) {
          // 不穩：在 (cents − 70) 上下晃 ±70，最接近目標的那段剛好是 cents
          const s = el / 1000;
          c = cents - 70 + 70 * (0.65 * Math.sin(2 * Math.PI * 0.8 * s) + 0.35 * Math.sin(2 * Math.PI * 2.1 * s + 1));
          if (Math.floor(el / 90) !== lastGlide) { lastGlide = Math.floor(el / 90); voice.glide(target + c / 100, 0.09); }
        } else {
          c = cents + (-70 - cents) * Math.exp(-p * 9) + Math.sin(p * 40) * 6; // 滑音＋小顫音
        }
        const pt = { x: x0 + (x1 - x0) * p, y: centsToY(c), ok: isOk(c) };
        if (last) {
          path.insertAdjacentHTML('beforeend', `<line x1="${last.x}" y1="${last.y}" x2="${pt.x}" y2="${pt.y}" stroke="${pt.ok ? '#3E8E5A' : '#C8553D'}" stroke-width="4" stroke-linecap="round"/>`);
        }
        last = pt;
        if (p < 1) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
    voice.stop();
    await run.wait(100);
  }

  /** 一個音唱完後，在框裡留一條結果線 */
  drawTraceFinal(res) {
    const svg = this.root.querySelector('[data-ref="svg"]');
    if (!svg || res.result === 'none') return;
    const y = centsToY(res.cents);
    svg.insertAdjacentHTML('beforeend', `<line x1="20" y1="${y}" x2="${this.w - 64}" y2="${y}" stroke="${isOk(res.cents) ? '#3E8E5A' : '#C8553D'}" stroke-width="4" stroke-linecap="round"/>`);
  }

  complete() {
    const results = this.results;
    this.ctx.setDraft('pitch', { targets: this.plan.targets, results });
    const none = results.filter((r) => r.result === 'none').length;
    this.state = none >= 3 ? 'manyNone' : 'done';
    this.ctx.countRun?.('pitch');
    this.ctx.setBusy(null);
    this.render();
  }

  /** 按停止：停在目前這個音。已唱完的音照常留下，還沒唱完的不記錄、不算錯 */
  stop() {
    this.run?.cancel();
    const results = this.results;
    this.ctx.setDraft('pitch', results.length ? { targets: this.plan.targets, results } : null);
    this.state = 'stopped';
    this.ctx.setBusy(null);
    this.render();
  }

  /** 繼續：從停下來的那個音接著測 */
  async resume() {
    if (this.ctx.isBusy()) return;
    if (!(await this.ctx.ensureMic())) return;
    if (!this.plan) this.plan = this.ctx.pitchPlan(this.scenario);
    if (!this.results) this.results = [...(this.result?.results ?? [])];
    this.state = 'run';
    this.ctx.setBusy('pitch');
    this.playFrom(this.results.length);
  }

  destroy() { this.run?.cancel(); }
}
