// 音名、頻率、建議 Key 的計算
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function toMidi(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`看不懂的音名：${name}`);
  return NAMES.indexOf(m[1]) + (Number(m[2]) + 1) * 12;
}
export const toName = (midi) => NAMES[((Math.round(midi) % 12) + 12) % 12] + (Math.floor(Math.round(midi) / 12) - 1);
export const toFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// 音域描述
export function describeSpan(low, high) {
  const span = toMidi(high) - toMidi(low);
  if (span >= 24) return '超過兩個八度';
  if (span >= 19) return '將近兩個八度';
  if (span >= 15) return '大約一個半八度';
  if (span >= 12) return '一個多八度';
  return '不到一個八度';
}

const MAX_SHIFT = 5; // 升降超過 5 Key，跟原曲差太多，就不推薦

/**
 * 比較歌曲音域和使用者音域，算出建議 Key。
 * 回傳 { kind: 'same' | 'down' | 'up' | 'wide' | 'far', shift, ... }
 * 1 Key＝1 個半音（KTV 的說法）。
 */
export function suggestKey(song, range) {
  const sLow = toMidi(song.low), sHigh = toMidi(song.high);
  const uLow = toMidi(range.low), uHigh = toMidi(range.high);
  const songSpan = sHigh - sLow, userSpan = uHigh - uLow;
  if (songSpan > userSpan) return { kind: 'wide', songSpan, userSpan };
  // 可以移動的範圍：[uLow - sLow, uHigh - sHigh]，挑最接近 0 的
  const min = uLow - sLow, max = uHigh - sHigh;
  const shift = Math.min(Math.max(0, min), max);
  if (Math.abs(shift) > MAX_SHIFT) return { kind: 'far', shift };
  if (shift === 0) return { kind: 'same', shift };
  return { kind: shift < 0 ? 'down' : 'up', shift, over: shift < 0 ? sHigh - uHigh : uLow - sLow };
}

export function keyLabel(s) {
  if (s.kind === 'same') return '原 Key 即可';
  if (s.kind === 'down') return `建議降 ${-s.shift} Key`;
  if (s.kind === 'up') return `建議升 ${s.shift} Key`;
  return '先不推薦';
}
