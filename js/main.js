/* =====================================================================
   BALVIORA — Interactions
   Vanilla JS, no dependencies. Progressive enhancement:
   the page is fully readable and usable with JS disabled.
   ===================================================================== */
(function () {
  'use strict';

  var doc = document;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };

  /* ------------------------- Header scroll state ------------------------- */
  var header = $('[data-header]');
  var progress = $('[data-progress] span');
  var toTop = $('[data-to-top]');

  function onScroll() {
    var y = window.pageYOffset || doc.documentElement.scrollTop;
    if (header) header.classList.toggle('is-scrolled', y > 40);
    if (toTop) toTop.classList.toggle('is-show', y > 800);
    if (progress) {
      var h = doc.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = 'scaleX(' + (h > 0 ? Math.min(y / h, 1) : 0) + ')';
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) { raf(function () { onScroll(); ticking = false; }); ticking = true; }
  }, { passive: true });
  onScroll();

  if (toTop) toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ---------------------------- Mobile menu ---------------------------- */
  var navToggle = $('[data-nav-toggle]');
  var mobileMenu = $('[data-mobile-menu]');
  function closeMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    setTimeout(function () { mobileMenu.hidden = true; }, 300);
    doc.body.style.overflow = '';
  }
  function openMenu() {
    mobileMenu.hidden = false;
    raf(function () { mobileMenu.classList.add('is-open'); });
    navToggle.setAttribute('aria-expanded', 'true');
    doc.body.style.overflow = 'hidden';
  }
  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', function () {
      navToggle.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu();
    });
    $$('[data-nav-close]', mobileMenu).forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !mobileMenu.hidden) closeMenu();
    });
  }

  /* ------------------------ Scroll reveal (IO) ------------------------ */
  var revealEls = $$('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        // stagger siblings sharing a parent for an editorial cascade
        var sibs = el.parentElement ? $$('[data-reveal]', el.parentElement) : [el];
        var idx = sibs.indexOf(el);
        el.style.setProperty('--reveal-delay', (idx > -1 ? Math.min(idx, 6) * 70 : 0) + 'ms');
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------- Animated counters ----------------------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    var word = el.getAttribute('data-word');
    if (word && target === 0) { el.textContent = word; return; }
    if (reduceMotion) { el.textContent = target + suffix; return; }
    var start = null, dur = 1400;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) raf(step);
    }
    raf(step);
  }
  var counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { animateCount(entry.target); cio.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(animateCount);
  }

  /* -------------------------- Ring chart -------------------------- */
  var ring = $('[data-ring]');
  if (ring && 'IntersectionObserver' in window) {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); rio.unobserve(entry.target); }
      });
    }, { threshold: 0.4 });
    rio.observe(ring);
  } else if (ring) { ring.classList.add('is-in'); }

  /* --------------------- Hero parallax (subtle) --------------------- */
  var parallaxEls = $$('[data-parallax]');
  if (!reduceMotion && parallaxEls.length) {
    var hero = $('.hero');
    var pTicking = false;
    window.addEventListener('scroll', function () {
      if (pTicking) return;
      pTicking = true;
      raf(function () {
        var y = window.pageYOffset;
        if (hero && y < window.innerHeight * 1.2) {
          parallaxEls.forEach(function (el) {
            var speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
            el.style.transform = 'translate3d(0,' + (y * speed) + 'px,0)';
          });
        }
        pTicking = false;
      });
    }, { passive: true });
  }

  /* ------------------- Timeline progress fill ------------------- */
  var timeline = $('[data-timeline]');
  var tlProgress = $('[data-timeline-progress]');
  if (timeline && tlProgress && !reduceMotion) {
    window.addEventListener('scroll', function () {
      var r = timeline.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = (vh - r.top) / (vh + r.height);
      tlProgress.style.width = Math.max(0, Math.min(1, p)) * 100 + '%';
    }, { passive: true });
  }

  /* ------------------- Ingredient explorer (tabs) ------------------- */
  var explorer = $('[data-explorer]');
  if (explorer) {
    var tabs = $$('[data-explorer-tab]', explorer);
    var panels = $$('[data-explorer-panel]', explorer);
    function selectTab(key, focus) {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-explorer-tab') === key;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on && focus) t.focus();
      });
      panels.forEach(function (p) {
        var on = p.getAttribute('data-explorer-panel') === key;
        p.hidden = !on;
        p.classList.toggle('is-active', on);
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { selectTab(t.getAttribute('data-explorer-tab')); });
      t.addEventListener('keydown', function (e) {
        var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        var next = (i + dir + tabs.length) % tabs.length;
        selectTab(tabs[next].getAttribute('data-explorer-tab'), true);
      });
    });
  }

  /* ---------------------- Origin map pins ---------------------- */
  var mapPins = $$('[data-pin]');
  if (mapPins.length && 'IntersectionObserver' in window) {
    var mapWrap = $('[data-map-pins]');
    if (mapWrap) {
      var mio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          mapPins.forEach(function (pin, i) {
            setTimeout(function () { pin.classList.add('is-on'); }, reduceMotion ? 0 : i * 260);
          });
          mio.disconnect();
        });
      }, { threshold: 0.4 });
      mio.observe(mapWrap);
    }
  } else { mapPins.forEach(function (p) { p.classList.add('is-on'); }); }

  /* --------------------------- Quiz --------------------------- */
  var quiz = $('[data-quiz]');
  if (quiz) {
    var qForm = $('[data-quiz-form]', quiz);
    var steps = $$('[data-quiz-step]', quiz);
    var bar = $('[data-quiz-bar]', quiz);
    var answers = [];
    var results = {
      pine: { title: 'Black Sea Pine Honey', copy: 'A robust, mineral forest honeydew for depth-seekers. Savoury, complex, and rare — the connoisseur\'s choice.' },
      chestnut: { title: 'Black Sea Chestnut Honey', copy: 'Bold, aromatic, and unmistakable, with a characterful bittersweet finish. For those who like an honest, memorable flavour.' },
      wild: { title: 'Black Sea Wildflower Honey', copy: 'Delicate, floral, and ever-shifting — a gentle everyday honey that captures a single meadow season.' }
    };
    var totalQ = 3;

    function showStep(key) {
      steps.forEach(function (s) { s.hidden = s.getAttribute('data-quiz-step') !== String(key); });
      var progressPct;
      if (key === 'result') progressPct = 100;
      else progressPct = (Number(key) / totalQ) * 100;
      if (bar) bar.style.width = progressPct + '%';
    }

    function tally() {
      var counts = {};
      answers.forEach(function (a) { counts[a] = (counts[a] || 0) + 1; });
      var best = 'pine', bestN = -1;
      Object.keys(counts).forEach(function (k) { if (counts[k] > bestN) { bestN = counts[k]; best = k; } });
      return best;
    }

    $$('[data-value]', quiz).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var step = btn.closest('[data-quiz-step]');
        var idx = Number(step.getAttribute('data-quiz-step'));
        answers[idx] = btn.getAttribute('data-value');
        if (idx + 1 < totalQ) {
          showStep(idx + 1);
        } else {
          var res = results[tally()];
          $('[data-quiz-result-title]', quiz).textContent = res.title;
          $('[data-quiz-result-copy]', quiz).textContent = res.copy;
          showStep('result');
        }
      });
    });

    var restart = $('[data-quiz-restart]', quiz);
    if (restart) restart.addEventListener('click', function () {
      answers = []; showStep(0);
      var msg = $('[data-quiz-msg]', quiz);
      if (msg) { msg.textContent = ''; msg.className = 'field-note'; }
      var em = $('#quiz-email', quiz); if (em) em.value = '';
    });

    if (qForm) qForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('#quiz-email', quiz);
      var msg = $('[data-quiz-msg]', quiz);
      if (!email || !isEmail(email.value)) {
        if (msg) { msg.textContent = 'Please enter a valid email address.'; msg.className = 'field-note is-err'; }
        return;
      }
      function quizSuccess() {
        if (msg) { msg.textContent = 'Sent. Check your inbox to confirm — your recommendation is on its way.'; msg.className = 'field-note is-ok'; }
        email.value = '';
      }
      // Submit to Brevo (same endpoint as the waitlist form), then confirm.
      var wl = doc.querySelector('[data-waitlist]');
      var endpoint = wl && wl.getAttribute('data-endpoint');
      if (endpoint) {
        var fd = new FormData();
        fd.append('EMAIL', email.value.trim());
        fd.append('email_address_check', '');
        fd.append('locale', 'en');
        fetch(endpoint, { method: 'POST', body: fd, mode: 'no-cors' })
          .then(quizSuccess)
          .catch(function () { if (msg) { msg.textContent = 'Something went wrong. Please try again.'; msg.className = 'field-note is-err'; } });
      } else {
        quizSuccess();
      }
    });

    showStep(0);
  }

  /* ------------------------ Waitlist form ------------------------ */
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim()); }

  var wForm = $('[data-waitlist]');
  if (wForm) {
    wForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('#wl-email', wForm);
      var consent = wForm.querySelector('input[name="consent"]');
      var msg = $('[data-waitlist-msg]', wForm);
      if (!isEmail(email.value)) {
        msg.textContent = 'Please enter a valid email address.'; msg.className = 'field-note is-err'; email.focus(); return;
      }
      if (consent && !consent.checked) {
        msg.textContent = 'Please agree to the Privacy Policy to continue.'; msg.className = 'field-note is-err'; return;
      }
      var endpoint = wForm.getAttribute('data-endpoint');
      if (endpoint) {
        // Real submit path (double opt-in handled by your ESP).
        var data = new FormData(wForm);
        fetch(endpoint, { method: 'POST', body: data, mode: 'no-cors' })
          .then(function () { success(); })
          .catch(function () { msg.textContent = 'Something went wrong. Please try again.'; msg.className = 'field-note is-err'; });
      } else {
        success(); // demo mode
      }
      function success() {
        msg.textContent = 'Welcome to the founding circle. Please confirm via the email we just sent.';
        msg.className = 'field-note is-ok';
        wForm.reset();
      }
    });
  }

  /* ---------------- Video placeholder (founder) ---------------- */
  var videoBtn = $('[data-video-placeholder]');
  if (videoBtn) videoBtn.addEventListener('click', function () {
    // Placeholder: swap for a real video embed / lightbox when ready.
    videoBtn.setAttribute('aria-label', 'Founder message coming soon');
  });

  /* ------------------------ Scroll spy ------------------------ */
  var navLinks = $$('[data-nav]');
  var sections = navLinks.map(function (a) {
    var id = a.getAttribute('href');
    return id && id.charAt(0) === '#' ? doc.querySelector(id) : null;
  });
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var i = sections.indexOf(entry.target);
        navLinks.forEach(function (l, j) { l.classList.toggle('is-active', j === i); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { if (s) spy.observe(s); });
  }

  /* --------------------- Current year --------------------- */
  var yearEl = $('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ------------------- Consent banner (privacy-first) ------------------- */
  var consent = $('[data-consent]');
  if (consent) {
    var KEY = 'balviora-consent';
    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) {}
    if (!stored) { setTimeout(function () { consent.hidden = false; }, 1200); }

    function setConsent(value) {
      try { localStorage.setItem(KEY, value); } catch (e) {}
      consent.hidden = true;
      // Consent Mode v2 hook — only enable analytics when accepted.
      // if (value === 'granted' && window.gtag) {
      //   gtag('consent', 'update', { analytics_storage:'granted', ad_storage:'granted' });
      //   // then inject GA4 / GTM / pixels here.
      // }
    }
    var acc = $('[data-consent-accept]', consent);
    var dec = $('[data-consent-decline]', consent);
    if (acc) acc.addEventListener('click', function () { setConsent('granted'); });
    if (dec) dec.addEventListener('click', function () { setConsent('denied'); });
  }

})();
