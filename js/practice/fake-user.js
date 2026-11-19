// 假的使用者：依 data/rewind-demo-user.json 每句的唱法，算出每個字唱成的音高。
// 練唱頁的即時音高線、報告頁的分析、下載的假歌聲，都從這裡來，所以三個地方會一致。
import { toName, OK_RANGE } from '../music.js';

export { OK_RANGE };          // ±0.5 個半音以內算準（定義在 music.js，和聽音跟唱共用）
export const LINE_OK = 0.7;    // 一句裡有唱的字，七成以上是綠色就算唱對
export const SUNG_MIN = 0.5;   // 一個字錄到一半以上，才算有唱

// 固定的亂數（同一個字每次都一樣）
const rand = (a, b, c = 0) => {
  const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return x - Math.floor(x);
};

export function profileOf(singer, li) {
  const name = singer.lines[li] ?? 'good';
  return { name, ...(singer.profiles[name] ?? {}) };
}

/**
 * 第 li 句第 ci 個字，唱到 u（0～1）時，和正確音高差幾個半音。
 * 回傳 null＝聽不清楚（有聲音但抓不到音高）。
 */
export function deviation(singer, song, li, ci, u) {
  const p = profileOf(singer, li);
  if (p.name === 'unclear') return null;
  const n = song.lines[li].chars.length;
  const r = rand(li, ci);
  const attack = u < 0.12 ? -0.35 * (1 - u / 0.12) : 0;      // 每個字開頭從下面滑上來一點
  const wobble = 0.06 * Math.sin(2 * Math.PI * (1.5 * u + r));  // 一點點不穩
  let d = (r - 0.5) * 0.36;                                  // 好的字也有小偏差
  if (p.offset) d = p.offset + (r - 0.5) * 0.3;
  if (p.swing) d = p.swing * (ci % 2 ? 1 : -1) * (0.75 + 0.35 * r) + 0.2 * Math.sin(2 * Math.PI * 2 * u);
  if (p.tailDrop && ci === n - 1) d = (r - 0.5) * 0.2 + p.tailDrop * Math.max(0, (u - 0.15) / 0.85);
  let shake = 0;
  if (p.shake) shake = p.shake * Math.sin(2 * Math.PI * (5 * u + r));        // 不穩：每個字裡面也在抖
  const k = weakOf(singer, song, li, ci);
  if (k > 0) {                                                                // 沒氣：越後面的字越往下沉、越抖
    d = (r - 0.5) * 0.2 - (0.5 + 1.3 * k) * (0.4 + 0.6 * u);
    shake = 0.3 * k * Math.sin(2 * Math.PI * (4 * u + r));
  }
  return d + attack + wobble + shake;
}

/**
 * 沒氣（breath）：句子後半段的字，0＝正常，1＝最後一個字、最沒力。
 * profile 的 breath＝從句子後面多少比例開始沒氣（0.5＝後半句）。
 */
export function weakOf(singer, song, li, ci) {
  const p = profileOf(singer, li);
  if (!p.breath) return 0;
  const n = song.lines[li].chars.length;
  const pos = n > 1 ? ci / (n - 1) : 1;
  const from = 1 - p.breath;
  return pos < from ? 0 : Math.min(1, (pos - from) / p.breath + 0.15);
}

/** 畫面用：這個字的音高線要不要畫成發抖（shaky）、變淡（weak 0～1） */
export function lookOf(singer, song, li, ci) {
  const p = profileOf(singer, li);
  return { shaky: !!p.swing, weak: weakOf(singer, song, li, ci) };
}

/** 一個字從 0 唱到 upTo 的平均偏差和顏色 */
export function charStat(singer, song, li, ci, upTo = 1) {
  const steps = Math.max(2, Math.round(upTo * 20));
  let sum = 0, okN = 0, n = 0;
  for (let k = 0; k < steps; k++) {
    const d = deviation(singer, song, li, ci, (k + 0.5) / steps * upTo);
    if (d === null) return { unclear: true };
    sum += d; n++;
    if (Math.abs(d) <= OK_RANGE) okN++;
  }
  return { mean: sum / n, ok: okN / n >= 0.5 };
}

/** 搶拍／拖拍：使用者每個字提早幾秒唱（負數＝晚唱，拖拍） */
export const earlyOf = (singer, li) => profileOf(singer, li).early ?? 0;

// 建議一律先鼓勵，再給一個具體的小提醒。唱對（ok）和還沒唱對各一種說法。
const ADVICE = {
  good: { ok: '音準和節奏都很穩，唱得很好！保持這樣唱就對了。', bad: '大部分的字都有跟上，很不錯！有幾個字偏掉了，可以先聽一次原唱，再跟著唱一次。' },
  flat: { ok: '這句大部分都唱對了，很棒！整句稍微偏低一點，唱之前先在心裡想好第一個音，聲音位置再放高一點會更好。', bad: '旋律都有跟上，很好！這句整體偏低一點，唱之前先在心裡想一下第一個音，聲音位置放高一點、氣多一點，就會更準。' },
  sharp: { ok: '這句大部分都唱對了，很有精神！稍微偏高一點，放鬆喉嚨、音量收一點會更穩。', bad: '唱得很有精神！只是整句偏高一點，可能太用力了。放鬆喉嚨、音量小一點，再唱一次試試看。' },
  unstable: { ok: '這句大部分都在音上，很好！有幾個字晃了一下，每個字唱長一點、穩一點會更好。', bad: '這句不好唱，願意挑戰很棒！音忽高忽低，聲音也在抖。先用慢一點的速度把每個字唱長、唱穩，再慢慢加快。' },
  breath: { ok: '前半句唱得很穩，很好！後面幾個字氣有點不夠，聲音變小、音也往下沉。句子開始前先吸飽氣，就能撐到最後。', bad: '前面唱得很穩，很棒！後半句氣不夠，聲音越來越小、音也一路往下沉。句子開始前先吸飽氣，長句子可以在中間找個地方偷換氣。' },
  droop: { ok: '前面都唱得很準，很棒！最後一個字稍微往下掉，句尾留一點氣撐住就更完整了。', bad: '前面都唱得很準，很棒！最後一個字往下掉比較多，句尾留一點氣，把最後的音撐住。' },
  drag: { ok: '音都唱對了，很好！只是每個字比伴奏晚一點進來，可以提前吸氣、拍點一到就出聲。', bad: '唱得很穩！只是每個字都比伴奏晚一點，先跟著伴奏打拍子，提前吸氣、拍點一到就出聲。' },
  rush: { ok: '音都唱對了，很好！只是每個字比伴奏早一點進來，先聽伴奏的拍點再出聲會更好。', bad: '很投入！每個字都比伴奏早一點唱，先聽伴奏的拍子，等拍點到了再出聲。' },
  unclear: { ok: '', bad: '這句有聲音，但太小聲或太吵，判斷不出音高，所以沒有評分。可以靠近麥克風一點再唱一次。' }
};

/**
 * 分析一句：sung＝這句有唱的字（index 陣列）
 * 回傳 { tag, tagKind, ok, okChars, chars:[{ci, mean, ok}], advice }
 */
export function analyzeLine(singer, song, li, sung, key) {
  const p = profileOf(singer, li);
  const line = song.lines[li];
  if (p.name === 'unclear') {
    return { li, unclear: true, ok: false, tag: '聽不清楚，未評分', tagKind: 'grey', chars: [], advice: ADVICE.unclear.bad };
  }
  const chars = sung.map((ci) => {
    const s = charStat(singer, song, li, ci);
    const target = line.chars[ci].midi + key;
    return { ci, mean: s.mean, ok: s.ok, target, sungAs: toName(target + s.mean) };
  });
  const okChars = chars.filter((c) => c.ok).length;
  const ok = chars.length > 0 && okChars / chars.length >= LINE_OK;
  const avg = chars.reduce((a, c) => a + c.mean, 0) / (chars.length || 1);
  // 標籤寫出這句的狀況；顏色只看這句算不算唱對（有唱的字七成以上是綠色＝綠色標籤）
  let tag = '唱得很好', name = 'good';
  if (p.name === 'flat') { tag = `平均偏低 ${Math.abs(avg).toFixed(1)} 個半音`; name = 'flat'; }
  else if (p.name === 'sharp') { tag = `平均偏高 ${Math.abs(avg).toFixed(1)} 個半音`; name = 'sharp'; }
  else if (p.name === 'unstable') { tag = '高低不穩・聲音發抖'; name = 'unstable'; }
  else if (p.name === 'breath' && sung.some((ci) => weakOf(singer, song, li, ci) > 0)) { tag = '句尾沒氣'; name = 'breath'; }
  else if (p.name === 'droop' && sung.includes(line.chars.length - 1)) { tag = '尾音下滑'; name = 'droop'; }
  else if (p.name === 'rush') { tag = '節奏搶拍'; name = 'rush'; }
  else if (p.name === 'drag') { tag = '節奏拖拍'; name = 'drag'; }
  else if (!ok) { tag = '有幾個字不準'; }
  const tagKind = ok ? 'good' : 'bad';
  return { li, ok, okChars, chars, tag, tagKind, name, advice: ADVICE[name][ok ? 'ok' : 'bad'] };
}

/** 整次練唱：sungMap＝{ 句 index: [字 index…] } */
export function analyzeTake(singer, song, sungMap, key) {
  const lines = Object.keys(sungMap).map(Number).sort((a, b) => a - b)
    .filter((li) => sungMap[li].length)
    .map((li) => analyzeLine(singer, song, li, sungMap[li], key));
  const scored = lines.filter((l) => !l.unclear);
  const okLines = scored.filter((l) => l.ok).length;
  return { lines, scored: scored.length, okLines, unclear: lines.filter((l) => l.unclear) };
}
