// 用 Web Audio API 合成聲音：提示音和假的使用者聲音。
// 之後如果有真的錄音，可以把 Voice 換成播放音檔。
import { toFreq } from '../music.js';

let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** 提示音：柔和、持續的音（長度跟使用者唱的一樣），結尾自然收掉 */
export function playTone(midi, seconds = 1.9) {
  const ac = audio();
  const t = ac.currentTime + 0.02;
  const f = toFreq(midi);
  const out = ac.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.32, t + 0.03);
  out.gain.exponentialRampToValueAtTime(0.22, t + 0.4);
  out.gain.setValueAtTime(0.22, t + seconds - 0.35);
  out.gain.linearRampToValueAtTime(0, t + seconds);
  out.connect(master);
  [[1, 'sine', 0.8], [2, 'sine', 0.22], [3, 'sine', 0.07]].forEach(([h, type, amp]) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = f * h;
    g.gain.value = amp;
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + seconds + 0.05);
  });
}

/** 一段白噪音（給氣音和音高的微小抖動用） */
let noiseBuf = null;
function noise(ac) {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

// 母音「啊／喔」之間的共振峰（人聲聽起來像人，主要靠這三個峰）
const FORMANTS = [
  { f: 650, q: 6, gain: 1.0 },
  { f: 1080, q: 9, gain: 0.45 },
  { f: 2650, q: 18, gain: 0.12 }
];

/**
 * 假的使用者聲音：共振峰合成的「啊～」
 * 聲帶（鋸齒波，高頻往下壓）→ 三個共振峰 ＋ 一點氣音 ＋ 音高微小抖動 ＋ 慢慢出現的顫音
 */
export class Voice {
  constructor(midi) {
    const ac = audio();
    this.ac = ac;
    const t = ac.currentTime;
    this.sources = [];

    // 聲帶
    this.osc = ac.createOscillator();
    this.osc.type = 'sawtooth';
    this.osc.frequency.setValueAtTime(toFreq(midi), t);
    const tilt = ac.createBiquadFilter(); // 真人聲帶的高頻比鋸齒波弱很多
    tilt.type = 'lowpass';
    tilt.frequency.value = 900;
    tilt.Q.value = 0.3;
    this.osc.connect(tilt);

    const mix = ac.createGain();
    mix.gain.value = 1;
    FORMANTS.forEach(({ f, q, gain }) => {
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const g = ac.createGain();
      g.gain.value = gain * 4;
      tilt.connect(bp).connect(g).connect(mix);
    });
    const body = ac.createGain(); // 保留一點基音的厚度
    body.gain.value = 0.35;
    tilt.connect(body).connect(mix);

    // 氣音
    const breath = noise(ac);
    const bf = ac.createBiquadFilter();
    bf.type = 'bandpass';
    bf.frequency.value = 2800;
    bf.Q.value = 0.8;
    const bg = ac.createGain();
    bg.gain.value = 0.035;
    breath.connect(bf).connect(bg).connect(mix);

    // 音高微小抖動（真人不會唱得像機器一樣穩）
    const jitter = noise(ac);
    jitter.playbackRate.value = 0.002;
    const jf = ac.createBiquadFilter();
    jf.type = 'lowpass';
    jf.frequency.value = 6;
    const jg = ac.createGain();
    jg.gain.value = 40; // 約 ±8 cents
    jitter.connect(jf).connect(jg).connect(this.osc.detune);

    // 顫音：開頭平穩，0.5 秒後慢慢出現
    this.lfo = ac.createOscillator();
    this.lfo.frequency.value = 5.3;
    const lfoGain = ac.createGain();
    lfoGain.gain.setValueAtTime(0, t);
    lfoGain.gain.linearRampToValueAtTime(0, t + 0.5);
    lfoGain.gain.linearRampToValueAtTime(18, t + 1.2);
    this.lfo.connect(lfoGain).connect(this.osc.detune);

    // 柔一點的整體音色
    const soft = ac.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 3800;

    this.amp = ac.createGain();
    this.amp.gain.setValueAtTime(0, t);
    this.amp.gain.linearRampToValueAtTime(0.22, t + 0.08);
    this.amp.gain.linearRampToValueAtTime(0.32, t + 0.35);
    mix.connect(soft).connect(this.amp).connect(master);

    this.sources = [this.osc, this.lfo, breath, jitter];
    this.sources.forEach((s) => s.start(t));
  }

  /** 滑到某個音高（可帶 cents 偏差） */
  glide(midi, seconds = 0.15) {
    const t = this.ac.currentTime;
    this.osc.frequency.cancelScheduledValues(t);
    this.osc.frequency.setValueAtTime(this.osc.frequency.value, t);
    this.osc.frequency.exponentialRampToValueAtTime(toFreq(midi), t + Math.max(0.02, seconds));
  }

  stop(fade = 0.25) {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.ac.currentTime;
    this.amp.gain.cancelScheduledValues(t);
    this.amp.gain.setValueAtTime(this.amp.gain.value, t);
    this.amp.gain.linearRampToValueAtTime(0, t + fade);
    this.sources.forEach((s) => s.stop(t + fade + 0.05));
  }
}

/** 一律停止：給「結束展示」或離開頁面用 */
const live = new Set();
export function track(v) { live.add(v); return v; }
export function stopAll() { live.forEach((v) => v.stop()); live.clear(); }
