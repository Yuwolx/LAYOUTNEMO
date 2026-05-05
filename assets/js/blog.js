/* 블로그 보조 스크립트 — 앵커 링크, 코드 복사, sticky TOC, lightbox, lazy load */
(function () {
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    enableAnchors();
    enableCodeCopy();
    enableLightbox();
    enableLazyImages();
    enableStickyTOC();
  }

  /* ---------- 1. 제목 옆 # 앵커 ---------- */
  function enableAnchors() {
    var headings = document.querySelectorAll('.prose h2, .prose h3, .prose h4');
    headings.forEach(function (h) {
      if (!h.id) return;
      var anchor = document.createElement('a');
      anchor.href = '#' + h.id;
      anchor.className = 'heading-anchor';
      anchor.setAttribute('aria-label', '이 섹션 링크 복사');
      anchor.textContent = '#';
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        var url = window.location.origin + window.location.pathname + '#' + h.id;
        history.replaceState(null, '', '#' + h.id);
        try {
          navigator.clipboard.writeText(url);
          flashToast('링크 복사됨');
        } catch (err) {}
      });
      h.appendChild(anchor);
    });
  }

  /* ---------- 2. 코드 블럭 복사 버튼 ---------- */
  function enableCodeCopy() {
    var blocks = document.querySelectorAll('.prose pre, .prose .highlight');
    blocks.forEach(function (block) {
      // .highlight 안에 pre 가 있으면 그쪽에 붙임
      var target = block.querySelector('pre') || block;
      if (target.querySelector('.code-copy')) return;
      target.style.position = 'relative';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.textContent = 'Copy';
      btn.addEventListener('click', function () {
        var code = target.querySelector('code') || target;
        var text = code.innerText;
        try {
          navigator.clipboard.writeText(text);
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1400);
        } catch (e) {
          btn.textContent = 'Failed';
        }
      });
      target.appendChild(btn);
    });
  }

  /* ---------- 3. 이미지 lightbox ---------- */
  function enableLightbox() {
    var imgs = document.querySelectorAll('.prose img');
    imgs.forEach(function (img) {
      if (img.closest('a')) return; // 이미 링크에 감싸진 이미지는 건드리지 않음
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () {
        var overlay = document.createElement('div');
        overlay.className = 'lightbox';
        overlay.innerHTML = '<img src="' + img.src + '" alt="' + (img.alt || '') + '" />';
        overlay.addEventListener('click', function () { overlay.remove(); });
        document.body.appendChild(overlay);
      });
    });
  }

  /* ---------- 4. lazy loading ---------- */
  function enableLazyImages() {
    document.querySelectorAll('.prose img').forEach(function (img) {
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
    });
  }

  /* ---------- 5. sticky TOC ---------- */
  function enableStickyTOC() {
    var tocEl = document.querySelector('[data-toc]');
    var listEl = document.querySelector('[data-toc-list]');
    if (!tocEl || !listEl) return;

    var headings = document.querySelectorAll('.prose h2, .prose h3');
    if (headings.length < 2) return;

    var items = [];
    headings.forEach(function (h) {
      if (!h.id) return;
      var li = document.createElement('li');
      li.className = 'post-toc__item post-toc__item--' + h.tagName.toLowerCase();
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/#$/, '').trim();
      a.dataset.tocLink = h.id;
      li.appendChild(a);
      listEl.appendChild(li);
      items.push({ id: h.id, link: a, el: h });
    });

    if (items.length < 2) return;
    tocEl.removeAttribute('hidden');

    // 스크롤에 따라 현재 섹션 highlight
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var item = items.find(function (it) { return it.el === entry.target; });
          if (!item) return;
          if (entry.isIntersecting) {
            items.forEach(function (it) { it.link.classList.remove('is-active'); });
            item.link.classList.add('is-active');
          }
        });
      }, { rootMargin: '0px 0px -75% 0px', threshold: 0 });
      items.forEach(function (it) { io.observe(it.el); });
    }
  }

  /* ---------- 토스트 ---------- */
  var toastTimer = null;
  function flashToast(msg) {
    var t = document.querySelector('.flash-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'flash-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-visible'); }, 1400);
  }
})();
