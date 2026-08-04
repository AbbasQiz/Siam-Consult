/* ===== JOURNAL LISTING — category filters, search, load more ===== */
(function () {
  'use strict';

  var grid = document.querySelector('[data-post-grid]');
  if (!grid) return;

  /* Only cards with data-active are published; CSS hides the rest too */
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.post-card[data-active]'));
  var filters    = Array.prototype.slice.call(document.querySelectorAll('.filter'));
  var searchInput = document.querySelector('[data-search]');
  var clearBtn    = document.querySelector('[data-search-clear]');
  var loadMoreBtn = document.querySelector('[data-load-more]');
  var countLabel  = document.querySelector('[data-count-label]');
  var emptyState  = document.querySelector('[data-empty]');

  var PAGE = 6;                 // cards revealed per batch
  var state = { category: 'all', query: '', shown: PAGE };
  var first = true;             // first paint keeps the scroll-reveal animation

  // Cache the searchable text of every card once
  cards.forEach(function (card) {
    card._text = (card.textContent || '').toLowerCase().replace(/\s+/g, ' ');
    card._category = card.getAttribute('data-category') || '';
  });

  function matches(card) {
    var byCategory = state.category === 'all' || card._category === state.category;
    var byQuery = !state.query || card._text.indexOf(state.query) !== -1;
    return byCategory && byQuery;
  }

  function render() {
    var visible = 0;
    var total = 0;

    cards.forEach(function (card) {
      if (!matches(card)) { card.hidden = true; return; }
      total++;
      if (total <= state.shown) { card.hidden = false; visible++; }
      else { card.hidden = true; }
    });

    if (emptyState) emptyState.hidden = total !== 0;

    if (countLabel) {
      countLabel.textContent = total
        ? 'Showing ' + visible + ' of ' + total + (total === 1 ? ' article' : ' articles')
        : '';
    }

    if (loadMoreBtn) loadMoreBtn.hidden = visible >= total;

    // A card revealed by a filter, search or "load more" may sit below the
    // observer's threshold, so reveal it directly. First paint keeps the
    // scroll animation.
    if (!first) {
      requestAnimationFrame(function () {
        cards.forEach(function (card) {
          if (!card.hidden) card.classList.add('is-visible');
        });
      });
    }
    first = false;
  }

  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.category = btn.getAttribute('data-filter');
      state.shown = PAGE;
      filters.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      render();
    });
  });

  function applyQuery() {
    state.query = searchInput.value.trim().toLowerCase();
    state.shown = PAGE;
    if (clearBtn) clearBtn.hidden = !searchInput.value;
    render();
  }

  if (searchInput) {
    var timer;
    searchInput.addEventListener('input', function () {
      if (clearBtn) clearBtn.hidden = !searchInput.value;
      clearTimeout(timer);
      timer = setTimeout(applyQuery, 180);
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && searchInput.value) { searchInput.value = ''; applyQuery(); }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      searchInput.value = '';
      applyQuery();
      searchInput.focus();
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function () {
      state.shown += PAGE;
      render();
    });
  }

  render();
})();
