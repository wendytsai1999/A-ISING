// 小工具
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const CANCEL = Symbol('cancel');

/** 一段可以中途停止的動畫流程。run.wait(ms) 在停止後會丟出 CANCEL。 */
export function makeRun() {
  const timers = new Set();
  const run = {
    cancelled: false,
    wait(ms) {
      return new Promise((resolve, reject) => {
        if (run.cancelled) return reject(CANCEL);
        const id = setTimeout(() => {
          timers.delete(id);
          run.cancelled ? reject(CANCEL) : resolve();
        }, ms);
        timers.add(id);
        run._rejects.add(reject);
      });
    },
    cancel() {
      run.cancelled = true;
      timers.forEach(clearTimeout);
      timers.clear();
      run._rejects.forEach((r) => r(CANCEL));
      run._rejects.clear();
      run.onCancel.forEach((fn) => fn());
    },
    _rejects: new Set(),
    onCancel: []
  };
  return run;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};
