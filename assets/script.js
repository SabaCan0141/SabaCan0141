/* Site orchestration: theme, hero Game of Life, scroll reveal */
(function () {
  'use strict';

  var site = document.getElementById('top');
  var schemeMQ = window.matchMedia('(prefers-color-scheme: dark)');
  var manualTheme = false;

  function applyTheme(theme) {
    site.setAttribute('data-theme', theme);
    document.body.style.background = theme === 'light' ? '#ffffff' : '#161616';
    var label = document.getElementById('theme-label');
    if (label) label.textContent = theme === 'dark' ? 'LIGHT' : 'DARK';
    if (window.__life) window.__life.setTheme(theme);
  }

  // Initial theme from system preference
  var theme = schemeMQ.matches ? 'dark' : 'light';
  applyTheme(theme);

  // Follow system changes until the user overrides manually
  schemeMQ.addEventListener('change', function (e) {
    if (manualTheme) return;
    applyTheme(e.matches ? 'dark' : 'light');
  });

  // Manual toggle
  var toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) toggleBtn.addEventListener('click', function () {
    manualTheme = true;
    var next = site.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  // Hero Game of Life
  var canvas = document.getElementById('life');
  if (canvas && window.LifeGame) {
    window.__life = new window.LifeGame(canvas, {
      density: 'medium',
      speed: 1000,
      showGrid: true,
      theme: site.getAttribute('data-theme')
    }).mount();

    var pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) pauseBtn.addEventListener('click', function () {
      var paused = window.__life.togglePause();
      var PLAY = '<svg viewBox="0 0 12 14" width="11" height="12"><path d="M1 1 L11 7 L1 13 Z" fill="currentColor"/></svg>';
      var PAUSE = '<svg viewBox="0 0 12 14" width="11" height="12"><rect x="1" y="1" width="3.5" height="12" fill="currentColor"/><rect x="7.5" y="1" width="3.5" height="12" fill="currentColor"/></svg>';
      document.getElementById('pause-glyph').innerHTML = paused ? PLAY : PAUSE;
      document.getElementById('pause-label').textContent = paused ? '再開' : '一時停止';
    });
  }

  // Devicon fallback: try "-plain" variant if "-original" is missing; hide icon if both fail
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!(t instanceof HTMLImageElement) || !t.classList.contains('chip-icon')) return;
    if (!t.dataset.fallback && t.src.indexOf('-original') !== -1) {
      t.dataset.fallback = '1';
      t.src = t.src.replace('-original', '-plain');
    } else {
      t.remove();
    }
  }, true);

  // Scroll reveal
  var reveals = document.querySelectorAll('.reveal');
  if (window.IntersectionObserver && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }
})();
