// 演唱紀錄：data/records.json 的假紀錄＋這次練唱分析過的（store.take）＋刪掉的（store.records.deleted）。
// 紀錄頁、報告頁（查看某一筆）、追蹤報告都從這裡拿資料。
import { store } from '../store.js';
import { loadSong, loadSinger } from '../practice/song.js';
import { analyzeTake } from '../practice/fake-user.js';

let file;
export const loadRecordFile = () => (file ??= fetch('data/records.json').then((r) => {
  if (!r.ok) throw new Error('讀不到 data/records.json');
  return r.json();
}));

/** 這次練唱（報告頁那份）變成一筆紀錄 */
export function takeRecord(take) {
  const song = take.song ?? 'rewind';
  return { id: 'take', date: take.date, song, key: take.key, sung: take.sung, singer: `${song}-demo-user`, voice: `${song}-me`, isTake: true };
}

/**
 * 目前的紀錄（新到舊）。
 * 有分析過的這次練唱：取代同一首歌 latest 的那筆（展示版維持六筆）。
 */
export async function currentRecords() {
  const f = await loadRecordFile();
  const d = store.get();
  const deleted = new Set(d.records?.deleted ?? []);
  let list = f.records.map((r) => ({ ...r }));
  if (d.take && !d.take.pending) {
    const t = takeRecord(d.take);
    const i = list.findIndex((r) => r.song === t.song && r.latest);
    const base = list.find((r) => r.song === t.song) ?? {};
    const rec = { ...t, title: base.title, artist: base.artist, replaces: i >= 0 ? list[i].id : null };
    if (i >= 0) list.splice(i, 1, rec); else list.unshift(rec);
  }
  list = list.filter((r) => !deleted.has(r.id));
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

/** 刪除一筆（存在 sessionStorage） */
export function deleteRecord(rec) {
  store.update((d) => {
    d.records ??= { deleted: [] };
    if (!rec.isTake) d.records.deleted.push(rec.id);
    else {
      if (rec.replaces) d.records.deleted.push(rec.replaces);   // 被這次取代的那筆不要再跑回來
      d.take = null;                                            // 報告也一起刪掉
    }
  });
}

/** lines: [從, 到] → { 句: [每個字] } */
export function sungOf(song, rec) {
  if (rec.sung) return rec.sung;
  const map = {};
  const [a, b] = rec.lines;
  for (let li = a; li <= b && li < song.lines.length; li++) map[li] = song.lines[li].chars.map((_, ci) => ci);
  return map;
}

export const hasReport = (rec) => !!rec.song;

/** 讀一筆紀錄需要的歌、唱法，回傳 { song, singer, sung, result } */
export async function openRecord(rec) {
  const [song, singer] = await Promise.all([loadSong(rec.song), loadSinger(rec.singer)]);
  const sung = sungOf(song, rec);
  return { song, singer, sung, result: analyzeTake(singer, song, sung, rec.key) };
}

const ISSUES = ['flat', 'sharp', 'unstable', 'droop', 'rush', 'drag'];

/** 追蹤報告用的數字：{ scored, okLines, rate, avgDev, issues:{名稱:句數} } */
export async function statsOf(rec) {
  if (rec.stats) return { ...rec.stats, rate: rec.stats.okLines / rec.stats.scored };
  const { result } = await openRecord(rec);
  const issues = {};
  ISSUES.forEach((n) => { const c = result.lines.filter((l) => l.name === n).length; if (c) issues[n] = c; });
  const chars = result.lines.filter((l) => !l.unclear).flatMap((l) => l.chars);
  const avgDev = chars.reduce((s, c) => s + Math.abs(c.mean), 0) / (chars.length || 1);
  return { scored: result.scored, okLines: result.okLines, rate: result.scored ? result.okLines / result.scored : 0, avgDev, issues };
}
