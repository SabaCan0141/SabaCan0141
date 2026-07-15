/* Conway's Game of Life — canvas background renderer (B3/S23) */
(function (global) {
  'use strict';

  class LifeGame {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Object} opts { density:'fine'|'medium'|'large', speed:ms, showGrid:bool, theme:'dark'|'light' }
     */
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.density = opts.density || 'medium';
      this.speed = opts.speed || 1000;
      this.showGrid = opts.showGrid !== false;
      this.theme = opts.theme || 'dark';
      this.paused = false;
      this.reduced = global.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this._loop = null;
      this._reseedT = null;
      this._drawing = false;

      this._onResize = this.resize.bind(this);
      this._onVis = () => { if (document.hidden) this._stopLoop(); else this._startLoop(); };
      this._onDown = this._pointerDown.bind(this);
      this._onMove = this._pointerMove.bind(this);
      this._onUp = this._pointerUp.bind(this);
    }

    mount() {
      this.resize();
      this.seed();
      global.addEventListener('resize', this._onResize);
      document.addEventListener('visibilitychange', this._onVis);
      this.canvas.addEventListener('pointerdown', this._onDown);
      this.canvas.addEventListener('pointermove', this._onMove);
      this.canvas.addEventListener('pointerup', this._onUp);
      this.canvas.addEventListener('pointerleave', this._onUp);
      if (this.reduced) this.draw(); else this._startLoop();
      return this;
    }

    destroy() {
      this._stopLoop();
      clearTimeout(this._reseedT);
      global.removeEventListener('resize', this._onResize);
      document.removeEventListener('visibilitychange', this._onVis);
      this.canvas.removeEventListener('pointerdown', this._onDown);
      this.canvas.removeEventListener('pointermove', this._onMove);
      this.canvas.removeEventListener('pointerup', this._onUp);
      this.canvas.removeEventListener('pointerleave', this._onUp);
    }

    /* ----- public controls ----- */
    setTheme(theme) { this.theme = theme; this.draw(); }
    togglePause() { this.paused = !this.paused; if (this.paused) this._stopLoop(); else this._startLoop(); return this.paused; }
    reseed() { this.seed(); this.draw(); }

    /* ----- sizing ----- */
    _cellSize() {
      let base = this.density === 'fine' ? 15 : this.density === 'large' ? 30 : 22;
      if (global.innerWidth < 640) base = Math.min(base, 15);
      return base;
    }

    resize() {
      const dpr = global.devicePixelRatio || 1;
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      if (!w || !h) return;
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.cw = w; this.ch = h;
      this.cs = this._cellSize();
      const cols = Math.ceil(w / this.cs), rows = Math.ceil(h / this.cs);
      if (cols !== this.cols || rows !== this.rows) {
        this.cols = cols; this.rows = rows;
        this.seed();
      }
      this.draw();
    }

    /* ----- simulation ----- */
    seed() {
      const n = this.cols * this.rows;
      this.grid = new Uint8Array(n);
      for (let i = 0; i < n; i++) this.grid[i] = Math.random() < 0.28 ? 1 : 0;
      this.prev = null; this.staticGen = 0; this.oscGen = 0;
      this.hot = new Set();
    }

    _next(g) {
      const { cols, rows } = this;
      const out = new Uint8Array(cols * rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && g[ny * cols + nx]) n++;
            }
          }
          const i = y * cols + x;
          out[i] = g[i] ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
        }
      }
      return out;
    }

    _eq(a, b) { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
    _pop(g) { let s = 0; for (let i = 0; i < g.length; i++) s += g[i]; return s; }

    _step() {
      const nx = this._next(this.grid);
      let stagnant = false;
      if (this._pop(nx) === 0) stagnant = true;
      else if (this._eq(nx, this.grid)) { this.staticGen++; if (this.staticGen >= 1) stagnant = true; }
      else if (this._eq(nx, this.prev)) { this.oscGen++; this.staticGen = 0; if (this.oscGen >= 7) stagnant = true; }
      else { this.staticGen = 0; this.oscGen = 0; }
      this.prev = this.grid;
      this.grid = nx;
      this.hot = new Set();
      this.draw();
      if (stagnant) this._scheduleReseed();
    }

    _scheduleReseed() {
      if (this._reseedT) return;
      this._stopLoop();
      this._reseedT = setTimeout(() => {
        this._reseedT = null;
        this.seed();
        this.draw();
        if (!this.reduced && !this.paused && !document.hidden) this._startLoop();
      }, 2800);
    }

    _startLoop() {
      if (this.reduced || this.paused || document.hidden || this._reseedT) return;
      this._stopLoop();
      this._loop = setInterval(() => this._step(), this.speed);
    }
    _stopLoop() { if (this._loop) { clearInterval(this._loop); this._loop = null; } }

    /* ----- rendering ----- */
    _colors() {
      const light = this.theme === 'light';
      return {
        cell: light ? '#c6c6c6' : '#525252',
        grid: light ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.035)',
        hot: light ? '#0f62fe' : '#4589ff'
      };
    }

    draw() {
      if (!this.ctx || !this.grid) return;
      const { cs, cols, rows, cw, ch } = this;
      const c = this._colors();
      const ctx = this.ctx;
      ctx.clearRect(0, 0, cw, ch);
      if (this.showGrid) {
        ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = 0; x <= cols; x++) { const px = Math.round(x * cs) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, ch); }
        for (let y = 0; y <= rows; y++) { const py = Math.round(y * cs) + 0.5; ctx.moveTo(0, py); ctx.lineTo(cw, py); }
        ctx.stroke();
      }
      ctx.fillStyle = c.cell;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (this.grid[y * cols + x] && !(this.hot && this.hot.has(y * cols + x))) ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
      }
      if (this.hot && this.hot.size) {
        ctx.fillStyle = c.hot;
        this.hot.forEach(i => { const x = i % cols, y = (i / cols) | 0; if (this.grid[i]) ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2); });
      }
    }

    /* ----- drawing by pointer (click + drag) ----- */
    _cellIndex(e) {
      if (!this.grid) return -1;
      const r = this.canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / this.cs);
      const y = Math.floor((e.clientY - r.top) / this.cs);
      if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return -1;
      return y * this.cols + x;
    }

    _paint(i) {
      if (i < 0 || this._painted.has(i)) return;
      this._painted.add(i);
      this.grid[i] = this._paintVal;
      if (!this.hot) this.hot = new Set();
      if (this._paintVal) this.hot.add(i); else this.hot.delete(i);
      this.draw();
    }

    _pointerDown(e) {
      const i = this._cellIndex(e);
      if (i < 0) return;
      this._drawing = true;
      this._paintVal = this.grid[i] ? 0 : 1; // 生きていれば消す、死んでいれば描く
      this._painted = new Set();
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
      this._paint(i);
    }
    _pointerMove(e) { if (this._drawing) this._paint(this._cellIndex(e)); }
    _pointerUp() { this._drawing = false; }
  }

  global.LifeGame = LifeGame;
})(window);
