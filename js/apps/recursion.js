import { CalcError } from '../parse.js';
import { Plot, fmt } from '../plot.js';

const TYPES = [['an', 'aₙ = f(n)'], ['an1', 'aₙ₊₁ = f(aₙ, n)'], ['an2', 'aₙ₊₂ = f(aₙ₊₁, aₙ, n)']];

export const recursionApp = {
  id: 'recursion',
  title: 'Recursion',
  mount(el, ctx) {
    this.ctx = ctx;
    this.el = el;
    if (!ctx.store.rec) ctx.store.rec = { type: 'an1', expr: '2a_{n}+1', start: '1', end: '10', a1: '1', a2: '1', view: 'table' };
    this.showEdit();
  },
  unmount() { this.ctx.save(); if (this.plot) this.plot.dispose(); },
  showEdit() {
    const { h, tex, store, seg } = this.ctx;
    const st = store.rec;
    this.mode = 'edit';
    if (this.plot) { this.plot.dispose(); this.plot = null; }
    this.ctx.showKeypad(true);
    this.ctx.setTitle('Recursion');
    this.el.innerHTML = '';
    const form = h('div', { class: 'form scroll' });
    form.append(h('div', { class: 'field-label' }, 'Type'), h('div', { class: 'wrap-seg' }, seg(TYPES, st.type, v => { st.type = v; this.ctx.save(); this.showEdit(); })));
    const lhs = { an: 'a_n=', an1: 'a_{n+1}=', an2: 'a_{n+2}=' }[st.type];
    this.cells = [];
    const mk = (key, cls = 'cell') => { const mf = this.ctx.makeField(st[key], { class: cls, onInput: v => { st[key] = v; this.ctx.save(); } }); this.cells.push(mf); return mf; };
    const ins = h('div', { class: 'toolbar ins' });
    const addIns = (label, latex) => { const b = h('button', { type: 'button' }, label); b.addEventListener('click', () => this.ctx.insert(latex)); ins.append(b); };
    addIns('n', 'n');
    if (st.type !== 'an') addIns('aₙ', 'a_{n}');
    if (st.type === 'an2') addIns('aₙ₊₁', 'a_{n+1}');
    form.append(h('div', { class: 'frow wide-l' }, h('span', { class: 'flabel', html: tex(lhs) }), mk('expr', 'solver-eq')), ins);
    form.append(h('label', { class: 'frow' }, h('span', { class: 'flabel', html: tex('n\\text{ start}') }), mk('start')));
    form.append(h('label', { class: 'frow' }, h('span', { class: 'flabel', html: tex('n\\text{ end}') }), mk('end')));
    if (st.type !== 'an') form.append(h('label', { class: 'frow' }, h('span', { class: 'flabel', html: tex('a_{\\text{start}}') }), mk('a1')));
    if (st.type === 'an2') form.append(h('label', { class: 'frow' }, h('span', { class: 'flabel', html: tex('a_{\\text{start}+1}') }), mk('a2')));
    this.err = h('div', { class: 'err' });
    const btns = h('div', { class: 'two-btn' },
      h('button', { type: 'button', class: 'primary', onclick: () => this.run('table') }, 'Table'),
      h('button', { type: 'button', class: 'primary', onclick: () => this.run('graph') }, 'Graph'),
      ...(st.type === 'an1' ? [h('button', { type: 'button', class: 'primary', onclick: () => this.run('web') }, 'Web')] : []));
    form.append(this.err, btns);
    this.el.append(form);
    this.ctx.focusField(this.cells[0]);
  },
  onExe() {
    if (this.mode !== 'edit') return;
    const i = this.cells.indexOf(this.ctx.field);
    if (i >= 0 && i < this.cells.length - 1) this.ctx.focusField(this.cells[i + 1]);
    else this.run('table');
  },
  onKey(id) { return id === 'sd' || id === 'format'; },
  num(src) {
    const r = this.ctx.engine.evaluate(src || '0');
    if (typeof r.value !== 'number') throw new CalcError('Math ERROR');
    return r.value;
  },
  compute() {
    const { engine, parse, store } = this.ctx;
    const st = store.rec;
    const ast = parse.parseLatex(st.expr);
    const n0 = Math.round(this.num(st.start)), n1 = Math.round(this.num(st.end));
    if (n1 < n0 || n1 - n0 > 999) throw new CalcError('Range ERROR');
    const rows = [];
    const ev = scope => { const v = engine.ev(ast, scope); if (typeof v !== 'number' || !isFinite(v)) throw new CalcError('Math ERROR'); return v; };
    if (st.type === 'an') {
      for (let n = n0; n <= n1; n++) rows.push([n, ev({ n })]);
    } else if (st.type === 'an1') {
      let a = this.num(st.a1);
      rows.push([n0, a]);
      for (let n = n0; n < n1; n++) { a = ev({ n, a_n: a }); rows.push([n + 1, a]); }
    } else {
      let a = this.num(st.a1), b = this.num(st.a2);
      rows.push([n0, a]);
      if (n1 > n0) rows.push([n0 + 1, b]);
      for (let n = n0; n + 2 <= n1; n++) { const c = ev({ n, a_n: a, 'a_n+1': b }); rows.push([n + 2, c]); a = b; b = c; }
    }
    let sum = 0;
    return { rows: rows.map(([n, v]) => { sum += v; return [n, v, sum]; }), ast };
  },
  run(view) {
    let data;
    try { data = this.compute(); } catch (e) { this.err.textContent = e.kind || 'Syntax ERROR'; return; }
    if (view === 'table') this.showTable(data);
    else this.showPlot(data, view);
  },
  backBar() {
    const { h } = this.ctx;
    const back = h('button', { type: 'button', class: 'back' }, '‹ Edit');
    back.addEventListener('click', () => this.showEdit());
    return back;
  },
  showTable(data) {
    const { h } = this.ctx;
    this.mode = 'table';
    this.ctx.showKeypad(false);
    this.el.innerHTML = '';
    const t = h('table', { class: 'grid-table' });
    t.append(h('thead', {}, h('tr', {}, h('th', {}, 'n'), h('th', {}, 'aₙ'), h('th', {}, 'Σaₙ'))));
    const body = h('tbody');
    for (const [n, v, s] of data.rows) body.append(h('tr', {}, h('td', {}, String(n)), h('td', {}, fmt(v)), h('td', {}, fmt(s))));
    t.append(body);
    this.el.append(h('div', { class: 'col' }, h('div', { class: 'pad' }, this.backBar()), h('div', { class: 'stable scroll' }, t)));
  },
  showPlot(data, view) {
    const { h, engine } = this.ctx;
    this.mode = 'plot';
    this.ctx.showKeypad(false);
    this.el.innerHTML = '';
    const cv = h('canvas', { class: 'gcanvas' });
    const info = h('div', { class: 'sg-info' });
    this.el.append(h('div', { class: 'col' }, h('div', { class: 'pad' }, this.backBar()), h('div', { class: 'gwrap' }, cv), info));
    const ys = data.rows.map(r => r[1]), xs = data.rows.map(r => r[0]);
    const win = {};
    const pad = (a, b) => { const r = (b - a) || Math.abs(b) || 1; return [a - r * 0.1, b + r * 0.1]; };
    if (view === 'web') {
      const lo = Math.min(...ys, 0), hi = Math.max(...ys, 0);
      [win.xmin, win.xmax] = pad(lo, hi); [win.ymin, win.ymax] = pad(lo, hi);
    } else { [win.xmin, win.xmax] = pad(Math.min(...xs), Math.max(...xs)); [win.ymin, win.ymax] = pad(Math.min(...ys), Math.max(...ys)); }
    this.plot = new Plot(cv, win);
    this.plot.onDraw = (g, v, C) => {
      if (view === 'web') {
        const f = x => { try { const r = engine.ev(data.ast, { a_n: x, n: 0 }); return typeof r === 'number' ? r : NaN; } catch (e) { return NaN; } };
        this.plot.curve(g, v, f, '#0a84ff', 2.25);
        this.plot.curve(g, v, x => x, C.label2, 1.25);
        const pts = [];
        for (let i = 0; i < ys.length - 1; i++) { pts.push([ys[i], i === 0 ? 0 : ys[i]], [ys[i], ys[i + 1]]); pts.push([ys[i + 1], ys[i + 1]]); }
        this.plot.path(g, v, pts, '#ff9500', 1.75);
        info.textContent = 'Web (cobweb) diagram of aₙ₊₁ = f(aₙ) with y = x';
      } else {
        this.plot.path(g, v, data.rows.map(r => [r[0], r[1]]), C.label2, 1.25);
        for (const [n, a] of data.rows) this.plot.dot(g, v, n, a, '#0a84ff', 3.5);
        info.textContent = data.rows.length + ' terms · last aₙ = ' + fmt(ys[ys.length - 1]);
      }
    };
    this.plot.observe();
    this.plot.draw();
  }
};
