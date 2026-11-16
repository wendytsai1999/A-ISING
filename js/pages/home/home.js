// 首頁：三個步驟、儲存、報告、第一次／再次進入的提示
import { store } from '../../store.js';
import { loadSongs, loadDemoUser } from '../../data.js';
import { today } from '../../util.js';
import { renderNav } from '../../components/nav.js';
import { openDialog } from '../../components/dialog.js';
import { showToast } from '../../components/toast.js';
import { askMic } from '../../components/mic-prompt.js';
import { initDemoPanel } from '../../components/demo-panel.js';
import { RangeStep } from './range-step.js';
import { PitchStep } from './pitch-step.js';
import { SongStep } from './song-step.js';
import { reportHTML, playAnalyzing } from './report.js';
import { buildScenarios } from './scenarios.js';

const pick = (o) => ({ range: o?.range ?? null, pitch: o?.pitch ?? null, song: o?.song ?? null });
const same = (a, b) => JSON.stringify(pick(a)) === JSON.stringify(pick(b));

async function main() {
  let songs, demo;
  try {
    [songs, demo] = await Promise.all([loadSongs(), loadDemoUser()]);
  } catch (err) {
    document.querySelector('.main').innerHTML = `<p style="font-size:16px;line-height:2">讀不到 data 資料夾裡的 JSON。<br>請用 VS Code 的 Live Server（或 GitHub Pages）開這個網頁，不要直接雙擊 HTML 檔。</p>`;
    throw err;
  }

  renderNav(document.getElementById('nav'), { active: 'home', initial: demo.user.initial });
  document.querySelector('[data-act="logout"]').addEventListener('click', () => store.update((d) => { d.loggedIn = false; }));

  // 已儲存的資料（報告用）和這次畫面上的資料（按儲存才會寫回去）
  let saved = store.get().saved;
  const draft = pick(saved);
  let busy = null;

  const saveBtn = document.getElementById('save-btn');
  const saveNote = document.getElementById('save-note');
  const reportBox = document.getElementById('report');

  const ctx = {
    songs,
    getDraft: () => draft,
    setDraft(key, value) { draft[key] = value; refresh(); },
    isBusy: () => busy,
    setBusy(v) { busy = v; refresh(); },
    countRun(key) { store.update((d) => { d.runs[key] += 1; }); },
    async ensureMic() {
      if (store.get().micAllowed) return true;
      const ok = await askMic();
      if (ok) {
        store.update((d) => { d.micAllowed = true; });
        return true;
      }
      await openDialog({ eyebrow: 'MICROPHONE', heading: '需要麥克風權限', body: '請點網址列左邊的鎖頭圖示，把「麥克風」改成允許，並重新整理。' });
      return false;
    },
    // 第一次用 first，之後（按重新）用 retest，結果稍微不一樣
    rangePlan() {
      const v = store.get().runs.range > 0 ? 'retest' : 'first';
      return { ...demo.range[v], autoStop: demo.range.autoStopSeconds };
    },
    pitchPlan() {
      const v = store.get().runs.pitch > 0 ? 'retest' : 'first';
      return { targets: demo.pitch.targets, outcomes: demo.pitch[v], retry: true };
    }
  };

  const steps = [
    new RangeStep(document.getElementById('step-range'), ctx),
    new PitchStep(document.getElementById('step-pitch'), ctx),
    new SongStep(document.getElementById('step-song'), ctx)
  ];

  function refresh() {
    steps.forEach((s) => s.updateLock?.());
    const hasData = !!(draft.range || draft.pitch || draft.song);
    const changed = !saved || !same(draft, saved);
    saveBtn.disabled = !!busy || !hasData || !changed;
    saveBtn.classList.toggle('btn--primary', !saveBtn.disabled);
    if (saved && changed && hasData) saveNote.textContent = '有新的結果，按儲存後才會更新下面的報告';
    else if (saved) saveNote.textContent = `已儲存・${saved.date}`;
    else saveNote.textContent = '';
  }

  function showReport() {
    if (!saved) { reportBox.classList.add('is-hidden'); return; }
    reportBox.classList.remove('is-hidden');
    reportBox.innerHTML = reportHTML(saved, songs);
  }

  // 儲存：AI 分析中 → 報告 → 右上角「已儲存」
  saveBtn.addEventListener('click', async () => {
    if (saveBtn.disabled) return;
    ctx.setBusy('save');
    reportBox.classList.remove('is-hidden');
    reportBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await playAnalyzing(reportBox);
    saved = { ...pick(draft), date: today() };
    store.update((d) => { d.saved = saved; });
    showReport();
    ctx.setBusy(null);
    showToast('已儲存，報告產生完成');
  });

  const goPractice = () => { location.href = 'practice.html'; };
  reportBox.addEventListener('click', (e) => { if (e.target.closest('[data-act="go-practice"]')) goPractice(); });

  // 直接練唱：沒有任何測驗資料時先確認
  document.getElementById('skip-btn').addEventListener('click', async () => {
    if (!draft.range && !draft.pitch) {
      const r = await openDialog({
        eyebrow: 'SKIP', heading: '要直接練唱嗎？',
        body: '跳過後不會產生聲音報告，Key 會維持原 Key。之後可以隨時回首頁補測。',
        secondary: '回去測驗', primary: '直接練唱'
      });
      if (r !== 'primary') return;
    }
    goPractice();
  });

  refresh();
  showReport();

  // 展示情境面板
  initDemoPanel({
    groups: buildScenarios({ songs, demo })
  });

  // 第一次進入：開始之前；之後每次進入：提醒用有線耳麥
  const first = !store.get().seenWelcome;
  if (first) {
    await openDialog({
      eyebrow: 'BEFORE YOU START', heading: '開始之前',
      bodyHTML: `
        <div class="dialog__point"><span class="dialog__point-no">01</span><div><b>隱私</b><span class="dialog__text">你的錄音和報告會存在雲端，只有你看得到，可以隨時刪除。</span></div></div>
        <div class="dialog__point"><span class="dialog__point-no">02</span><div><b>設備</b><span class="dialog__text">請使用有線耳麥。藍牙耳機會延遲，影響音準判斷。</span></div></div>`
    });
    store.update((d) => { d.seenWelcome = true; });
  } else {
    await openDialog({ eyebrow: 'HEADSET', heading: '請使用有線耳麥', body: '藍牙耳機會延遲，影響音準判斷。' });
  }
}

main();
