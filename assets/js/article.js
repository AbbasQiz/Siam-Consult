/* ===== ARTICLE READER — reading progress bar ===== */
(function () {
  'use strict';

  var article = document.querySelector('[data-article]');
  if (!article) return;

  (function progress() {
    var bar = document.querySelector('[data-progress]');
    if (!bar) return;
    var ticking = false;

    function update() {
      var rect = article.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var scrolled = -rect.top;
      var pct = total > 0 ? Math.min(Math.max(scrolled / total, 0), 1) : 0;
      bar.style.width = (pct * 100).toFixed(2) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

})();
