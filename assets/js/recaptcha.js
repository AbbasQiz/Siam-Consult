/* =====================================================================
   reCAPTCHA v3 — the only place the public SITE key lives.

   Setup: create a v3 key pair at https://www.google.com/recaptcha/admin,
   put the site key in SITE_KEY below and the secret key in
   assets/php/mail-config.php. While SITE_KEY is the placeholder the
   helper resolves an empty token and the backend skips verification.

   Usage: SiamRecaptcha.token('contact').then(function (token) { ... });
   ===================================================================== */
(function () {
  'use strict';

  /* ---- Paste your reCAPTCHA v3 site key here ---- */
  var SITE_KEY = 'RECAPTCHA_SITE_KEY_HERE';

  function isPlaceholder() {
    return !SITE_KEY || SITE_KEY === 'RECAPTCHA_SITE_KEY_HERE';
  }

  var loadPromise = null;

  /* Inject Google's script once, on demand. Resolves false when disabled or
     unreachable; the form still submits and the backend decides. */
  function load() {
    if (isPlaceholder()) return Promise.resolve(false);
    if (loadPromise) return loadPromise;

    loadPromise = new Promise(function (resolve) {
      if (window.grecaptcha && window.grecaptcha.execute) { resolve(true); return; }
      var s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(SITE_KEY);
      s.async = true;
      s.defer = true;
      s.onload  = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
    return loadPromise;
  }

  /* Always resolves, never rejects, so a hiccup can't block a real enquiry.
     Strictness is enforced server side. */
  function token(action) {
    return load().then(function (ready) {
      if (!ready) return '';
      return new Promise(function (resolve) {
        try {
          window.grecaptcha.ready(function () {
            window.grecaptcha
              .execute(SITE_KEY, { action: action || 'submit' })
              .then(function (t) { resolve(t || ''); })
              .catch(function () { resolve(''); });
          });
        } catch (e) {
          resolve('');
        }
      });
    });
  }

  window.SiamRecaptcha = {
    siteKey: SITE_KEY,
    enabled: !isPlaceholder(),
    load: load,
    token: token
  };

  /* Warm up early so the first submit doesn't wait on a script fetch */
  if (!isPlaceholder()) {
    if (document.readyState === 'complete') load();
    else window.addEventListener('load', load);
  }
})();
