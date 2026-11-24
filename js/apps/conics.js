import { CalcError } from '../parse.js';
import { Plot } from '../plot.js';

const TYPES = [
  { group: 'Parabola' },
  { id: 'py1', form: 'y=A\\left(x-h\\right)^2+k', params: ['A', 'h', 'k'], def: ['1', '0', '0'] },
  { id: 'py2', form: 'y=Ax^2+Bx+C', params: ['A', 'B', 'C'], def: ['1', '0', '0'] },
  { id: 'px1', form: 'x=A\\left(y-k\\right)^2+h', params: ['A', 'h', 'k'], def: ['1', '0', '0'] },
  { id: 'px2', form: 'x=Ay^2+By+C', params: ['A', 'B', 'C'], def: ['1', '0', '0'] },
  { group: 'Circle' },
  { id: 'c1', form: '\\left(x-h\\right)^2+\\left(y-k\\right)^2=r^2', params: ['h', 'k', 'r'], def: ['0', '0', '3'] },
  { id: 'c2', form: 'x^2+y^2+Ax+By+C=0', params: ['A', 'B', 'C'], def: ['0', '0', '-9'] },
  { group: 'Ellipse' },
  { id: 'e1', form: '\\frac{\\left(x-h\\right)^2}{A^2}+\\frac{\\left(y-k\\right)^2}{B^2}=1', params: ['A', 'B', 'h', 'k'], def: ['4', '2', '0', '0'] },
  { group: 'Hyperbola' },
  { id: 'h1', form: '\\frac{\\left(x-h\\right)^2}{A^2}-\\frac{\\left(y-k\\right)^2}{B^2}=1', params: ['A', 'B', 'h', 'k'], def: ['3', '2', '0', '0'] },
  { id: 'h2', form: '\\frac{\\left(y-k\\right)^2}{A^2}-\\frac{\\left(x-h\\right)^2}{B^2}=1', params: ['A', 'B', 'h', 'k'], def: ['3', '2', '0', '0'] }
];

function analyse(t, p) {
  const bad = () => { throw new CalcError('Math ERROR'); };
  const F = { points: [], lines: [], rows: [] };
  const pt = (label, x, y) => { F.points.push([x, y]); F.rows.push({ label, pair: [x, y] }); };
  const val = (label, v) => F.rows.push({ label, v });
  const line = (label, kind, a, b) => { F.lines.push({ kind, a, b }); F.rows.push({ label, line: { kind, a, b } }); };
  if (t.id[0] === 'p') {
    let A, h, k;
    if (t.id === 'py1' || t.id === 'px1') ({ A, h, k } = p);
    else { A = p.A; if (A === 0) bad(); if (t.id === 'py2') { h = -p.B / (2 * A); k = p.C - p.B * p.B / (4 * A); } else { k = -p.B / (2 * A); h = p.C - p.B * p.B / (4 * A); } }
    if (A === 0) bad();
    const f = 1 / (4 * A);
    if (t.id[1] === 'y') {
      F.draw = { kind: 'fx', f: x => A * (x - h) ** 2 + k };
      pt('\\text{Vertex}', h, k); pt('\\text{Focus}', h, k + f);
      line('\\text{Directrix}', 'y', k - f); line('\\text{Axis of symmetry}', 'x', h);
    } else {
      F.draw = { kind: 'fy', f: y => A * (y - k) ** 2 + h };
      pt('\\text{Vertex}', h, k); pt('\\text{Focus}', h + f, k);
      line('\\text{Directrix}', 'x', h - f); line('\\text{Axis of symmetry}', 'y', k);
    }
    val('\\text{Latus rectum}', Math.abs(1 / A)); val('e', 1);
    F.center = [h, k]; F.size = Math.max(4, Math.abs(4 * f) * 6);
  } else if (t.id[0] === 'c') {
    let h, k, r;
    if (t.id === 'c1') { ({ h, k, r } = p); r = Math.abs(r); }
    else { h = -p.A / 2; k = -p.B / 2; const r2 = h * h + k * k - p.C; if (r2 <= 0) bad(); r = Math.sqrt(r2); }
    if (!(r > 0)) bad();
    F.draw = { kind: 'param', x: s => h + r * Math.cos(s), y: s => k + r * Math.sin(s), t0: 0, t1: 2 * Math.PI };
    pt('\\text{Centre}', h, k); val('\\text{Radius}', r);
    F.center = [h, k]; F.size = r * 2.6;
  } else if (t.id === 'e1') {
    const a = Math.abs(p.A), b = Math.abs(p.B), { h, k } = p;
    if (!a || !b) bad();
    F.draw = { kind: 'param', x: s => h + a * Math.cos(s), y: s => k + b * Math.sin(s), t0: 0, t1: 2 * Math.PI };
    pt('\\text{Centre}', h, k);
    if (a >= b) { const c = Math.sqrt(a * a - b * b); pt('\\text{Focus 1}', h - c, k); pt('\\text{Focus 2}', h + c, k); pt('\\text{Vertex 1}', h - a, k); pt('\\text{Vertex 2}', h + a, k); val('e', c / a); }
    else { const c = Math.sqrt(b * b - a * a); pt('\\text{Focus 1}', h, k - c); pt('\\text{Focus 2}', h, k + c); pt('\\text{Vertex 1}', h, k - b); pt('\\text{Vertex 2}', h, k + b); val('e', c / b); }
    F.center = [h, k]; F.size = Math.max(a, b) * 2.6;
  } else {
    const a = Math.abs(p.A), b = Math.abs(p.B), { h, k } = p;
    if (!a || !b) bad();
    const c = Math.sqrt(a * a + b * b);
    pt('\\text{Centre}', h, k);
    if (t.id === 'h1') {
      F.draw = { kind: 'hyp', branches: [s => [h + a * Math.cosh(s), k + b * Math.sinh(s)], s => [h - a * Math.cosh(s), k + b * Math.sinh(s)]] };
      pt('\\text{Vertex 1}', h - a, k); pt('\\text{Vertex 2}', h + a, k); pt('\\text{Focus 1}', h - c, k); pt('\\text{Focus 2}', h + c, k);
      line('\\text{Asymptote 1}', 'm', b / a, k - b / a * h); line('\\text{Asymptote 2}', 'm', -b / a, k + b / a * h);
    } else {
      F.draw = { kind: 'hyp', branches: [s => [h + b * Math.sinh(s), k + a * Math.cosh(s)], s => [h + b * Math.sinh(s), k - a * Math.cosh(s)]] };
      pt('\\text{Vertex 1}', h, k - a); pt('\\text{Vertex 2}', h, k + a); pt('\\text{Focus 1}', h, k - c); pt('\\text{Focus 2}', h, k + c);
      line('\\text{Asymptote 1}', 'm', a / b, k - a / b * h); line('\\text{Asymptote 2}', 'm', -a / b, k + a / b * h);
    }
    val('e', c / a);
    F.center = [h, k]; F.size = c * 3;
  }
  return F;
}

export const conicsApp = {
  id: 'conics',
  title: 'Conics',
  mount(el, ctx) {
    this.ctx = ctx;
    this.el = el;
    if (!ctx.store.conic) ctx.store.conic = { id: 'py1', vals: {} };
    this.showList();
  },
  unmount() { this.ctx.save(); if (this.plot) this.plot.dispose(); },
  showList() {
    const { h, tex } = this.ctx;
    this.mode = 'list';
    if (this.plot) { this.plot.dispose(); this.plot = null; }
    this.ctx.showKeypad(false);
    this.ctx.setTitle('Conics');
    this.el.innerHTML = '';
    const list = h('div', { class: 'list scroll' });
    for (const t of TYPES) {
      if (t.group) { list.append(h('div', { class: 'list-h' }, t.group)); continue; }
      list.append(h('button', { type: 'button', class: 'list-row', onclick: () => this.showForm(t) }, h('span', { html: tex(t.form) }), h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')));
    }
    this.el.append(list);
  },
  showForm(t) {
    const { h, tex, store } = this.ctx;
    this.mode = 'form';
    this.t = t;
    store.conic.id = t.id;
    const vals = store.conic.vals[t.id] || (store.conic.vals[t.id] = {});
    this.ctx.showKeypad(true);
    this.el.innerHTML = '';
    const back = h('button', { type: 'button', class: 'back' }, '‹ Conics');
    back.addEventListener('click', () => this.showList());
    const form = h('div', { class: 'form scroll' }, back, h('div', { class: 'eq-form big', html: tex(t.form) }));
    this.cells = [];
    t.params.forEach((pn, i) => {
      const mf = this.ctx.makeField(vals[pn] ?? t.def[i], { class: 'cell', onInput: v => { vals[pn] = v; this.ctx.save(); } });
      this.cells.push(mf);
      form.append(h('label', { class: 'frow' }, h('span', { class: 'flabel', html: tex(pn) }), mf));
    });
    this.err = h('div', { class: 'err' });
    form.append(this.err, h('button', { type: 'button', class: 'primary wide', onclick: () => this.draw() }, 'Draw'));
    this.el.append(form);
    this.ctx.focusField(this.cells[0]);
  },
  onExe() {
    if (this.mode !== 'form') return;
    const i = this.cells.indexOf(this.ctx.field);
    if (i >= 0 && i < this.cells.length - 1) this.ctx.focusField(this.cells[i + 1]);
    else this.draw();
  },
  onKey(id) { return id === 'sd' || id === 'format'; },
  draw() {
    const { h, tex, store, engine } = this.ctx;
    const t = this.t;
    const vals = store.conic.vals[t.id] || {};
    let F;
    try {
      const p = {};
      t.params.forEach((pn, i) => { const r = engine.evaluate(vals[pn] ?? t.def[i]); if (typeof r.value !== 'number') throw new CalcError('Math ERROR'); p[pn] = r.value; });
      F = analyse(t, p);
    } catch (e) { this.err.textContent = e.kind || 'Math ERROR'; return; }
    this.mode = 'plot';
    this.ctx.showKeypad(false);
    this.el.innerHTML = '';
    const back = h('button', { type: 'button', class: 'back' }, '‹ Edit');
    back.addEventListener('click', () => this.showForm(t));
    const cv = h('canvas', { class: 'gcanvas' });
    const L = v => this.ctx.valueLatex(Math.abs(v) < 1e-12 ? 0 : v, { root: true, pi: false }, 'standard');
    const rows = h('div', { class: 'res-table conic-rows' });
    for (const r of F.rows) {
      let val;
      if (r.pair) val = '\\left(' + L(r.pair[0]) + ',\\;' + L(r.pair[1]) + '\\right)';
      else if (r.line) val = r.line.kind === 'y' ? 'y=' + L(r.line.a) : r.line.kind === 'x' ? 'x=' + L(r.line.a) : 'y=' + L(r.line.a) + 'x' + (r.line.b < 0 ? '-' + L(-r.line.b) : '+' + L(r.line.b)).replace(/\+0$|-0$/, '');
      else val = L(r.v);
      rows.append(h('div', { class: 'res-row' }, h('span', { class: 'res-k', html: tex(r.label) }), h('span', { class: 'res-v', html: tex(val) })));
    }
    this.el.append(h('div', { class: 'col' }, h('div', { class: 'pad' }, back, h('div', { class: 'eq-form', html: tex(t.form) })), h('div', { class: 'gwrap' }, cv), h('div', { class: 'conic-scroll scroll' }, rows)));
    const [cx, cy] = F.center, s = F.size || 10;
    this.plot = new Plot(cv, { xmin: cx - s, xmax: cx + s, ymin: cy - s, ymax: cy + s }, { equal: true });
    this.plot.onDraw = (g, v, C) => {
      g.setLineDash([6, 5]);
      for (const ln of F.lines) {
        if (ln.kind === 'y') this.plot.path(g, v, [[v.xmin, ln.a], [v.xmax, ln.a]], C.label2, 1.25);
        else if (ln.kind === 'x') this.plot.path(g, v, [[ln.a, v.ymin], [ln.a, v.ymax]], C.label2, 1.25);
        else this.plot.curve(g, v, x => ln.a * x + ln.b, C.label2, 1.25);
      }
      g.setLineDash([]);
      const d = F.draw, col = '#0a84ff';
      if (d.kind === 'fx') this.plot.curve(g, v, d.f, col, 2.5);
      else if (d.kind === 'fy') {
        const pts = [];
        for (let k = 0; k <= 800; k++) { const y = v.ymin + (v.ymax - v.ymin) * k / 800; pts.push([d.f(y), y]); }
        this.plot.path(g, v, pts, col, 2.5);
      } else if (d.kind === 'param') {
        const pts = [];
        for (let k = 0; k <= 720; k++) { const s2 = d.t0 + (d.t1 - d.t0) * k / 720; pts.push([d.x(s2), d.y(s2)]); }
        this.plot.path(g, v, pts, col, 2.5);
      } else {
        for (const br of d.branches) {
          const pts = [];
          for (let k = -600; k <= 600; k++) pts.push(br(k / 100));
          this.plot.path(g, v, pts, col, 2.5);
        }
      }
      for (const [x, y] of F.points) this.plot.dot(g, v, x, y, '#ff3b30', 4.5, true);
    };
    this.plot.observe();
    this.plot.draw();
  }
};
