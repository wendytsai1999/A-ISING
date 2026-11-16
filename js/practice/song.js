// 練唱用的歌（〈倒帶〉、〈愛如潮水〉）的歌詞、逐字時間、音高，以及假的使用者唱法
const cache = {};
const load = (name) => (cache[name] ??= fetch(`data/${name}.json`).then((r) => {
  if (!r.ok) throw new Error(`讀不到 data/${name}.json`);
  return r.json();
}));

export const loadRewind = () => load('rewind');
export const loadSong = (name) => load(name);
/** 假的使用者唱法：預設是 data/{歌}-demo-user.json；紀錄頁較早那次用另一個檔 */
export const loadSinger = (file = 'rewind-demo-user') => load(file);

/** 展示版能完整練唱的歌：首頁歌單的 id → 這裡的資料檔 */
export const PLAYABLE = { rewind: 'rewind', 'love-tide': 'tide' };

/** 音檔路徑：mode＝'original'（原唱）或 'inst'（伴奏） */
export const audioUrl = (song, mode, key) => song.audio[mode].replace('{key}', String(key));

/** 依時間找出現在是第幾句（兩句中間算下一句；全部唱完算最後一句） */
export function lineAt(song, t) {
  const L = song.lines;
  for (let i = 0; i < L.length; i++) {
    if (t < L[i].end) return i;
  }
  return L.length - 1;
}

/** 把每個字攤平成一個陣列，方便算錄到哪些字 */
export function flatChars(song) {
  const out = [];
  song.lines.forEach((l, li) => l.chars.forEach((c, ci) => out.push({ ...c, li, ci })));
  return out;
}
