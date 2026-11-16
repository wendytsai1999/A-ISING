// 登入頁：假的 Google 登入（帳戶選擇 → 轉圈 → 首頁）
import { el, esc } from '../util.js';
import { store } from '../store.js';
import { loadDemoUser } from '../data.js';

const btn = document.getElementById('google-btn');

btn.addEventListener('click', async () => {
  let user = { name: '示範使用者', initial: 'D', email: 'aising.demo@gmail.com' };
  try { user = (await loadDemoUser()).user; } catch { /* 用預設 */ }

  const scrim = el(`
    <div class="scrim">
      <div class="chooser" role="dialog" aria-modal="true" aria-labelledby="ch-title">
        <div class="chooser__g">G</div>
        <h2 class="chooser__title" id="ch-title">選擇帳戶</h2>
        <p class="chooser__sub">以繼續使用 A-ISING</p>
        <div class="chooser__list">
          <button class="chooser__acct" data-act="pick">
            <span class="chooser__avatar">${esc(user.initial)}</span>
            <span><span>${esc(user.name)}</span><br><span class="chooser__mail">${esc(user.email)}</span></span>
          </button>
          <button class="chooser__acct chooser__other" data-act="pick">
            <span class="chooser__avatar">＋</span><span>使用其他帳戶</span>
          </button>
        </div>
        <p class="chooser__note">展示用畫面，不會真的連到 Google</p>
      </div>
    </div>`);
  document.body.appendChild(scrim);
  scrim.querySelector('[data-act="pick"]').focus();

  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) return scrim.remove(); // 點外面＝取消
    if (!e.target.closest('[data-act="pick"]')) return;
    scrim.querySelector('.chooser').innerHTML = `
      <div class="chooser__loading" role="status">
        <div class="spinner spinner--sm"></div>
        <span>登入中…</span>
      </div>`;
    store.update((d) => { d.loggedIn = true; });
    setTimeout(() => { location.href = 'home.html'; }, 1300);
  });
});
