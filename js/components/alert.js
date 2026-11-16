// 共用提示框。
// closable=true：黃底黑框，有 ✕（按 ✕＝用現有結果）
// closable=false：紅底紅框，不能關（必須重做，例如沒偵測到聲音）
import { esc } from '../util.js';

export function alertHTML({ heading, body, closable }) {
  return `
    <div class="alert ${closable ? 'alert--closable' : 'alert--danger'}" role="alert">
      <b class="alert__title">${esc(heading)}</b>
      <span class="alert__text">${esc(body)}</span>
      ${closable ? '<button class="alert__close" data-act="close-alert" aria-label="關閉，使用現有結果">✕</button>' : ''}
    </div>`;
}
