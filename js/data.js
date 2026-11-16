// 讀取 data/*.json。用 fetch，所以要用 Live Server 或 GitHub Pages 開，不能直接雙擊檔案。
const cache = {};

async function load(name) {
  if (!cache[name]) {
    cache[name] = fetch(`data/${name}.json`).then((res) => {
      if (!res.ok) throw new Error(`讀不到 data/${name}.json`);
      return res.json();
    });
  }
  return cache[name];
}

export const loadSongs = async () => (await load('songs')).songs;
export const loadDemoUser = () => load('demo-user');
