// 成功提示：黑底，固定在右上角，幾秒後自動消失
import { esc, el } from '../util.js';

let current = null;

export function showToast(text, ms = 2600) {
  current?.remove();
  const t = el(`<div class="toast" role="status"><span class="toast__icon">✓</span>${esc(text)}</div>`);
  document.body.appendChild(t);
  current = t;
  setTimeout(() => {
    t.classList.add('is-leaving');
    setTimeout(() => t.remove(), 260);
  }, ms);
}
