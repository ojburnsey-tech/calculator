import { fmt } from '../plot.js';

class FinErr extends Error {}
const bad = (m = 'Math ERROR') => { throw new FinErr(m); };

function perRate(I, PY, CY) {
  return Math.pow(1 + I / (100 * CY), CY / PY) - 1;
}

function tvmResidual(n, i, PV, PMT, FV, bgn) {
  if (Math.abs(i) < 1e-14) return PV + PMT * n + FV;
  const v = Math.pow(1 + i, -n);
  return PV + PMT * (1 + i * (bgn ? 1 : 0)) * (1 - v) / i + FV * v;
}

export function solveTVM(target, p) {
  const { n, I, PV, PMT, FV, PY, CY, bgn } = p;
  if (!(PY > 0) || !(CY > 0)) bad();
  const S = bgn ? 1 : 0;
  if (target === 'I') {
    const f = I2 => tvmResidual(n, perRate(I2, PY, CY), PV, PMT, FV, bgn);
    let lo = -99.9999 * CY, hi = 1e4, flo = f(lo), fhi = f(hi);
    const pts = [];
    for (let k = 0; k <= 400; k++) pts.push(-99 * CY + (1e3 + 99 * CY) * Math.pow(k / 400, 3));
    let a = null, b = null;
    let pv = f(pts[0]);
    for (let k = 1; k < pts.length; k++) {
      const cv = f(pts[k]);
      if (isFinite(pv) && isFinite(cv) && Math.sign(pv) !== Math.sign(cv)) { a = pts[k - 1]; b = pts[k]; break; }
      pv = cv;
    }
    if (a === null) { if (isFinite(flo) && isFinite(fhi) && Math.sign(flo) !== Math.sign(fhi)) { a = lo; b = hi; } else bad("Can't Solve"); }
    let fa = f(a);
    for (let k = 0; k < 200; k++) { const m = (a + b) / 2, fm = f(m); if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; }
    return (a + b) / 2;
  }
  const i = perRate(I, PY, CY);
  if (target === 'n') {
    if (Math.abs(i) < 1e-14) { if (PMT === 0) bad(); return -(PV + FV) / PMT; }
    const A = PMT * (1 + i * S);
    const num = (A - FV * i), den = (A + PV * i);
    if (num / den <= 0) bad();
    return Math.log(num / den) / Math.log(1 + i);
  }
  if (Math.abs(i) < 1e-14) {
    if (target === 'PV') return -(PMT * n + FV);
    if (target === 'PMT') { if (!n) bad(); return -(PV + FV) / n; }
    return -(PV + PMT * n);
  }
  const v = Math.pow(1 + i, -n);
  const ann = (1 + i * S) * (1 - v) / i;
  if (target === 'PV') return -(PMT * ann + FV * v);
  if (target === 'PMT') { if (!ann) bad(); return -(PV + FV * v) / ann; }
  if (target === 'FV') return -(PV + PMT * ann) / v;
  bad();
}

function npv(i, cf) { return cf.reduce((s, c, k) => s + c / Math.pow(1 + i, k), 0); }

function irr(cf) {
  const f = r => npv(r, cf);
  let prevR = -0.9999, prevV = f(prevR);
  for (let k = 1; k <= 2000; k++) {
    const r = -0.9999 + k * 0.005;
    const v = f(r);
    if (isFinite(prevV) && isFinite(v) && Math.sign(prevV) !== Math.sign(v)) {
      let a = prevR, b = r, fa = prevV;
      for (let j = 0; j < 200; j++) { const m = (a + b) / 2, fm = f(m); if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; }
      return (a + b) / 2 * 100;
    }
    prevR = r; prevV = v;
  }
  bad("Can't Solve");
}

function daysBetween(a, b) {
  const t = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

function depreciation(method, p) {
  const { n, I, PV, FV, j, Y1 } = p;
  if (!(n >= 1) || j < 1 || !(Y1 >= 1 && Y1 <= 12)) bad();
  const full = Y1 === 12;
  const last = full ? n : n + 1;
  if (j > last) bad();
  const rows = [];
  let rdv = PV - FV;
  if (method === 'SL') {
    const base = (PV - FV) / n;
    for (let k = 1; k <= j; k++) {
      const d = k === 1 ? base * Y1 / 12 : (!full && k === n + 1 ? base * (12 - Y1) / 12 : base);
      rdv = k === last ? 0 : rdv - d;
      rows.push([d, rdv]);
    }
  } else if (method === 'FP' || method === 'DB') {
    const rate = method === 'FP' ? I / 100 : I / (100 * n);
    for (let k = 1; k <= j; k++) {
      let d;
      if (k === 1) d = PV * rate * Y1 / 12;
      else if (!full && k === n + 1) d = rdv;
      else d = (rdv + FV) * rate;
      rdv = (!full && k === n + 1) ? 0 : rdv - d;
      rows.push([d, rdv]);
    }
  } else {
    const Z = n * (n + 1) / 2;
    const np = n - Y1 / 12;
    const ip = Math.floor(np), fp = np - ip;
    const Zp = (ip + 1) * (ip + 2 * fp) / 2;
    const d1 = n / Z * (PV - FV) * Y1 / 12;
    for (let k = 1; k <= j; k++) {
      let d;
      if (k === 1) d = d1;
      else if (!full && k === n + 1) d = (np - (n + 1) + 2) / Zp * (PV - FV - d1) * (12 - Y1) / 12;
      else d = (np - k + 2) / Zp * (PV - FV - d1);
      rdv = k === last ? 0 : rdv - d;
      rows.push([d, rdv]);
    }
  }
  const [d, r] = rows[rows.length - 1];
  return [[method + ' (year ' + j + ')', d], ['RDV', Math.abs(r) < 1e-9 ? 0 : r]];
}

const SCREENS = [
  { id: 'simple', name: 'Simple Interest', fields: [['n', 'n (days)', 30], ['I', 'I%', 5], ['PV', 'PV', -1000]], opts: [['basis', 'Year', [[365, '365 days'], [360, '360 days']], 365]],
    run: (p) => { const si = p.n / p.basis * p.PV * p.I / 100; return [['SI', -si], ['SFV', -(p.PV + si)]]; } },
  { id: 'tvm', name: 'Compound Interest', tvm: true, fields: [['n', 'n', 12], ['I', 'I%', 5], ['PV', 'PV', -1000], ['PMT', 'PMT', 0], ['FV', 'FV', 0], ['PY', 'P/Y', 12], ['CY', 'C/Y', 12]], opts: [['bgn', 'Payment', [[false, 'End'], [true, 'Begin']], false]] },
  { id: 'cash', name: 'Cash Flow', fields: [['I', 'I%', 5]], opts: [['list', 'Cash flows (CF₀ first)', [0, 1, 2, 3, 4, 5].map(i => [i, 'L' + (i + 1)]), 0]],
    run: (p, ctx) => {
      const cf = ctx.store.lists[p.list].filter(v => typeof v === 'number' && isFinite(v));
      if (cf.length < 2) bad('Dimension ERROR');
      const i = p.I / 100;
      const N = npv(i, cf);
      let cum = 0, pbp = NaN;
      for (let k = 0; k < cf.length; k++) {
        const prev = cum;
        cum += cf[k] / Math.pow(1 + i, k);
        if (k > 0 && prev < 0 && cum >= 0) { pbp = k - 1 + (-prev) / (cum - prev); break; }
      }
      return [['NPV', N], ['NFV', N * Math.pow(1 + i, cf.length - 1)], ['IRR (%)', irr(cf)], ['PBP', pbp]];
    } },
  { id: 'amort', name: 'Amortisation', fields: [['PM1', 'PM1', 1], ['PM2', 'PM2', 12], ['n', 'n', 240], ['I', 'I%', 5], ['PV', 'PV', 100000], ['PMT', 'PMT', -659.96], ['FV', 'FV', 0], ['PY', 'P/Y', 12], ['CY', 'C/Y', 12]],
    run: (p) => {
      const i = perRate(p.I, p.PY, p.CY);
      const a = Math.round(p.PM1), b = Math.round(p.PM2);
      if (a < 1 || b < a || b > p.n) bad();
      let bal = p.PV, sInt = 0, sPrn = 0, int1 = 0, prn1 = 0;
      for (let k = 1; k <= b; k++) {
        const int = -bal * i;
        const prn = p.PMT - int;
        bal = bal + prn;
        if (k === a) { int1 = int; prn1 = prn; }
        if (k >= a) { sInt += int; sPrn += prn; }
      }
      return [['BAL', bal], ['INT', int1], ['PRN', prn1], ['ΣINT', sInt], ['ΣPRN', sPrn]];
    } },
  { id: 'conv', name: 'Interest Conversion', fields: [['n', 'n (compounds per year)', 12], ['I', 'I%', 5]],
    run: (p) => { if (!(p.n > 0)) bad(); return [['EFF (from APR)', (Math.pow(1 + p.I / (100 * p.n), p.n) - 1) * 100], ['APR (from EFF)', p.n * (Math.pow(1 + p.I / 100, 1 / p.n) - 1) * 100]]; } },
  { id: 'csm', name: 'Cost / Sell / Margin', fields: [['cost', 'Cost', 80], ['sell', 'Sell', 100], ['mrg', 'Margin %', 20]], solveFor: [['cost', 'Cost'], ['sell', 'Sell'], ['mrg', 'Margin']],
    run: (p, ctx, target) => {
      if (target === 'cost') return [['Cost', p.sell * (1 - p.mrg / 100)]];
      if (target === 'sell') { if (p.mrg === 100) bad(); return [['Sell', p.cost / (1 - p.mrg / 100)]]; }
      if (!p.sell) bad();
      return [['Margin %', (1 - p.cost / p.sell) * 100]];
    } },
  { id: 'days', name: 'Day Count', dates: [['d1', 'First date'], ['d2', 'Second date']],
    run: (p) => [['Days', daysBetween(p.d1, p.d2)]] },
  { id: 'dep', name: 'Depreciation', fields: [['n', 'n (useful life, years)', 5], ['I', 'I% (FP and DB)', 25], ['PV', 'PV (cost)', 10000], ['FV', 'FV (residual)', 1000], ['j', 'Year j', 1], ['Y1', 'Months in first year', 12]], opts: [['method', 'Method', [['SL', 'SL'], ['FP', 'FP'], ['SYD', 'SYD'], ['DB', 'DB']], 'SL']],
    run: (p) => depreciation(p.method, { ...p, n: Math.round(p.n), j: Math.round(p.j), Y1: Math.round(p.Y1) }) },
  { id: 'bond', name: 'Bond', fields: [['n', 'n (coupon payments left)', 10], ['RDV', 'RDV (redemption per 100)', 100], ['CPN', 'CPN (annual coupon %)', 5], ['YLD', 'YLD (annual yield %)', 4], ['PRC', 'PRC (price per 100)', -108]], opts: [['M', 'Coupons per year', [[1, 'Annual'], [2, 'Semi-annual']], 2]], solveFor: [['PRC', 'Price'], ['YLD', 'Yield']],
    run: (p, ctx, target) => {
      const M = p.M, n = Math.round(p.n);
      if (n < 1) bad();
      const cpn = p.RDV * p.CPN / (100 * M);
      const price = y => { const R = y / (100 * M); let s = p.RDV / Math.pow(1 + R, n); for (let k = 1; k <= n; k++) s += cpn / Math.pow(1 + R, k); return -s; };
      if (target === 'PRC') return [['PRC', price(p.YLD)], ['Coupon per payment', cpn]];
      let a = -99, b = 1000, fa = price(a) - p.PRC;
      if (Math.sign(fa) === Math.sign(price(b) - p.PRC)) bad("Can't Solve");
      for (let k = 0; k < 200; k++) { const m = (a + b) / 2, fm = price(m) - p.PRC; if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; }
      return [['YLD (%)', (a + b) / 2]];
    } }
];

export const financialApp = {
  id: 'financial',
  title: 'Financial',
  mount(el, ctx) {
    this.ctx = ctx;
    this.el = el;
    if (!ctx.store.fin) ctx.store.fin = {};
    ctx.showKeypad(false);
    this.showList();
  },
  unmount() { this.ctx.save(); },
  showList() {
    const { h } = this.ctx;
    this.ctx.setTitle('Financial');
    this.el.innerHTML = '';
    const list = h('div', { class: 'list scroll' }, h('p', { class: 'note' }, 'Money you pay out is negative and money you receive is positive, as on the Casio.'));
    for (const s of SCREENS) list.append(h('button', { type: 'button', class: 'list-row', onclick: () => this.show(s) }, h('span', {}, s.name), h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')));
    this.el.append(list);
  },
  show(s) {
    const { h, seg, store } = this.ctx;
    const st = store.fin[s.id] || (store.fin[s.id] = {});
    this.ctx.setTitle(s.name);
    this.el.innerHTML = '';
    const back = h('button', { type: 'button', class: 'back' }, '‹ Financial');
    back.addEventListener('click', () => this.showList());
    const form = h('div', { class: 'form scroll' }, back);
    const inputs = {};
    for (const [k, label, def, choices] of (s.opts || []).map(o => [o[0], o[1], o[3], o[2]])) {
      if (st[k] === undefined) st[k] = def;
      form.append(h('div', { class: 'field-label' }, label), seg(choices, st[k], v => { st[k] = v; this.ctx.save(); }));
    }
    for (const [k, label] of s.dates || []) {
      const d = h('input', { type: 'date', class: 'num-in', value: st[k] || new Date().toISOString().slice(0, 10), 'aria-label': label });
      d.addEventListener('change', () => { st[k] = d.value; this.ctx.save(); });
      if (!st[k]) st[k] = d.value;
      inputs[k] = { get: () => d.value };
      form.append(h('label', { class: 'frow fin' }, h('span', { class: 'flabel' }, label), d));
    }
    for (const [k, label, def] of s.fields || []) {
      const f = this.ctx.numField(st[k] ?? def, { label, onInput: v => { st[k] = v; this.ctx.save(); } });
      inputs[k] = f;
      form.append(h('label', { class: 'frow fin' }, h('span', { class: 'flabel' }, label), f.el));
    }
    const out = h('div', { class: 'results' });
    const show = rows => {
      out.innerHTML = '';
      out.classList.add('on');
      for (const [k, v] of rows) out.append(h('div', { class: 'res-row' }, h('span', { class: 'res-k' }, k), h('span', { class: 'res-v' }, typeof v === 'number' ? fmt(Number(v.toPrecision(10))) : String(v))));
      requestAnimationFrame(() => out.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    };
    const collect = () => {
      const p = { ...Object.fromEntries((s.opts || []).map(o => [o[0], st[o[0]]])) };
      for (const [k] of s.fields || []) { const v = inputs[k].get(); if (!Number.isFinite(v)) bad('Syntax ERROR'); p[k] = v; }
      for (const [k] of s.dates || []) p[k] = inputs[k].get();
      return p;
    };
    const run = (target) => {
      try {
        const p = collect();
        if (s.tvm) {
          const v = solveTVM(target, p);
          if (!isFinite(v)) bad();
          inputs[target].set(String(Number(v.toPrecision(10))));
          st[target] = inputs[target].input.value;
          this.ctx.save();
          show([[{ n: 'n', I: 'I%', PV: 'PV', PMT: 'PMT', FV: 'FV' }[target], v]]);
          store.vars.Ans = v;
          return;
        }
        const rows = s.run(p, this.ctx, target);
        const first = rows.find(r => typeof r[1] === 'number' && isFinite(r[1]));
        if (first) store.vars.Ans = first[1];
        this.ctx.save();
        show(rows);
      } catch (e) { out.innerHTML = ''; out.classList.add('on'); out.append(h('div', { class: 'res-msg bad' }, e instanceof FinErr ? e.message : 'Math ERROR')); }
    };
    if (s.tvm) {
      const btns = h('div', { class: 'solve-grid' });
      for (const [t, label] of [['n', 'n'], ['I', 'I%'], ['PV', 'PV'], ['PMT', 'PMT'], ['FV', 'FV']]) btns.append(h('button', { type: 'button', class: 'primary', onclick: () => run(t) }, 'Solve ' + label));
      form.append(h('div', { class: 'field-label' }, 'Work out'), btns);
    } else if (s.solveFor) {
      const btns = h('div', { class: 'solve-grid' });
      for (const [t, label] of s.solveFor) btns.append(h('button', { type: 'button', class: 'primary', onclick: () => run(t) }, 'Solve ' + label));
      form.append(h('div', { class: 'field-label' }, 'Work out'), btns);
    } else form.append(h('button', { type: 'button', class: 'primary wide', onclick: () => run() }, 'Execute'));
    form.append(out);
    this.el.append(form);
  }
};
