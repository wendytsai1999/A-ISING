// 紀錄頁「展示情境」：整個紀錄頁放進舞台（用 iframe 開 records.html?demo=…），不會動到真正的紀錄。
import { el } from '../../util.js';

function pageScene(demo) {
  return (stage) => {
    const frame = el(`<iframe class="stage__frame" src="records.html?demo=${demo}" title="展示：紀錄頁"></iframe>`);
    stage.body.appendChild(frame);
    stage.onEnd(() => { frame.src = 'about:blank'; });
  };
}

export function buildScenarios() {
  return [
    {
      title: '紀錄',
      items: [
        { where: '綜合分析', what: '如果追蹤報告沒有產生成功', run: pageScene('fail') },
        { where: '紀錄已滿', what: '等待存入 → 刪除一筆 → 自動存入', run: pageScene('full') }
      ]
    }
  ];
}
