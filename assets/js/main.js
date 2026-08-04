/* =====================================================================
   SITE ENGINE — shared by every page.
   No dependencies. Each module opts in via a data-attribute.
   ===================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ===== 1. MOBILE NAV ===== */
  function initNav() {
    var toggle = document.getElementById('menu-toggle');
    var menu = document.getElementById('mobile-menu');
    if (!toggle || !menu) return;

    function setOpen(open) {
      toggle.classList.toggle('active', open);
      menu.classList.toggle('active', open);
      toggle.setAttribute('aria-expanded', String(open));
    }
    toggle.addEventListener('click', function () {
      setOpen(!menu.classList.contains('active'));
    });
    toggle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!menu.classList.contains('active')); }
    });
    // Close after tapping a link, and on Escape
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  /* ===== 2. WORD SPLITTING — recurses so <em> and <br> survive ===== */
  function splitWords(el) {
    var index = 0;

    function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      kids.forEach(function (child) {
        if (child.nodeType === 3) {                       // text node
          var words = child.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          words.forEach(function (word) {
            if (!word.trim()) { frag.appendChild(document.createTextNode(' ')); return; }
            var outer = document.createElement('span');
            outer.className = 'w';
            outer.style.setProperty('--w', index++);
            var inner = document.createElement('span');
            inner.textContent = word;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    }

    walk(el);
    el.classList.add('is-split');
  }

  /* ===== 3. SCROLL REVEALS ===== */
  function initReveals() {
    var items = $$('[data-reveal]');
    if (!items.length) return;

    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    items.forEach(function (el) {
      if (el.getAttribute('data-reveal') === 'text') splitWords(el);
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ===== 4. SCROLL-LIT TEXT — words darken as the block scrolls up ===== */
  function initLitText() {
    var blocks = $$('[data-lit]');
    if (!blocks.length) return;

    if (reduced) {
      blocks.forEach(function (el) {
        splitWords(el);
        $$('.w', el).forEach(function (w) { w.classList.add('is-lit'); });
      });
      return;
    }

    var items = blocks.map(function (el) {
      splitWords(el);
      return { el: el, words: $$('.w', el), lit: -1 };
    });
    var ticking = false;

    function update() {
      var vh = window.innerHeight;
      items.forEach(function (item) {
        var rect = item.el.getBoundingClientRect();
        // 0 when the block's top reaches 60% of the viewport, 1 when its
        // bottom passes 30%. 60% stays clear of where the statement sits on
        // load, so no word is lit before the page is scrolled.
        var startAt = vh * 0.60;
        var endAt   = vh * 0.30;
        var span = (rect.height + (startAt - endAt)) || 1;
        var p = (startAt - rect.top) / span;
        p = Math.min(Math.max(p, 0), 1);

        var target = Math.round(p * item.words.length);
        if (target === item.lit) return;

        if (target > item.lit) {
          for (var i = Math.max(item.lit, 0); i < target; i++) item.words[i].classList.add('is-lit');
        } else {
          for (var j = item.lit - 1; j >= target; j--) {
            if (item.words[j]) item.words[j].classList.remove('is-lit');
          }
        }
        item.lit = target;
      });
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ===== 5. PARALLAX — one rAF loop for every [data-parallax] ===== */
  function initParallax() {
    var nodes = $$('[data-parallax]');
    if (!nodes.length || reduced) return;

    var layers = nodes.map(function (el) {
      return { el: el, factor: parseFloat(el.getAttribute('data-parallax')) || 0.1 };
    });
    var ticking = false;

    function update() {
      var vh = window.innerHeight;
      layers.forEach(function (l) {
        var rect = l.el.getBoundingClientRect();
        if (rect.bottom < -vh || rect.top > vh * 2) return;   // off-screen: skip
        // -1 .. 1 as the element travels through the viewport
        var progress = (rect.top + rect.height / 2 - vh / 2) / vh;
        l.el.style.setProperty('--py', (progress * l.factor * 260).toFixed(2) + 'px');
      });
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ===== 6. COUNTERS ===== */
  function initCounters() {
    var els = $$('[data-count]');
    if (!els.length) return;

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var suffix = el.getAttribute('data-suffix') || '';
      if (reduced) { el.textContent = target.toLocaleString() + suffix; return; }
      var start = performance.now();
      var dur = 1600;
      (function step(now) {
        var p = Math.min((now - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(step);
      })(start);
    }

    if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ===== 7. MARQUEE — speed normalised to track width ===== */
  function initMarquee() {
    $$('[data-marquee]').forEach(function (wrap) {
      var track = $('.marquee__track', wrap);
      if (!track) return;
      var width = track.scrollWidth / 2;              // one full copy
      var seconds = Math.max(18, width / 55);         // ~55px per second
      track.style.animationDuration = seconds.toFixed(1) + 's';
    });
  }

  /* ===== 8. TESTIMONIAL SLIDER — snap scroll, drag, dots ===== */
  function initSlider() {
    var viewport = $('[data-slider]');
    if (!viewport) return;

    var originals = $$('.testi-card', viewport);
    if (!originals.length) return;

    var dotsWrap = $('[data-dots]');
    var count = originals.length;

    /* A copy of the set either side lets the track run forever both ways */
    var head = document.createDocumentFragment();
    var tail = document.createDocumentFragment();
    originals.forEach(function (card) {
      var a = card.cloneNode(true); a.setAttribute('aria-hidden', 'true'); a.dataset.clone = '1';
      var b = card.cloneNode(true); b.setAttribute('aria-hidden', 'true'); b.dataset.clone = '1';
      head.appendChild(a);
      tail.appendChild(b);
    });
    viewport.insertBefore(head, originals[0]);
    viewport.appendChild(tail);

    /* Cached so the scroll handler never reads layout */
    var stepPx = 0, setW = 0;

    function measure() {
      var gap = parseFloat(getComputedStyle(viewport).columnGap || '0') || 0;
      stepPx = originals[0].getBoundingClientRect().width + gap;
      setW = viewport.scrollWidth / 3;
    }

    function step()    { return stepPx || viewport.clientWidth; }
    function setWidth(){ return setW || viewport.scrollWidth / 3; }
    function centre()  { return setWidth(); }

    /* Dots come from the real cards only */
    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      for (var i = 0; i < count; i++) {
        var d = document.createElement('span');
        d.className = 'testi__dot' + (i === 0 ? ' is-active' : '');
        dotsWrap.appendChild(d);
      }
    }
    var dots = dotsWrap ? $$('.testi__dot', dotsWrap) : [];
    var index = 0;                       // position within the real set

    function paintDots() {
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === index); });
    }

    function setIndex(next) {
      index = ((next % count) + count) % count;
      paintDots();
    }

    /* Derive the index from scroll position, e.g. after a drag */
    function syncDots() {
      if (!dots.length) return;
      setIndex(Math.round((viewport.scrollLeft - centre()) / step()));
    }

    /* Jump back one set width when the position leaves the middle copy */
    function normalise() {
      var w = setWidth();
      if (viewport.scrollLeft >= w * 2)        viewport.scrollLeft -= w;
      else if (viewport.scrollLeft <= step())  viewport.scrollLeft += w;
    }

    var settle;
    function onScroll() {
      syncDots();
      // Re-centre only once motion stops, so a smooth scroll is never cut off
      clearTimeout(settle);
      settle = setTimeout(normalise, 160);
    }

    function go(dir) {
      // Re-centre before moving, so a step never waits on a scroll event
      normalise();
      viewport.scrollBy({ left: dir * step(), behavior: reduced ? 'auto' : 'smooth' });
    }

    /* ---- Autoplay ---- */
    var timer = null;
    var DELAY = 2600;

    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function play() {
      if (reduced || timer || !inView || paused) return;
      timer = setInterval(function () { go(1); }, DELAY);
    }

    var paused = false;
    var inView = true;

    function hold(on) { paused = on; if (on) stop(); else play(); }

    /* Focus and drag pause autoplay. Hover deliberately does not — a resting
       cursor fires pointerenter with no matching pointerleave, which used to
       stop the carousel for good. */
    viewport.addEventListener('focusin',  function () { hold(true); });
    viewport.addEventListener('focusout', function () { hold(false); });

    /* Don't animate a carousel nobody can see */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else play();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView) play(); else stop();
      }, { threshold: 0.2 }).observe(viewport);
    }

    viewport.addEventListener('scroll', onScroll, { passive: true });

    /* Pointer drag — touch keeps native momentum scrolling */
    var down = false, startX = 0, startScroll = 0, moved = 0;
    viewport.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      down = true; moved = 0;
      startX = e.clientX;
      startScroll = viewport.scrollLeft;
      viewport.classList.add('is-dragging');
      stop();
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      moved = Math.abs(dx);
      viewport.scrollLeft = startScroll - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      viewport.classList.remove('is-dragging');
      play();
    });
    /* Swallow the click that follows a real drag */
    viewport.addEventListener('click', function (e) {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    window.addEventListener('resize', function () {
      measure();
      viewport.scrollLeft = centre() + index * step();
      paintDots();
    });
    /* Web fonts landing late change the card width */
    window.addEventListener('load', measure);

    /* Start on the middle copy, then begin the loop */
    measure();
    viewport.scrollLeft = centre();
    setIndex(0);
    requestAnimationFrame(function () {
      measure();
      viewport.scrollLeft = centre();
      setIndex(0);
      play();
    });
    play();
  }

  /* ===== 9. ACCORDION (FAQ) — one panel open at a time ===== */
  function initAccordion() {
    $$('[data-accordion]').forEach(function (list) {
      var buttons = $$('.faq__q', list);
      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var item = btn.closest('.faq__item');
          var open = item.classList.contains('is-open');
          buttons.forEach(function (b) {
            b.setAttribute('aria-expanded', 'false');
            b.closest('.faq__item').classList.remove('is-open');
          });
          if (!open) {
            item.classList.add('is-open');
            btn.setAttribute('aria-expanded', 'true');
          }
        });
      });
    });
  }

  /* ===== 10. CONSULTATION FORM — inline validation ===== */
  function initForm() {
    var form = document.getElementById('consult-form');
    if (!form) return;

    var status = $('[data-status]', form);
    var openedAt = Date.now();
    var emailRe = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

    function fieldOf(input) { return input.closest('.field'); }

    function validate(input) {
      var field = fieldOf(input);
      var msgEl = field ? $('[data-error]', field) : null;
      var value = (input.value || '').trim();
      var msg = '';

      if (!value) {
        msg = 'This field is required.';
      } else if (input.type === 'email' && !emailRe.test(value)) {
        msg = 'Enter a valid email address.';
      } else if (input.type === 'tel' && value.replace(/[^\d]/g, '').length < 7) {
        msg = 'Enter a reachable phone number.';
      } else if (input.tagName === 'TEXTAREA' && value.length < 12) {
        msg = 'A little more detail helps us prepare.';
      }

      if (field) field.classList.toggle('is-invalid', !!msg);
      if (msgEl) msgEl.textContent = msg;
      return !msg;
    }

    /* Real controls only. Every one lives in a .field wrapper, which keeps
       the honeypot and the hidden fields out of validation. */
    var inputs = $$('.field input, .field select, .field textarea', form)
      .filter(function (el) { return el.type !== 'hidden'; });

    inputs.forEach(function (input) {
      input.addEventListener('blur', function () { validate(input); });
      input.addEventListener('input', function () {
        var field = fieldOf(input);
        if (field && field.classList.contains('is-invalid')) validate(input);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var ok = true;
      inputs.forEach(function (input) { if (!validate(input)) ok = false; });

      if (!ok) {
        status.className = 'form-status is-error';
        status.textContent = 'Please complete the highlighted fields.';
        var firstBad = $('.field.is-invalid input, .field.is-invalid select, .field.is-invalid textarea', form);
        if (firstBad) firstBad.focus();
        return;
      }

      var button = $('button[type="submit"]', form);
      var label = button ? $('span', button) : null;
      var original = label ? label.textContent : '';

      if (button) { button.disabled = true; button.classList.add('is-sending'); }
      if (label) { label.textContent = 'Sending…'; }
      status.className = 'form-status';
      status.textContent = '';

      /* Mint a reCAPTCHA token first. Resolves '' when reCAPTCHA is off or
         unreachable; the backend decides whether that is acceptable. */
      recaptchaToken().then(function (token) {
        var tokenInput = form.elements['g-recaptcha-response'];
        if (tokenInput) tokenInput.value = token;

        var payload = new FormData(form);
        payload.set('started_at', String(openedAt));

        return fetch(form.getAttribute('action') || 'assets/php/contact.php', {
          method: 'POST',
          body: payload,
          headers: { 'Accept': 'application/json' }
        });
      })
        .then(function (res) {
          return res.json().catch(function () { return { ok: false, message: 'Unexpected server response.' }; })
            .then(function (data) { return { status: res.status, data: data }; });
        })
        .then(function (result) {
          var data = result.data || {};

          if (data.ok) {
            status.className = 'form-status is-success';
            status.textContent = data.message || 'Thank you — a consultant will reply within one business day.';
            form.reset();
            inputs.forEach(function (i) {
              var f = fieldOf(i);
              if (f) f.classList.remove('is-invalid');
              var m = f && $('[data-error]', f);
              if (m) m.textContent = '';
            });
            return;
          }

          /* Field-level errors returned by the server */
          if (data.errors) {
            Object.keys(data.errors).forEach(function (name) {
              var input = form.elements[name];
              if (!input) return;
              var field = fieldOf(input);
              if (field) field.classList.add('is-invalid');
              var msgEl = field && $('[data-error]', field);
              if (msgEl) msgEl.textContent = data.errors[name];
            });
          }
          status.className = 'form-status is-error';
          status.textContent = data.message || 'We could not send your message. Please try again.';
        })
        .catch(function () {
          status.className = 'form-status is-error';
          status.textContent = 'Network error — please email contact@siamconsult.co.th directly.';
        })
        .then(function () {
          if (button) { button.disabled = false; button.classList.remove('is-sending'); }
          if (label) { label.textContent = original; }
          /* Tokens are single-use — drop it so the next submit mints a fresh one */
          var tokenInput = form.elements['g-recaptcha-response'];
          if (tokenInput) tokenInput.value = '';
        });
    });
  }

  /* Fresh token from assets/js/recaptcha.js. Resolves '' when not configured. */
  function recaptchaToken() {
    if (window.SiamRecaptcha && typeof window.SiamRecaptcha.token === 'function') {
      return window.SiamRecaptcha.token('contact');
    }
    return Promise.resolve('');
  }

  /* ===== 11. CUSTOM SELECT =====
     Swaps the OS dropdown for a themed listbox. The native <select> stays put
     and keeps owning the value, so validation, reset and FormData are unchanged
     — every choice is written back to it with a real 'change' event. Without JS
     the field simply stays native, which is the correct fallback. */
  function initSelects() {
    $$('select[data-select]').forEach(buildSelect);
  }

  var selectSeq = 0;

  function buildSelect(select) {
    var field = select.closest('.field');
    if (!field || field.classList.contains('has-cselect')) return;

    selectSeq += 1;
    var base = select.id || 'cselect-' + selectSeq;
    var labelEl = $('label', field);
    if (labelEl && !labelEl.id) labelEl.id = base + '-label';

    /* The blank, disabled first entry is the prompt — it belongs on the
       trigger, not in the list. */
    var natives = $$('option', select);
    var prompt = '';
    var choices = natives.filter(function (opt) {
      if (opt.disabled || opt.value === '') {
        if (!prompt) prompt = opt.textContent.trim();
        return false;
      }
      return true;
    });
    if (!choices.length) return;

    var root = document.createElement('div');
    root.className = 'cselect';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cselect__trigger';
    trigger.id = base + '-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', base + '-list');
    if (labelEl) trigger.setAttribute('aria-labelledby', labelEl.id + ' ' + trigger.id);

    var value = document.createElement('span');
    value.className = 'cselect__value';
    var caret = document.createElement('i');
    caret.className = 'cselect__caret';
    caret.setAttribute('aria-hidden', 'true');
    trigger.appendChild(value);
    trigger.appendChild(caret);

    var panel = document.createElement('div');
    panel.className = 'cselect__panel';
    var list = document.createElement('ul');
    list.className = 'cselect__list';
    list.id = base + '-list';
    list.setAttribute('role', 'listbox');
    if (labelEl) list.setAttribute('aria-labelledby', labelEl.id);
    panel.appendChild(list);

    var items = choices.map(function (opt, i) {
      var li = document.createElement('li');
      li.className = 'cselect__opt';
      li.id = base + '-opt-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.dataset.value = opt.value;
      li.textContent = opt.textContent.trim();
      list.appendChild(li);
      return li;
    });

    root.appendChild(trigger);
    root.appendChild(panel);
    select.parentNode.insertBefore(root, select.nextSibling);
    field.classList.add('has-cselect');

    var open = false;
    var active = -1;
    var painted = false;   /* highlight the active row only once it is aimed at */
    var typed = '';
    var typedAt = 0;

    function indexOfValue(v) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].dataset.value === v) return i;
      }
      return -1;
    }

    /* Mirrors whatever the native select currently holds */
    function syncFromSelect() {
      var i = indexOfValue(select.value);
      items.forEach(function (li, n) { li.setAttribute('aria-selected', String(n === i)); });
      value.textContent = i > -1 ? items[i].textContent : prompt;
      value.classList.toggle('is-placeholder', i < 0);
    }

    /* `paint` marks a deliberate move — a key press or the pointer — after
       which the highlight follows the active row. Merely opening the menu on a
       touch screen should not light up a row nobody has reached for. */
    function setActive(i, paint) {
      if (i < 0 || i >= items.length) return;
      if (paint) painted = true;
      if (active > -1 && items[active]) items[active].classList.remove('is-active');
      active = i;
      if (painted) items[i].classList.add('is-active');
      trigger.setAttribute('aria-activedescendant', items[i].id);
      items[i].scrollIntoView({ block: 'nearest' });
    }

    function setOpen(next) {
      if (next === open) return;
      open = next;
      root.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));

      if (!open) {
        if (active > -1 && items[active]) items[active].classList.remove('is-active');
        active = -1;
        painted = false;
        trigger.removeAttribute('aria-activedescendant');
        /* Leaving the field closed and empty is still an error worth showing */
        select.dispatchEvent(new Event('blur'));
        return;
      }

      /* Flip above the trigger when the panel would fall off the viewport */
      var room = window.innerHeight - trigger.getBoundingClientRect().bottom;
      root.classList.toggle('is-up', room < 260 && trigger.getBoundingClientRect().top > room);

      /* An existing choice is worth showing; a fresh menu opens unmarked */
      var sel = indexOfValue(select.value);
      setActive(sel > -1 ? sel : 0, sel > -1);
    }

    function choose(i) {
      if (i < 0 || i >= items.length) return;
      select.value = items[i].dataset.value;
      syncFromSelect();
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.dispatchEvent(new Event('input', { bubbles: true }));
      setOpen(false);
      trigger.focus();
    }

    /* Jump to the first entry starting with what was typed, as the OS menu does */
    function typeahead(key) {
      var now = Date.now();
      typed = now - typedAt > 900 ? key : typed + key;
      typedAt = now;
      var from = active > -1 ? active : 0;
      for (var n = 1; n <= items.length; n++) {
        var i = (from + (typed.length > 1 ? 0 : n)) % items.length;
        if (items[i].textContent.toLowerCase().indexOf(typed) === 0) {
          open ? setActive(i, true) : choose(i);
          return;
        }
      }
    }

    trigger.addEventListener('click', function () { setOpen(!open); });

    trigger.addEventListener('keydown', function (e) {
      var k = e.key;

      if (k === 'Escape') { if (open) { e.preventDefault(); setOpen(false); } return; }
      if (k === 'Tab') { setOpen(false); return; }

      if (k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault();
        if (!open) { painted = true; setOpen(true); return; }
        setActive(Math.min(items.length - 1, Math.max(0, active + (k === 'ArrowDown' ? 1 : -1))), true);
        return;
      }
      if (k === 'Home' || k === 'End') {
        if (!open) return;
        e.preventDefault();
        setActive(k === 'Home' ? 0 : items.length - 1, true);
        return;
      }
      if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        e.preventDefault();
        if (open) { choose(active); } else { painted = true; setOpen(true); }
        return;
      }
      if (k.length === 1 && /\S/.test(k)) {
        e.preventDefault();
        typeahead(k.toLowerCase());
      }
    });

    items.forEach(function (li, i) {
      li.addEventListener('click', function () { choose(i); });
      li.addEventListener('mousemove', function () { if (i !== active || !painted) setActive(i, true); });
    });

    document.addEventListener('pointerdown', function (e) {
      if (open && !root.contains(e.target)) setOpen(false);
    });
    window.addEventListener('resize', function () { setOpen(false); });

    /* The validator focuses the native control on a failed submit, and
       form.reset() clears it silently — pick both up. */
    select.addEventListener('focus', function () { trigger.focus(); });
    select.addEventListener('change', syncFromSelect);
    if (select.form) {
      select.form.addEventListener('reset', function () {
        setTimeout(syncFromSelect, 0);
      });
    }

    syncFromSelect();
  }

  /* ===== 12. ANCHOR SCROLLING ===== */
  /* Desktop lands entirely from CSS — html scroll-padding-top plus the
     .section[id] scroll-margin-top in base.css — and stays on that path.
     Mobile cannot use it, for two reasons:
       1. The dropdown sits in the flow above every section. Closing it takes
          0.45s, so the page slides up under an in-flight smooth scroll and the
          landing ends a menu-height too deep — past the heading, into the
          service grid or the contact form.
       2. A section's first child is not always its heading. #firm opens with
          the photo, so a section-top landing fills the fold with the image and
          pushes "Who We Are" to the bottom of the screen.
     So below the breakpoint we snap the menu shut and scroll to a point we
     measure ourselves: the section's heading block, with a gap above it. */
  var MOBILE_Q = '(max-width: 767px)';
  var ANCHOR_GAP = 2;   /* rem of breathing room above the heading block */

  function isMobile() { return window.matchMedia(MOBILE_Q).matches; }

  /* Only the home page's landmark sections take the measured path; #main and
     any other in-page target keeps the native behaviour. */
  function anchorSection(el) {
    return (el && el.id && el.classList.contains('section')) ? el : null;
  }

  function mobileAnchorTop(section) {
    /* The first eyebrow/heading inside the section — for #firm that is the one
       in .firm__body, i.e. below the photo. */
    var head = section.querySelector('.eyebrow, .h2, h2') || section;
    var rem  = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    /* data-anchor-gap (rem) lets a section ask for more room, e.g. #firm keeps
       the photo's badge in shot above the heading. */
    var gap  = parseFloat(section.getAttribute('data-anchor-gap'));
    if (isNaN(gap)) gap = ANCHOR_GAP;
    var top = window.pageYOffset + head.getBoundingClientRect().top - gap * rem;
    return Math.max(top, 0);
  }

  function initAnchors() {
    var menu = document.getElementById('mobile-menu');

    /* Take the dropdown out of the flow *before* we measure. Suppressing its
       transition for this one close makes the forced reflow settle the layout
       immediately, so the target we compute is the one we end up at. */
    function collapseMenu() {
      if (!menu || !menu.offsetHeight) return;
      menu.classList.add('is-instant');
      menu.classList.remove('active');
      void menu.offsetHeight;
      menu.classList.remove('is-instant');
    }

    function landOn(section, behavior) {
      collapseMenu();
      window.scrollTo({ top: mobileAnchorTop(section), behavior: behavior });
    }

    $$('a[href^="#"]').forEach(function (a) {
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      a.addEventListener('click', function (e) {
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        var section = anchorSection(target);
        if (section && isMobile()) {
          landOn(section, reduced ? 'auto' : 'smooth');
        } else {
          target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        }
        history.replaceState(null, '', id);
        // preventDefault() cancels the native focus move — restore it so the
        // skip link and in-page nav stay usable by keyboard
        if (target.hasAttribute('tabindex') || /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) {
          target.focus({ preventScroll: true });
        }
      });
    });

    /* Arriving from another page (the blog links index.html#firm) lands from
       CSS, which drops mobile at the section top. Re-land once images and web
       fonts have settled, or the measurement is taken against a shorter page. */
    if (/^#[A-Za-z][\w-]*$/.test(window.location.hash)) {
      window.addEventListener('load', function () {
        var section = anchorSection(document.querySelector(window.location.hash));
        if (section && isMobile()) landOn(section, 'auto');
      });
    }
  }

  /* ===== BOOT ===== */
  function boot() {
    initNav();
    initReveals();
    initLitText();
    initParallax();
    initCounters();
    initMarquee();
    initSlider();
    initAccordion();
    initForm();
    initSelects();
    initAnchors();
    document.documentElement.classList.add('js-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
