import { colors, fmt } from '../plot.js';

const COLS = [[10, 132, 255], [255, 59, 48], [52, 199, 89]];

export const graph3dApp = {
  id: 'graph3d',
  title: '3D Graph',
  mount(el, ctx) {
    this.ctx = ctx;
    this.el = el;
    if (!ctx.store.g3 || !Array.isArray(ctx.store.g3.f)) ctx.store.g3 = { f: [{ latex: '\\sin\\left(x\\right)\\cos\\left(y\\right)', on: true }, { latex: '', on: true }, { latex: '', on: true }], range: 3, zmax: 3, yaw: -0.7, pitch: 0.55, zoom: 1 };
    this.showEdit();
  },
  unmount() { this.ctx.save(); if (this.ro) this.ro.disconnect(); },
  showEdit() {
    const { h, tex, store } = this.ctx;
    const st = store.g3;
    this.mode = 'edit';
    if (this.ro) { this.ro.disconnect(); this.ro = null; }
    this.ctx.showKeypad(true);
    this.ctx.setTitle('3D Graph');
    this.el.innerHTML = '';
    const list = h('div', { class: 'flist scroll' });
    this.cells = [];
    st.f.forEach((f, i) => {
      const c = 'rgb(' + COLS[i].join(',') + ')';
      const sw = h('button', { type: 'button', class: 'swatch' + (f.on ? ' on' : ''), style: `--c:${c}`, 'aria-pressed': f.on ? 'true' : 'false', 'aria-label': 'Show z' + (i + 1) });
      sw.addEventListener('click', () => { f.on = !f.on; sw.classList.toggle('on', f.on); this.ctx.save(); });
      const mf = this.ctx.makeField(f.latex, { class: 'fcell', onInput: v => { f.latex = v; this.ctx.save(); } });
      this.cells.push(mf);
      list.append(h('div', { class: 'frow-g' }, sw, h('span', { class: 'flabel', html: tex('z_{' + (i + 1) + '}=') }), mf));
    });
    const r = this.ctx.numField(st.range, { label: 'x and y range', noSign: true, onInput: () => { const v = r.get(); if (v > 0) { st.range = v; this.ctx.save(); } } });
    const z = this.ctx.numField(st.zmax, { label: 'z range', noSign: true, onInput: () => { const v = z.get(); if (v > 0) { st.zmax = v; this.ctx.save(); } } });
    const tools = h('div', { class: 'toolbar' }, h('button', { type: 'button', class: 'prim', onclick: () => this.showGraph() }, 'Draw 3D graph'));
    const ins = h('div', { class: 'toolbar ins' });
    const y = h('button', { type: 'button' }, 'y'); y.addEventListener('click', () => this.ctx.insert('y')); ins.append(y);
    this.el.append(h('div', { class: 'gedit' }, tools,
      h('div', { class: 'pad g3-range' }, h('label', { class: 'vrow' }, h('span', { html: tex('-a\\le x,y\\le a,\\;a=') }), r.el), h('label', { class: 'vrow' }, h('span', { html: tex('\\left|z\\right|\\le') }), z.el)),
      ins, list));
    this.ctx.focusField(this.cells[0]);
  },
  onExe() {
    if (this.mode !== 'edit') return;
    const i = this.cells.indexOf(this.ctx.field);
    if (i >= 0 && i < this.cells.length - 1) this.ctx.focusField(this.cells[i + 1]);
    else this.showGraph();
  },
  onKey(id) { return id === 'sd' || id === 'format'; },
  showGraph() {
    const { h, store, parse, engine } = this.ctx;
    const st = store.g3;
    this.mode = 'graph';
    this.ctx.showKeypad(false);
    this.ctx.setTitle('3D Graph');
    this.el.innerHTML = '';
    this.fns = [];
    st.f.forEach((f, i) => {
      if (!f.on || !f.latex || !f.latex.trim()) return;
      try {
        const ast = parse.parseLatex(f.latex);
        this.fns.push({ i, f: (x, y) => { try { const v = engine.ev(ast, { x, y }); return typeof v === 'number' ? v : NaN; } catch (e) { return NaN; } } });
      } catch (e) {}
    });
    this.cv = h('canvas', { class: 'gcanvas', 'aria-label': '3D graph. Drag to rotate, pinch to zoom.' });
    const info = h('div', { class: 'sg-info' }, 'Drag to rotate · pinch to zoom');
    const bar = h('div', { class: 'gbar' },
      h('button', { type: 'button', onclick: () => this.showEdit() }, 'Edit'),
      h('button', { type: 'button', onclick: () => { Object.assign(st, { yaw: -0.7, pitch: 0.55, zoom: 1 }); this.draw(); } }, 'Reset view'),
      h('button', { type: 'button', class: 'sq', onclick: () => { st.zoom = Math.max(0.3, st.zoom / 1.25); this.draw(); } }, '−'),
      h('button', { type: 'button', class: 'sq', onclick: () => { st.zoom = Math.min(5, st.zoom * 1.25); this.draw(); } }, '+'));
    const wrap = h('div', { class: 'gwrap' }, this.cv);
    this.el.append(h('div', { class: 'gview' }, wrap, info, bar));
    this.mesh();
    this.bind();
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(wrap);
  },
  mesh() {
    const st = this.ctx.store.g3;
    const N = 34, R = st.range, Z = st.zmax;
    this.quads = [];
    for (const fn of this.fns) {
      const P = [];
      for (let i = 0; i <= N; i++) {
        P.push([]);
        for (let j = 0; j <= N; j++) {
          const x = -R + 2 * R * i / N, y = -R + 2 * R * j / N, z = fn.f(x, y);
          P[i].push([x / R, y / R, isFinite(z) ? z / Z : NaN]);
        }
      }
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const q = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]];
        if (q.some(p => !isFinite(p[2]) || Math.abs(p[2]) > 1.0001)) continue;
        this.quads.push({ q, c: COLS[fn.i] });
      }
    }
  },
  draw() {
    const cv = this.cv;
    if (!cv) return;
    const st = this.ctx.store.g3;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const C = colors();
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
    const S = Math.min(W, H) * 0.3 * st.zoom;
    const proj = ([x, y, z]) => {
      const x1 = x * cy - y * sy, y1 = x * sy + y * cy;
      const y2 = y1 * cp + z * sp, z2 = -y1 * sp + z * cp;
      const d = 4 / (4 + y2 * 0.6);
      return [W / 2 + x1 * S * d, H / 2 - z2 * S * d, y2];
    };
    const box = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(proj);
    g.strokeStyle = C.grid; g.lineWidth = 1;
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) { g.beginPath(); g.moveTo(box[a][0], box[a][1]); g.lineTo(box[b][0], box[b][1]); g.stroke(); }
    const axes = [[[-1.15, 0, 0], [1.15, 0, 0], 'x'], [[0, -1.15, 0], [0, 1.15, 0], 'y'], [[0, 0, -1.15], [0, 0, 1.15], 'z']];
    g.strokeStyle = C.axis; g.fillStyle = C.label2; g.font = '600 12px -apple-system, system-ui, sans-serif';
    for (const [a, b, l] of axes) { const p = proj(a), q = proj(b); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); g.fillText(l, q[0] + 4, q[1] - 4); }
    const L = [0.35, -0.5, 0.8];
    const ll = Math.hypot(...L);
    const faces = this.quads.map(({ q, c }) => {
      const pr = q.map(proj);
      const depth = pr.reduce((s, p) => s + p[2], 0) / 4;
      const u = [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]], w = [q[3][0] - q[1][0], q[3][1] - q[1][1], q[3][2] - q[1][2]];
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const nl = Math.hypot(...n) || 1;
      const lam = Math.abs((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / (nl * ll));
      return { pr, depth, c, k: 0.45 + 0.55 * lam };
    }).sort((a, b) => b.depth - a.depth);
    for (const f of faces) {
      g.beginPath();
      f.pr.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.closePath();
      g.fillStyle = `rgb(${f.c.map(v => Math.round(v * f.k)).join(',')})`;
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 0.6; g.stroke();
    }
    g.fillStyle = C.label2; g.font = '11px -apple-system, system-ui, sans-serif';
    g.fillText('x, y ∈ [−' + fmt(st.range) + ', ' + fmt(st.range) + ']   |z| ≤ ' + fmt(st.zmax), 10, H - 10);
    if (!this.fns.length) { g.fillStyle = C.label2; g.textAlign = 'center'; g.fillText('No functions. Tap Edit and type z = f(x, y).', W / 2, 24); g.textAlign = 'left'; }
  },
  bind() {
    const cv = this.cv, st = this.ctx.store.g3;
    const pts = new Map();
    let last = null, lastDist = null;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; lastDist = null; });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1 && last) {
        st.yaw += (e.clientX - last[0]) * 0.01;
        st.pitch = Math.max(-1.5, Math.min(1.5, st.pitch + (e.clientY - last[1]) * 0.01));
        last = [e.clientX, e.clientY];
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (lastDist) st.zoom = Math.max(0.3, Math.min(5, st.zoom * d / lastDist));
        lastDist = d;
      }
      this.draw();
    });
    const end = e => { pts.delete(e.pointerId); last = pts.size === 1 ? [...pts.values()][0] : null; lastDist = null; this.ctx.save(); };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', e => { e.preventDefault(); st.zoom = Math.max(0.3, Math.min(5, st.zoom * Math.exp(-e.deltaY * 0.002))); this.draw(); }, { passive: false });
  }
};
