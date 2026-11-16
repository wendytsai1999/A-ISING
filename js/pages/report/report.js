// 練唱報告頁（照 Mid 的 Report／ReportAnalyzing／ReportDownload）：
// 標題、唱對句數、Key、綜合評價、逐句建議、整首播放（只播有唱的段落）、下載、再唱一次。
// 從練唱頁按「AI 分析」過來時，先在這頁播「AI 正在分析」，播完才出現報告。
import { store } from '../../store.js';
import { loadDemoUser } from '../../data.js';
import { esc, makeRun } from '../../util.js';
import { toName } from '../../music.js';
import { renderNav } from '../../components/nav.js';
import { showToast } from '../../components/toast.js';
import { playAnalyzing } from '../../components/analyzing.js';
import { audioUrl } from '../../practice/song.js';
import { currentRecords, takeRecord, openRecord } from '../../records/records.js';
import { earlyOf, profileOf } from '../../practice/fake-user.js';
import { ANALYZE_STEPS } from '../practice/scenarios.js';
import { playLine, renderMix, sungSegments, mixLength, loadBuffer, voiceUrl } from '../../audio/sing.js';

// 從紀錄頁「查看」過來：report.html?rec=紀錄 id；沒有就是最近一次練唱
const REC_ID = new URLSearchParams(location.search).get('rec');

const $ = (sel) => document.querySelector(sel);
const keyText = (k) => (k > 0 ? `+${k}` : k < 0 ? `−${-k}` : '0');
const signed = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}`;
const two = (n) => String(n).padStart(2, '0');
const mmss = (s) => `${two(Math.floor(s / 60))}:${two(Math.floor(s % 60))}`;
const minSec = (s) => (s >= 60 ? `${Math.floor(s / 60)} 分 ${Math.floor(s % 60)} 秒` : `${Math.floor(s)} 秒`);

// 返回鍵回到這頁時，瀏覽器可能直接拿舊畫面（停在分析中），所以重新載入
window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

async function main() {
  let demo, take, rec;
  try {
    demo = await loadDemoUser();
    take = store.get().take;
    if (REC_ID) rec = (await currentRecords()).find((r) => r.id === REC_ID && r.song);
    else if (take) rec = takeRecord(take);
  } catch (err) {
    $('#main').innerHTML = `<p style="font-size:16px;line-height:2">讀不到 data 資料夾裡的檔案。<br>請用 VS Code 的 Live Server（或 GitHub Pages）開這個網頁，不要直接雙擊 HTML 檔。</p>`;
    throw err;
  }
  renderNav($('#nav'), { active: REC_ID ? 'records' : 'report', initial: demo.user.initial });
  $('[data-act="logout"]').addEventListener('click', () => store.update((d) => { d.loggedIn = false; }));

  if (!rec) {
    $('#main').innerHTML = `
      ${headHTML('練唱報告', '')}
      <div class="r-empty">
        <h2>${REC_ID ? '找不到這筆紀錄' : '還沒有練唱報告'}</h2>
        <p>${REC_ID ? '這筆紀錄可能已經刪除了。' : '到練唱頁錄一段，按「AI 分析」，報告就會出現在這裡。'}</p>
        <a class="btn btn--primary btn--big" href="practice.html">去練唱 →</a>
      </div>`;
    return;
  }

  const { song, singer, sung, result } = await openRecord(rec);
  const { key } = rec;
  const voice = rec.voice;
  const title = song.title;   // 跟練唱頁一樣：歌名、歌手同一排
  const sub = `${song.artist}・${rec.date}`;
  const cards = (evalHTML) => `
    <div class="r-cards">
      <section class="r-card"><div class="r-big"><span class="r-big__num">${result.okLines}</span><span class="r-big__of"> / ${result.scored}</span></div><div class="r-card__label">唱對的句數</div></section>
      <section class="r-card"><div class="r-big"><span class="r-big__num">${keyText(key)}</span></div><div class="r-card__label">這次用的 Key</div></section>
      <section class="r-card r-card--eval"><b>綜合評價</b>${evalHTML}</section>
    </div>`;

  // ---------- 分析中（從練唱頁剛過來） ----------
  if (!REC_ID && take.pending) {
    $('#main').innerHTML = `
      ${headHTML(title, sub)}
      ${cards('<div class="r-ph" style="width:90%"></div><div class="r-ph" style="width:70%"></div>')}
      <section class="r-panel r-panel--center" id="az"></section>`;
    await playAnalyzing($('#az'), makeRun(), { steps: ANALYZE_STEPS, title: 'AI 正在分析你的演唱' });
    store.update((d) => { if (d.take) d.take.pending = false; });
  }

  // ---------- 報告 ----------
  const segs = sungSegments(song, sung);
  const total = mixLength(segs);
  $('#main').innerHTML = `
    ${headHTML(title, sub)}
    ${cards(`<p class="r-eval">${summary(result)}</p>`)}

    <section class="r-panel">
      <div class="r-panel__head"><b>逐句建議</b><span>共 ${result.lines.length} 句</span></div>
      ${result.lines.map((l) => lineHTML(l)).join('') || '<p class="r-none">這次沒有錄到完整的句子。</p>'}
    </section>

    <section class="r-player">
      <b class="r-player__title">整首播放</b>
      <span class="r-seg" id="whole-mode"><button data-mode="original" aria-pressed="true">有原唱人聲</button><button data-mode="inst" aria-pressed="false">無原唱人聲</button></span>
      <input type="range" class="r-progress" id="whole-prog" min="0" max="1000" value="0" aria-label="播放進度">
      <span class="r-time" id="whole-time">00:00 / ${mmss(total)}</span>
      <button class="r-play" id="whole-play" aria-label="播放">▶</button>
      <span class="r-dl">
        <button class="btn" id="dl-btn" aria-haspopup="menu" aria-expanded="false">↓ 下載</button>
        <div class="r-menu is-hidden" role="menu" id="dl-menu">
          <button role="menuitem" data-dl="original"><span class="r-menu__icon">↓</span><span><b>我的歌聲＋原唱人聲</b><small>WAV・${minSec(total)}</small></span></button>
          <button role="menuitem" data-dl="inst"><span class="r-menu__icon">↓</span><span><b>我的歌聲＋伴奏</b><small>無原唱・WAV・${minSec(total)}</small></span></button>
        </div>
      </span>
    </section>

    <div class="r-foot">
      <a class="btn btn--big r-foot__again" href="practice.html?song=${song.id}&amp;key=${key}">再唱一次</a>
      <a class="btn btn--primary btn--big r-foot__right" href="records.html">歷史紀錄</a>
    </div>`;


  function lineHTML(l) {
    const line = song.lines[l.li];
    const p = profileOf(singer, l.li);
    const targets = line.chars.map((c) => c.midi + key);
    const center = (Math.max(...targets) + Math.min(...targets)) / 2;
    const top = (m) => Math.max(0, Math.min(44, 22 - (m - center) * 4));   // 1 個半音＝4px
    const sungSet = new Set(sung[l.li]);
    const stat = new Map(l.chars.map((c) => [c.ci, c]));
    const early = earlyOf(singer, l.li);
    const firstSung = Math.min(...sung[l.li]);
    const last = line.chars.length - 1;

    const cols = line.chars.map((c, ci) => {
      const t = targets[ci];
      const s = stat.get(ci);
      const isSung = sungSet.has(ci);
      let user = '', row1 = '', row2 = '';
      if (isSung && !l.unclear && s) {
        if (p.name === 'droop' && ci === last && !s.ok) {
          user = `<i class="r-bar r-bar--ok" style="top:${top(t)}px;width:22px"></i><i class="r-bar r-bar--off r-bar--drop" style="top:${top(t) + 3}px"></i>`;
        } else {
          // 搶拍往左、拖拍往右，最多 18px
          const shift = early ? -Math.sign(early) * Math.min(18, (Math.abs(early) / Math.max(0.1, c.end - c.start)) * 40) : 0;
          user = `<i class="r-bar ${s.ok ? 'r-bar--ok' : 'r-bar--off'}" style="top:${top(t + s.mean)}px;left:${shift}px"></i>`;
          if (early) user += '<i class="r-beat"></i>';
        }
        if (early && ci === firstSung) row1 = early > 0 ? `← 早 ${early.toFixed(1)} 秒` : `晚 ${(-early).toFixed(1)} 秒 →`;
        else if (!s.ok) { row1 = s.sungAs; row2 = signed(s.mean); }
      }
      return `
        <div class="r-ch ${isSung ? '' : 'is-unsung'}">
          <span class="r-ch__t">${esc(c.t)}</span>
          <div class="r-ch__bars"><i class="r-bar r-bar--target" style="top:${top(t)}px"></i>${user}</div>
          <span class="r-ch__note">${toName(t)}</span>
          <span class="r-ch__dev">${esc(row1)}</span>
          <span class="r-ch__dev">${esc(row2)}</span>
        </div>`;
    }).join('');
    return `
      <article class="r-line ${l.unclear ? 'is-unclear' : ''}" data-li="${l.li}">
        <span class="r-line__no">${two(l.li + 1)}</span>
        <div class="r-line__body">
          <span class="r-tag r-tag--${l.tagKind}">${esc(l.tag)}</span>
          <div class="r-chars">${cols}</div>
          <p class="r-line__advice">${esc(l.advice)}</p>
        </div>
        <div class="r-line__btns">
          <button class="r-pill" data-play="me">▶ 我的歌聲</button>
          <button class="r-pill" data-play="orig">▶ 原唱</button>
        </div>
      </article>`;
  }

  // ---------- 逐句播放 ----------
  let playing = null; // { btn, label, stop }
  const stopPlaying = () => {
    if (!playing) return;
    playing.stop();
    playing.btn.classList.remove('is-playing');
    playing.btn.textContent = playing.label;
    playing = null;
  };
  const origAudio = new Audio(audioUrl(song, 'original', key));
  origAudio.preload = 'auto';
  loadBuffer(voiceUrl(voice, key)).catch((err) => console.warn(err)); // 先在背景讀好我的歌聲

  $('#main').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-play]');
    if (!btn) return;
    const li = Number(btn.closest('[data-li]').dataset.li);
    const was = playing?.btn === btn;
    stopPlaying();
    pauseWhole();
    if (was) return;
    const label = btn.textContent;
    btn.classList.add('is-playing');
    btn.textContent = '■ 停止';
    const line = song.lines[li];
    if (btn.dataset.play === 'me') {
      const me = { btn, label, stop() { this.cancelled = true; } };
      playing = me;
      try {
        const h = await playLine(song, singer, key, li, sung[li], voice);
        if (me.cancelled) { h.stop(); return; }
        me.stop = h.stop;
        h.done.then(() => { if (playing === me) stopPlaying(); });
      } catch (err) {
        console.error(err);
        if (playing === me) stopPlaying();
        showToast('讀不到我的歌聲音檔');
      }
    } else {
      origAudio.currentTime = Math.max(0, line.start - 0.3);
      origAudio.play();
      const timer = setInterval(() => { if (origAudio.currentTime >= line.end + 0.4) stopPlaying(); }, 100);
      playing = { btn, label, stop: () => { clearInterval(timer); origAudio.pause(); } };
    }
  });

  // ---------- 整首播放（只接有唱的段落）、下載 ----------
  const mixes = {};
  const getMix = (mode) => (mixes[mode] ??= renderMix(song, singer, sung, { trackUrl: audioUrl(song, mode, key), key, voiceFile: voice }));
  const player = new Audio();
  let wholeMode = 'original';
  let loadedMode = null;
  const playBtn = $('#whole-play'), prog = $('#whole-prog');
  let seeking = false;

  function pauseWhole() { player.pause(); }
  function paint() {
    const d = player.duration || total;
    const t = player.currentTime || 0;
    if (!seeking) prog.value = Math.round((t / d) * 1000);
    prog.style.setProperty('--p', `${(prog.value / 10)}%`);
    $('#whole-time').textContent = `${mmss(t)} / ${mmss(d)}`;
    playBtn.textContent = player.paused ? '▶' : 'II';
    playBtn.setAttribute('aria-label', player.paused ? '播放' : '暫停');
  }
  ['timeupdate', 'play', 'pause', 'ended', 'loadedmetadata'].forEach((ev) => player.addEventListener(ev, paint));

  async function ensureLoaded() {
    if (loadedMode === wholeMode) return true;
    const mode = wholeMode;
    playBtn.disabled = true;
    playBtn.innerHTML = '<span class="spinner"></span>';
    try {
      const blob = await getMix(mode);
      if (mode !== wholeMode) return false;
      const t = player.currentTime || 0;
      player.src = URL.createObjectURL(blob);
      loadedMode = mode;
      await new Promise((res) => player.addEventListener('loadedmetadata', res, { once: true }));
      player.currentTime = Math.min(t, player.duration - 0.1);
      return true;
    } catch (err) {
      console.error(err);
      showToast('播放失敗，請重新整理再試一次');
      return false;
    } finally {
      playBtn.disabled = false;
      paint();
    }
  }

  playBtn.addEventListener('click', async () => {
    if (!player.paused) { player.pause(); return; }
    stopPlaying();
    if (await ensureLoaded()) player.play();
  });
  prog.addEventListener('input', async () => {
    seeking = true;
    prog.style.setProperty('--p', `${prog.value / 10}%`);
    if (loadedMode) player.currentTime = (prog.value / 1000) * (player.duration || total);
  });
  prog.addEventListener('change', () => { seeking = false; paint(); });
  $('#whole-mode').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b || b.dataset.mode === wholeMode) return;
    wholeMode = b.dataset.mode;
    $('#whole-mode').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const wasPlaying = !player.paused;
    player.pause();
    if (loadedMode && await ensureLoaded() && wasPlaying) player.play();
  });

  const menu = $('#dl-menu'), dlBtn = $('#dl-btn');
  const toggleMenu = (open) => { menu.classList.toggle('is-hidden', !open); dlBtn.setAttribute('aria-expanded', String(open)); dlBtn.classList.toggle('is-open', open); };
  dlBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(menu.classList.contains('is-hidden')); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.r-dl')) toggleMenu(false); });
  menu.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', async () => {
    const mode = b.dataset.dl;
    toggleMenu(false);
    dlBtn.disabled = true;
    dlBtn.innerHTML = '<span class="spinner"></span> 混音中…';
    try {
      const blob = await getMix(mode);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${song.title}_我的歌聲+${mode === 'inst' ? '伴奏' : '原唱人聲'}_Key${keyText(key)}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('已開始下載');
    } catch (err) {
      console.error(err);
      showToast('下載失敗，請重新整理再試一次');
    } finally {
      dlBtn.disabled = false;
      dlBtn.textContent = '↓ 下載';
    }
  }));
  paint();
}

function headHTML(title, sub) {
  return `
    <header class="r-head">
      <div class="r-head__title">
        <div class="eyebrow">REPORT</div>
        <div class="p-head__row"><h1 class="main__title">${esc(title)}</h1>${sub ? `<span class="r-head__sub">${esc(sub)}</span>` : ''}</div>
      </div>
      <span class="r-head__ai">AI 分析・僅供參考</span>
    </header>`;
}

/** 綜合評價：依每句的結果組一段話 */
function summary(r) {
  if (!r.lines.length) return '這次沒有錄到完整的字，所以沒有分析。';
  const count = (name) => r.lines.filter((l) => l.name === name).length;
  const parts = [];
  const rate = r.scored ? r.okLines / r.scored : 0;
  // 先肯定，再說可以加強的地方
  parts.push(rate >= 0.7 ? `唱得很好！${r.scored} 句裡唱對了 ${r.okLines} 句，大部分的字都在音上。` : rate >= 0.4 ? `有一半左右的句子都唱對了，進步空間很大！` : '完整唱完一次就很棒了！這次偏掉的句子比較多，可以先用原唱跟唱，熟悉旋律後再用伴奏。');
  const issues = [
    ['flat', '有幾句整句偏低'],
    ['sharp', '有幾句偏高，可能太用力'],
    ['unstable', '有幾句高低不穩'],
    ['droop', '長音尾端會往下掉'],
    ['rush', '有地方比伴奏早唱'],
    ['drag', '有地方比伴奏晚進來']
  ].filter(([n]) => count(n)).map(([, t]) => t);
  if (issues.length) parts.push(`可以再加強的地方：${issues.join('，')}。`);
  const tips = [];
  if (count('flat') || count('droop')) tips.push('唱高音和長音時把氣撐住');
  if (count('sharp')) tips.push('放鬆喉嚨');
  if (count('rush')) tips.push('先聽伴奏的拍點再出聲');
  if (count('drag')) tips.push('提前吸氣、拍點一到就出聲');
  if (tips.length) parts.push(`下次可以${tips.join('、')}。`);
  if (r.unclear.length) parts.push(`有 ${r.unclear.length} 句聽不清楚，沒有評分。`);
  return parts.join('');
}

main();
