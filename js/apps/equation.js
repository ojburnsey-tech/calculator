import { CalcError } from '../parse.js';

const VARS = ['x', 'y', 'z', 't', 'u', 'v'];
const COEF = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cabs = a => Math.hypot(a[0], a[1]);

function horner(c, z) {
  let r = [c[0], 0];
  for (let i = 1; i < c.length; i++) r = [r[0] * z[0] - r[1] * z[1] + c[i], r[0] * z[1] + r[1] * z[0]];
  return r;
}

export function polyRoots(coefs) {
  const n = coefs.length - 1;
  const c = coefs.map(x => x / coefs[0]);
  const R = 1 + Math.max(...c.slice(1).map(Math.abs));
  let z = Array.from({ length: n }, (_, k) => [R * Math.cos(2 * Math.PI * k / n + 0.4), R * Math.sin(2 * Math.PI * k / n + 0.4)]);
  for (let it = 0; it < 500; it++) {
    let delta = 0;
    const next = z.map((zi, i) => {
      let den = [1, 0];
      for (let j = 0; j < n; j++) if (j !== i) den = cmul(den, csub(zi, z[j]));
      const step = cdiv(horner(c, zi), den);
      delta = Math.max(delta, cabs(step));
      return csub(zi, step);
    });
    z = next;
    if (delta < 1e-15 * R) break;
  }
  const d = c.map((k, i) => k * (n - i)).slice(0, n);
  return z.map(r => {
    for (let k = 0; k < 4; k++) {
      const fv = horner(c, r), dv = horner(d, r);
      if (cabs(dv) < 1e-300) break;
      r = csub(r, cdiv(fv, dv));
    }
    return r;
  });
}

function solveLinear(A, b) {
  const n = A.length;
  const M = A.map((r, i) => [...r, b[i]]);
  const scale = Math.max(1e-300, ...M.flat().map(Math.abs));
  let rank = 0;
  const where = Array(n).fill(-1);
  for (let col = 0, row = 0; col < n && row < n; col++) {
    let piv = row;
    for (let i = row; i < n; i++) if (Math.abs(M[i][col]) > Math.abs(M[piv][col])) piv = i;
    if (Math.abs(M[piv][col]) < 1e-12 * scale) continue;
    [M[piv], M[row]] = [M[row], M[piv]];
    where[col] = row;
    for (let i = 0; i < n; i++) if (i !== row) {
      const f = M[i][col] / M[row][col];
      for (let j = col; j <= n; j++) M[i][j] -= f * M[row][j];
    }
    row++; rank++;
  }
  if (rank < n) {
    for (let i = rank; i < n; i++) if (Math.abs(M[i][n]) > 1e-10 * scale) return { status: 'none' };
    return { status: 'infinite' };
  }
  return { status: 'ok', x: where.map((r, col) => { const v = M[r][n] / M[r][col]; return Math.abs(v) < 1e-13 * scale ? 0 : v; }) };
}

export const equationApp = {
  id: 'equation',
  title: 'Equation',
  mount(el, ctx) {
    this.ctx = ctx;
    const { store } = ctx;
    if (!store.eq) store.eq = { mode: 'sim', n: 2, deg: 2, sim: {}, poly: {}, solver: { eq: '', guess: '0' } };
    this.el = el;
    this.resultMode = 'standard';
    this.build();
  },
  unmount() { this.ctx.save(); },
  setMode(mode) {
    this.ctx.store.eq.mode = mode;
    this.ctx.save();
    this.build();
  },
  build() {
    const { h, seg, store } = this.ctx;
    const st = store.eq;
    this.el.innerHTML = '';
    const top = h('div', { class: 'eq-top' },
      seg([['sim', 'Simultaneous'], ['poly', 'Polynomial'], ['ineq', 'Inequality'], ['solver', 'Solver']], st.mode, v => this.setMode(v)));
    this.el.append(top);
    this.body = h('div', { class: 'eq-body scroll' });
    this.el.append(this.body);
    this.cells = [];
    this.results = null;
    if (st.mode === 'sim') this.buildSim();
    else if (st.mode === 'poly') this.buildPoly();
    else if (st.mode === 'ineq') this.buildIneq();
    else this.buildSolver();
  },
  chips(values, cur, label, onPick) {
    const { h } = this.ctx;
    const wrap = h('div', { class: 'chips' }, h('span', { class: 'chips-label' }, label));
    for (const v of values) {
      const b = h('button', { type: 'button', class: 'chip' + (v === cur ? ' on' : '') }, String(v));
      b.addEventListener('click', () => onPick(v));
      wrap.append(b);
    }
    return wrap;
  },
  cell(store, key, cls = '') {
    const mf = this.ctx.makeField(store[key] || '', { class: 'cell ' + cls, onInput: v => { store[key] = v; this.clearResults(); } });
    this.cells.push(mf);
    return mf;
  },
  clearResults() { if (this.results) { this.results.innerHTML = ''; this.results.classList.remove('on'); } },
  buildSim() {
    const { h, tex, store } = this.ctx;
    const st = store.eq;
    const n = st.n;
    this.body.append(this.chips([2, 3, 4, 5, 6], n, 'Unknowns', v => { st.n = v; this.ctx.save(); this.build(); }));
    const form = VARS.slice(0, n).map((v, i) => COEF[i] + '_1' + v).join('+') + '=' + COEF[n] + '_1';
    this.body.append(h('div', { class: 'eq-form', html: tex(form) }));
    const grid = h('div', { class: 'mgrid', style: `grid-template-columns: 1.6em repeat(${n + 1}, minmax(0,1fr))` });
    grid.append(h('div'));
    for (let j = 0; j <= n; j++) grid.append(h('div', { class: 'mhead', html: tex(COEF[j]) }));
    for (let i = 0; i < n; i++) {
      grid.append(h('div', { class: 'mrow', html: tex(String(i + 1)) }));
      for (let j = 0; j <= n; j++) grid.append(this.cell(st.sim, `${i},${j}`));
    }
    this.body.append(grid);
    this.addActions();
  },
  buildPoly() {
    const { h, tex, store } = this.ctx;
    const st = store.eq;
    const d = st.deg;
    this.body.append(this.chips([2, 3, 4, 5, 6], d, 'Degree', v => { st.deg = v; this.ctx.save(); this.build(); }));
    const form = COEF.slice(0, d + 1).map((c, i) => { const p = d - i; return c + (p === 0 ? '' : p === 1 ? 'x' : 'x^{' + p + '}'); }).join('+') + '=0';
    this.body.append(h('div', { class: 'eq-form', html: tex(form) }));
    const grid = h('div', { class: 'mgrid poly', style: `grid-template-columns: repeat(${Math.min(d + 1, 4)}, minmax(0,1fr))` });
    for (let j = 0; j <= d; j++) grid.append(h('label', { class: 'pcell' }, h('span', { class: 'mhead', html: tex(COEF[j]) }), this.cell(st.poly[d] || (st.poly[d] = {}), String(j))));
    this.body.append(grid);
    this.addActions();
  },
  buildIneq() {
    const { h, tex, store } = this.ctx;
    const st = store.eq;
    if (!st.ineq) st.ineq = { deg: 2, rel: '>', coefs: {} };
    const q = st.ineq;
    const d = q.deg;
    this.body.append(this.chips([2, 3, 4], d, 'Degree', v => { q.deg = v; this.ctx.save(); this.build(); }));
    const rels = [['>', '>'], ['ge', '≥'], ['<', '<'], ['le', '≤']];
    this.body.append(h('div', { class: 'chips' }, h('span', { class: 'chips-label' }, 'Type'), this.ctx.seg(rels, q.rel, v => { q.rel = v; this.ctx.save(); this.build(); })));
    const relTex = { '>': '>', ge: '\\ge', '<': '<', le: '\\le' }[q.rel];
    const form = COEF.slice(0, d + 1).map((c, i) => { const p = d - i; return c + (p === 0 ? '' : p === 1 ? 'x' : 'x^{' + p + '}'); }).join('+') + relTex + '0';
    this.body.append(h('div', { class: 'eq-form', html: tex(form) }));
    const grid = h('div', { class: 'mgrid poly', style: `grid-template-columns: repeat(${Math.min(d + 1, 4)}, minmax(0,1fr))` });
    const cells = q.coefs[d] || (q.coefs[d] = {});
    for (let j = 0; j <= d; j++) grid.append(h('label', { class: 'pcell' }, h('span', { class: 'mhead', html: tex(COEF[j]) }), this.cell(cells, String(j))));
    this.body.append(grid);
    this.addActions();
  },
  solveIneq() {
    const q = this.ctx.store.eq.ineq;
    const d = q.deg;
    const cells = q.coefs[d] || {};
    const c = [];
    for (let j = 0; j <= d; j++) c.push(this.evalCell(cells[String(j)]).value);
    if (c[0] === 0) throw new CalcError('Math ERROR');
    const f = x => c.reduce((s, k) => s * x + k, 0);
    const scale = Math.max(1, ...c.map(Math.abs));
    let roots = (d === 2 ? (() => { const D = c[1] * c[1] - 4 * c[0] * c[2]; if (D < -1e-12 * scale * scale) return []; const s = Math.sqrt(Math.max(0, D)); return [(-c[1] - s) / (2 * c[0]), (-c[1] + s) / (2 * c[0])]; })() : polyRoots(c).filter(r => Math.abs(r[1]) < 1e-7 * Math.max(1, cabs(r))).map(r => r[0]));
    roots.sort((a, b) => a - b);
    const R = [];
    for (const r of roots) if (!R.length || Math.abs(r - R[R.length - 1]) > 1e-7 * Math.max(1, Math.abs(r))) R.push(Math.abs(r) < 1e-13 ? 0 : r);
    const strict = q.rel === '>' || q.rel === '<';
    const want = v => (q.rel === '>' || q.rel === 'ge') ? v > 0 : v < 0;
    const pts = [-Infinity, ...R, Infinity];
    const mid = (a, b) => a === -Infinity ? (b === Infinity ? 0 : b - 1) : b === Infinity ? a + 1 : (a + b) / 2;
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const inside = want(f(mid(a, b)));
      const loIn = a !== -Infinity && !strict;
      const hiIn = b !== Infinity && !strict;
      if (inside) {
        const last = segs[segs.length - 1];
        if (last && last.b === a && (last.bIn || loIn)) { last.b = b; last.bIn = hiIn; }
        else segs.push({ a, b, aIn: loIn, bIn: hiIn });
      }
    }
    if (!strict) for (const r of R) {
      if (segs.some(s => (s.a < r && r < s.b) || (s.a === r && s.aIn) || (s.b === r && s.bIn))) continue;
      segs.push({ a: r, b: r, aIn: true, bIn: true });
    }
    segs.sort((p, q2) => p.a - q2.a);
    const flags = { root: true };
    const L = v => this.ctx.valueLatex(v, flags, this.resultMode === 'decimal' ? 'decimal' : 'standard');
    if (!segs.length) return [{ msg: 'No Solution' }];
    if (segs.length === 1 && segs[0].a === -Infinity && segs[0].b === Infinity) return [{ msg: 'All Real Numbers' }];
    const parts = segs.map(s => {
      const lo = s.aIn ? '\\le' : '<', hi = s.bIn ? '\\le' : '<';
      if (s.a === s.b) return 'x=' + L(s.a);
      if (s.a === -Infinity) return 'x' + hi + L(s.b);
      if (s.b === Infinity) return L(s.a) + lo + 'x';
      return L(s.a) + lo + 'x' + hi + L(s.b);
    });
    return parts.map(p => ({ label: '', latex: p }));
  },
  buildSolver() {
    const { h, tex, store } = this.ctx;
    const st = store.eq.solver;
    this.body.append(h('p', { class: 'note' }, 'Type an equation in x. SHIFT then . gives =. Without =, it solves expression = 0.'));
    const eq = this.ctx.makeField(st.eq, { class: 'solver-eq', onInput: v => { st.eq = v; this.clearResults(); } });
    const guess = this.ctx.makeField(st.guess, { class: 'cell', onInput: v => { st.guess = v; this.clearResults(); } });
    this.cells = [eq, guess];
    this.body.append(h('div', { class: 'solver' }, h('div', { class: 'field-label' }, 'Equation'), eq, h('div', { class: 'field-label' }, 'Start from x ='), guess));
    this.addActions();
  },
  addActions() {
    const { h } = this.ctx;
    this.results = h('div', { class: 'results' });
    const solve = h('button', { type: 'button', class: 'primary wide' }, 'Solve');
    solve.addEventListener('click', () => this.solve());
    this.body.append(solve, this.results);
    if (this.cells[0]) this.ctx.focusField(this.cells[0]);
  },
  evalCell(latex) {
    if (!latex || !latex.trim()) return { value: 0, flags: {} };
    const r = this.ctx.engine.evaluate(latex);
    if (typeof r.value !== 'number') throw new CalcError('Math ERROR');
    return r;
  },
  onExe() {
    const i = this.cells.indexOf(this.ctx.field);
    if (i >= 0 && i < this.cells.length - 1) { this.ctx.focusField(this.cells[i + 1]); return; }
    this.solve();
  },
  onKey(id) {
    if (id === 'sd' && this.lastSolve) {
      this.resultMode = this.resultMode === 'decimal' ? 'standard' : 'decimal';
      if (this.ctx.store.eq.mode === 'ineq') { try { this.lastSolve = this.solveIneq(); } catch (e) {} }
      this.showResults(this.lastSolve);
      return true;
    }
    if (id === 'format') return true;
    return false;
  },
  showResults(rows) {
    const { h, tex } = this.ctx;
    this.results.innerHTML = '';
    this.results.classList.add('on');
    for (const r of rows) {
      if (r.msg) { this.results.append(h('div', { class: 'res-msg' + (r.err ? ' bad' : '') }, r.msg)); continue; }
      let val = r.latex;
      if (!val) {
        try { val = this.ctx.valueLatex(r.value, r.flags || {}, this.resultMode); } catch (e) { val = String(r.value); }
      }
      this.results.append(h('div', { class: 'res-row' }, h('span', { class: 'res-k', html: tex(r.label) }), h('span', { class: 'res-v', html: tex(val) })));
    }
  },
  solve() {
    const st = this.ctx.store.eq;
    try {
      let rows;
      if (st.mode === 'sim') rows = this.solveSim();
      else if (st.mode === 'poly') rows = this.solvePoly();
      else if (st.mode === 'ineq') rows = this.solveIneq();
      else rows = this.solveSolver();
      this.resultMode = this.ctx.store.settings.io === 'dec' ? 'decimal' : 'standard';
      if (st.mode === 'ineq') rows = this.solveIneq();
      this.lastSolve = rows;
      this.showResults(rows);
    } catch (e) {
      this.lastSolve = null;
      this.showResults([{ msg: e.kind || e.message || 'Math ERROR', err: true }]);
    }
    requestAnimationFrame(() => this.results.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  },
  solveSim() {
    const st = this.ctx.store.eq;
    const n = st.n;
    const flags = { root: false, pi: false, trans: false };
    const A = [], b = [];
    for (let i = 0; i < n; i++) {
      A.push([]);
      for (let j = 0; j <= n; j++) {
        const r = this.evalCell(st.sim[`${i},${j}`]);
        for (const k of Object.keys(flags)) if (r.flags[k]) flags[k] = true;
        if (j < n) A[i].push(r.value); else b.push(r.value);
      }
    }
    const res = solveLinear(A, b);
    if (res.status === 'none') return [{ msg: 'No Solution' }];
    if (res.status === 'infinite') return [{ msg: 'Infinite Solutions' }];
    return res.x.map((v, i) => ({ label: VARS[i] + '=', value: v, flags }));
  },
  solvePoly() {
    const st = this.ctx.store.eq;
    const d = st.deg;
    const cells = st.poly[d] || {};
    const flags = { root: true, pi: false, trans: false };
    const c = [];
    for (let j = 0; j <= d; j++) {
      const r = this.evalCell(cells[String(j)]);
      if (r.flags.pi) flags.pi = true;
      if (r.flags.trans) flags.trans = true;
      c.push(r.value);
    }
    if (c[0] === 0) throw new CalcError('Math ERROR');
    let roots;
    if (d === 2) {
      const [a, b2, cc] = c;
      const D = b2 * b2 - 4 * a * cc;
      if (Math.abs(D) < 1e-14 * Math.max(1, b2 * b2)) roots = [[-b2 / (2 * a), 0], [-b2 / (2 * a), 0]];
      else if (D > 0) {
        const q = -0.5 * (b2 + Math.sign(b2 || 1) * Math.sqrt(D));
        roots = [[q / a, 0], [cc / q, 0]];
      } else roots = [[-b2 / (2 * a), Math.sqrt(-D) / (2 * a)], [-b2 / (2 * a), -Math.sqrt(-D) / (2 * a)]];
    } else roots = polyRoots(c);
    const scale = Math.max(1, ...roots.map(cabs));
    const real = [], cx = [];
    for (const r of roots) {
      if (Math.abs(r[1]) < 1e-8 * scale) real.push(Math.abs(r[0]) < 1e-13 * scale ? 0 : r[0]);
      else cx.push(r);
    }
    real.sort((p, q) => q - p);
    cx.sort((p, q) => q[0] - p[0] || q[1] - p[1]);
    const rows = [];
    let k = 1;
    const seen = [];
    for (const r of real) rows.push({ label: 'x_{' + (k++) + '}=', value: r, flags });
    for (const r of cx) rows.push({ label: 'x_{' + (k++) + '}=', value: window.math.complex(r[0], r[1]), flags });
    if (d === 2) {
      const [a, b2, cc] = c;
      const xv = -b2 / (2 * a), yv = cc - b2 * b2 / (4 * a);
      const kind = a > 0 ? 'Minimum' : 'Maximum';
      rows.push({ label: '\\text{x-value ' + kind + '}=', value: xv, flags });
      rows.push({ label: '\\text{y-value ' + kind + '}=', value: yv, flags });
    }
    if (d === 3) {
      const [a, b2, cc] = c;
      const D = 4 * b2 * b2 - 12 * a * cc;
      if (D > 0) {
        const xs = [(-2 * b2 + Math.sqrt(D)) / (6 * a), (-2 * b2 - Math.sqrt(D)) / (6 * a)].sort((p, q) => p - q);
        const f = x => ((c[0] * x + c[1]) * x + c[2]) * x + c[3];
        for (const x of xs) {
          const kind = 6 * a * x + 2 * b2 > 0 ? 'Minimum' : 'Maximum';
          rows.push({ label: '\\text{x-value ' + kind + '}=', value: x, flags });
          rows.push({ label: '\\text{y-value ' + kind + '}=', value: f(x), flags });
        }
      }
    }
    return rows;
  },
  solveSolver() {
    const { engine } = this.ctx;
    const st = this.ctx.store.eq.solver;
    if (!st.eq || !st.eq.trim()) throw new CalcError('Syntax ERROR');
    const { parseLatex, exprFlags, usesVar } = this.ctx.parse;
    const ast = parseLatex(st.eq);
    const lhs = ast.k === 'eq' ? ast.a : ast;
    const rhs = ast.k === 'eq' ? ast.b : { k: 'num', v: 0 };
    const v = ['x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'M'].find(n => usesVar(lhs, n) || usesVar(rhs, n)) || 'x';
    const f = x => {
      const a = engine.ev(lhs, { [v]: x }), b = engine.ev(rhs, { [v]: x });
      if (typeof a !== 'number' || typeof b !== 'number') return NaN;
      return a - b;
    };
    const g = this.evalCell(st.guess).value;
    let x = this.findRoot(f, g);
    if (x === null) throw new CalcError("Can't Solve");
    if (Math.abs(x) < 1e-12) x = 0;
    this.ctx.store.vars[v] = x;
    this.ctx.save();
    const flags = exprFlags(ast, this.ctx.store.settings.angle);
    flags.root = true;
    return [{ label: v + '=', value: x, flags }, { label: '\\text{L}-\\text{R}=', latex: this.ctx.valueLatex(Math.abs(f(x)) < 1e-15 ? 0 : f(x), {}, 'decimal') }];
  },
  findRoot(f, g) {
    const tolOk = (x) => { const y = f(x); return isFinite(y) && Math.abs(y) < 1e-10 * Math.max(1, Math.abs(x)); };
    let x = g;
    for (let i = 0; i < 100; i++) {
      const y = f(x);
      if (!isFinite(y)) break;
      if (Math.abs(y) < 1e-14) return x;
      const hh = 1e-6 * Math.max(1, Math.abs(x));
      const d = (f(x + hh) - f(x - hh)) / (2 * hh);
      if (!isFinite(d) || d === 0) break;
      const nx = x - y / d;
      if (Math.abs(nx - x) < 1e-14 * Math.max(1, Math.abs(x))) { x = nx; break; }
      x = nx;
    }
    if (tolOk(x)) return x;
    const bisect = (a, b, fa) => {
      for (let i = 0; i < 200; i++) {
        const m = (a + b) / 2, fm = f(m);
        if (!isFinite(fm)) return null;
        if (fm === 0) return m;
        if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m;
        if (Math.abs(b - a) < 1e-15 * Math.max(1, Math.abs(m))) break;
      }
      return (a + b) / 2;
    };
    for (let span = 1; span <= 1e6; span *= 4) {
      const N = 400;
      let best = null;
      let px = g - span, py = f(px);
      for (let i = 1; i <= N; i++) {
        const cx = g - span + 2 * span * i / N, cy = f(cx);
        if (isFinite(py) && isFinite(cy) && Math.sign(py) !== Math.sign(cy)) {
          const r = bisect(px, cx, py);
          if (r !== null && tolOk(r) && (best === null || Math.abs(r - g) < Math.abs(best - g))) best = r;
        }
        px = cx; py = cy;
      }
      if (best !== null) return best;
    }
    return null;
  }
};
