// 「展示情境」面板裡的異常情境。全部在蓋版舞台裡演，不會動到真正的進度和儲存資料。
import { el, makeRun, today, CANCEL } from '../../util.js';
import { stopAll } from '../../audio/synth.js';
import { showToast } from '../../components/toast.js';
import { RangeStep } from './range-step.js';
import { PitchStep } from './pitch-step.js';
import { reportHTML, playAnalyzing, failedHTML } from './report.js';

/** 舞台用的假 ctx：資料只存在這次展示裡 */
function stageCtx({ songs, demo }) {
  const draft = { range: null, pitch: null, song: null };
  return {
    songs,
    getDraft: () => draft,
    setDraft(k, v) { draft[k] = v; },
    isBusy: () => null,
    setBusy() {},
    ensureMic: async () => true,
    rangePlan(scenario) {
      if (scenario === 'noVoice') return { silent: true, autoStop: 5 };
      if (scenario === 'narrow') return { ...demo.scenarios.narrowRange, narrow: true, stepSec: 0.9, autoStop: 7 };
      return { ...demo.range.first, autoStop: 15 };
    },
    pitchPlan(scenario) {
      if (scenario === 'manyNone') return { targets: demo.pitch.targets, outcomes: demo.scenarios.manyNoVoice, retry: false };
      return { targets: demo.pitch.targets, outcomes: demo.pitch.first, retry: true };
    }
  };
}

/** 一張步驟卡放在舞台中間，自動開始 */
function cardScene(StepClass, scenario, data) {
  return (stage) => {
    const card = el('<section class="card stage__card"></section>');
    stage.body.appendChild(card);
    const step = new StepClass(card, stageCtx(data), { scenario });
    stage.onEnd(() => { step.destroy(); stopAll(); });
    setTimeout(() => step.start(), 500);
  };
}

/** 儲存相關：上面顯示三步驟完成狀況，下面演 AI 分析 → 報告 */
function saveScene(parts, data, { fail = false } = {}) {
  return (stage) => {
    const { demo, songs } = data;
    const draft = {
      range: parts.range ? demo.range.first : null,
      pitch: parts.pitch ? { targets: demo.pitch.targets, results: demo.pitch.first } : null,
      song: parts.song ? 'rewind' : null
    };
    const chip = (no, name, done) => `
      <div class="stage__chip ${done ? '' : 'is-off'}"><span class="no">${no}</span>${name}<span class="st">${done ? '完成' : '沒做'}</span></div>`;
    const wrap = el(`
      <div class="stage__wide">
        <div class="stage__steps">${chip('01', '測音域', parts.range)}${chip('02', '聽音跟唱', parts.pitch)}${chip('03', '選歌', parts.song)}</div>
        <section class="report" style="margin-top:0"></section>
      </div>`);
    stage.body.appendChild(wrap);
    const box = wrap.querySelector('.report');
    let run = makeRun();
    stage.onEnd(() => run.cancel());

    const go = async (shouldFail) => {
      run = makeRun();
      try {
        await playAnalyzing(box, run);
        if (shouldFail) { box.innerHTML = failedHTML(); return; }
        box.innerHTML = reportHTML({ ...draft, date: today() }, songs);
        showToast('已儲存，報告產生完成');
      } catch (err) { if (err !== CANCEL) throw err; }
    };
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-act="retry"]')) go(false);
      if (e.target.closest('[data-act="go-practice"]')) showToast('展示中不會離開這一頁');
    });
    setTimeout(() => go(fail), 400);
  };
}

export function buildScenarios(data) {
  return [
    {
      title: '測音域',
      items: [
        { where: '測音域', what: '如果沒偵測到聲音', run: cardScene(RangeStep, 'noVoice', data) },
        { where: '測音域', what: '如果音域太窄（不到一個八度）', run: cardScene(RangeStep, 'narrow', data) }
      ]
    },
    {
      title: '聽音跟唱',
      items: [
        { where: '聽音跟唱', what: '如果五個音有三個以上沒收到聲音', run: cardScene(PitchStep, 'manyNone', data) }
      ]
    },
    {
      title: '儲存',
      items: [
        { where: '儲存', what: '如果只完成測音域就儲存', run: saveScene({ range: true }, data) },
        { where: '儲存', what: '如果只完成聽音跟唱就儲存', run: saveScene({ pitch: true }, data) },
        { where: '儲存', what: '如果只選歌就儲存', run: saveScene({ song: true }, data) },
        { where: '儲存', what: '如果報告產生失敗', run: saveScene({ range: true, pitch: true, song: true }, data, { fail: true }) }
      ]
    }
  ];
}
