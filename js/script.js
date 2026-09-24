/* ============================================================
   The Menopause Diaries — sticky rail bounds

   The rail card is position:fixed (sections are siblings, so it cannot be
   position:sticky across them). This adds the missing half of sticky
   behaviour: when the element named by data-stop-selector — the claims footer
   by default — reaches the card, the card parks and scrolls away with the page
   instead of riding over it.

   Geometry is read fresh every frame rather than cached. The card's height
   changes as fonts swap, images land and the theme editor is used, and a stale
   height parks the card in the wrong place. Reading the live rect and
   subtracting the shift already applied keeps it self-correcting.
   ============================================================ */
(function () {
  'use strict';

  // Scroll distance over which the card eases down into alignment when the
  // viewport is tall enough that the stop element never reaches it.
  var RAMP = 240;

  function initRail(rail) {
    if (!rail || rail.dataset.mdRailReady === 'true') return;

    var card = rail.querySelector('.md-lp__sticky');
    var selector = rail.dataset.stopSelector;
    if (!card || !selector) return;

    var stop;
    try {
      stop = document.querySelector(selector);
    } catch (error) {
      return; // invalid selector typed in the theme editor
    }
    if (!stop) return;

    rail.dataset.mdRailReady = 'true';

    var gap = parseFloat(rail.dataset.stopGap);
    if (isNaN(gap)) gap = 24; // clearance above the stop element

    var offset = parseFloat(rail.dataset.stickyOffset);
    if (isNaN(offset)) offset = 24; // gap above the card once pinned

    // The element the card lines up with at rest.
    var anchor = document.querySelector(rail.dataset.anchorSelector || '.md-lp__eyebrow');

    var ticking = false;
    var enabled = false; // false below 1024px, where the rail is display:none
    var stickyTop = 0;   // the CSS `top` the card sticks at once scrolled

    function currentShift() {
      return parseFloat(rail.style.getPropertyValue('--md-rail-shift')) || 0;
    }

    function update() {
      ticking = false;
      if (!enabled) return;

      var shift = currentShift();
      var rect = card.getBoundingClientRect();

      // 1. Pinned position: `offset` below the viewport top. Figma marks the
      //    card `sticky top-0`, which puts it against the edge; the 24px
      //    default matches the rail container's py-24 (324:2131).
      var pinned = offset;

      // 2. At rest it sits level with the anchor (the hero's first line) and
      //    rides down with the page until it reaches the pinned position.
      var desired = anchor
        ? Math.max(pinned, anchor.getBoundingClientRect().top)
        : pinned;

      // 3. Never let the bottom pass the stop element.
      var stopTop = stop.getBoundingClientRect().top;
      var limit = stopTop - gap - rect.height;
      if (desired > limit) {
        desired = limit;
      } else {
        // 4. On a tall viewport the stop never reaches the card, so it would
        //    finish short of the section end. Ease the remaining drop in over
        //    the last RAMP pixels of scroll.
        var doc = document.documentElement;
        var remaining = Math.max(0, doc.scrollHeight - window.pageYOffset - window.innerHeight);
        var shortfall = (limit - desired) - remaining;
        if (shortfall > 0) desired += shortfall * (1 - Math.min(1, remaining / RAMP));
      }

      // Correct by the observed error rather than assuming where the card sits
      // unshifted — no dependence on the box model between rail and card.
      var next = shift + (desired - rect.top);

      if (Math.abs(next - shift) > 0.5) {
        rail.style.setProperty('--md-rail-shift', next + 'px');
      }
    }

    function refresh() {
      var styles = window.getComputedStyle(rail);
      enabled = styles.display !== 'none';
      stickyTop = parseFloat(styles.top) || 0;
      if (!enabled) rail.style.setProperty('--md-rail-shift', '0px');
      update();
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', refresh);
    window.addEventListener('load', update);
    if (typeof ResizeObserver === 'function') new ResizeObserver(update).observe(card);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);

    refresh();
  }

  function init(root) {
    (root || document).querySelectorAll('[data-md-rail]').forEach(initRail);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function (event) {
    init(event.target);
  });
})();

/* ============================================================
   Mobile sticky bar — reveal on scroll

   The bar stays out of the way until the reader has passed the section named
   by data-reveal-selector, so it does not cover the opening of the article.
   ============================================================ */
(function () {
  'use strict';

  function initBar(bar) {
    if (bar.dataset.mdBarReady === 'true') return;

    var selector = bar.dataset.revealSelector;
    var target;
    try {
      target = selector ? document.querySelector(selector) : null;
    } catch (error) {
      target = null;
    }
    if (!target) return; // no target: leave the bar visible

    bar.dataset.mdBarReady = 'true';
    bar.setAttribute('data-md-hidden', '');

    var ticking = false;

    // Separate show/hide thresholds. A single threshold makes the bar flicker
    // when a scroll sits right on it; between the two nothing changes.
    var HYSTERESIS = 80;

    function update() {
      ticking = false;
      var top = target.getBoundingClientRect().top;
      var fold = window.innerHeight;

      if (top <= fold) {
        bar.removeAttribute('data-md-hidden');          // section reached
      } else if (top > fold + HYSTERESIS) {
        bar.setAttribute('data-md-hidden', '');         // scrolled back above it
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  function init() {
    document.querySelectorAll('.md-lp__bar').forEach(initBar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
