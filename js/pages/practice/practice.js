// 練唱頁：歌曲和錄音分開控制。只有「歌在播＋錄音中」的時間才算數。
import { store } from '../../store.js';
import { loadDemoUser } from '../../data.js';
import { today } from '../../util.js';
import { renderNav } from '../../components/nav.js';
import { openDialog } from '../../components/dialog.js';
import { showToast } from '../../components/toast.js';
import { askMic } from '../../components/mic-prompt.js';
import { initDemoPanel } from '../../components/demo-panel.js';
import { loadSong, loadSinger, audioUrl, flatChars, PLAYABLE } from '../../practice/song.js';
import { SUNG_MIN } from '../../practice/fake-user.js';
import { Lyrics } from './lyrics.js';
import { buildScenarios } from './scenarios.js';
import { bindTourButton } from '../../components/tour.js';
import { voiceUrl } from '../../audio/sing.js';

// 「使用導覽」（按了才開始，不自動播放）
const TOUR = [
  { target: '#settings', place: 'bottom', title: '練唱設定', text: '可以換歌、選原唱或伴奏、調音量和 Key、跳過前奏、開關音高線。開始錄音後，歌和 Key 就會鎖住。' },
  { target: '#play-btn', place: 'bottom', title: '▶ 播放', text: '只播歌、不錄音，可以先聽熟旋律。' },
  { target: '#rec-btn', place: 'bottom', title: '● 錄音', text: '按下就開始錄你的歌聲。' },
  { target: '#progress', place: 'bottom', title: '進度條', text: '隨時可以拖到想重唱的地方。' },
  { target: '#lyrics', place: 'top', title: '歌詞和音高線', text: '灰線是正確的音高，你唱的音會疊在上面：綠色＝準、紅色＝不準。' },
  { target: '#analyze-btn', place: 'top', title: 'AI 分析', text: '唱完按這裡，就會產生逐句的練唱報告。', done: '開始練唱' }
];

const $ = (id) => document.getElementById(id);
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// 展示情境「首頁沒選歌」：practice.html?demo=nosong（放在展示舞台的框框裡）
const params = new URLSearchParams(location.search);
const NO_SONG = params.get('demo') === 'nosong';
// 練哪一首：網址 ?song=tide（紀錄頁、報告頁「再唱一次」）→ 首頁儲存的選歌 → 預設〈倒帶〉
const SONG_ID = ['rewind', 'tide'].includes(params.get('song')) ? params.get('song') : PLAYABLE[store.get().saved?.song] ?? 'rewind';
const KEY_PARAM = params.has('key') ? Number(params.get('key')) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 首頁沒選歌：播放、錄音、進度條和設定都是灰色，只有歌曲欄可以輸入。
 * 自動打出「愛如潮水」→ 出現選項 → 選好後才載入歌詞和音檔。回傳選好的歌。
 */
async function noSongIntro() {
  const page = document.querySelector('.practice');
  page.classList.add('is-nosong');
  $('song-title').textContent = '---';
  $('song-artist').textContent = '';
  $('time').textContent = '00:00 / 00:00';
  $('key-val').textContent = '－';
  const ctrls = [...document.querySelectorAll('#settings button, #settings input, #play-btn, #rec-btn, #progress')];
  ctrls.forEach((c) => { c.disabled = true; });
  document.querySelectorAll('#mode button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  $('lyr-lines').innerHTML = '<p class="lyr__empty">還沒選歌。<br>請在上方「歌曲」輸入歌名。</p>';
  $('foot-left').textContent = '請先選歌';

  const box = document.querySelector('.pset__song');
  const original = box.innerHTML;
  box.innerHTML = `<span>歌曲</span>
    <div class="pset__pick">
      <input class="pset__input" id="song-input" placeholder="輸入歌名" autocomplete="off" aria-label="輸入歌名">
      <ul class="pset__list is-hidden" role="listbox"><li role="option" class="is-active">愛如潮水 － 張信哲</li></ul>
    </div>`;
  const input = $('song-input');
  await sleep(1400);
  input.focus();
  for (const ch of '愛如潮水') { input.value += ch; await sleep(280); }
  box.querySelector('.pset__list').classList.remove('is-hidden');
  await sleep(1100);
  const song = await loadSong('tide');

  // 選好了：還原歌曲欄、打開所有控制
  box.innerHTML = original;
  $('song-btn').textContent = `${song.title} ▾`;
  $('song-tip').textContent = '開始錄音後就不能換歌';
  ctrls.forEach((c) => { if (c.isConnected) c.disabled = false; });
  page.classList.remove('is-nosong');
  $('foot-left').textContent = '';
  return song;
}

// 按上一頁回到練唱頁時，瀏覽器可能直接拿舊畫面，所以重新載入成乾淨的練唱頁
window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

async function main() {
  let song, singer, demo;
  try {
    [song, singer, demo] = NO_SONG
      ? [null, { lines: {}, profiles: {} }, await loadDemoUser()]   // 展示用：每句都唱得好
      : await Promise.all([loadSong(SONG_ID), loadSinger(`${SONG_ID}-demo-user`), loadDemoUser()]);
  } catch (err) {
    document.querySelector('.main').innerHTML = `<p style="font-size:16px;line-height:2">讀不到 data 資料夾裡的檔案。<br>請用 VS Code 的 Live Server（或 GitHub Pages）開這個網頁，不要直接雙擊 HTML 檔。</p>`;
    throw err;
  }
  renderNav($('nav'), { active: 'practice', initial: demo.user.initial });
  bindTourButton(TOUR);
  if (NO_SONG) song = await noSongIntro();
  $('song-title').textContent = song.title;
  $('song-artist').textContent = song.artist;
  if (!NO_SONG) $('song-btn').textContent = `${song.title} ▾`;

  // ---------- 狀態 ----------
  const S = {
    // 首頁有測音域並儲存 → 帶入建議的 Key（tide.json／rewind.json 的 defaultKey：倒帶 +1、愛如潮水 −1）；直接練唱（沒測）→ 原 Key
    key: song.keys.includes(KEY_PARAM) ? KEY_PARAM : !NO_SONG && store.get().saved?.range ? song.defaultKey : 0,
    mode: NO_SONG ? 'inst' : 'original',   // 一般預設伴奏；展示版〈倒帶〉設成原唱
    volume: 0.5,
    skipIntro: false,
    showPitch: true,
    playing: false,
    rec: 'off',               // off｜on｜paused｜done
    started: false,           // 歌播過了沒
    analyzed: false
  };
  const chars = flatChars(song);
  const cov = new Float32Array(chars.length);         // 每個字錄到幾成
  const index = new Map(chars.map((c, i) => [`${c.li}-${c.ci}`, i]));
  const covOf = (li, ci) => cov[index.get(`${li}-${ci}`)] ?? 0;
  const hasTake = () => cov.some((v) => v >= SUNG_MIN);

  const A = { original: $('a-original'), inst: $('a-inst') };
  // 展示版：按「錄音」時一起播放模擬的「我的歌聲」（和報告頁同一個音檔，跟畫面上的音高線對齊）
  const me = $('a-me');
  const active = () => A[S.mode];
  const lyrics = new Lyrics($('lyrics'), { song, singer });

  function loadAudio(keepTime = 0) {
    Object.entries(A).forEach(([mode, a]) => {
      a.src = audioUrl(song, mode, S.key);
      a.volume = S.volume;
      a.addEventListener('loadedmetadata', () => { a.currentTime = keepTime; }, { once: true });
    });
    lyrics.setKey(S.key);
    if (!NO_SONG) { me.src = voiceUrl(`${song.id}-me`, S.key); me.volume = S.volume; }
  }

  // 模擬歌聲只在「歌在播＋錄音中」時出聲，時間跟著歌走（暫停、拖進度條、點歌詞、換原唱／伴奏都會跟上）
  function syncVoice(t) {
    if (NO_SONG) return;
    const on = S.playing && S.rec === 'on';
    if (!on) { if (!me.paused) me.pause(); return; }
    if (me.paused) { me.currentTime = t; me.play().catch(() => {}); return; }
    if (Math.abs(me.currentTime - t) > 0.12) me.currentTime = t;   // 差太多就對齊回來
  }

  // ---------- 計分：只算「歌在播＋錄音中」 ----------
  let lastT = null;
  let pass = 0;                        // 每拖一次進度條就換一輪
  const linePass = {};                 // 每句最後是在哪一輪錄到的
  function track(t) {
    const counting = S.playing && S.rec === 'on';
    if (counting && lastT !== null && t > lastT && t - lastT < 0.5) {
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (c.end <= lastT) continue;
        if (c.start >= t) break;
        const overlap = Math.min(t, c.end) - Math.max(lastT, c.start);
        if (overlap <= 0) continue;
        // 拖回去重唱：這句用最後一次，先把這句之前錄到的清掉
        if (linePass[c.li] !== pass) {
          linePass[c.li] = pass;
          chars.forEach((x, k) => { if (x.li === c.li) cov[k] = 0; });
        }
        cov[i] = Math.min(1, cov[i] + overlap / Math.max(0.05, c.end - c.start));
      }
    }
    lastT = counting ? t : null;
  }

  // ---------- 畫面更新 ----------
  const status = $('status');
  function setStatus(text, tone) {
    status.querySelector('.p-status__text').textContent = text;
    status.dataset.tone = tone;
  }

  function refresh() {
    const t = active().currentTime || 0;
    const dur = active().duration || song.duration;
    const recording = S.rec !== 'off';
    const locked = recording;           // 開始錄音後：歌曲、Key、跳過前奏不能改
    const done = S.rec === 'done';

    // 標題右邊的狀態
    // 狀態一律看錄音：沒按過錄音＝準備中（試聽也是）；歌暫停不影響狀態
    if (done) setStatus('已唱完', 'done');
    else if (S.rec === 'on') setStatus('錄音中', 'rec');
    else if (S.rec === 'paused') setStatus('錄音暫停', 'pause');
    else setStatus('準備中', 'ready');

    // 設定列
    $('key-val').textContent = S.key > 0 ? `+${S.key}` : String(S.key);
    document.querySelectorAll('.kbtn').forEach((b) => {
      const next = S.key + Number(b.dataset.key);
      b.disabled = locked || !song.keys.includes(next);
    });
    $('key-box').classList.toggle('is-locked', locked);
    document.querySelector('.pset__song').classList.toggle('is-locked', locked);
    $('skip-intro').disabled = locked;
    $('skip-box').classList.toggle('is-locked', locked);
    document.querySelectorAll('#mode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode)));
    $('volume').style.setProperty('--v', `${S.volume * 100}%`);

    // 播放列
    const play = $('play-btn');
    play.textContent = S.playing ? 'II' : '▶';
    play.setAttribute('aria-label', S.playing ? '暫停歌曲' : '播放歌曲');
    play.disabled = done;
    const rec = $('rec-btn');
    rec.dataset.state = S.rec === 'on' ? 'on' : 'off';
    rec.querySelector('.recbtn__text').textContent = S.rec === 'on' ? '暫停錄音' : S.rec === 'paused' ? '繼續錄音' : '錄音';
    rec.disabled = done;
    const prog = $('progress');
    prog.disabled = done;
    if (!dragging) prog.value = Math.round((t / dur) * 1000);
    prog.style.setProperty('--p', `${(t / dur) * 100}%`);
    $('time').textContent = `${fmt(t)} / ${fmt(dur)}`;

    // 歌詞
    $('lyrics').classList.toggle('no-pitch', !S.showPitch);
    $('lyrics').classList.toggle('is-ended', done);
    // 錄音途中把歌暫停：歌詞變淡，這段收到的聲音不算
    $('lyrics').classList.toggle('is-dim', !done && S.rec !== 'off' && !S.playing);
    lyrics.update(t, covOf);

    // 底部
    const left = $('foot-left');
    const leftText = done ? (hasTake() ? '已唱完，按「AI 分析」看報告' : '已唱完，這次沒有錄到歌聲')
      : S.rec === 'on' ? (S.playing ? '演唱中…' : '歌曲暫停中，這段時間不會記錄')
      : S.rec === 'paused' ? (S.playing ? '錄音暫停中，這段的句子不會記錄' : '已暫停')
      : '';
    if (left.textContent !== leftText) left.textContent = leftText;
    $('analyze-btn').disabled = !hasTake();
  }

  function loop() {
    const t = active().currentTime || 0;
    track(t);
    syncVoice(t);
    refresh();
    requestAnimationFrame(loop);
  }

  // ---------- 歌曲 ----------
  async function playSong() {
    const a = active();
    if (S.skipIntro && a.currentTime < song.skipIntroTo) a.currentTime = song.skipIntroTo;
    try { await a.play(); } catch (err) { console.warn(err); return; }
    S.playing = true;
    S.started = true;
  }
  function pauseSong() {
    Object.values(A).forEach((a) => a.pause());
    S.playing = false;
  }
  $('play-btn').addEventListener('click', () => (S.playing ? pauseSong() : playSong()));

  Object.values(A).forEach((a) => a.addEventListener('ended', () => {
    if (a !== active()) return;
    S.playing = false;
    // 按過錄音（錄音中或錄音暫停）：歌播完就自動結束錄音
    if (S.rec !== 'off') {
      S.rec = 'done';
      showToast('歌曲播完了，錄音已自動結束');
    } else {
      S.rec = 'off';
      a.currentTime = 0;
      S.started = false;
    }
  }));

  // 伴唱：原唱／伴奏切換，時間接著
  $('mode').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b || b.dataset.mode === S.mode) return;
    const from = active();
    S.mode = b.dataset.mode;
    const to = active();
    to.currentTime = from.currentTime;
    if (S.playing) {
      from.pause();
      try { await to.play(); } catch (err) { console.warn(err); }
    }
  });

  $('volume').addEventListener('input', (e) => {
    S.volume = Number(e.target.value) / 100;
    Object.values(A).forEach((a) => { a.volume = S.volume; });
    me.volume = S.volume;
  });

  document.querySelectorAll('.kbtn').forEach((b) => b.addEventListener('click', () => {
    const next = S.key + Number(b.dataset.key);
    if (!song.keys.includes(next) || S.rec !== 'off') return;
    const t = active().currentTime;
    const wasPlaying = S.playing;
    pauseSong();
    S.key = next;
    loadAudio(t);
    if (wasPlaying) active().addEventListener('loadedmetadata', () => playSong(), { once: true });
  }));

  $('skip-intro').addEventListener('change', (e) => {
    S.skipIntro = e.target.checked;
    if (S.skipIntro && active().currentTime < song.skipIntroTo) active().currentTime = song.skipIntroTo;
  });
  $('show-pitch').addEventListener('change', (e) => { S.showPitch = e.target.checked; });

  // 歌曲：開始錄音前可以換（展示版只有〈倒帶〉、〈愛如潮水〉）；開始錄音後鎖住，點了跳提示
  const SONGS = [{ id: 'rewind', name: '倒帶 － 蔡依林' }, { id: 'tide', name: '愛如潮水 － 張信哲' }];
  const menu = $('song-menu');
  const setMenu = (open) => {
    menu.classList.toggle('is-hidden', !open);
    $('song-btn').setAttribute('aria-expanded', String(open));
  };
  let tipTimer;
  $('song-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (S.rec !== 'off') {
      $('song-tip').classList.remove('is-hidden');
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => $('song-tip').classList.add('is-hidden'), 2600);
      return;
    }
    menu.innerHTML = SONGS.map((x) => `<li role="option" data-song="${x.id}" aria-selected="${x.id === song.id}" class="${x.id === song.id ? 'is-active' : ''}"><span class="ck">${x.id === song.id ? '✓' : ''}</span>${x.name}</li>`).join('')
      + '<li class="pset__listnote">展示版只有這兩首</li>';
    setMenu(menu.classList.contains('is-hidden'));
  });
  menu.addEventListener('click', (e) => {
    const li = e.target.closest('[data-song]');
    if (!li) return;
    setMenu(false);
    if (li.dataset.song === song.id) return;
    if (NO_SONG) { showToast('展示中：實際會換成這首歌'); return; }
    pauseSong();
    location.href = `practice.html?song=${li.dataset.song}`;   // 換歌：Key 回到這首歌的預設
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.pset__song')) setMenu(false); });

  let dragging = false;
  const prog = $('progress');
  // 進度條：隨時都可以自由拖。拖回去重唱的句子，以最後一次為準；往後拖跳過的句子算沒唱
  prog.addEventListener('input', () => {
    dragging = true;
    const dur = active().duration || song.duration;
    active().currentTime = (prog.value / 1000) * dur;
    lastT = null;
    pass++;
  });
  prog.addEventListener('change', () => { dragging = false; });

  // 點歌詞：跳到那句開頭前一點（和拖進度條一樣，換一輪、以最後一次為準）
  $('lyr-lines').addEventListener('click', (e) => {
    const el = e.target.closest('[data-li]');
    if (!el || NO_SONG || S.rec === 'done') return;
    const line = song.lines[+el.dataset.li];
    if (!line) return;
    active().currentTime = Math.max(0, line.start - 0.5);
    lastT = null;
    pass++;
  });

  // ---------- 錄音 ----------
  async function ensureMic() {
    if (store.get().micAllowed) return true;
    const ok = await askMic();
    if (ok) { store.update((d) => { d.micAllowed = true; }); return true; }
    await openDialog({ eyebrow: 'MICROPHONE', heading: '需要麥克風權限', body: '請點網址列左邊的鎖頭圖示，把「麥克風」改成允許，並重新整理。' });
    return false;
  }

  $('rec-btn').addEventListener('click', async () => {
    if (S.rec === 'on') { S.rec = 'paused'; return; }
    if (S.rec === 'paused') {
      S.rec = 'on';
      // 繼續錄音時歌停著：自動把歌打開
      if (!S.playing) await playSong();
      return;
    }
    if (S.rec !== 'off') return;
    if (!(await ensureMic())) return;
    S.rec = 'on';
    // 第一次錄音時歌還沒在播：歌和錄音一起開始
    if (!S.playing) await playSong();
  });

  // ---------- AI 分析 ----------
  function sungMap() {
    const map = {};
    chars.forEach((c, i) => {
      if (cov[i] >= SUNG_MIN) (map[c.li] ??= []).push(c.ci);
    });
    return map;
  }

  $('analyze-btn').addEventListener('click', async () => {
    if (!hasTake()) return;
    if (NO_SONG) { showToast('展示中：實際會進到報告頁'); return; }
    pauseSong();
    if (S.rec !== 'off') S.rec = 'done';
    // 「AI 正在分析」在報告頁播（照 Mid 的 ReportAnalyzing）
    store.update((d) => { d.take = { date: today(), song: song.id, key: S.key, mode: S.mode, sung: sungMap(), pending: true }; });
    S.analyzed = true;
    location.href = 'report.html';
  });

  // ---------- 離開：錄了但沒分析 ----------
  const unsaved = () => S.rec !== 'off' && hasTake() && !S.analyzed;
  async function confirmLeave() {
    if (!unsaved()) return true;
    const wasPlaying = S.playing;
    pauseSong();
    const r = await openDialog({
      eyebrow: 'LEAVE', heading: '這次還沒分析，要放棄嗎？', body: '放棄後，這次的錄音不會儲存。',
      secondary: '取消', primary: '放棄', tone: 'danger'
    });
    if (r === 'primary') return true;
    if (wasPlaying) playSong();
    return false;
  }
  document.querySelector('.nav').addEventListener('click', async (e) => {
    const a = e.target.closest('a[href]');
    if (!a || a.dataset.soon === '1' || a.getAttribute('aria-current')) return;
    e.preventDefault();
    if (NO_SONG) return;
    if (!(await confirmLeave())) return;
    if (a.dataset.act === 'logout') store.update((d) => { d.loggedIn = false; });
    location.href = a.getAttribute('href');
  }, true);

  // 空白鍵＝播放／暫停歌曲
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.target.closest('input, textarea, button, .scrim')) return;
    e.preventDefault();
    if (!$('play-btn').disabled) $('play-btn').click();
  });

  loadAudio(0);
  if (!NO_SONG) initDemoPanel({ groups: buildScenarios({ song, singer }) });
  requestAnimationFrame(loop);
}

main();
