// 假的瀏覽器麥克風權限泡泡（不會真的要權限）
import { el } from '../util.js';

const MIC_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#444" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>`;

export function askMic() {
  return new Promise((resolve) => {
    const host = location.host || 'a-ising.local';
    const scrim = el('<div class="mic-ask-scrim"></div>');
    const box = el(`
      <div class="mic-ask" role="dialog" aria-label="要允許使用麥克風嗎？">
        <div class="mic-ask__host">${host} 想要</div>
        <div class="mic-ask__row">${MIC_ICON}<span>使用你的麥克風（要允許使用麥克風嗎？）</span></div>
        <div class="mic-ask__actions">
          <button class="mic-ask__btn" data-act="block">封鎖</button>
          <button class="mic-ask__btn mic-ask__btn--main" data-act="allow">允許</button>
        </div>
        <div class="mic-ask__note">展示用畫面，不會真的開啟麥克風</div>
      </div>`);
    box.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      scrim.remove();
      box.remove();
      resolve(act === 'allow');
    });
    document.body.append(scrim, box);
    box.querySelector('[data-act="allow"]').focus();
  });
}
