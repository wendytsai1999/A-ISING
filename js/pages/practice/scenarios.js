// 練唱頁「展示情境」：紀錄滿六筆、沒按分析就離開、報告沒產生成功。
// 都在蓋版舞台裡演，不會動到這次的練唱。
import { el, esc, makeRun, CANCEL } from '../../util.js';
import { showToast } from '../../components/toast.js';
import { playAnalyzing, failedHTML } from '../../components/analyzing.js';

export const ANALYZE_STEPS = ['整理錄到的句子', '比對每個字的音高和節奏', '產生逐句建議'];

/** 舞台裡的靜態彈窗（樣式和真的彈窗一樣） */
function dialogScene({ eyebrow, heading, body, secondary, primary, tone, onSecondary, onPrimary }) {
  return (stage) => {
    const box = el(`
      <div class="dialog" role="dialog" aria-label="${esc(heading)}">
        <div class="eyebrow">${esc(eyebrow)}</div>
        <h2 class="dialog__title">${esc(heading)}</h2>
        <div class="dialog__body"><span class="dialog__text">${esc(body)}</span></div>
        <div class="dialog__actions">
          <button class="btn" data-act="secondary">${esc(secondary)}</button>
          <button class="btn ${tone === 'danger' ? 'btn--dark' : 'btn--primary'}" data-act="primary">${esc(primary)}</button>
        </div>
      </div>`);
    box.style.marginTop = '12vh';
    stage.body.appendChild(box);
    box.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'secondary') onSecondary();
      if (act === 'primary') onPrimary();
    });
  };
}

function failScene() {
  return (stage) => {
    const box = el('<div class="p-analyze" style="margin-top:8vh"></div>');
    stage.body.appendChild(box);
    let run = makeRun();
    stage.onEnd(() => run.cancel());
    const go = async (fail) => {
      run = makeRun();
      try {
        await playAnalyzing(box, run, { steps: ANALYZE_STEPS, title: 'AI 正在分析這次的演唱' });
        if (fail) { box.innerHTML = failedHTML('這次的錄音已經保存，不會遺失。'); return; }
        box.innerHTML = `
          <div class="failed">
            <span class="failed__icon" style="background:var(--green)">✓</span>
            <h2>報告產生完成</h2>
            <p>實際使用時，這裡會直接跳到報告頁。</p>
          </div>`;
        showToast('報告產生完成');
      } catch (err) { if (err !== CANCEL) throw err; }
    };
    box.addEventListener('click', (e) => { if (e.target.closest('[data-act="retry"]')) go(false); });
    setTimeout(() => go(true), 300);
  };
}

/** 整個練唱頁放進舞台（用 iframe 開 practice.html?demo=…，不影響這次的練唱） */
function pageScene(demo) {
  return (stage) => {
    const frame = el(`<iframe class="stage__frame" src="practice.html?demo=${demo}" title="展示：練唱頁"></iframe>`);
    stage.body.appendChild(frame);
    stage.onEnd(() => { frame.src = 'about:blank'; });
  };
}

export function buildScenarios() {
  return [
    {
      title: '選歌',
      items: [
        { where: '練唱頁', what: '如果首頁沒選歌', run: pageScene('nosong') }
      ]
    },
    {
      title: '練唱',
      items: [
        {
          where: 'AI 分析', what: '如果紀錄已經滿六筆',
          run: dialogScene({
            eyebrow: 'RECORDS FULL', heading: '紀錄已滿 6 筆',
            body: '到紀錄頁刪除一筆舊紀錄後，就會自動存入，不用重唱。',
            secondary: '先看報告', primary: '刪除',
            onSecondary: () => showToast('展示中：實際會先打開這次的報告'),
            onPrimary: () => showToast('展示中：實際會打開紀錄頁（後續請看紀錄頁的展示情境）')
          })
        },
        {
          where: '離開練唱頁', what: '如果錄了音但沒按 AI 分析',
          run: dialogScene({
            eyebrow: 'LEAVE', heading: '這次還沒分析，要放棄嗎？', body: '放棄後，這次的錄音不會儲存。',
            secondary: '取消', primary: '放棄', tone: 'danger',
            onSecondary: () => showToast('展示中：實際會回到練唱頁，錄音還在'),
            onPrimary: () => showToast('展示中：實際會離開，這次錄音不儲存')
          })
        },
        { where: 'AI 分析', what: '如果報告沒產生成功', run: failScene() }
      ]
    }
  ];
}
