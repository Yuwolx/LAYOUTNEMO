/* 다크모드 토글 — 헤더의 [data-theme-toggle] 버튼 + localStorage 영속화. */
(function () {
  var STORAGE_KEY = 'theme';
  var root = document.documentElement;

  function getCurrent() {
    return root.getAttribute('data-theme') || 'light';
  }

  function setTheme(next) {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
  }

  // 헤더 토글 버튼 연결
  var btn = document.querySelector('[data-theme-toggle]');
  if (btn) {
    btn.addEventListener('click', function () {
      var next = getCurrent() === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  }

  // OS 선호도 변경 시, 사용자가 명시 저장 안 했으면 따라간다.
  if (window.matchMedia) {
    var media = window.matchMedia('(prefers-color-scheme: dark)');
    if (media && media.addEventListener) {
      media.addEventListener('change', function (e) {
        var saved = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch (err) {}
        if (!saved) setTheme(e.matches ? 'dark' : 'light');
      });
    }
  }
})();
