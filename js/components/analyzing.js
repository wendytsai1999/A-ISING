// 共用：「AI 分析中」動畫和「報告沒有產生成功」畫面
import { makeRun } from '../util.js';

const HOME_STEPS = ['整理測音域結果', '比對聽音跟唱', '產生推薦歌單與建議 Key'];

/** 「AI 分析中」動畫，約 3 秒 */
export async function playAnalyzing(box, run = makeRun(), { steps = HOME_STEPS, title = 'AI 正在分析你的聲音' } = {}) {
  box.innerHTML = `
    <div class="analyzing" role="status">
      <div class="analyzing__spin"><div class="spinner"></div><span>大約需要幾秒鐘</span></div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="eyebrow">ANALYZING</div>
        <h2 style="font-size:24px;letter-spacing:.12em">${title}</h2>
        <div class="analyzing__steps">${steps.map((t) => `<div class="astep"><span class="astep__mark"></span>${t}</div>`).join('')}</div>
      </div>
    </div>`;
  const items = [...box.querySelectorAll('.astep')];
  for (let i = 0; i < items.length; i++) {
    items[i].classList.add('is-now');
    await run.wait(950);
    items[i].classList.remove('is-now');
    items[i].classList.add('is-done');
    items[i].querySelector('.astep__mark').textContent = '✓';
  }
  await run.wait(300);
}

export function failedHTML(note = '你的測驗結果已經保存，不會遺失。') {
  return `
    <div class="failed" role="alert">
      <span class="failed__icon">!</span>
      <h2>報告沒有產生成功</h2>
      <p>${note}</p>
      <button class="btn btn--primary" data-act="retry">再試一次</button>
    </div>`;
}
