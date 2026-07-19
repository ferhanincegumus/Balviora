(function () {
  'use strict';

  /* ---------------------------------------------------------------- */
  /* Header scroll state                                               */
  /* ---------------------------------------------------------------- */
  var header = document.getElementById('siteHeader');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------------------------------------------------------------- */
  /* Mobile drawer                                                     */
  /* ---------------------------------------------------------------- */
  var menuToggle = document.getElementById('menuToggle');
  var menuClose = document.getElementById('menuClose');
  var drawer = document.getElementById('mobileDrawer');

  function openDrawer() {
    drawer.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    drawer.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  if (menuToggle && drawer) {
    menuToggle.addEventListener('click', openDrawer);
    menuClose.addEventListener('click', closeDrawer);
    drawer.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeDrawer);
    });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });
  }

  /* ---------------------------------------------------------------- */
  /* Reveal on scroll                                                  */
  /* ---------------------------------------------------------------- */
  var revealEls = document.querySelectorAll('[data-reveal], [data-reveal-stagger]');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------------------------------------------------------------- */
  /* Origin map — hotspot / legend interaction                         */
  /* ---------------------------------------------------------------- */
  var hotspots = document.querySelectorAll('.map-hotspot');
  var legendBtns = document.querySelectorAll('.legend-btn');
  var panels = document.querySelectorAll('.origin-detail__item');

  function setActiveOrigin(key) {
    hotspots.forEach(function (h) {
      h.classList.toggle('is-active', h.getAttribute('data-hotspot') === key);
    });
    legendBtns.forEach(function (b) {
      var active = b.getAttribute('data-target') === key;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', String(active));
    });
    panels.forEach(function (p) {
      p.classList.toggle('is-active', p.getAttribute('data-panel') === key);
    });
  }

  hotspots.forEach(function (h) {
    var key = h.getAttribute('data-hotspot');
    h.addEventListener('click', function () { setActiveOrigin(key); });
    h.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setActiveOrigin(key);
      }
    });
  });
  legendBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      setActiveOrigin(b.getAttribute('data-target'));
    });
  });

  /* ---------------------------------------------------------------- */
  /* Email capture form                                                */
  /* ---------------------------------------------------------------- */
  var form = document.getElementById('emailForm');
  var panel = document.getElementById('capturePanel');
  var input = document.getElementById('emailInput');
  var errorEl = document.getElementById('emailError');

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var value = input.value.trim();

      if (!isValidEmail(value)) {
        input.setAttribute('aria-invalid', 'true');
        errorEl.textContent = 'Please enter a valid email address.';
        input.focus();
        return;
      }

      input.setAttribute('aria-invalid', 'false');
      errorEl.textContent = '';

      /* Integration point: wire to Shopify / Klaviyo / ESP endpoint here. */
      panel.classList.add('is-submitted');
    });

    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true' && isValidEmail(input.value.trim())) {
        input.setAttribute('aria-invalid', 'false');
        errorEl.textContent = '';
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Footer year                                                       */
  /* ---------------------------------------------------------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

})();
