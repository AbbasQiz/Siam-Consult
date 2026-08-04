# Siam Consult Phuket — Website

Static site: HTML, CSS, vanilla JS. No build step, no frameworks. The contact
form needs PHP, so serve the folder rather than opening the file:

```
php -S localhost:8000
```

`.htaccess` needs Apache (shared cPanel/Hostinger). It is ignored by `php -S`,
so error pages and redirects can only be tested on the host.

## Structure

```
index.html            Home
blogs.html            Journal listing
blog-article.html     Article reader
error.html            All error statuses — self-contained, no dependencies
.htaccess             Error pages, HTTPS, protected files, headers, caching

assets/css/           base (tokens + primitives), nav-footer, home, blog, icons
assets/js/            main (shared engine), blog (filters), article (progress),
                      recaptcha (site key)
assets/php/           contact.php + mail-config.sample.php + vendor/ (PHPMailer)
assets/img/           logo, favicon, hero statue, thai-law, clients/
assets/fonts/         boxicons-subset.woff2 — 16 glyphs, 1.9 KB
```

## Contact form setup — required, or the form will not send

1. `cp assets/php/mail-config.sample.php assets/php/mail-config.php`
2. Add the real password for `contact@siamconsult.co.th`. The `SMTP_PASSWORD`
   environment variable overrides the file if you prefer to keep it off disk.
3. Check `host` and `port` — defaults assume a Hostinger/cPanel mailbox on
   SSL port 465.
4. Never commit `mail-config.php`.

Until that file exists the endpoint returns a clear "not finished being set up"
message instead of failing silently.

Delivers to `contact@siamconsult.co.th` with the enquirer as `Reply-To`, and
sends the enquirer an acknowledgement (disable with `send_ack`). Both emails are
plain text — edit `$bodyText` and `$ack->Body` in `contact.php`. Protected by a
honeypot, a minimum fill time, reCAPTCHA v3, and a limit of 5 submissions per IP
per hour.

### reCAPTCHA v3

Create a v3 key pair at <https://www.google.com/recaptcha/admin>, listing every
domain the site runs on plus `localhost`.

| Key | Goes in | Name |
|---|---|---|
| Site (public) | `assets/js/recaptcha.js` | `SITE_KEY` |
| Secret (private) | `assets/php/mail-config.php` | `recaptcha_secret` |

Leave either as its placeholder and verification is skipped — the form still
works, it just isn't protected. `RECAPTCHA_SECRET` overrides the file.

| Situation | Result |
|---|---|
| no secret configured | skipped |
| missing or invalid token | rejected, 403 |
| score below `recaptcha_min_score` (0.5) | delivered, subject tagged `[LOW reCAPTCHA SCORE n]` |
| Google unreachable | delivered |

Every score is printed in the notification email, so raise the threshold against
real traffic rather than guessing.

The badge is hidden with `.grecaptcha-badge { visibility: hidden }`, which Google
permits only if the attribution is shown instead — that is the `.form-legal` line
under the submit button. **Remove one and you must restore the other.**

## Before going live

- **Mailbox password** — the form will not send until `mail-config.php` exists.
- **reCAPTCHA site key** — `assets/js/recaptcha.js` still holds the placeholder.
- **Contact details** — phone (`+66 (0) 00 000 0000`) and street address in
  `index.html` `.office` are placeholders.
- **Google Map** — the `.map` block is a styled placeholder. Replace its inner
  markup with a Maps `<iframe>`; the container styling still applies.
- **Copyright year** — footers on all three pages read © 2025.
- **Statistics** — "Since 2016", "20+ years", "3,400+ matters", "98% retention"
  are plausible placeholders. Confirm or change them.
- **Testimonials** — names are illustrative and all six portraits in
  `assets/img/clients/` are copies of the logo. Swap in real, permissioned
  quotes and photos (overwrite the files, keep the names — `object-fit: cover`
  crops anything roughly square; ~100px is ideal).
- **Blog articles** — all 12 cards link to the same `blog-article.html`. Each
  needs its own page, or the listing needs trimming to what exists.
- **Blog content** — realistic sample copy carrying a "not legal advice"
  callout. Have a licensed lawyer review before publishing.
- **`og:image`** — `index.html` uses a relative path; Facebook and LinkedIn
  need an absolute URL. `blogs.html` and `blog-article.html` have none.
- **Social links** — `@siamconsultphuket` appears 4× per page plus the `sameAs`
  block in `index.html`'s structured data. Update all of them together.
- **`robots.txt` / `sitemap.xml`** — neither exists.
- **Marquee** — lists Thai authorities the firm deals with, not endorsements.

## Known issue

`blogs.html` uses `bx-bookmark-star` on the featured-post label. That class does
not exist in Boxicons — only the solid `bxs-bookmark-star` does — so it renders
as an empty box. The glyph is already in the subset font; change the class in
`blogs.html` to `bxs-bookmark-star` and it appears.

## Icons

Boxicons, self-hosted and subsetted to the 16 glyphs the site uses. Adding an
icon takes two steps — a class in `icons.css` alone does nothing, because the
glyph must also be in the font file:

1. Find the class and its codepoint in the full Boxicons CSS.
2. Re-run the subset with that codepoint added, then add the matching
   `.bx-name:before { content: "\xxxx"; }` rule to `icons.css`.

## Design tokens

Custom properties at the top of `base.css` drive everything: `--ivory`
`#F8F5EE`, `--ivory-warm` `#F3EEE3`, `--bronze` `#8A5A2B`, `--brown` `#3A2617`,
`--gold` `#C9A227`, `--r-btn` `15px`. Cormorant Garamond for headings, Poppins
for UI and body.

`error.html` restates these inline and **does not update itself** — change a
token in `base.css` and change it there too.

## Animation

Opt-in via data attributes, all handled by `main.js`:

| Attribute | Effect |
|---|---|
| `data-reveal` | fade-up on scroll; also `left`, `right`, `scale`, `fade`, `text` |
| `--reveal-delay` | stagger, set inline per element |
| `data-parallax="0.1"` | scroll parallax; writes `--py` |
| `data-count` / `data-suffix` | number count-up in view |
| `data-lit` | words darken as the block scrolls up |
| `data-slider` / `data-dots` | looping carousel, autoplay 2.6s |

`prefers-reduced-motion: reduce` disables all of it, and a `<noscript>` rule
keeps reveal elements visible without JavaScript.

Two constraints: `data-reveal` fires at 12% visibility, so never put it on a
block taller than ~8 viewports — it cannot reach the threshold and stays faded
out (this is why `.art-box` has none). And the carousel deliberately does not
pause on hover; a resting cursor fires `pointerenter` with no `pointerleave`,
which stops autoplay permanently.

## Publishing an article

Every card carries `data-active`. Remove it and the card disappears — hidden by
CSS, so it works with JavaScript off, and excluded from `blog.js` filter counts.

```html
<a class="post-card" href="…" data-active data-category="legal">
```

## Advertising slots

`blog-article.html` has a sticky `.ad-rail` either side of the article holding a
130 × 480 `.ad-slot`. Below 1180px both rails hide and `.ad-strip`, a 728 × 90
slot between the article and Read Next, takes over. Replace the inner markup:

```html
<div class="ad-slot"><a href="…"><img src="…" alt="…"></a></div>
```

## Deploying

`.htaccess` maps every error status to `/error.html`, turns off directory
listings and MultiViews, forces HTTPS and strips `www`, denies HTTP access to
`mail-config.php`, `*.sample.php`, `*.md` and dotfiles, 404s `assets/php/vendor/`
and `assets/php/data/`, sets security headers, gzips text, and caches images and
fonts for a year, CSS and JS for a month, HTML not at all.

Three things to know:

- **HSTS is commented out.** Turn it on only when HTTPS works on every hostname
  including subdomains — browsers remember it for a year.
- **`Options -Indexes` / `-MultiViews` need `AllowOverride Options`.** A host
  that withholds it answers with a 500; comment those two lines out first if the
  site goes blank.
- **Cache busting is manual.** Assets are referenced by plain filename, so an
  edited `home.css` will not reach returning visitors for a month. Rename the
  file when you ship a change.

If the site moves to `www.`, swap the two rewrite rules — the canonical tags in
every `<head>` point at the bare domain and must agree.
