import { Plot, fmt } from '../plot.js';

const TOOLS = [
  ['move', 'Move', 0], ['point', 'Point', 1], ['segment', 'Segment', 2], ['line', 'Line', 2], ['circle', 'Circle', 2], ['polygon', 'Polygon', -1],
  ['midpoint', 'Midpoint', 2], ['perp', 'Perpendicular', 2], ['parallel', 'Parallel', 2], ['bisector', 'Perp. bisector', 2], ['anglebis', 'Angle bisector', 3], ['intersect', 'Intersection', 2],
  ['length', 'Length', 2], ['angle', 'Angle', 3], ['area', 'Area', 1], ['delete', 'Delete', 1]
];
const HINT = {
  move: 'Drag points to move them. Drag empty space to pan.', point: 'Tap to place a point.', segment: 'Tap two points.', line: 'Tap two points.', circle: 'Tap the centre, then a point on the circle.',
  polygon: 'Tap corners, then tap the first corner again to close.', midpoint: 'Tap two points.', perp: 'Tap a line or segment, then a point.', parallel: 'Tap a line or segment, then a point.',
  bisector: 'Tap two points.', anglebis: 'Tap three points: one arm, the vertex, the other arm.', intersect: 'Tap two lines, segments or circles.',
  length: 'Tap two points to measure the distance.', angle: 'Tap three points: one arm, the vertex, the other arm.', area: 'Tap a polygon or circle.', delete: 'Tap an object to delete it and anything built from it.'
};
const LINEISH = new Set(['segment', 'line', 'perp', 'parallel', 'bisector', 'anglebis']);

export const geometryApp = {
  id: 'geometry',
  title: 'Geometry',
  mount(el, ctx) {
    this.ctx = ctx;
    this.el = el;
    if (!ctx.store.geo) ctx.store.geo = { objs: [], next: 1, snap: true, win: { xmin: -8, xmax: 8, ymin: -8, ymax: 8 } };
    this.st = ctx.store.geo;
    this.tool = 'point';
    this.picks = [];
    this.undo = [];
    ctx.showKeypad(false);
    const { h } = ctx;
    this.toolbar = h('div', { class: 'toolbar geo-tools' });
    this.hint = h('div', { class: 'sg-info' });
    this.meas = h('div', { class: 'geo-meas scroll' });
    const cv = h('canvas', { class: 'gcanvas', 'aria-label': 'Geometry canvas' });
    const bar = h('div', { class: 'gbar' },
      h('button', { type: 'button', onclick: () => this.doUndo() }, 'Undo'),
      this.snapBtn = h('button', { type: 'button', class: this.st.snap ? 'on' : '', onclick: () => { this.st.snap = !this.st.snap; this.snapBtn.classList.toggle('on', this.st.snap); this.ctx.save(); } }, 'Snap'),
      h('button', { type: 'button', class: 'sq', onclick: () => this.plot.zoom(1.25) }, '−'),
      h('button', { type: 'button', class: 'sq', onclick: () => this.plot.zoom(0.8) }, '+'),
      h('button', { type: 'button', onclick: () => this.clearAll() }, 'Clear'));
    el.append(h('div', { class: 'col' }, this.toolbar, this.hint, h('div', { class: 'gwrap' }, cv), this.meas, bar));
    this.plot = new Plot(cv, this.st.win, { equal: true });
    this.plot.onDraw = (g, v, C) => this.render(g, v, C);
    this.plot.onTap = (p, phase) => this.tap(p, phase);
    this.plot.onChange = () => this.ctx.save();
    this.plot.observe();
    this.buildTools();
    this.plot.draw();
  },
  unmount() { this.ctx.save(); this.plot.dispose(); },
  buildTools() {
    const { h } = this.ctx;
    this.toolbar.innerHTML = '';
    for (const [id, label] of TOOLS) {
      const b = h('button', { type: 'button', class: this.tool === id ? 'on' : '' }, label);
      b.addEventListener('click', () => { this.tool = id; this.picks = []; this.buildTools(); this.plot.draw(); });
      this.toolbar.append(b);
    }
    this.hint.textContent = HINT[this.tool];
  },
  obj(id) { return this.st.objs.find(o => o.id === id); },
  add(o) {
    this.undo.push(JSON.stringify(this.st.objs));
    o.id = this.st.next++;
    this.st.objs.push(o);
    this.ctx.save();
    return o;
  },
  pt(id) {
    const o = this.obj(id);
    if (!o) return null;
    if (o.t === 'P') return [o.x, o.y];
    if (o.t === 'M') { const a = this.pt(o.a), b = this.pt(o.b); return a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : null; }
    if (o.t === 'X') { const s = this.intersections(this.obj(o.a), this.obj(o.b)); return s[o.k] || null; }
    return null;
  },
  lineOf(o) {
    if (!o) return null;
    if (o.t === 'segment' || o.t === 'line') { const a = this.pt(o.a), b = this.pt(o.b); if (!a || !b) return null; return { p: a, d: [b[0] - a[0], b[1] - a[1]], seg: o.t === 'segment' ? [a, b] : null }; }
    if (o.t === 'perp' || o.t === 'parallel') {
      const L = this.lineOf(this.obj(o.line)), p = this.pt(o.p);
      if (!L || !p) return null;
      return { p, d: o.t === 'perp' ? [-L.d[1], L.d[0]] : L.d };
    }
    if (o.t === 'bisector') { const a = this.pt(o.a), b = this.pt(o.b); if (!a || !b) return null; return { p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d: [-(b[1] - a[1]), b[0] - a[0]] }; }
    if (o.t === 'anglebis') {
      const a = this.pt(o.a), v = this.pt(o.v), b = this.pt(o.b);
      if (!a || !v || !b) return null;
      const u1 = norm([a[0] - v[0], a[1] - v[1]]), u2 = norm([b[0] - v[0], b[1] - v[1]]);
      let d = [u1[0] + u2[0], u1[1] + u2[1]];
      if (Math.hypot(...d) < 1e-12) d = [-u1[1], u1[0]];
      return { p: v, d };
    }
    return null;
  },
  circleOf(o) {
    if (!o || o.t !== 'circle') return null;
    const c = this.pt(o.c), p = this.pt(o.p);
    if (!c || !p) return null;
    return { c, r: Math.hypot(p[0] - c[0], p[1] - c[1]) };
  },
  intersections(A, B) {
    if (!A || !B) return [];
    const LA = LINEISH.has(A.t) ? this.lineOf(A) : null, LB = LINEISH.has(B.t) ? this.lineOf(B) : null;
    const CA = this.circleOf(A), CB = this.circleOf(B);
    let pts = [];
    if (LA && LB) {
      const den = LA.d[0] * LB.d[1] - LA.d[1] * LB.d[0];
      if (Math.abs(den) < 1e-12) return [];
      const t = ((LB.p[0] - LA.p[0]) * LB.d[1] - (LB.p[1] - LA.p[1]) * LB.d[0]) / den;
      pts = [[LA.p[0] + t * LA.d[0], LA.p[1] + t * LA.d[1]]];
    } else if ((LA && CB) || (LB && CA)) {
      const L = LA || LB, C = CA || CB;
      const fx = L.p[0] - C.c[0], fy = L.p[1] - C.c[1];
      const a = L.d[0] ** 2 + L.d[1] ** 2, b = 2 * (fx * L.d[0] + fy * L.d[1]), c = fx * fx + fy * fy - C.r * C.r;
      const D = b * b - 4 * a * c;
      if (D < -1e-12) return [];
      const s = Math.sqrt(Math.max(0, D));
      pts = [(-b - s) / (2 * a), (-b + s) / (2 * a)].map(t => [L.p[0] + t * L.d[0], L.p[1] + t * L.d[1]]);
    } else if (CA && CB) {
      const dx = CB.c[0] - CA.c[0], dy = CB.c[1] - CA.c[1], d = Math.hypot(dx, dy);
      if (d < 1e-12 || d > CA.r + CB.r + 1e-12 || d < Math.abs(CA.r - CB.r) - 1e-12) return [];
      const a = (CA.r ** 2 - CB.r ** 2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, CA.r ** 2 - a * a));
      const mx = CA.c[0] + a * dx / d, my = CA.c[1] + a * dy / d;
      pts = [[mx + hh * dy / d, my - hh * dx / d], [mx - hh * dy / d, my + hh * dx / d]];
    }
    return pts;
  },
  hit(p, v, kinds) {
    const W = v.W;
    const px = p.x, py = p.y;
    let best = null, bd = 16;
    for (const o of this.st.objs) {
      if (o.t === 'P' || o.t === 'M' || o.t === 'X') {
        if (kinds && !kinds.includes('pt')) continue;
        const q = this.pt(o.id);
        if (!q) continue;
        const d = Math.hypot(v.X(q[0]) - px, v.Y(q[1]) - py);
        if (d < bd + 4) { bd = d - 4; best = o; }
      }
    }
    if (best) return best;
    bd = 12;
    for (const o of this.st.objs) {
      if (kinds && !kinds.some(k => k === o.t || (k === 'lineish' && LINEISH.has(o.t)) || (k === 'curve' && (LINEISH.has(o.t) || o.t === 'circle')))) continue;
      let d = Infinity;
      if (LINEISH.has(o.t)) {
        const L = this.lineOf(o); if (!L) continue;
        const a = [v.X(L.p[0]), v.Y(L.p[1])], b = [v.X(L.p[0] + L.d[0]), v.Y(L.p[1] + L.d[1])];
        d = distToLine([px, py], a, b, L.seg ? true : false);
      } else if (o.t === 'circle') {
        const C = this.circleOf(o); if (!C) continue;
        d = Math.abs(Math.hypot(px - v.X(C.c[0]), py - v.Y(C.c[1])) - C.r * W / (v.xmax - v.xmin));
      } else if (o.t === 'polygon') {
        const ps = o.pts.map(id => this.pt(id)).filter(Boolean).map(q => [v.X(q[0]), v.Y(q[1])]);
        if (inside([px, py], ps)) d = 6;
      }
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  },
  world(p, v) {
    let x = v.ix(p.x), y = v.iy(p.y);
    if (this.st.snap) { const s = gridStep(v); x = Math.round(x / s) * s; y = Math.round(y / s) * s; }
    return [x, y];
  },
  pointAt(p, v) {
    const o = this.hit(p, v, ['pt']);
    if (o) return o.id;
    const [x, y] = this.world(p, v);
    return this.add({ t: 'P', x, y }).id;
  },
  tap(p, phase) {
    const v = this.plot.view(this.plot.cv.clientWidth, this.plot.cv.clientHeight);
    if (this.tool === 'move') {
      if (phase === 'down') {
        const o = this.hit(p, v, ['pt']);
        if (o && o.t === 'P') { this.undo.push(JSON.stringify(this.st.objs)); this.drag = o; return true; }
        return false;
      }
      if (phase === 'move' && this.drag) { const [x, y] = this.world(p, v); this.drag.x = x; this.drag.y = y; this.plot.draw(); return true; }
      if (phase === 'up') { this.drag = null; this.ctx.save(); this.plot.draw(); return true; }
      return false;
    }
    if (phase !== 'down') return true;
    const t = this.tool;
    const need = { segment: 'pt', line: 'pt', circle: 'pt', midpoint: 'pt', bisector: 'pt', length: 'pt', angle: 'pt', anglebis: 'pt', point: 'pt', polygon: 'pt' };
    if (t === 'delete') {
      const o = this.hit(p, v);
      if (o) { this.undo.push(JSON.stringify(this.st.objs)); this.remove(o.id); this.ctx.save(); }
      this.plot.draw(); return true;
    }
    if (t === 'area') {
      const o = this.hit(p, v, ['polygon', 'circle']);
      if (o) this.add({ t: 'areaM', o: o.id });
      this.plot.draw(); this.renderMeas(); return true;
    }
    if (t === 'intersect') {
      const o = this.hit(p, v, ['curve']);
      if (o) this.picks.push(o.id);
      if (this.picks.length === 2) {
        const [a, b] = this.picks;
        const n = this.intersections(this.obj(a), this.obj(b)).length;
        if (!n) this.hint.textContent = 'Those do not meet.';
        for (let k = 0; k < n; k++) this.add({ t: 'X', a, b, k });
        this.picks = [];
      }
      this.plot.draw(); return true;
    }
    if (t === 'perp' || t === 'parallel') {
      if (!this.picks.length) { const o = this.hit(p, v, ['lineish']); if (o) this.picks.push(o.id); }
      else { const id = this.pointAt(p, v); this.add({ t, line: this.picks[0], p: id }); this.picks = []; }
      this.plot.draw(); return true;
    }
    if (need[t]) {
      const id = this.pointAt(p, v);
      if (t === 'point') { this.plot.draw(); return true; }
      if (t === 'polygon') {
        if (this.picks.length >= 3 && id === this.picks[0]) { this.add({ t: 'polygon', pts: this.picks.slice() }); this.picks = []; }
        else if (!this.picks.includes(id)) this.picks.push(id);
        this.plot.draw(); this.renderMeas(); return true;
      }
      if (this.picks[this.picks.length - 1] !== id) this.picks.push(id);
      const n = { segment: 2, line: 2, circle: 2, midpoint: 2, bisector: 2, length: 2, angle: 3, anglebis: 3 }[t];
      if (this.picks.length === n) {
        const [a, b, c] = this.picks;
        if (t === 'segment' || t === 'line') this.add({ t, a, b });
        else if (t === 'circle') this.add({ t, c: a, p: b });
        else if (t === 'midpoint') this.add({ t: 'M', a, b });
        else if (t === 'bisector') this.add({ t, a, b });
        else if (t === 'length') this.add({ t: 'lenM', a, b });
        else if (t === 'angle') this.add({ t: 'angM', a, v: b, b: c });
        else if (t === 'anglebis') this.add({ t, a, v: b, b: c });
        this.picks = [];
      }
      this.plot.draw(); this.renderMeas(); return true;
    }
    return true;
  },
  remove(id) {
    const dead = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const o of this.st.objs) {
        if (dead.has(o.id)) continue;
        const refs = [o.a, o.b, o.c, o.p, o.v, o.line, o.o, ...(o.pts || [])].filter(x => x !== undefined);
        if (refs.some(r => dead.has(r))) { dead.add(o.id); grew = true; }
      }
    }
    this.st.objs = this.st.objs.filter(o => !dead.has(o.id));
    this.renderMeas();
  },
  doUndo() {
    const s = this.undo.pop();
    if (!s) return;
    this.st.objs = JSON.parse(s);
    this.picks = [];
    this.ctx.save();
    this.plot.draw();
    this.renderMeas();
  },
  clearAll() {
    if (!this.st.objs.length) return;
    this.undo.push(JSON.stringify(this.st.objs));
    this.st.objs = [];
    this.picks = [];
    this.ctx.save();
    this.plot.draw();
    this.renderMeas();
  },
  label(id) {
    const pts = this.st.objs.filter(o => o.t === 'P' || o.t === 'M' || o.t === 'X');
    const i = pts.findIndex(o => o.id === id);
    return i < 0 ? '?' : (i < 26 ? String.fromCharCode(65 + i) : 'P' + (i + 1));
  },
  measures() {
    const out = [];
    const ang = this.ctx.store.settings.angle;
    for (const o of this.st.objs) {
      if (o.t === 'lenM') { const a = this.pt(o.a), b = this.pt(o.b); if (a && b) out.push([this.label(o.a) + this.label(o.b), Math.hypot(b[0] - a[0], b[1] - a[1]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); }
      else if (o.t === 'angM') {
        const a = this.pt(o.a), v = this.pt(o.v), b = this.pt(o.b);
        if (a && v && b) {
          const u = [a[0] - v[0], a[1] - v[1]], w = [b[0] - v[0], b[1] - v[1]];
          const c = Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w))));
          const r = Math.acos(c);
          const val = ang === 'rad' ? r : ang === 'gra' ? r * 200 / Math.PI : r * 180 / Math.PI;
          out.push(['∠' + this.label(o.a) + this.label(o.v) + this.label(o.b), val, v[0], v[1], ang === 'deg' ? '°' : ang === 'gra' ? 'ᵍ' : ' rad']);
        }
      } else if (o.t === 'areaM') {
        const t = this.obj(o.o);
        if (!t) continue;
        if (t.t === 'circle') { const C = this.circleOf(t); if (C) out.push(['Circle area', Math.PI * C.r * C.r, C.c[0], C.c[1]]); }
        else { const ps = t.pts.map(id => this.pt(id)); if (ps.every(Boolean)) { let s = 0; for (let i = 0; i < ps.length; i++) { const p = ps[i], q = ps[(i + 1) % ps.length]; s += p[0] * q[1] - q[0] * p[1]; } const cx = ps.reduce((a, p) => a + p[0], 0) / ps.length, cy = ps.reduce((a, p) => a + p[1], 0) / ps.length; out.push(['Area ' + t.pts.map(id => this.label(id)).join(''), Math.abs(s) / 2, cx, cy]); } }
      }
    }
    return out;
  },
  renderMeas() {
    const { h } = this.ctx;
    this.meas.innerHTML = '';
    const pts = this.st.objs.filter(o => o.t === 'P' || o.t === 'M' || o.t === 'X');
    const ms = this.measures();
    for (const [name, val, , , unit] of ms) this.meas.append(h('div', { class: 'res-row' }, h('span', { class: 'res-k' }, name), h('span', { class: 'res-v' }, fmt(val) + (unit || ''))));
    for (const o of pts) { const q = this.pt(o.id); if (q) this.meas.append(h('div', { class: 'res-row small' }, h('span', { class: 'res-k' }, this.label(o.id)), h('span', { class: 'res-v' }, '(' + fmt(q[0]) + ', ' + fmt(q[1]) + ')'))); }
  },
  render(g, v, C) {
    const ink = C.label, tint = '#0a84ff';
    const drawLine = (L, color, dashed) => {
      if (!L) return;
      g.strokeStyle = color; g.lineWidth = 2; if (dashed) g.setLineDash([6, 5]);
      g.beginPath();
      if (L.seg) { g.moveTo(v.X(L.seg[0][0]), v.Y(L.seg[0][1])); g.lineTo(v.X(L.seg[1][0]), v.Y(L.seg[1][1])); }
      else {
        const len = Math.hypot(...L.d) || 1, k = 4 * Math.max(v.xmax - v.xmin, v.ymax - v.ymin) / len;
        g.moveTo(v.X(L.p[0] - L.d[0] * k), v.Y(L.p[1] - L.d[1] * k)); g.lineTo(v.X(L.p[0] + L.d[0] * k), v.Y(L.p[1] + L.d[1] * k));
      }
      g.stroke(); g.setLineDash([]);
    };
    for (const o of this.st.objs) {
      if (o.t === 'polygon') {
        const ps = o.pts.map(id => this.pt(id));
        if (!ps.every(Boolean)) continue;
        g.beginPath(); ps.forEach((p, i) => i ? g.lineTo(v.X(p[0]), v.Y(p[1])) : g.moveTo(v.X(p[0]), v.Y(p[1]))); g.closePath();
        g.fillStyle = tint + '22'; g.fill(); g.strokeStyle = tint; g.lineWidth = 2; g.stroke();
      }
      if (o.t === 'segment' || o.t === 'line') drawLine(this.lineOf(o), ink);
      if (o.t === 'perp' || o.t === 'parallel' || o.t === 'bisector' || o.t === 'anglebis') drawLine(this.lineOf(o), '#af52de');
      if (o.t === 'circle') { const c = this.circleOf(o); if (c) { g.strokeStyle = '#34c759'; g.lineWidth = 2; g.beginPath(); g.arc(v.X(c.c[0]), v.Y(c.c[1]), c.r * v.W / (v.xmax - v.xmin), 0, Math.PI * 2); g.stroke(); } }
    }
    if (this.tool === 'polygon' && this.picks.length > 1) {
      const ps = this.picks.map(id => this.pt(id)).filter(Boolean);
      g.setLineDash([5, 4]); this.plot.path(g, v, ps, tint, 1.5); g.setLineDash([]);
    }
    g.font = '600 12px -apple-system, system-ui, sans-serif';
    for (const [name, val, x, y, unit] of this.measures()) {
      const txt = fmt(Number(val.toPrecision(6))) + (unit || '');
      const w = g.measureText(txt).width + 10;
      const px = v.X(x), py = v.Y(y) - 16;
      g.fillStyle = C.card; g.strokeStyle = C.sep; g.lineWidth = 1;
      g.beginPath(); g.roundRect ? g.roundRect(px - w / 2, py - 10, w, 20, 6) : g.rect(px - w / 2, py - 10, w, 20); g.fill(); g.stroke();
      g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, px, py);
    }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    for (const o of this.st.objs) {
      if (o.t !== 'P' && o.t !== 'M' && o.t !== 'X') continue;
      const q = this.pt(o.id);
      if (!q) continue;
      const picked = this.picks.includes(o.id);
      g.beginPath(); g.arc(v.X(q[0]), v.Y(q[1]), picked ? 7 : 5, 0, Math.PI * 2);
      g.fillStyle = o.t === 'P' ? '#ff3b30' : '#ff9500'; g.fill();
      g.lineWidth = 2; g.strokeStyle = C.paper; g.stroke();
      g.fillStyle = ink; g.font = '600 13px -apple-system, system-ui, sans-serif';
      g.fillText(this.label(o.id), v.X(q[0]) + 8, v.Y(q[1]) - 8);
    }
    for (const id of this.picks) {
      const o = this.obj(id);
      if (o && (LINEISH.has(o.t) || o.t === 'circle')) {
        if (o.t === 'circle') { const c = this.circleOf(o); if (c) { g.strokeStyle = '#ff9500'; g.lineWidth = 4; g.beginPath(); g.arc(v.X(c.c[0]), v.Y(c.c[1]), c.r * v.W / (v.xmax - v.xmin), 0, Math.PI * 2); g.stroke(); } }
        else drawLine(this.lineOf(o), '#ff9500');
      }
    }
    if (!this.drag) this.renderMeas();
  }
};

function norm(u) { const l = Math.hypot(...u) || 1; return [u[0] / l, u[1] / l]; }
function gridStep(v) {
  const r = (v.xmax - v.xmin) / 16;
  const p = Math.pow(10, Math.floor(Math.log10(r)));
  const m = r / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p / 2;
}
function distToLine(p, a, b, seg) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy || 1;
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
  if (seg) t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function inside(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (((poly[i][1] > p[1]) !== (poly[j][1] > p[1])) && (p[0] < (poly[j][0] - poly[i][0]) * (p[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])) c = !c;
  }
  return c;
}
