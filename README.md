## 展示方式

- 正常流程永遠正常：登入 → 開始之前 → 測音域 → 聽音跟唱 → 選歌 → 儲存 → 報告 → 唱歌去 → 練唱 → AI 分析 → 練唱報告 → 歷史紀錄（勾兩筆以上 → 綜合分析 → 追蹤報告）
- 左下角「展示情境」：點選異常情境，會用蓋版動畫展示，按「結束展示」回原畫面，不影響進度
- 資料存在瀏覽器的 sessionStorage：按 F5 重新整理還在（用來展示「再次進入」），關掉分頁或開新分頁就回到第一次使用

## 檔案結構

```
網頁/
  index.html                登入頁
  home.html                 首頁
  practice.html             練唱頁（錄音前可在歌曲欄換〈倒帶〉／〈愛如潮水〉；首頁選〈愛如潮水〉就先開它；網址可帶 ?song=tide&key=-1）
  report.html               練唱報告頁（report.html?rec=紀錄 id＝看某一筆紀錄的報告）
  records.html              紀錄頁
  css/
    tokens.css              共用顏色、字體、圓角（取自 Mid）
    base.css                基本樣式、按鈕
    components.css          導覽列、彈窗、提示框、成功提示、麥克風泡泡、展示情境面板
    login.css               登入頁
    home.css                首頁
    practice.css            練唱頁
    report.css              練唱報告頁
    records.css             紀錄頁、追蹤報告
  js/
    store.js                sessionStorage 讀寫
    data.js                 讀 data/*.json
    music.js                音名換算、建議 Key 計算
    util.js                 小工具
    audio/synth.js          合成提示音和假的哼唱聲
    audio/sing.js           播「我的歌聲」（只開有唱的字）、整首播放／下載的混音（只接有唱的段落，WAV）
    practice/song.js        讀〈倒帶〉、〈愛如潮水〉資料
    records/records.js      演唱紀錄（假紀錄＋這次練唱＋刪掉的），紀錄頁和報告頁共用
    practice/fake-user.js   假使用者每個字唱成什麼音、逐句分析（練唱頁和報告頁共用）
    components/             dialog、alert、toast、nav、mic-prompt、demo-panel、analyzing
    pages/login.js          登入頁
    pages/home/             首頁：home、range-step、pitch-step、song-step、report、scenarios
    pages/practice/         練唱頁：practice、lyrics（歌詞與音高線）、scenarios
    pages/report/report.js  練唱報告頁
    pages/records/          紀錄頁：records、tracking（追蹤報告的文字怎麼產生）、scenarios
  data/
    songs.json              20 首歌與音域（估計值，示意資料）
    demo-user.json          展示用假資料（第一次測、重新測、異常情境）
    rewind.json             〈倒帶〉52 句、每個字的開始／結束時間和音高（自動切的）
    rewind-pitch.json       原唱人聲的音高曲線（小工具重算音名用）
    tide.json、tide-pitch.json  〈愛如潮水〉36 句的逐字時間和音高（用小工具重標過）
    rewind-demo-user.json、tide-demo-user.json  假使用者每一句的唱法（唱得很好、偏低、偏高、不穩、尾音下滑、搶拍、拖拍、聽不清楚）
    rewind-demo-user-1105.json、tide-demo-user-1108.json  紀錄頁較早那次的唱法（比較差，追蹤報告才看得出進步）
    records.json            紀錄頁的六筆假紀錄：〈愛如潮水〉11/14、11/08（Key −1）、〈倒帶〉11/12、11/05（Key +1）、〈小幸運〉、〈後來〉（只有數字）
    audio/                  兩首歌的原唱、伴奏、我的歌聲（rewind-me、tide-me）各 7 個版本（Key −3～+3）；較早那次的歌聲 rewind-me-1105_k1、tide-me-1108_k-1
  tools/
    timing.html             逐字時間小工具：左上選〈倒帶〉或〈愛如潮水〉，修正切錯的句子，下載新的 rewind.json／tide.json
```

## 練唱頁怎麼算分

- 只有「歌在播放」而且「正在錄音」的時間才算。一個字錄到一半以上才算有唱。
- 進度條隨時都可以拖。同一句唱了不只一次，以最後一次為準；往後拖跳過的句子算沒唱。
- 一個字多半時間在 ±0.5 個半音內就是綠色。一句裡有唱的字，七成以上綠色就算唱對。
- 報告分數＝唱對句數 ÷ 有唱的句數；沒唱的句子不列出，「聽不清楚」的句子不評分。

## 我的歌聲怎麼來的

- `data/audio/rewind-me_k*.m4a`、`tide-me_k*.m4a`：把原唱減掉伴奏，分離出人聲，再照每一句的唱法改音高（偏低、偏高、不穩、尾音下滑）、把搶拍的句子提早 0.3 秒、聽不清楚的句子壓小聲加雜音。所以聽起來是真的在唱歌詞，但音色是原唱者的。
- 報告頁只會放出這次有錄到的字，沒唱的字是靜音。

## 紀錄頁

- 最多 6 筆，展示版一開始就是滿的。在練唱頁按 AI 分析後，這次的演唱會取代同一首歌最新的那筆（所以一直是 6 筆）。
- 勾兩筆以上 → 綜合分析 → 追蹤報告：照日期由舊到新比較唱對的比例、平均偏差、各種問題的句數，寫出改善的地方、共同的問題（每一次都有的）、待改進之處。報告不會儲存。
- 刪除紀錄、刪除「認識你的聲音」會真的刪（存在 sessionStorage，關掉分頁就回來）。
- 展示情境：追蹤報告沒有產生成功、紀錄已滿（等待存入 → 刪除一筆 → 自動存入）。這兩個都開在框框裡，不會動到真正的紀錄。

## 想改假資料

- 換報告內容：改 `data/rewind-demo-user.json` 每一句的唱法（注意：「我的歌聲」音檔是照目前的唱法預先做好的，改唱法後報告的線會變，但聲音不會跟著變）
- 換測驗結果：改 `data/demo-user.json`（`first` 第一次、`retest` 按「重新」之後）
- 換歌單或音域：改 `data/songs.json`
- 建議 Key 的規則在 `js/music.js` 的 `suggestKey`：歌的音域比你寬 → 不推薦；要調超過 5 Key → 不推薦；其他挑最接近原 Key 的升降
