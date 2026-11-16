// 紀錄頁（照 Mid 的 Records 系列）：認識你的聲音、最多六筆演唱紀錄、勾選兩筆以上做綜合分析（追蹤報告）。
// 展示情境用 records.html?demo=… 開在舞台的框框裡，不會動到真正的紀錄：
//   fail＝追蹤報告沒有成功、full＝紀錄已滿，等待存入 → 刪除一筆 → 自動存入
import { store } from '../../store.js';
import { loadDemoUser, loadSongs } from '../../data.js';
import { esc, makeRun, today } from '../../util.js';
import { suggestKey } from '../../music.js';
import { renderNav } from '../../components/nav.js';
import { openDialog } from '../../components/dialog.js';
import { showToast } from '../../components/toast.js';
import { alertHTML } from '../../components/alert.js';
import { playAnalyzing, failedHTML } from '../../components/analyzing.js';
import { initDemoPanel } from '../../components/demo-panel.js';
import { currentRecords, deleteRecord, loadRecordFile, statsOf, hasReport } from '../../records/records.js';
import { buildTracking, trackingHTML } from './tracking.js';
import { buildScenarios } from './scenarios.js';

const $ = (sel) => document.querySelector(sel);
const DEMO = new URLSearchParams(location.search).get('demo');
const keyText = (k) => (k > 0 ? `＋${k}` : k < 0 ? `−${-k}` : '0');
const TRACK_STEPS = ['整理勾選的紀錄', '比較每次的音準和節奏', '找出進步和共同的問題'];

async function main() {
  let demoUser, file, songs, records;
  try {
    [demoUser, file, songs, records] = await Promise.all([loadDemoUser(), loadRecordFile(), loadSongs(), currentRecords()]);
  } catch (err) {
    $('#main').innerHTML = `<p style="font-size:16px;line-height:2">讀不到 data 資料夾裡的檔案。<br>請用 VS Code 的 Live Server（或 GitHub Pages）開這個網頁，不要直接雙擊 HTML 檔。</p>`;
    throw err;
  }
  renderNav($('#nav'), { active: 'records', initial: demoUser.user.initial });
  $('[data-act="logout"]').addEventListener('click', () => store.update((d) => { d.loggedIn = false; }));

  // ---------- 狀態（展示情境只存在記憶體裡） ----------
  const S = {
    records: DEMO ? file.records.map((r) => ({ ...r })) : records,
    voice: DEMO ? demoVoice(file.demo.voice, demoUser) : realVoice(store.get().saved),
    pending: DEMO === 'full' ? { ...file.demo.pending, date: today(), isNew: true } : null,
    selected: new Set(DEMO === 'fail' ? ['rewind-1112', 'rewind-1105'] : []),
    newId: null,
    failNext: DEMO === 'fail',
    tracking: null
  };

  function voiceHTML() {
    const v = S.voice;
    if (!v) {
      return `<section class="rc-voice is-empty"><b>認識你的聲音</b><span class="muted">還沒有儲存的測驗結果。到首頁做完測驗按「儲存」，就會出現在這裡。</span><a class="link-arrow" href="home.html">去首頁 →</a></section>`;
    }
    const song = songs.find((s) => s.id === v.song);
    let songText = '－';
    if (song) {
      const k = v.range ? suggestKey(song, v.range) : null;
      const key = k && ['same', 'up', 'down'].includes(k.kind) ? `（${k.shift ? keyText(k.shift) : '原 Key'}）` : '';
      songText = `${song.title} － ${song.artist}${key}`;
    }
    return `
      <section class="rc-voice">
        <b class="rc-voice__title">認識你的聲音</b><span class="rc-voice__date">${esc(v.date)}</span>
        <span>音域 <b>${v.range ? `${esc(v.range.low)}–${esc(v.range.high)}` : '－'}</b></span>
        <span>聽音跟唱 <b>${v.pitchOk === null ? '－' : `${v.pitchOk} / 5`}</b></span>
        <span class="rc-voice__song">選歌 <b>${esc(songText)}</b></span>
        <button class="rc-pill rc-voice__del" data-act="del-voice">刪除</button>
      </section>`;
  }

  function rowHTML(r) {
    const on = S.selected.has(r.id);
    return `
      <div class="rc-row ${on ? 'is-on' : ''}" data-id="${esc(r.id)}">
        <button class="rc-check" role="checkbox" aria-checked="${on}" aria-label="選擇 ${esc(r.date)} ${esc(r.title)}" data-act="check">${on ? '✓' : ''}</button>
        <span>${esc(r.date)}</span>
        <span class="rc-row__song">${esc(r.title)} － ${esc(r.artist)}${r.id === S.newId ? '<span class="rc-new">新</span>' : ''}</span>
        <span>${keyText(r.key)}</span>
        <b>${r._stats ? `${r._stats.okLines} / ${r._stats.scored}` : '…'}</b>
        <a class="rc-view" href="${hasReport(r) ? `report.html?rec=${encodeURIComponent(r.id)}` : '#'}" data-act="view">查看 →</a>
        <button class="rc-pill" data-act="del">刪除</button>
      </div>`;
  }

  function render() {
    const n = S.selected.size;
    $('#main').innerHTML = `
      <header class="rc-head">
        <div class="r-head__title"><div class="eyebrow">RECORDS</div><h1 class="main__title">演唱紀錄</h1></div>
        <span class="rc-count">${S.records.length}／${file.max} 筆</span>
      </header>
      ${voiceHTML()}
      ${S.pending ? alertHTML({ heading: `等待存入：${S.pending.title} － ${S.pending.artist}　${S.pending.date}`, body: '紀錄已滿，刪除一筆舊紀錄後會自動存入。', closable: false }) : ''}
      <section class="rc-table">
        <div class="rc-row rc-row--head"><span></span><span>日期</span><span>歌曲</span><span>Key</span><span>唱對句數</span><span></span><span></span></div>
        ${S.records.map(rowHTML).join('') || '<p class="r-none">還沒有紀錄。到練唱頁唱一段，按「AI 分析」就會存進來。</p>'}
      </section>
      <div class="rc-bar">
        <button class="btn btn--big ${n >= 2 ? 'btn--primary' : ''}" id="track-btn" ${n >= 2 ? '' : 'disabled'}>綜合分析（已選 ${n} 筆）</button>
        ${n < 2 ? '<span class="rc-bar__note">請至少選擇 2 筆紀錄</span>' : ''}
      </div>
      <section class="rc-track ${S.tracking ? '' : 'is-hidden'}" id="track" aria-live="polite">${S.tracking ?? ''}</section>`;
  }

  // 每筆的唱對句數（真的分析一次）
  async function fillStats() {
    await Promise.all([...S.records, S.pending].filter(Boolean).map(async (r) => { r._stats ??= await statsOf(r); }));
    render();
  }

  // ---------- 操作 ----------
  $('#main').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const row = btn.closest('[data-id]');
    const rec = row && S.records.find((r) => r.id === row.dataset.id);
    const act = btn.dataset.act;

    if (act === 'check' && rec) {
      S.selected.has(rec.id) ? S.selected.delete(rec.id) : S.selected.add(rec.id);
      S.tracking = null;              // 換了勾選，舊的追蹤報告就不算了
      render();
    }
    if (act === 'view' && rec && !hasReport(rec)) {
      e.preventDefault();
      showToast('展示版只有〈倒帶〉和〈愛如潮水〉的完整報告');
    }
    if (act === 'view' && rec && hasReport(rec) && DEMO) e.preventDefault();
    if (act === 'del' && rec) await removeRecord(rec);
    if (act === 'del-voice') await removeVoice();
  });
  $('#main').addEventListener('click', (e) => { if (e.target.closest('#track-btn') || e.target.closest('#track [data-act="retry"]')) runTracking(); });

  async function removeRecord(rec) {
    const p = S.pending;
    const r = await openDialog({
      eyebrow: 'DELETE', heading: '刪除這筆紀錄？', item: `${rec.date}　${rec.title} － ${rec.artist}`,
      body: `這筆的錄音和報告會一起刪除，刪除後無法復原。${p ? `刪除後，〈${p.title}〉這次的演唱會自動存入。` : ''}`,
      secondary: '取消', primary: '刪除', tone: 'danger'
    });
    if (r !== 'primary') return;
    S.records = S.records.filter((x) => x.id !== rec.id);
    S.selected.delete(rec.id);
    S.tracking = null;
    if (!DEMO) deleteRecord(rec);
    if (p) {
      S.records.unshift(p);
      S.newId = p.id;
      S.pending = null;
      showToast(`已存入：〈${p.title}〉${p.date}`);
    } else {
      showToast('已刪除這筆紀錄');
    }
    render();
  }

  async function removeVoice() {
    const r = await openDialog({
      eyebrow: 'DELETE', heading: '刪除「認識你的聲音」？', item: `${S.voice.date}　音域・聽音跟唱・選歌`,
      body: '首頁的測驗結果和聲音報告會一起刪除，刪除後無法復原。',
      secondary: '取消', primary: '刪除', tone: 'danger'
    });
    if (r !== 'primary') return;
    S.voice = null;
    if (!DEMO) store.update((d) => { d.saved = null; });
    showToast('已刪除認識你的聲音');
    render();
  }

  let busy = false;
  async function runTracking() {
    if (busy || S.selected.size < 2) return;
    busy = true;
    const picked = S.records.filter((r) => S.selected.has(r.id)).sort((a, b) => a.date.localeCompare(b.date));
    const box = $('#track');
    box.classList.remove('is-hidden');
    box.classList.add('rc-track--center');
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const btn = $('#track-btn');
    btn.disabled = true;
    await playAnalyzing(box, makeRun(), { steps: TRACK_STEPS, title: 'AI 正在比較你的演唱' });
    busy = false;
    if (S.failNext) {
      S.failNext = false;
      // 和首頁、練唱頁一樣：失敗訊息直接顯示在報告區域
      box.innerHTML = failedHTML('你勾選的紀錄都還在，不會遺失。').replace('報告沒有產生成功', '追蹤報告沒有產生成功');
      return;
    }
    const items = await Promise.all(picked.map(async (rec) => ({ rec, stats: rec._stats ?? await statsOf(rec) })));
    S.tracking = trackingHTML(buildTracking(items));
    render();
    $('#track').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  render();
  await fillStats();

  // 展示情境：自動打開要展示的彈窗
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  if (DEMO === 'fail') { await sleep(900); runTracking(); }
  if (DEMO === 'voice') { await sleep(900); removeVoice(); }
  if (DEMO === 'full') {
    // 先勾選最舊的一筆，再按它的「刪除」
    await sleep(1200);
    const oldest = S.records[S.records.length - 1];
    if (oldest) {
      S.selected.add(oldest.id);
      render();
      await sleep(1000);
      removeRecord(oldest);
    }
  }
  if (!DEMO) initDemoPanel({ groups: buildScenarios() });
}

function realVoice(saved) {
  if (!saved || !(saved.range || saved.pitch || saved.song)) return null;
  const ok = saved.pitch ? saved.pitch.results.filter((r) => r.result === 'ok').length : null;
  return { date: saved.date, range: saved.range, pitchOk: ok, song: saved.song };
}
function demoVoice(v) {
  return { date: v.date, range: v.range, pitchOk: v.pitchOk, song: v.song };
}

main();
