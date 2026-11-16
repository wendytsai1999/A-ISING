// 追蹤報告：比較勾選的幾次演唱（舊 → 新），寫出改善的地方、共同的問題、待改進之處。
// 一律先肯定，再說可以加強的地方（和練唱報告同一個語氣）。
import { esc } from '../../util.js';

const LABEL = {
  flat: '整句偏低', sharp: '整句偏高', unstable: '高低不穩',
  droop: '長音的尾端往下掉', rush: '比伴奏早進來（搶拍）', drag: '比伴奏晚進來（拖拍）'
};
const TIP = {
  flat: '唱之前先在心裡想好第一個音，聲音位置放高一點、氣多一點。',
  sharp: '放鬆喉嚨、音量收一點，不要太用力。',
  unstable: '先放慢速度，把每個字唱長、唱穩，再慢慢加快。',
  droop: '唱長音時把氣留到最後，可以先放慢速度練副歌的長音。',
  rush: '先跟著伴奏打拍子，等拍點到了再出聲。',
  drag: '提前吸氣，拍點一到就出聲。'
};
const pct = (x) => `${Math.round(x * 100)}%`;
const keyText = (k) => (k > 0 ? `＋${k}` : k < 0 ? `−${-k}` : '原 Key');

/** items: [{ rec, stats }]，已經照日期由舊到新排好 */
export function buildTracking(items) {
  const first = items[0], last = items[items.length - 1];
  const a = first.stats, b = last.stats;
  const titles = [...new Set(items.map((x) => x.rec.title))];
  const sameSong = titles.length === 1;
  const n = items.length;

  // 改善的地方：最新一次和最早一次比
  const better = [];
  if (b.rate > a.rate + 0.02) better.push(`唱對的比例從 ${pct(a.rate)} 進步到 ${pct(b.rate)}。`);
  if (b.avgDev < a.avgDev - 0.03) better.push(`平均音準偏差從 ${a.avgDev.toFixed(1)} 個半音降到 ${b.avgDev.toFixed(1)} 個半音。`);
  Object.keys(LABEL).forEach((k) => {
    const x = a.issues[k] ?? 0, y = b.issues[k] ?? 0;
    if (x > y) better.push(y ? `「${LABEL[k]}」的句數從 ${x} 句減少到 ${y} 句。` : `上次有 ${x} 句「${LABEL[k]}」，這次沒有了。`);
  });
  if (!better.length) better.push('這幾次的表現差不多，很穩定！持續練習就會看到進步。');

  // 共同的問題：每一次都有的
  // 每次都有的問題，句數多的排前面，最多列三個
  const total = (k) => items.reduce((s, x) => s + (x.stats.issues[k] ?? 0), 0);
  const common = Object.keys(LABEL).filter((k) => items.every((x) => (x.stats.issues[k] ?? 0) > 0))
    .sort((p, q) => total(q) - total(p)).slice(0, 3);
  const times = ['', '一', '兩', '三', '四', '五', '六'][n] ?? n;
  const commonLines = common.map((k) => `${LABEL[k]}：${times}次分別有 ${items.map((x) => `${x.stats.issues[k]} 句`).join('、')}。`);
  if (!commonLines.length) commonLines.push('沒有每一次都出現的問題，很棒！');

  // 待改進之處：共同的問題優先，再加上最新一次還有的
  const todo = [...new Set([...common, ...Object.keys(LABEL).filter((k) => (b.issues[k] ?? 0) > 0)])].slice(0, 3).map((k) => TIP[k]);
  if (!todo.length) todo.push('繼續保持！可以挑戰新的歌，或試試升一個 Key。');

  // 綜合一段話
  const who = sameSong ? `綜合${times}次〈${titles[0]}〉的演唱` : `綜合這${times}次演唱（${titles.map((t) => `〈${t}〉`).join('、')}）`;
  const trend = b.rate > a.rate + 0.02 ? '唱對的句子變多了，進步很明顯' : b.rate < a.rate - 0.02 ? (sameSong ? '這次唱對的比例稍微少一點，可能是狀況不同，多唱幾次就會穩定' : '最近這首比較難，唱對的比例稍微少一點是正常的') : '表現很穩定';
  const commonText = common.length ? `；${common.slice(0, 2).map((k) => LABEL[k]).join('和')}每次都有，是接下來可以加強的地方` : '，沒有反覆出現的問題';
  const summary = `${who}，${trend}${commonText}。`;

  return { summary, better, common: commonLines, todo, items };
}

const list = (arr) => arr.map((t) => `<li>${esc(t)}</li>`).join('');

export function trackingHTML(t) {
  const cards = t.items.map(({ rec, stats }, i) => `
    ${i ? '<span class="t-arrow" aria-hidden="true">→</span>' : ''}
    <div class="t-card">
      <span class="t-card__meta">${esc(rec.date)}・${rec.key ? `Key ${keyText(rec.key)}` : '原 Key'}</span>
      <b class="t-card__song">${esc(rec.title)} － ${esc(rec.artist)}</b>
      <span class="t-card__num">${pct(stats.rate)}<small>唱對 ${stats.okLines} / ${stats.scored} 句</small></span>
    </div>`).join('');
  return `
    <div class="t-head">
      <div><div class="eyebrow">TRACKING</div><h2 class="t-title">追蹤報告</h2></div>
      <span class="r-head__ai">AI 分析・僅供參考</span>
    </div>
    <div class="t-cards">${cards}</div>
    <div class="t-body">
      <p class="t-summary">${esc(t.summary)}</p>
      <div class="t-boxes">
        <div class="t-box t-box--good"><b>改善的地方</b><ul>${list(t.better)}</ul></div>
        <div class="t-box t-box--bad"><b>共同的問題</b><ul>${list(t.common)}</ul></div>
        <div class="t-box t-box--todo"><b>待改進之處</b><ul>${list(t.todo)}</ul></div>
      </div>
    </div>
    <div class="t-note">此報告不會儲存</div>`;
}
