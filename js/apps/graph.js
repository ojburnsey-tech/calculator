import { integrate } from '../engine.js';
import { CalcError } from '../parse.js';

const N = 20;
const COLORS = ['#0a84ff', '#ff3b30', '#34c759', '#ff9500', '#af52de', '#00a3a3', '#ff2d55', '#a2845e'];
const color = i => COLORS[i % COLORS.length];

function niceStep(range, px, target = 70) {
  const raw = range / Math.max(1, px / target);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function fmt(v) {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) < 1e-12) return '0';
  const a = Math.abs(v);
  if (a >= 1e10 || a < 1e-4) return v.toExponential(6).replace(/\.?0+e/, 'e').replace('e', '×10^').replace(/\^\+?/, '^');
  return String(Number(v.toPrecision(10)));
}

function tickLabel(v, step) {
  if (Math.abs(v) < step * 1e-9) return '0';
  const d = Math.max(0, -Math.floor(Math.log10(step)) + (step / Math.pow(10, Math.floor(Math.log10(step))) % 1 ? 1 : 0));
  const s = v.toFixed(Math.min(d, 8));
  return Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4) ? v.toExponential(1) : s;
}

export const graphApp = {
  id: 'graph',
  title: 'Graph & Table',
  mount(el, ctx) {
    this.ctx = ctx;
    this.el = el;
    const { store } = ctx;
    if (!store.graph) store.graph = [];
    while (store.graph.length < N) store.graph.push({ latex: '', on: true });
    if (!store.window) store.window = { xmin: -10, xmax: 10, xscl: 1, ymin: -7, ymax: 7, yscl: 1 };
    if (!store.table) store.table = { start: '-5', end: '5', step: '1' };
    this.sel = 0;
    this.showEdit();
  },
  unmount() {
    this.ctx.save();
    if (this.ro) { this.ro.disconnect(); this.ro = null; }
  },
  fns() {
    const { store, parse } = this.ctx;
    const out = [];
    store.graph.forEach((g, i) => {
      if (!g || !g.on || !g.latex || !g.latex.trim()) return;
      try {
        const ast = parse.parseLatex(g.latex);
        if (ast.k === 'eq') return;
        out.push({ i, f: this.ctx.engine.fnOf(ast, 'x') });
      } catch (e) {}
    });
    return out;
  },
  showEdit() {
    const { h, tex, store } = this.ctx;
    this.mode = 'edit';
    if (this.ro) { this.ro.disconnect(); this.ro = null; }
    this.ctx.showKeypad(true);
    this.ctx.setTitle('Graph & Table');
    this.el.innerHTML = '';
    const tools = h('div', { class: 'toolbar' },
      h('button', { type: 'button', class: 'prim', onclick: () => this.showGraph() }, 'Draw graph'),
      h('button', { type: 'button', onclick: () => this.showTable() }, 'Table'),
      h('button', { type: 'button', onclick: () => this.openWindow() }, 'View window'));
    const list = h('div', { class: 'flist scroll' });
    this.cells = [];
    store.graph.forEach((g, i) => {
      const sw = h('button', { type: 'button', class: 'swatch' + (g.on ? ' on' : ''), style: `--c:${color(i)}`, 'aria-label': (g.on ? 'Hide' : 'Show') + ' y' + (i + 1), 'aria-pressed': g.on ? 'true' : 'false' });
      sw.addEventListener('click', () => { g.on = !g.on; sw.classList.toggle('on', g.on); sw.setAttribute('aria-pressed', g.on ? 'true' : 'false'); this.ctx.save(); });
      const mf = this.ctx.makeField(g.latex, { class: 'fcell', onInput: v => { g.latex = v; this.ctx.save(); } });
      this.cells.push(mf);
      list.append(h('div', { class: 'frow-g' }, sw, h('span', { class: 'flabel', html: tex('y_{' + (i + 1) + '}=') }), mf));
    });
    this.el.append(h('div', { class: 'gedit' }, tools, list));
    const first = store.graph.findIndex(g => !g.latex);
    this.ctx.focusField(this.cells[Math.max(0, first)]);
  },
  onExe() {
    if (this.mode === 'edit') {
      const i = this.cells.indexOf(this.ctx.field);
      if (i >= 0 && i < this.cells.length - 1) this.ctx.focusField(this.cells[i + 1]);
      return;
    }
    if (this.mode === 'table') { this.fillTable(); return; }
    if (this.prompt) {
      const i = this.prompt.fields.indexOf(this.ctx.field);
      if (i >= 0 && i < this.prompt.fields.length - 1) { this.ctx.focusField(this.prompt.fields[i + 1]); return; }
      this.submitPrompt();
    }
  },
  onKey(id) {
    if (id === 'sd' || id === 'format') return true;
    if (this.mode === 'graph' && !this.prompt) {
      if (id === 'left' || id === 'right') { this.step(id === 'left' ? -1 : 1); return true; }
    }
    return false;
  },
  openWindow() {
    const { h, store, tex } = this.ctx;
    const w = store.window;
    const keys = [['xmin', 'X_{\\min}'], ['xmax', 'X_{\\max}'], ['xscl', 'X_{\\text{scale}}'], ['ymin', 'Y_{\\min}'], ['ymax', 'Y_{\\max}'], ['yscl', 'Y_{\\text{scale}}']];
    const inputs = {};
    const body = h('div', { class: 'settings' });
    const grid = h('div', { class: 'vwin' });
    for (const [k, label] of keys) {
      const inp = h('input', { type: 'text', inputmode: 'decimal', value: String(w[k]), class: 'num-in', 'aria-label': k });
      inputs[k] = inp;
      grid.append(h('label', { class: 'vrow' }, h('span', { html: tex(label) }), inp));
    }
    const err = h('div', { class: 'err' });
    const presets = h('div', { class: 'toolbar' },
      h('button', { type: 'button', onclick: () => fill({ xmin: -10, xmax: 10, xscl: 1, ymin: -7, ymax: 7, yscl: 1 }) }, 'Standard'),
      h('button', { type: 'button', onclick: () => fill({ xmin: -360, xmax: 360, xscl: 90, ymin: -1.6, ymax: 1.6, yscl: 0.5 }) }, 'Trig (Deg)'),
      h('button', { type: 'button', onclick: () => fill({ xmin: -2 * Math.PI, xmax: 2 * Math.PI, xscl: Math.PI / 2, ymin: -1.6, ymax: 1.6, yscl: 0.5 }) }, 'Trig (Rad)'));
    const fill = v => { for (const k in v) inputs[k].value = String(Number(v[k].toPrecision(10))); };
    body.append(presets, grid, err, h('button', { type: 'button', class: 'primary wide', onclick: () => {
      const nv = {};
      for (const [k] of keys) {
        const raw = inputs[k].value.replace('−', '-').replace('π', String(Math.PI));
        const v = Number(raw);
        if (!isFinite(v)) { err.textContent = 'Check ' + k; return; }
        nv[k] = v;
      }
      if (nv.xmin >= nv.xmax || nv.ymin >= nv.ymax || nv.xscl < 0 || nv.yscl < 0) { err.textContent = 'Min must be less than max'; return; }
      Object.assign(w, nv);
      this.ctx.save();
      this.ctx.closeSheet();
      if (this.mode === 'graph') this.draw();
    } }, 'Save'));
    this.ctx.openSheet('View window', body, { tall: true });
  },
  showGraph() {
    const { h } = this.ctx;
    this.mode = 'graph';
    this.ctx.showKeypad(false);
    this.ctx.setTitle('Graph');
    this.el.innerHTML = '';
    this.trace = false;
    this.marks = [];
    this.markIdx = 0;
    this.shade = null;
    this.prompt = null;
    const active = this.fns();
    if (active.length && !active.some(a => a.i === this.sel)) this.sel = active[0].i;
    this.canvas = h('canvas', { class: 'gcanvas', 'aria-label': 'Graph' });
    this.info = h('div', { class: 'ginfo' });
    this.promptEl = h('div', { class: 'gprompt' });
    const btn = (label, fn, cls = '') => h('button', { type: 'button', class: cls, onclick: fn }, label);
    this.traceBtn = btn('Trace', () => this.toggleTrace());
    const bar = h('div', { class: 'gbar' },
      btn('Edit', () => this.showEdit()),
      this.traceBtn,
      btn('G-Solve', () => this.openGSolve()),
      btn('−', () => this.zoom(2), 'sq'),
      btn('+', () => this.zoom(0.5), 'sq'),
      btn('Reset', () => { Object.assign(this.ctx.store.window, { xmin: -10, xmax: 10, xscl: 1, ymin: -7, ymax: 7, yscl: 1 }); this.ctx.save(); this.draw(); }));
    const wrap = h('div', { class: 'gwrap' }, this.canvas, this.info);
    this.el.append(h('div', { class: 'gview' }, wrap, this.promptEl, bar));
    this.bindCanvas();
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(wrap);
    if (!active.length) this.setInfo('No graphs to draw. Tap Edit and type a function.');
    else this.setInfo('');
  },
  setInfo(html, nav) {
    const { h } = this.ctx;
    this.info.innerHTML = '';
    if (!html) { this.info.classList.remove('on'); return; }
    this.info.classList.add('on');
    if (nav) this.info.append(h('button', { type: 'button', class: 'nav', 'aria-label': 'Previous', onclick: () => this.step(-1) }, '◀'));
    this.info.append(h('div', { class: 'ginfo-t', html }));
    if (nav) this.info.append(h('button', { type: 'button', class: 'nav', 'aria-label': 'Next', onclick: () => this.step(1) }, '▶'));
  },
  view() {
    const w = this.ctx.store.window;
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    return { ...w, W, H, X: x => (x - w.xmin) / (w.xmax - w.xmin) * W, Y: y => H - (y - w.ymin) / (w.ymax - w.ymin) * H, ix: px => w.xmin + px / W * (w.xmax - w.xmin), iy: py => w.ymin + (H - py) / H * (w.ymax - w.ymin) };
  },
  draw() {
    if (this.mode !== 'graph' || !this.canvas) return;
    const cv = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const v = this.view();
    const css = getComputedStyle(document.body);
    const C = k => css.getPropertyValue(k).trim();
    g.fillStyle = C('--paper'); g.fillRect(0, 0, W, H);
    const sx = niceStep(v.xmax - v.xmin, W), sy = niceStep(v.ymax - v.ymin, H);
    g.lineWidth = 1;
    g.strokeStyle = C('--grid');
    g.beginPath();
    for (let x = Math.ceil(v.xmin / sx) * sx; x <= v.xmax; x += sx) { const px = Math.round(v.X(x)) + 0.5; g.moveTo(px, 0); g.lineTo(px, H); }
    for (let y = Math.ceil(v.ymin / sy) * sy; y <= v.ymax; y += sy) { const py = Math.round(v.Y(y)) + 0.5; g.moveTo(0, py); g.lineTo(W, py); }
    g.stroke();
    const ax = clampN(v.X(0), 0, W), ay = clampN(v.Y(0), 0, H);
    g.strokeStyle = C('--axis');
    g.beginPath();
    if (v.xmin <= 0 && v.xmax >= 0) { g.moveTo(Math.round(ax) + 0.5, 0); g.lineTo(Math.round(ax) + 0.5, H); }
    if (v.ymin <= 0 && v.ymax >= 0) { g.moveTo(0, Math.round(ay) + 0.5); g.lineTo(W, Math.round(ay) + 0.5); }
    g.stroke();
    g.fillStyle = C('--label2');
    g.font = '11px -apple-system, system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'top';
    const ly = clampN(ay + 4, 2, H - 14);
    for (let x = Math.ceil(v.xmin / sx) * sx; x <= v.xmax; x += sx) if (Math.abs(x) > sx / 2 && v.X(x) > 16 && v.X(x) < W - 16) g.fillText(tickLabel(x, sx), v.X(x), ly);
    g.textAlign = 'right'; g.textBaseline = 'middle';
    const lx = clampN(ax - 4, 30, W - 2);
    for (let y = Math.ceil(v.ymin / sy) * sy; y <= v.ymax; y += sy) if (Math.abs(y) > sy / 2 && v.Y(y) > 10 && v.Y(y) < H - 10) g.fillText(tickLabel(y, sy), lx, v.Y(y));
    const fns = this.fns();
    if (this.shade) {
      const { f, a, b, i } = this.shade;
      g.fillStyle = color(i) + '40';
      g.beginPath();
      g.moveTo(v.X(a), v.Y(0));
      const n = 200;
      for (let k = 0; k <= n; k++) { const x = a + (b - a) * k / n; const y = f(x); g.lineTo(v.X(x), v.Y(isFinite(y) ? clampN(y, v.ymin - 1e3, v.ymax + 1e3) : 0)); }
      g.lineTo(v.X(b), v.Y(0));
      g.closePath(); g.fill();
    }
    for (const { i, f } of fns) {
      g.strokeStyle = color(i);
      g.lineWidth = i === this.sel && this.trace ? 2.75 : 2.25;
      g.lineJoin = 'round';
      g.beginPath();
      let pen = false, py = null;
      const n = Math.ceil(W * 2);
      for (let k = 0; k <= n; k++) {
        const x = v.xmin + (v.xmax - v.xmin) * k / n;
        const y = f(x);
        if (!isFinite(y)) { pen = false; py = null; continue; }
        const sy2 = v.Y(y);
        if (py !== null && Math.abs(sy2 - py) > H * 3) { pen = false; }
        const cy = clampN(sy2, -H * 4, H * 5);
        if (!pen) { g.moveTo(k / 2, cy); pen = true; } else g.lineTo(k / 2, cy);
        py = sy2;
      }
      g.stroke();
    }
    const drawPoint = (x, y, c) => {
      g.fillStyle = C('--paper'); g.strokeStyle = c; g.lineWidth = 2.5;
      g.beginPath(); g.arc(v.X(x), v.Y(y), 5.5, 0, Math.PI * 2); g.fill(); g.stroke();
    };
    if (this.trace && this.traceX !== undefined) {
      const fn = fns.find(q => q.i === this.sel);
      if (fn) {
        const y = fn.f(this.traceX);
        g.strokeStyle = C('--label2'); g.setLineDash([4, 4]); g.lineWidth = 1;
        g.beginPath(); g.moveTo(v.X(this.traceX), 0); g.lineTo(v.X(this.traceX), H); g.stroke(); g.setLineDash([]);
        if (isFinite(y)) drawPoint(this.traceX, y, color(this.sel));
      }
    }
    if (this.marks.length) {
      const m = this.marks[this.markIdx];
      if (m) drawPoint(m.x, m.y, m.c || C('--label'));
    }
  },
  bindCanvas() {
    const cv = this.canvas;
    const pts = new Map();
    let start = null;
    const local = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, local(e));
      start = { win: { ...this.ctx.store.window }, pts: new Map([...pts].map(([k, p]) => [k, { ...p }])), moved: false };
      if (this.trace && pts.size === 1) this.traceTo(local(e).x);
    });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId) || !start) return;
      pts.set(e.pointerId, local(e));
      const v = this.view();
      const w = this.ctx.store.window;
      if (pts.size === 1) {
        const p = pts.get(e.pointerId), s = start.pts.get(e.pointerId);
        if (!s) return;
        if (this.trace) { this.traceTo(p.x); return; }
        const dx = (p.x - s.x) / v.W * (start.win.xmax - start.win.xmin);
        const dy = (p.y - s.y) / v.H * (start.win.ymax - start.win.ymin);
        if (Math.abs(p.x - s.x) + Math.abs(p.y - s.y) > 3) start.moved = true;
        w.xmin = start.win.xmin - dx; w.xmax = start.win.xmax - dx;
        w.ymin = start.win.ymin + dy; w.ymax = start.win.ymax + dy;
        this.draw();
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const ids = [...pts.keys()];
        const sa = start.pts.get(ids[0]), sb = start.pts.get(ids[1]);
        if (!sa || !sb) { start = { win: { ...w }, pts: new Map([...pts].map(([k, p]) => [k, { ...p }])) }; return; }
        const d0x = Math.max(20, Math.abs(sa.x - sb.x)), d1x = Math.max(20, Math.abs(a.x - b.x));
        const d0y = Math.max(20, Math.abs(sa.y - sb.y)), d1y = Math.max(20, Math.abs(a.y - b.y));
        const d0 = Math.hypot(sa.x - sb.x, sa.y - sb.y), d1 = Math.hypot(a.x - b.x, a.y - b.y);
        const kx = Math.abs(sa.x - sb.x) > 40 ? d0x / d1x : d0 / Math.max(1, d1);
        const ky = Math.abs(sa.y - sb.y) > 40 ? d0y / d1y : d0 / Math.max(1, d1);
        const sw = start.win;
        const cx0 = sw.xmin + ((sa.x + sb.x) / 2) / v.W * (sw.xmax - sw.xmin);
        const cy0 = sw.ymin + (v.H - (sa.y + sb.y) / 2) / v.H * (sw.ymax - sw.ymin);
        const nwx = (sw.xmax - sw.xmin) * kx, nwy = (sw.ymax - sw.ymin) * ky;
        const fx = ((a.x + b.x) / 2) / v.W, fy = (v.H - (a.y + b.y) / 2) / v.H;
        w.xmin = cx0 - fx * nwx; w.xmax = w.xmin + nwx;
        w.ymin = cy0 - fy * nwy; w.ymax = w.ymin + nwy;
        start.moved = true;
        this.draw();
      }
    });
    const end = e => {
      pts.delete(e.pointerId);
      if (pts.size === 0) { start = null; this.ctx.save(); }
      else start = { win: { ...this.ctx.store.window }, pts: new Map([...pts].map(([k, p]) => [k, { ...p }])), moved: true };
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const p = local(e);
      this.zoom(Math.exp(e.deltaY * 0.002), p);
    }, { passive: false });
  },
  zoom(k, at) {
    const w = this.ctx.store.window;
    const v = this.view();
    const cx = at ? v.ix(at.x) : (w.xmin + w.xmax) / 2, cy = at ? v.iy(at.y) : (w.ymin + w.ymax) / 2;
    w.xmin = cx - (cx - w.xmin) * k; w.xmax = cx + (w.xmax - cx) * k;
    w.ymin = cy - (cy - w.ymin) * k; w.ymax = cy + (w.ymax - cy) * k;
    this.ctx.save();
    this.draw();
  },
  toggleTrace() {
    this.trace = !this.trace;
    this.traceBtn.classList.toggle('on', this.trace);
    this.marks = []; this.shade = null;
    if (this.trace) {
      const w = this.ctx.store.window;
      this.traceTo(this.view().X((w.xmin + w.xmax) / 2));
    } else { this.setInfo(''); this.draw(); }
  },
  traceTo(px) {
    const fns = this.fns();
    const fn = fns.find(q => q.i === this.sel) || fns[0];
    if (!fn) return;
    this.sel = fn.i;
    const v = this.view();
    this.traceX = v.ix(px);
    const y = fn.f(this.traceX);
    this.setInfo(`<b style="color:${color(fn.i)}">Trace y${fn.i + 1}</b><br>x = ${fmt(this.traceX)}&emsp;y = ${fmt(y)}`, true);
    this.draw();
  },
  step(dir) {
    if (this.marks.length > 1) {
      this.markIdx = (this.markIdx + dir + this.marks.length) % this.marks.length;
      this.showMark();
      return;
    }
    if (this.trace) {
      const fns = this.fns();
      const idx = fns.findIndex(q => q.i === this.sel);
      if (fns.length > 1 && (this.traceStepMode === 'fn')) { this.sel = fns[(idx + dir + fns.length) % fns.length].i; }
      else {
        const v = this.view();
        this.traceX += dir * (v.xmax - v.xmin) / 100;
      }
      const v = this.view();
      this.traceTo(v.X(this.traceX));
    }
  },
  activeFn(index) {
    const fns = this.fns();
    return fns.find(q => q.i === index) || fns[0];
  },
  openGSolve() {
    const { h, seg } = this.ctx;
    const fns = this.fns();
    if (!fns.length) { this.setInfo('No graphs to solve.'); return; }
    if (!fns.some(q => q.i === this.sel)) this.sel = fns[0].i;
    let other = (fns.find(q => q.i !== this.sel) || fns[0]).i;
    const body = h('div', { class: 'settings' });
    if (fns.length > 1) {
      body.append(h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, 'Graph'), seg(fns.map(q => [q.i, 'y' + (q.i + 1)]), this.sel, v => { this.sel = v; })));
      body.append(h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, 'Intersect with'), seg(fns.map(q => [q.i, 'y' + (q.i + 1)]), other, v => { other = v; })));
    }
    const items = [
      ['Root', () => this.solveRoots()], ['Maximum', () => this.solveExt(1)], ['Minimum', () => this.solveExt(-1)],
      ['y-intercept', () => this.solveYIcpt()], ['Intersection', () => this.solveIntersect(other)],
      ['y-Cal (y at a given x)', () => this.askPrompt([['x', 'x']], v => this.yCal(v.x))],
      ['x-Cal (x at a given y)', () => this.askPrompt([['y', 'y']], v => this.xCal(v.y))],
      ['∫dx (area between bounds)', () => this.askPrompt([['Lower', 'a'], ['Upper', 'b']], v => this.area(v.a, v.b))]
    ];
    const list = h('div', { class: 'formats' });
    for (const [label, fn] of items) list.append(h('button', { type: 'button', class: 'fmt-row', onclick: () => { this.ctx.closeSheet(); this.trace = false; this.traceBtn.classList.remove('on'); fn(); } }, label));
    body.append(list);
    this.ctx.openSheet('G-Solve', body, { tall: true });
  },
  samples(f, n = 1200) {
    const w = this.ctx.store.window;
    const xs = [], ys = [];
    for (let k = 0; k <= n; k++) { const x = w.xmin + (w.xmax - w.xmin) * k / n; xs.push(x); ys.push(f(x)); }
    return { xs, ys };
  },
  rootsOf(f) {
    const { xs, ys } = this.samples(f);
    const w = this.ctx.store.window;
    const span = w.ymax - w.ymin;
    const out = [];
    const bis = (a, b) => {
      let fa = f(a);
      for (let i = 0; i < 200; i++) {
        const m = (a + b) / 2, fm = f(m);
        if (fm === 0) return m;
        if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m;
        if (b - a < 1e-14 * Math.max(1, Math.abs(m))) break;
      }
      return (a + b) / 2;
    };
    for (let k = 1; k < xs.length; k++) {
      const a = ys[k - 1], b = ys[k];
      if (!isFinite(a) || !isFinite(b)) continue;
      if (a === 0) { out.push(xs[k - 1]); continue; }
      if (Math.sign(a) !== Math.sign(b) && b !== 0) {
        const r = bis(xs[k - 1], xs[k]);
        if (Math.abs(f(r)) < 1e-6 * Math.max(1, span)) out.push(r);
      }
    }
    for (const e of this.extremaOf(f, 0)) if (Math.abs(e.y) < 1e-9 * Math.max(1, span) && !out.some(r => Math.abs(r - e.x) < (w.xmax - w.xmin) * 1e-6)) out.push(e.x);
    return out.sort((p, q) => p - q).map(x => Math.abs(x) < 1e-12 ? 0 : x);
  },
  extremaOf(f, dir) {
    const { xs, ys } = this.samples(f);
    const out = [];
    const gold = (a, b, sgn) => {
      const g = (Math.sqrt(5) - 1) / 2;
      let c = b - g * (b - a), d = a + g * (b - a);
      for (let i = 0; i < 120; i++) {
        if (sgn * f(c) > sgn * f(d)) b = d; else a = c;
        c = b - g * (b - a); d = a + g * (b - a);
        if (Math.abs(b - a) < 1e-12 * Math.max(1, Math.abs(a))) break;
      }
      return (a + b) / 2;
    };
    for (let k = 1; k < xs.length - 1; k++) {
      const [a, b, c] = [ys[k - 1], ys[k], ys[k + 1]];
      if (![a, b, c].every(isFinite)) continue;
      const isMax = b >= a && b >= c && (b > a || b > c);
      const isMin = b <= a && b <= c && (b < a || b < c);
      if (dir >= 0 && isMax) { const x = gold(xs[k - 1], xs[k + 1], 1); out.push({ x, y: f(x), kind: 'max' }); }
      if (dir <= 0 && isMin) { const x = gold(xs[k - 1], xs[k + 1], -1); out.push({ x, y: f(x), kind: 'min' }); }
    }
    return out;
  },
  setMarks(marks, label) {
    this.marks = marks;
    this.markIdx = 0;
    this.markLabel = label;
    this.shade = null;
    if (!marks.length) { this.setInfo(label + ': none found in this view'); this.draw(); return; }
    this.showMark();
  },
  showMark() {
    const m = this.marks[this.markIdx];
    const count = this.marks.length > 1 ? ` <span class="muted">${this.markIdx + 1}/${this.marks.length}</span>` : '';
    this.setInfo(`<b>${this.markLabel}</b>${count}<br>x = ${fmt(m.x)}&emsp;y = ${fmt(m.y)}`, this.marks.length > 1);
    if (isFinite(m.x)) this.ctx.store.vars.x = m.x;
    if (isFinite(m.y)) this.ctx.store.vars.y = m.y;
    this.draw();
  },
  solveRoots() {
    const fn = this.activeFn(this.sel);
    this.setMarks(this.rootsOf(fn.f).map(x => ({ x, y: 0, c: color(fn.i) })), 'Root');
  },
  solveExt(dir) {
    const fn = this.activeFn(this.sel);
    const list = this.extremaOf(fn.f, dir).filter(e => isFinite(e.y));
    this.setMarks(list.map(e => ({ x: Math.abs(e.x) < 1e-10 ? 0 : e.x, y: e.y, c: color(fn.i) })), dir > 0 ? 'Maximum' : 'Minimum');
  },
  solveYIcpt() {
    const fn = this.activeFn(this.sel);
    const y = fn.f(0);
    this.setMarks(isFinite(y) ? [{ x: 0, y, c: color(fn.i) }] : [], 'y-intercept');
  },
  solveIntersect(other) {
    const a = this.activeFn(this.sel), b = this.activeFn(other);
    if (!a || !b || a.i === b.i) { this.setInfo('Choose two different graphs in G-Solve.'); return; }
    const xs = this.rootsOf(x => a.f(x) - b.f(x));
    this.setMarks(xs.map(x => ({ x, y: a.f(x) })), 'Intersection');
  },
  yCal(x) {
    const fn = this.activeFn(this.sel);
    const y = fn.f(x);
    this.setMarks(isFinite(y) ? [{ x, y, c: color(fn.i) }] : [], 'y-Cal');
  },
  xCal(y0) {
    const fn = this.activeFn(this.sel);
    this.setMarks(this.rootsOf(x => fn.f(x) - y0).map(x => ({ x, y: y0, c: color(fn.i) })), 'x-Cal');
  },
  area(a, b) {
    const fn = this.activeFn(this.sel);
    try {
      const v = integrate(x => { const y = fn.f(x); if (!isFinite(y)) throw new CalcError('Math ERROR'); return y; }, a, b);
      this.marks = [];
      this.shade = { f: fn.f, a: Math.min(a, b), b: Math.max(a, b), i: fn.i };
      this.ctx.store.vars.Ans = v;
      this.setInfo(`<b>∫dx</b>&ensp;from ${fmt(a)} to ${fmt(b)} = ${fmt(v)}`);
      this.draw();
    } catch (e) { this.setInfo('∫dx: Math ERROR'); }
  },
  askPrompt(specs, done) {
    const { h, tex } = this.ctx;
    this.promptEl.innerHTML = '';
    const fields = [];
    for (const [label] of specs) {
      const mf = this.ctx.makeField('', { class: 'cell' });
      fields.push(mf);
      this.promptEl.append(h('label', { class: 'prow' }, h('span', { html: tex(label.length > 1 ? '\\text{' + label + '}' : label) }), mf));
    }
    const go = h('button', { type: 'button', class: 'primary' }, 'OK');
    go.addEventListener('click', () => this.submitPrompt());
    const cancel = h('button', { type: 'button' }, 'Cancel');
    cancel.addEventListener('click', () => this.closePrompt());
    this.promptEl.append(h('div', { class: 'prow-btns' }, cancel, go));
    this.promptEl.classList.add('on');
    this.prompt = { specs, fields, done };
    this.ctx.showKeypad(true);
    this.ctx.focusField(fields[0]);
    requestAnimationFrame(() => this.draw());
  },
  submitPrompt() {
    const p = this.prompt;
    if (!p) return;
    const vals = {};
    try {
      p.specs.forEach(([, key], i) => {
        const r = this.ctx.engine.evaluate(p.fields[i].value || '0');
        if (typeof r.value !== 'number') throw new CalcError('Math ERROR');
        vals[key] = r.value;
      });
    } catch (e) { this.setInfo(e.kind || 'Math ERROR'); return; }
    this.closePrompt();
    p.done(vals);
  },
  closePrompt() {
    this.prompt = null;
    this.promptEl.classList.remove('on');
    this.promptEl.innerHTML = '';
    this.ctx.showKeypad(false);
    requestAnimationFrame(() => this.draw());
  },
  showTable() {
    const { h, tex, store } = this.ctx;
    this.mode = 'table';
    this.ctx.showKeypad(true);
    this.ctx.setTitle('Table');
    this.el.innerHTML = '';
    const t = store.table;
    const mk = (key) => this.ctx.makeField(t[key], { class: 'cell', onInput: v => { t[key] = v; this.ctx.save(); } });
    const fStart = mk('start'), fEnd = mk('end'), fStep = mk('step');
    this.cells = [fStart, fEnd, fStep];
    const head = h('div', { class: 'tset' },
      h('label', { class: 'prow' }, h('span', {}, 'Start'), fStart),
      h('label', { class: 'prow' }, h('span', {}, 'End'), fEnd),
      h('label', { class: 'prow' }, h('span', {}, 'Step'), fStep));
    this.tableOut = h('div', { class: 'stable scroll' });
    const tools = h('div', { class: 'toolbar' },
      h('button', { type: 'button', onclick: () => this.showEdit() }, 'Edit'),
      h('button', { type: 'button', class: 'prim', onclick: () => this.fillTable() }, 'Update table'),
      h('button', { type: 'button', onclick: () => this.showGraph() }, 'Draw graph'));
    this.el.append(h('div', { class: 'gtable' }, tools, head, this.tableOut));
    this.fillTable();
    this.ctx.focusField(fStart);
  },
  fillTable() {
    const { h, store } = this.ctx;
    const t = store.table;
    this.tableOut.innerHTML = '';
    let a, b, s;
    try {
      [a, b, s] = [t.start, t.end, t.step].map(x => { const r = this.ctx.engine.evaluate(x || '0'); if (typeof r.value !== 'number') throw new CalcError('Math ERROR'); return r.value; });
      if (s <= 0 || b < a) throw new CalcError('Math ERROR');
      if ((b - a) / s > 300) throw new CalcError('Range ERROR');
    } catch (e) { this.tableOut.append(h('div', { class: 'res-msg bad' }, e.kind || 'Math ERROR')); return; }
    const fns = this.fns();
    if (!fns.length) { this.tableOut.append(h('div', { class: 'res-msg' }, 'No functions. Tap Edit to add one.')); return; }
    const tb = h('table', { class: 'grid-table' });
    const hr = h('tr', {}, h('th', {}, 'x'));
    for (const fn of fns) hr.append(h('th', { style: `color:${color(fn.i)}` }, 'y' + (fn.i + 1)));
    tb.append(h('thead', {}, hr));
    const body = h('tbody');
    const n = Math.round((b - a) / s);
    for (let k = 0; k <= n; k++) {
      const x = Math.abs(a + k * s) < 1e-12 * Math.max(1, Math.abs(s)) ? 0 : a + k * s;
      const tr = h('tr', {}, h('td', {}, fmt(x)));
      for (const fn of fns) { const y = fn.f(x); tr.append(h('td', {}, isFinite(y) ? fmt(y) : 'ERROR')); }
      body.append(tr);
    }
    tb.append(body);
    this.tableOut.append(tb);
  }
};

function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }
