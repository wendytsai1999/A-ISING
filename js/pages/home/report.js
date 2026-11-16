// 首頁下方的「你的聲音報告」：依有做的步驟自動組合，沒做的部分用灰字說明。
import { esc } from '../../util.js';
import { describeSpan, suggestKey, keyLabel, toMidi } from '../../music.js';

const row = (title, inner) => `
  <div class="report__row"><b>${title}</b>${inner}</div>`;
const grey = (t) => `<p class="muted">${t}</p>`;

function voiceText(range, pitch) {
  const parts = [];
  if (range) parts.push(`你的音域約 ${range.low} 到 ${range.high}，${describeSpan(range.low, range.high)}，大部分華語流行歌都唱得到。`);
  if (pitch) {
    const n = (k) => pitch.results.filter((r) => r.result === k).length;
    const ok = n('ok'), off = n('off'), none = n('none');
    const total = pitch.results.length;
    let s = total < 5 ? `聽音跟唱測了 ${total} 個音（沒測完），其中 ${ok} 個在半音之內` : `聽音跟唱 5 個音中有 ${ok} 個在半音之內`;
    if (off) s += `，${off} 個偏差超過半音`;
    if (none) s += `，${none} 個沒收到聲音`;
    s += ok / total >= 0.8 ? '，音準不錯' : ok / total >= 0.6 ? '，音準大致不錯' : '，音準還有進步空間';
    s += off ? '；長音的尾端容易往下掉，可以多練習把氣撐到最後。' : '。';
    parts.push(s);
  }
  if (range && !pitch) parts.push('還沒做聽音跟唱，所以音準的部分這次沒有分析。');
  if (!range && pitch) parts.push('還沒測音域，所以這次不知道你適合多高的歌。');
  return parts.join('');
}

/** 推薦歌單：原 Key 能唱的挑兩首，再各挑一首降 Key、升 Key 的，示範不同建議 */
function pickRecs(songs, range, exceptId) {
  const all = songs.filter((s) => s.id !== exceptId).map((s) => ({ s, k: suggestKey(s, range) }));
  const same = all.filter((x) => x.k.kind === 'same').slice(0, 2);
  const down = all.filter((x) => x.k.kind === 'down').sort((a, b) => b.k.shift - a.k.shift)[0];
  const up = all.filter((x) => x.k.kind === 'up').sort((a, b) => a.k.shift - b.k.shift)[0];
  return [...same, down, up].filter(Boolean);
}

function songText(song, range) {
  const name = `〈${esc(song.title)}〉`;
  const base = `${name}的音域大約從 ${song.low} 到 ${song.high}。`;
  if (!range) return `${base}因為還不知道你的音域，先用原 Key 練唱；測完音域後，可以告訴你要不要升降 Key。`;
  const k = suggestKey(song, range);
  if (k.kind === 'same') return `${base}整首都在你的音域（${range.low} 到 ${range.high}）裡，用原 Key 就可以。`;
  if (k.kind === 'down') return `${base}最高音 ${song.high} 比你的最高音 ${range.high} 高 ${toMidi(song.high) - toMidi(range.high)} 個半音。建議降 ${-k.shift} Key，讓整首歌落在你的音域內。`;
  if (k.kind === 'up') return `${base}最低音 ${song.low} 比你的最低音 ${range.low} 低 ${toMidi(range.low) - toMidi(song.low)} 個半音。建議升 ${k.shift} Key，讓整首歌落在你的音域內。`;
  if (k.kind === 'wide') return `${base}這首歌跨了 ${k.songSpan} 個半音，比你目前的音域（${k.userSpan} 個半音）還寬，換 Key 也很難整首唱完。可以先從推薦歌單挑一首，之後再挑戰。`;
  return `${base}要調 ${Math.abs(k.shift)} Key 才唱得到，調太多會跟原曲差很多，先不推薦這首。可以先從推薦歌單挑一首。`;
}

export function reportHTML({ range, pitch, song, date }, songs) {
  const s = songs.find((x) => x.id === song);
  const voice = range || pitch
    ? `<p>${voiceText(range, pitch)}</p>`
    : grey('還沒有測音域和聽音跟唱，所以這次沒辦法分析你的聲音。完成 01、02 後再按一次儲存，就會補上。');
  const recs = range
    ? `<div class="recs">${pickRecs(songs, range, song).map(({ s: x, k }) => `
        <div class="recs__item"><span class="recs__name">${esc(x.title)} － ${esc(x.artist)}</span><span>${keyLabel(k)}</span></div>`).join('')}</div>`
    : grey('需要先測音域，才能推薦適合你的歌和 Key。');
  const songPart = s ? `<p>${songText(s, range)}</p>` : grey('還沒選歌。選好歌後再按一次儲存，就會告訴你這首歌要不要升降 Key。');
  return `
    <div class="report__head">
      <div><div class="eyebrow">AI REPORT</div><h2 class="report__title">你的聲音報告</h2></div>
      <span class="report__date">${esc(date)}</span>
      <span class="report__ai">AI 分析・僅供參考</span>
    </div>
    ${row('聲音報告', voice)}
    ${row('推薦歌單與建議 Key', recs)}
    ${row('選歌分析', songPart)}
    <button class="btn btn--primary btn--huge" data-act="go-practice">唱歌去 →</button>`;
}

export { playAnalyzing, failedHTML } from '../../components/analyzing.js';
