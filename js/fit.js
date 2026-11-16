// 視窗不夠大時整頁等比例縮小（例如 14 吋筆電開 200% 顯示縮放，網頁只拿到 1000 多寬、700 多高）。
// 版面照 1280×800 設計：寬或高不夠就畫小一點，第一屏的三張卡、導覽列都放得下，不會被切掉。
(function () {
  var DESIGN_W = 1280, DESIGN_H = 800;
  function fit() {
    var w = document.documentElement.clientWidth || window.innerWidth;
    var h = window.innerHeight;
    var z = Math.min(1, w / DESIGN_W, h / DESIGN_H);
    var root = document.documentElement;
    root.style.zoom = z < 0.999 ? String(z) : '';
    // 縮小後 100vh 也會跟著變矮，所以另外給一個「整個視窗高」給 CSS 用（var(--full-h)）
    root.style.setProperty('--full-h', (z < 0.999 ? h / z : h) + 'px');
  }
  fit();
  window.addEventListener('resize', fit);
})();
