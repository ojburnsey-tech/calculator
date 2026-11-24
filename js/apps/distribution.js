import * as S from '../stats.js';
import { CalcError } from '../parse.js';

const INF = 1e99;
const needInt = (v, min = 0) => { if (!Number.isInteger(Math.round(v * 1e9) / 1e9) || Math.abs(v - Math.round(v)) > 1e-9 || v < min) throw new CalcError('Math ERROR'); return Math.round(v); };
const needProb = p => { if (!(p >= 0 && p <= 1)) throw new CalcError('Math ERROR'); return p; };
const needPos = v => { if (!(v > 0)) throw new CalcError('Math ERROR'); return v; };

const DISTS = [
  { group: 'Normal' },
  { id: 'npd', name: 'Normal PD', params: [['x', 'x', '0'], ['σ', 's', '1'], ['μ', 'm', '0']], run: p => [['p', S.normPdf(p.x, p.m, needPos(p.s))]] },
  { id: 'ncd', name: 'Normal CD', params: [['Lower', 'lo', '-1\\times10^{99}'], ['Upper', 'hi', '0'], ['σ', 's', '1'], ['μ', 'm', '0']], run: p => {
    needPos(p.s);
    const zl = (p.lo - p.m) / p.s, zu = (p.hi - p.m) / p.s;
    return [['p', S.normCdf(zu) - S.normCdf(zl)], ['z\\text{:Low}', zl], ['z\\text{:Up}', zu]];
  } },
  { id: 'invn', name: 'Inverse Normal', tail: true, params: [['Area', 'a', '0.5'], ['σ', 's', '1'], ['μ', 'm', '0']], run: (p, tail) => {
    needPos(p.s);
    if (!(p.a > 0 && p.a < 1)) throw new CalcError('Math ERROR');
    if (tail === 'left') return [['x', p.m + p.s * S.invNorm(p.a)]];
    if (tail === 'right') return [['x', p.m + p.s * S.invNorm(1 - p.a)]];
    const z = S.invNorm(0.5 + p.a / 2);
    return [['x_1', p.m - p.s * z], ['x_2', p.m + p.s * z]];
  } },
  { group: 'Binomial' },
  { id: 'bpd', name: 'Binomial PD', params: [['x', 'x', '0'], ['N', 'n', '10'], ['p', 'p', '0.5']], run: p => [['p', S.binomPd(needInt(p.x), needInt(p.n), needProb(p.p))]] },
  { id: 'bcd', name: 'Binomial CD', params: [['Lower', 'lo', '0'], ['Upper', 'hi', '5'], ['N', 'n', '10'], ['p', 'p', '0.5']], run: p => [['p', S.binomCd(p.lo, p.hi, needInt(p.n), needProb(p.p))]] },
  { id: 'binv', name: 'Inverse Binomial', params: [['Area', 'a', '0.5'], ['N', 'n', '10'], ['p', 'p', '0.5']], run: p => {
    const n = needInt(p.n), pr = needProb(p.p);
    if (!(p.a >= 0 && p.a <= 1)) throw new CalcError('Math ERROR');
    return [['x', S.invDiscrete(x => S.binomCd(0, x, n, pr), p.a, n)]];
  } },
  { group: 'Poisson' },
  { id: 'ppd', name: 'Poisson PD', params: [['x', 'x', '0'], ['λ', 'l', '1']], run: p => [['p', S.poissonPd(needInt(p.x), needPos(p.l))]] },
  { id: 'pcd', name: 'Poisson CD', params: [['Lower', 'lo', '0'], ['Upper', 'hi', '2'], ['λ', 'l', '1']], run: p => [['p', S.poissonCd(p.lo, p.hi, needPos(p.l))]] },
  { id: 'pinv', name: 'Inverse Poisson', params: [['Area', 'a', '0.5'], ['λ', 'l', '1']], run: p => {
    needPos(p.l);
    if (!(p.a >= 0 && p.a < 1)) throw new CalcError('Math ERROR');
    return [['x', S.invDiscrete(x => S.poissonCd(0, x, p.l), p.a, 1e6)]];
  } },
  { group: 'Geometric' },
  { id: 'gpd', name: 'Geometric PD', params: [['x', 'x', '1'], ['p', 'p', '0.5']], run: p => [['p', S.geoPd(needInt(p.x, 1), needProb(p.p))]] },
  { id: 'gcd', name: 'Geometric CD', params: [['Lower', 'lo', '1'], ['Upper', 'hi', '3'], ['p', 'p', '0.5']], run: p => [['p', S.geoCd(p.lo, p.hi, needProb(p.p))]] },
  { id: 'ginv', name: 'Inverse Geometric', params: [['Area', 'a', '0.5'], ['p', 'p', '0.5']], run: p => {
    const pr = needProb(p.p);
    if (!(p.a >= 0 && p.a < 1) || pr === 0) throw new CalcError('Math ERROR');
    const x = Math.max(1, Math.ceil(Math.log(1 - p.a) / Math.log(1 - pr) - 1e-12));
    return [['x', pr === 1 ? 1 : x]];
  } },
  { group: 'Hypergeometric' },
  { id: 'hpd', name: 'Hypergeometric PD', params: [['x', 'x', '0'], ['n', 'n', '5'], ['M', 'M', '10'], ['N', 'N', '20']], run: p => [['p', S.hyperPd(needInt(p.x), needInt(p.n), needInt(p.M), needInt(p.N))]] },
  { id: 'hcd', name: 'Hypergeometric CD', params: [['Lower', 'lo', '0'], ['Upper', 'hi', '2'], ['n', 'n', '5'], ['M', 'M', '10'], ['N', 'N', '20']], run: p => [['p', S.hyperCd(p.lo, p.hi, needInt(p.n), needInt(p.M), needInt(p.N))]] },
  { group: 'Student-t' },
  { id: 'tpd', name: 't PD', params: [['x', 'x', '0'], ['df', 'df', '10']], run: p => [['p', S.tPdf(p.x, needPos(p.df))]] },
  { id: 'tcd', name: 't CD', params: [['Lower', 'lo', '-1\\times10^{99}'], ['Upper', 'hi', '0'], ['df', 'df', '10']], run: p => {
    needPos(p.df);
    const c = x => x <= -INF ? 0 : x >= INF ? 1 : S.tCdf(x, p.df);
    return [['p', c(p.hi) - c(p.lo)], ['t\\text{:Low}', p.lo], ['t\\text{:Up}', p.hi]];
  } },
  { id: 'tinv', name: 'Inverse t', params: [['Area', 'a', '0.05'], ['df', 'df', '10']], run: p => {
    needPos(p.df);
    if (!(p.a > 0 && p.a < 1)) throw new CalcError('Math ERROR');
    return [['x', S.invert(x => S.tCdf(x, p.df), 1 - p.a, -1e4, 1e4)]];
  } },
  { group: 'χ²' },
  { id: 'cpd', name: 'χ² PD', params: [['x', 'x', '1'], ['df', 'df', '4']], run: p => [['p', S.chiPdf(p.x, needPos(p.df))]] },
  { id: 'ccd', name: 'χ² CD', params: [['Lower', 'lo', '0'], ['Upper', 'hi', '1\\times10^{99}'], ['df', 'df', '4']], run: p => {
    needPos(p.df);
    const c = x => x >= INF ? 1 : S.chiCdf(x, p.df);
    return [['p', c(p.hi) - c(p.lo)]];
  } },
  { id: 'cinv', name: 'Inverse χ²', params: [['Area', 'a', '0.05'], ['df', 'df', '4']], run: p => {
    needPos(p.df);
    if (!(p.a > 0 && p.a < 1)) throw new CalcError('Math ERROR');
    return [['x', S.invert(x => S.chiCdf(x, p.df), 1 - p.a, 0, 1e5)]];
  } },
  { group: 'F' },
  { id: 'fpd', name: 'F PD', params: [['x', 'x', '1'], ['n:df', 'd1', '5'], ['d:df', 'd2', '10']], run: p => [['p', S.fPdf(p.x, needPos(p.d1), needPos(p.d2))]] },
  { id: 'fcd', name: 'F CD', params: [['Lower', 'lo', '0'], ['Upper', 'hi', '1\\times10^{99}'], ['n:df', 'd1', '5'], ['d:df', 'd2', '10']], run: p => {
    needPos(p.d1); needPos(p.d2);
    const c = x => x >= INF ? 1 : S.fCdf(x, p.d1, p.d2);
    return [['p', c(p.hi) - c(p.lo)]];
  } },
  { id: 'finv', name: 'Inverse F', params: [['Area', 'a', '0.05'], ['n:df', 'd1', '5'], ['d:df', 'd2', '10']], run: p => {
    needPos(p.d1); needPos(p.d2);
    if (!(p.a > 0 && p.a < 1)) throw new CalcError('Math ERROR');
    return [['x', S.invert(x => S.fCdf(x, p.d1, p.d2), 1 - p.a, 0, 1e6)]];
  } }
];

export const distributionApp = {
  id: 'distribution',
  title: 'Distribution',
  mount(el, ctx) {
    this.ctx = ctx;
    this.el = el;
    if (!ctx.store.dist) ctx.store.dist = { values: {}, tail: 'left' };
    this.showList();
  },
  unmount() { this.ctx.save(); },
  showList() {
    const { h } = this.ctx;
    this.cur = null;
    this.cells = [];
    this.ctx.showKeypad(false);
    this.ctx.setTitle('Distribution');
    this.el.innerHTML = '';
    const list = h('div', { class: 'list scroll' });
    for (const d of DISTS) {
      if (d.group) { list.append(h('div', { class: 'list-h' }, d.group)); continue; }
      list.append(h('button', { type: 'button', class: 'list-row', onclick: () => this.showForm(d) }, h('span', {}, d.name), h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')));
    }
    this.el.append(list);
  },
  showForm(d) {
    const { h, tex, store } = this.ctx;
    this.cur = d;
    this.ctx.showKeypad(true);
    this.ctx.setTitle(d.name);
    this.el.innerHTML = '';
    const vals = store.dist.values[d.id] || (store.dist.values[d.id] = {});
    const back = h('button', { type: 'button', class: 'back' }, '‹ Distributions');
    back.addEventListener('click', () => this.showList());
    const form = h('div', { class: 'form scroll' }, back);
    if (d.tail) {
      form.append(h('div', { class: 'field-label' }, 'Tail'), this.ctx.seg([['left', 'Left'], ['right', 'Right'], ['center', 'Centre']], store.dist.tail, v => { store.dist.tail = v; this.ctx.save(); this.clear(); }));
    }
    this.cells = [];
    for (const [label, key, def] of d.params) {
      const mf = this.ctx.makeField(vals[key] ?? def, { class: 'cell', onInput: v => { vals[key] = v; this.clear(); } });
      this.cells.push(mf);
      form.append(h('label', { class: 'frow' }, h('span', { class: 'flabel', html: tex(label.length > 2 ? '\\text{' + label + '}' : label) }), mf));
    }
    const run = h('button', { type: 'button', class: 'primary wide' }, 'Execute');
    run.addEventListener('click', () => this.run());
    this.out = h('div', { class: 'results' });
    form.append(run, this.out);
    this.el.append(form);
    this.ctx.focusField(this.cells[0]);
  },
  clear() { if (this.out) { this.out.innerHTML = ''; this.out.classList.remove('on'); } },
  onExe() {
    if (!this.cur) return;
    const i = this.cells.indexOf(this.ctx.field);
    if (i >= 0 && i < this.cells.length - 1) { this.ctx.focusField(this.cells[i + 1]); return; }
    this.run();
  },
  onKey(id) { return id === 'sd' || id === 'format'; },
  run() {
    const { h, tex, store, engine } = this.ctx;
    const d = this.cur;
    const vals = store.dist.values[d.id] || {};
    this.out.innerHTML = '';
    this.out.classList.add('on');
    try {
      const p = {};
      for (const [, key, def] of d.params) {
        const r = engine.evaluate((vals[key] ?? def) || def);
        if (typeof r.value !== 'number') throw new CalcError('Math ERROR');
        p[key] = r.value;
      }
      const rows = d.run(p, store.dist.tail);
      for (const [k, v] of rows) {
        if (!isFinite(v)) throw new CalcError('Math ERROR');
        if (k === 'p' || k === 'x') store.vars.Ans = v;
        this.out.append(h('div', { class: 'res-row' }, h('span', { class: 'res-k', html: tex(k + '=') }), h('span', { class: 'res-v', html: tex(this.ctx.valueLatex(Math.abs(v) < 1e-300 ? 0 : v, {}, 'decimal')) })));
      }
      this.ctx.save();
    } catch (e) {
      this.out.append(h('div', { class: 'res-msg bad' }, e.kind || 'Math ERROR'));
    }
  }
};
