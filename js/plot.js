export const PALETTE = ['#0a84ff', '#ff3b30', '#34c759', '#ff9500', '#af52de', '#00a3a3', '#ff2d55', '#a2845e'];

export function niceStep(range, px, target = 70) {
  const raw = range / Math.max(1, px / target);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

export function tickLabel(v, step) {
  if (Math.abs(v) < step * 1e-9) return '0';
  if (Math.abs(v) >= 1e6 || Math.abs(v) < 1e-4) return v.toExponential(1);
  const d = Math.max(0, Math.min(8, -Math.floor(Math.log10(step) + 1e-9)));
  return v.toFixed(d);
}

export function fmt(v) {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) < 1e-12) return '0';
  const a = Math.abs(v);
  if (a >= 1e10 || a < 1e-4) return v.toExponential(6).replace(/\.?0+e/, 'e').replace('e', '×10^').replace(/\^\+?/, '^');
  return String(Number(v.toPrecision(10)));
}

export function colors() {
  const css = getComputedStyle(document.body);
  const C = k => css.getPropertyValue(k).trim();
  return { paper: C('--paper'), grid: C('--grid'), axis: C('--axis'), label: C('--label'), label2: C('--label2'), tint: C('--tint'), sep: C('--sep'), card: C('--card') };
}

export class Plot {
  constructor(canvas, win, opts = {}) {
    this.cv = canvas;
    this.win = win;
    this.opts = opts;
    this.onDraw = null;
    this.equal = !!opts.equal;
    this.bind();
  }
  size() {
    const dpr = window.devicePixelRatio || 1;
    const W = this.cv.clientWidth, H = this.cv.clientHeight;
    if (this.cv.width !== Math.round(W * dpr) || this.cv.height !== Math.round(H * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    const g = this.cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, W, H };
  }
  fitEqual(W, H) {
    if (!this.equal || !W || !H) return;
    const w = this.win;
    const cx = (w.xmin + w.xmax) / 2, cy = (w.ymin + w.ymax) / 2;
    const ux = (w.xmax - w.xmin) / W, uy = (w.ymax - w.ymin) / H;
    const u = Math.max(ux, uy);
    w.xmin = cx - u * W / 2; w.xmax = cx + u * W / 2; w.ymin = cy - u * H / 2; w.ymax = cy + u * H / 2;
  }
  view(W, H) {
    const w = this.win;
    return { W, H, ...w, X: x => (x - w.xmin) / (w.xmax - w.xmin) * W, Y: y => H - (y - w.ymin) / (w.ymax - w.ymin) * H, ix: px => w.xmin + px / W * (w.xmax - w.xmin), iy: py => w.ymin + (H - py) / H * (w.ymax - w.ymin) };
  }
  draw() {
    const { g, W, H } = this.size();
    if (!W || !H) return;
    this.fitEqual(W, H);
    const v = this.view(W, H);
    const C = colors();
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    if (this.opts.axes !== false) {
      const sx = niceStep(v.xmax - v.xmin, W), sy = niceStep(v.ymax - v.ymin, H);
      g.lineWidth = 1; g.strokeStyle = C.grid; g.beginPath();
      for (let x = Math.ceil(v.xmin / sx) * sx; x <= v.xmax; x += sx) { const px = Math.round(v.X(x)) + 0.5; g.moveTo(px, 0); g.lineTo(px, H); }
      for (let y = Math.ceil(v.ymin / sy) * sy; y <= v.ymax; y += sy) { const py = Math.round(v.Y(y)) + 0.5; g.moveTo(0, py); g.lineTo(W, py); }
      g.stroke();
      const ax = Math.max(0, Math.min(W, v.X(0))), ay = Math.max(0, Math.min(H, v.Y(0)));
      g.strokeStyle = C.axis; g.beginPath();
      if (v.xmin <= 0 && v.xmax >= 0) { g.moveTo(Math.round(ax) + 0.5, 0); g.lineTo(Math.round(ax) + 0.5, H); }
      if (v.ymin <= 0 && v.ymax >= 0) { g.moveTo(0, Math.round(ay) + 0.5); g.lineTo(W, Math.round(ay) + 0.5); }
      g.stroke();
      g.fillStyle = C.label2; g.font = '11px -apple-system, system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'top';
      const ly = Math.max(2, Math.min(H - 14, ay + 4));
      for (let x = Math.ceil(v.xmin / sx) * sx; x <= v.xmax; x += sx) if (Math.abs(x) > sx / 2 && v.X(x) > 16 && v.X(x) < W - 16) g.fillText(tickLabel(x, sx), v.X(x), ly);
      g.textAlign = 'right'; g.textBaseline = 'middle';
      const lx = Math.max(30, Math.min(W - 2, ax - 4));
      for (let y = Math.ceil(v.ymin / sy) * sy; y <= v.ymax; y += sy) if (Math.abs(y) > sy / 2 && v.Y(y) > 10 && v.Y(y) < H - 10) g.fillText(tickLabel(y, sy), lx, v.Y(y));
    }
    if (this.onDraw) this.onDraw(g, v, C);
  }
  curve(g, v, f, color, width = 2.25, from, to) {
    g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round';
    g.beginPath();
    let pen = false, py = null;
    const a = from ?? v.xmin, b = to ?? v.xmax;
    const n = Math.ceil(v.W * 2);
    for (let k = 0; k <= n; k++) {
      const x = a + (b - a) * k / n, y = f(x);
      if (!isFinite(y)) { pen = false; py = null; continue; }
      const sy = v.Y(y);
      if (py !== null && Math.abs(sy - py) > v.H * 3) pen = false;
      const cy = Math.max(-v.H * 4, Math.min(v.H * 5, sy));
      if (!pen) { g.moveTo(v.X(x), cy); pen = true; } else g.lineTo(v.X(x), cy);
      py = sy;
    }
    g.stroke();
  }
  path(g, v, pts, color, width = 2.25, close = false) {
    g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round';
    g.beginPath();
    let pen = false;
    for (const [x, y] of pts) {
      if (!isFinite(x) || !isFinite(y)) { pen = false; continue; }
      const px = v.X(x), py = Math.max(-v.H * 4, Math.min(v.H * 5, v.Y(y)));
      if (!pen) { g.moveTo(px, py); pen = true; } else g.lineTo(px, py);
    }
    if (close) g.closePath();
    g.stroke();
  }
  dot(g, v, x, y, color, r = 4, hollow = false) {
    g.beginPath(); g.arc(v.X(x), v.Y(y), r, 0, Math.PI * 2);
    if (hollow) { g.fillStyle = colors().paper; g.fill(); g.lineWidth = 2.5; g.strokeStyle = color; g.stroke(); }
    else { g.fillStyle = color; g.fill(); }
  }
  bind() {
    const cv = this.cv;
    const pts = new Map();
    let start = null;
    const local = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const snap = () => ({ win: { ...this.win }, pts: new Map([...pts].map(([k, p]) => [k, { ...p }])) });
    cv.addEventListener('pointerdown', e => {
      if (this.onTap && this.onTap(local(e), 'down', e) === true) { this.capturing = true; cv.setPointerCapture(e.pointerId); return; }
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, local(e));
      start = snap();
    });
    cv.addEventListener('pointermove', e => {
      if (this.capturing) { this.onTap(local(e), 'move', e); return; }
      if (!pts.has(e.pointerId) || !start || this.opts.pan === false) return;
      pts.set(e.pointerId, local(e));
      const W = cv.clientWidth, H = cv.clientHeight, w = this.win, sw = start.win;
      if (pts.size === 1) {
        const p = pts.get(e.pointerId), s = start.pts.get(e.pointerId);
        if (!s) return;
        const dx = (p.x - s.x) / W * (sw.xmax - sw.xmin), dy = (p.y - s.y) / H * (sw.ymax - sw.ymin);
        w.xmin = sw.xmin - dx; w.xmax = sw.xmax - dx; w.ymin = sw.ymin + dy; w.ymax = sw.ymax + dy;
      } else if (pts.size === 2) {
        const ids = [...pts.keys()];
        const [a, b] = ids.map(k => pts.get(k)), [sa, sb] = ids.map(k => start.pts.get(k));
        if (!sa || !sb) { start = snap(); return; }
        const k = Math.hypot(sa.x - sb.x, sa.y - sb.y) / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const cx = sw.xmin + ((sa.x + sb.x) / 2) / W * (sw.xmax - sw.xmin), cy = sw.ymin + (H - (sa.y + sb.y) / 2) / H * (sw.ymax - sw.ymin);
        const nw = (sw.xmax - sw.xmin) * k, nh = (sw.ymax - sw.ymin) * k;
        const fx = ((a.x + b.x) / 2) / W, fy = (H - (a.y + b.y) / 2) / H;
        w.xmin = cx - fx * nw; w.xmax = w.xmin + nw; w.ymin = cy - fy * nh; w.ymax = w.ymin + nh;
      }
      this.draw();
    });
    const end = e => {
      if (this.capturing) { this.capturing = false; this.onTap(local(e), 'up', e); return; }
      pts.delete(e.pointerId);
      start = pts.size ? snap() : null;
      if (!pts.size && this.onChange) this.onChange();
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      if (this.opts.pan === false) return;
      const p = local(e);
      this.zoom(Math.exp(e.deltaY * 0.002), p);
    }, { passive: false });
  }
  zoom(k, at) {
    const W = this.cv.clientWidth, H = this.cv.clientHeight, w = this.win;
    const v = this.view(W, H);
    const cx = at ? v.ix(at.x) : (w.xmin + w.xmax) / 2, cy = at ? v.iy(at.y) : (w.ymin + w.ymax) / 2;
    w.xmin = cx - (cx - w.xmin) * k; w.xmax = cx + (w.xmax - cx) * k;
    w.ymin = cy - (cy - w.ymin) * k; w.ymax = cy + (w.ymax - cy) * k;
    this.draw();
    if (this.onChange) this.onChange();
  }
  observe() {
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(this.cv.parentElement || this.cv);
    return this;
  }
  dispose() { if (this.ro) this.ro.disconnect(); }
}
