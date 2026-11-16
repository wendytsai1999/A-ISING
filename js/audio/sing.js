// 假的使用者歌聲：data/audio/{歌}-me_k{key}.m4a 是把原唱人聲分離出來，
// 再照 data/{歌}-demo-user.json 每句的唱法改過音高（偏低、偏高、不穩、尾音下滑）和時間（搶拍）。
// 這裡只負責「播哪幾段」：沒唱的字一律靜音，所以聽到的就是這次錄到的字。
import { earlyOf } from '../practice/fake-user.js';

// voice＝檔名開頭（例如 rewind-me、tide-me、紀錄頁較早那次的 rewind-me-1105）
export const voiceUrl = (voice, key) => `data/audio/${voice}_k${key}.m4a`;

let live = null;
function liveCtx() {
  live ??= new (window.AudioContext || window.webkitAudioContext)();
  if (live.state === 'suspended') live.resume();
  return live;
}

const buffers = {};
/** 讀音檔並解碼（同一個檔只讀一次） */
export function loadBuffer(url) {
  return (buffers[url] ??= fetch(url).then((r) => {
    if (!r.ok) throw new Error(`讀不到 ${url}`);
    return r.arrayBuffer();
  }).then((data) => liveCtx().decodeAudioData(data)));
}

/** 有唱的字在歌裡的時間（已算進搶拍），靠很近的字合成一段：[[開始, 結束]…] */
export function voiceWindows(song, singer, sungMap) {
  const w = [];
  Object.keys(sungMap).map(Number).sort((a, b) => a - b).forEach((li) => {
    const early = earlyOf(singer, li);
    [...sungMap[li]].sort((a, b) => a - b).forEach((ci) => {
      const c = song.lines[li].chars[ci];
      w.push([c.start - early - 0.03, c.end - early + 0.06]);
    });
  });
  w.sort((a, b) => a[0] - b[0]);
  const out = [];
  w.forEach(([a, b]) => {
    const last = out[out.length - 1];
    if (last && a - last[1] < 0.15) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  });
  return out;
}

/** 整首播放要播的段落：連續有唱的句子併成一段，前後各留一點伴奏 */
export function sungSegments(song, sungMap, dur = song.duration) {
  const lis = Object.keys(sungMap).map(Number).filter((li) => sungMap[li]?.length).sort((a, b) => a - b);
  const segs = [];
  lis.forEach((li) => {
    const l = song.lines[li];
    const a = Math.max(0, l.start - 1.2), b = Math.min(dur, l.end + 1.0);
    const last = segs[segs.length - 1];
    if (last && a <= last[1] + 0.3) last[1] = Math.max(last[1], b);
    else segs.push([a, b]);
  });
  return segs;
}

export const GAP = 0.8; // 段落和段落中間空幾秒
export const mixLength = (segs) => segs.reduce((s, [a, b]) => s + (b - a), 0) + GAP * Math.max(0, segs.length - 1);

/** 在 ac 上排好「只開有唱的字」的人聲；歌的 from 秒對到 ac 的 at 秒，播到歌的 to 秒 */
function scheduleVoice(ac, dest, buf, windows, { at, from, to, gain = 1 }) {
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, at);
  windows.forEach(([a, b]) => {
    if (b <= from || a >= to) return;
    const s = at + Math.max(0, a - from), e = at + (Math.min(b, to) - from);
    g.gain.setValueAtTime(0, Math.max(at, s - 0.02));
    g.gain.linearRampToValueAtTime(gain, s + 0.02);
    g.gain.setValueAtTime(gain, Math.max(s + 0.02, e - 0.04));
    g.gain.linearRampToValueAtTime(0, e);
  });
  src.connect(g).connect(dest);
  src.start(at, Math.max(0, from), Math.max(0.01, to - from));
  return src;
}

/** 報告頁「▶ 我的歌聲」：即時播一句，回傳 { stop, done } */
export async function playLine(song, singer, key, li, sungChars, voice = `${song.id}-me`) {
  const buf = await loadBuffer(voiceUrl(voice, key));
  const ac = liveCtx();
  const windows = voiceWindows(song, singer, { [li]: sungChars });
  if (!windows.length) return { stop() {}, done: Promise.resolve() };
  const from = Math.max(0, windows[0][0] - 0.1), to = windows[windows.length - 1][1] + 0.1;
  const at = ac.currentTime + 0.05;
  const src = scheduleVoice(ac, ac.destination, buf, windows, { at, from, to });
  let timer;
  const done = new Promise((res) => { timer = setTimeout(res, (to - from + 0.1) * 1000); });
  return { stop() { clearTimeout(timer); try { src.stop(); } catch { /* 已經停了 */ } }, done };
}

/** 整首播放／下載：只接有唱的段落，歌（原唱或伴奏）＋我的歌聲 → WAV Blob */
export async function renderMix(song, singer, sungMap, { trackUrl, key, voiceFile = `${song.id}-me`, sampleRate = 44100, trackGain = 0.7, voiceGain = 0.95 }) {
  const [track, voice] = await Promise.all([loadBuffer(trackUrl), loadBuffer(voiceUrl(voiceFile, key))]);
  const segs = sungSegments(song, sungMap, track.duration);
  const windows = voiceWindows(song, singer, sungMap);
  const len = Math.max(1, mixLength(segs));
  const ac = new OfflineAudioContext(2, Math.ceil(len * sampleRate), sampleRate);
  let at = 0;
  segs.forEach(([a, b]) => {
    const d = b - a;
    const src = ac.createBufferSource();
    src.buffer = track;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(trackGain, at + 0.4);  // 段落頭尾淡入淡出
    g.gain.setValueAtTime(trackGain, at + d - 0.6);
    g.gain.linearRampToValueAtTime(0, at + d);
    src.connect(g).connect(ac.destination);
    src.start(at, a, d);
    scheduleVoice(ac, ac.destination, voice, windows, { at, from: a, to: b, gain: voiceGain });
    at += d + GAP;
  });
  const out = await ac.startRendering();
  return toWav(out);
}

function toWav(buf) {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
  const bytes = 44 + len * ch * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); view.setUint32(4, bytes - 8, true); str(8, 'WAVE');
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, ch, true);
  view.setUint32(24, sr, true); view.setUint32(28, sr * ch * 2, true); view.setUint16(32, ch * 2, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, len * ch * 2, true);
  const chans = [...Array(ch)].map((_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}
