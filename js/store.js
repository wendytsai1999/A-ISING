// 本機儲存：用 sessionStorage 記住登入、看過的提示、已儲存的測驗結果。
// 按 F5 重新整理還在（可以展示「再次進入」）；關掉分頁或開新分頁就清空。
const KEY = 'aising.demo.v1';

const EMPTY = {
  loggedIn: false,
  seenWelcome: false,   // 看過「開始之前」
  micAllowed: false,    // 假的麥克風權限
  runs: { range: 0, pitch: 0 }, // 做過幾次（第二次起用 retest 資料）
  saved: null,          // { range, pitch, song, date }
  take: null,           // 最近一次分析過的練唱 { date, song, key, mode, sung: { 句: [字…] } }
  records: { deleted: [] } // 紀錄頁刪掉的紀錄 id
};

function read() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    return { ...structuredClone(EMPTY), ...JSON.parse(raw) };
  } catch {
    return structuredClone(EMPTY);
  }
}

function write(data) {
  try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 私密模式等情況，就不記 */ }
}

export const store = {
  get() { return read(); },
  update(fn) {
    const data = read();
    fn(data);
    write(data);
    return data;
  },
  clear() {
    try { sessionStorage.removeItem(KEY); } catch { /* 略過 */ }
  }
};
