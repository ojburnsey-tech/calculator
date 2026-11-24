import { CalcError, parseLatex, exprFlags } from './parse.js';

const M = window.math;
const mathErr = () => new CalcError('Math ERROR');
const isNum = v => typeof v === 'number';
const isCx = v => v && typeof v === 'object' && v.isComplex;
const isMat = v => v && typeof v === 'object' && (v.isMatrix || Array.isArray(v));

export const ANGLE = { deg: Math.PI / 180, rad: 1, gra: Math.PI / 200 };

function clean(v) {
  if (isCx(v)) {
    const re = Math.abs(v.re) < 1e-14 * Math.max(1, Math.abs(v.im)) ? 0 : v.re;
    const im = Math.abs(v.im) < 1e-14 * Math.max(1, Math.abs(v.re)) ? 0 : v.im;
    if (im === 0) return re;
    return M.complex(re, im);
  }
  return v;
}

const add = (a, b) => isNum(a) && isNum(b) ? a + b : clean(M.add(a, b));
const sub = (a, b) => isNum(a) && isNum(b) ? a - b : clean(M.subtract(a, b));
const mul = (a, b) => isNum(a) && isNum(b) ? a * b : clean(M.multiply(a, b));
function div(a, b) {
  if (isNum(b) && b === 0) throw mathErr();
  if (isCx(b) && b.re === 0 && b.im === 0) throw mathErr();
  if (isMat(b)) return clean(M.multiply(a, M.inv(b)));
  return isNum(a) && isNum(b) ? a / b : clean(M.divide(a, b));
}

function smallRational(x, maxDen = 99) {
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
  for (let n = 0; n < 20; n++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0, k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(x - h1 / k1) < 1e-12) return [h1, k1];
    const fr = b - a;
    if (fr < 1e-15) break;
    b = 1 / fr;
  }
  return null;
}

function pow(a, b) {
  if (isMat(a)) {
    if (!isNum(b) || !Number.isInteger(b)) throw mathErr();
    return clean(M.pow(a, b));
  }
  if (isNum(a) && isNum(b)) {
    if (a === 0 && b < 0) throw mathErr();
    if (a === 0 && b === 0) throw mathErr();
    if (a < 0 && !Number.isInteger(b)) {
      const r = smallRational(b);
      if (r && r[1] % 2 === 1) {
        const v = Math.pow(-a, b);
        return r[0] % 2 === 0 ? v : -v;
      }
      return clean(M.pow(M.complex(a, 0), b));
    }
    const v = Math.pow(a, b);
    if (!isFinite(v)) throw mathErr();
    return v;
  }
  return clean(M.pow(a, b));
}

function factorial(n) {
  if (!isNum(n) || n < 0 || !Number.isInteger(Math.round(n * 1e9) / 1e9) || Math.abs(n - Math.round(n)) > 1e-9) throw mathErr();
  n = Math.round(n);
  if (n > 69) throw mathErr();
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

const asInt = v => {
  if (!isNum(v) || Math.abs(v - Math.round(v)) > 1e-9) throw mathErr();
  return Math.round(v);
};

function gcd2(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }

function rnd(v, settings) {
  if (!isNum(v)) return v;
  if (settings.format === 'fix') return Number(v.toFixed(settings.digits));
  if (settings.format === 'sci') return Number(v.toPrecision(Math.max(1, settings.digits || 10)));
  return Number(v.toPrecision(10));
}

function realOnly(v) { if (!isNum(v)) throw mathErr(); return v; }

export function derivativeAt(f, a) {
  let h = 1e-2 * Math.max(1, Math.abs(a));
  const D = [];
  for (let i = 0; i < 6; i++) {
    const d = (f(a + h) - f(a - h)) / (2 * h);
    if (!isFinite(d)) throw mathErr();
    D.push([d]);
    for (let j = 1; j <= i; j++) D[i][j] = D[i][j - 1] + (D[i][j - 1] - D[i - 1][j - 1]) / (Math.pow(4, j) - 1);
    h /= 2;
  }
  const best = D[5][5];
  if (!isFinite(best)) throw mathErr();
  return Math.abs(best) < 1e-11 ? 0 : best;
}

const GK = {
  xk: [0.991455371120812639, 0.949107912342758525, 0.864864423359769073, 0.741531185599394440, 0.586087235467691130, 0.405845151377397167, 0.207784955007898468, 0],
  wk: [0.022935322010529225, 0.063092092629978553, 0.104790010322250184, 0.140653259715525919, 0.169004726639267903, 0.190350578064785410, 0.204432940075298892, 0.209482141084727828],
  wg: [0.129484966168869693, 0.279705391489276668, 0.381830050505118945, 0.417959183673469388]
};

function gk15(f, a, b) {
  const c = (a + b) / 2, h = (b - a) / 2;
  const fc = f(c);
  let k = fc * GK.wk[7], g = fc * GK.wg[3];
  for (let j = 0; j < 7; j++) {
    const dx = h * GK.xk[j];
    const f1 = f(c - dx), f2 = f(c + dx);
    k += GK.wk[j] * (f1 + f2);
    if (j % 2 === 1) g += GK.wg[(j - 1) / 2] * (f1 + f2);
  }
  return [k * h, Math.abs((k - g) * h)];
}

export function integrate(f, a, b) {
  if (a === b) return 0;
  let calls = 0;
  const rec = (lo, hi, tol, depth) => {
    calls++;
    if (calls > 4000) throw new CalcError('Time Out');
    const [v, err] = gk15(f, lo, hi);
    if (!isFinite(v)) throw mathErr();
    if (err <= Math.max(tol, 1e-14 * Math.abs(v)) || depth > 40) return v;
    const m = (lo + hi) / 2;
    return rec(lo, m, tol / 2, depth + 1) + rec(m, hi, tol / 2, depth + 1);
  };
  const v = rec(a, b, 1e-11, 0);
  return Math.abs(v) < 1e-12 ? 0 : v;
}

export class Engine {
  constructor(store) { this.store = store; }
  get settings() { return this.store.settings; }
  vars() { return this.store.vars; }

  angleIn(v) { return mul(v, ANGLE[this.settings.angle]); }
  angleOut(v) { return isNum(v) ? v / ANGLE[this.settings.angle] : div(v, ANGLE[this.settings.angle]); }

  trig(name, x) {
    if (isNum(x)) {
      const r = x * ANGLE[this.settings.angle];
      if (name === 'tan') {
        const c = Math.cos(r);
        if (Math.abs(c) < 1e-15) throw mathErr();
      }
      if (this.settings.angle !== 'rad') {
        const unit = this.settings.angle === 'deg' ? 90 : 100;
        const q = x / unit;
        if (Math.abs(q - Math.round(q)) < 1e-13) {
          const k = ((Math.round(q) % 4) + 4) % 4;
          const s = [0, 1, 0, -1][k], c = [1, 0, -1, 0][k];
          if (name === 'sin') return s;
          if (name === 'cos') return c;
          if (c === 0) throw mathErr();
          return s / c;
        }
      }
      const v = Math[name](r);
      return Math.abs(v) < 1e-15 ? 0 : v;
    }
    return clean(M[name](this.angleIn(x)));
  }

  call(name, args, scope) {
    const a = args;
    const need = n => { if (a.length !== n) throw new CalcError('Syntax ERROR'); };
    switch (name) {
      case 'sin': case 'cos': case 'tan': need(1); return this.trig(name, a[0]);
      case 'asin': case 'acos': {
        need(1);
        if (isNum(a[0]) && Math.abs(a[0]) <= 1) return Math[name](a[0]) / ANGLE[this.settings.angle];
        if (isNum(a[0])) throw mathErr();
        return this.angleOut(clean(M[name](a[0])));
      }
      case 'atan': need(1); return isNum(a[0]) ? Math.atan(a[0]) / ANGLE[this.settings.angle] : this.angleOut(clean(M.atan(a[0])));
      case 'sinh': case 'cosh': case 'tanh': case 'asinh': need(1); return isNum(a[0]) ? Math[name](a[0]) : clean(M[name](a[0]));
      case 'acosh': need(1); if (isNum(a[0]) && a[0] < 1) throw mathErr(); return Math.acosh(realOnly(a[0]));
      case 'atanh': need(1); if (isNum(a[0]) && Math.abs(a[0]) >= 1) throw mathErr(); return Math.atanh(realOnly(a[0]));
      case 'ln': need(1);
        if (isNum(a[0])) { if (a[0] === 0) throw mathErr(); if (a[0] > 0) return Math.log(a[0]); return clean(M.log(M.complex(a[0], 0))); }
        return clean(M.log(a[0]));
      case 'log': {
        if (a.length === 1) {
          if (isNum(a[0])) { if (a[0] <= 0) { if (a[0] === 0) throw mathErr(); return clean(M.log10(M.complex(a[0], 0))); } const v = Math.log10(a[0]); return Math.abs(v - Math.round(v)) < 1e-14 ? Math.round(v) : v; }
          return clean(M.log10(a[0]));
        }
        need(2);
        const [x, b] = a;
        if (isNum(x) && isNum(b)) {
          if (x <= 0 || b <= 0 || b === 1) throw mathErr();
          const v = Math.log(x) / Math.log(b);
          return Math.abs(v - Math.round(v)) < 1e-13 ? Math.round(v) : v;
        }
        return clean(M.divide(M.log(x), M.log(b)));
      }
      case 'exp': need(1); return isNum(a[0]) ? Math.exp(a[0]) : clean(M.exp(a[0]));
      case 'sqrt': need(1);
        if (isNum(a[0])) return a[0] >= 0 ? Math.sqrt(a[0]) : M.complex(0, Math.sqrt(-a[0]));
        return clean(M.sqrt(a[0]));
      case 'cbrt': need(1); return Math.cbrt(realOnly(a[0]));
      case 'nthroot': {
        need(2);
        const [x, n] = a;
        if (isNum(x) && isNum(n)) {
          if (n === 0) throw mathErr();
          if (x < 0) {
            if (Number.isInteger(n) && Math.abs(n) % 2 === 1) return -Math.pow(-x, 1 / n);
            return clean(M.pow(M.complex(x, 0), 1 / n));
          }
          return Math.pow(x, 1 / n);
        }
        return clean(M.pow(x, div(1, n)));
      }
      case 'abs': need(1); return isNum(a[0]) ? Math.abs(a[0]) : (isMat(a[0]) ? M.norm(a[0]) : M.abs(a[0]));
      case 'fact': need(1); return factorial(a[0]);
      case 'ncr': {
        need(2);
        const n = asInt(a[0]), r = asInt(a[1]);
        if (n < 0 || r < 0 || r > n || n >= 1e10) throw mathErr();
        let v = 1;
        for (let i = 1; i <= Math.min(r, n - r); i++) v = v * (n - Math.min(r, n - r) + i) / i;
        return Math.round(v);
      }
      case 'npr': {
        need(2);
        const n = asInt(a[0]), r = asInt(a[1]);
        if (n < 0 || r < 0 || r > n || n >= 1e10) throw mathErr();
        let v = 1;
        for (let i = 0; i < r; i++) v *= (n - i);
        return v;
      }
      case 'int': need(1); return Math.trunc(realOnly(a[0]));
      case 'intg': need(1); return Math.floor(realOnly(a[0]));
      case 'rnd': need(1); return rnd(a[0], this.settings);
      case 'gcd': if (a.length < 2) throw new CalcError('Syntax ERROR'); return a.map(asInt).reduce(gcd2);
      case 'lcm': if (a.length < 2) throw new CalcError('Syntax ERROR'); return a.map(asInt).reduce((x, y) => Math.abs(x * y) / gcd2(x, y));
      case 'ran': return Math.round(Math.random() * 1000) / 1000;
      case 'ranint': {
        need(2);
        const lo = asInt(a[0]), hi = asInt(a[1]);
        if (lo > hi) throw mathErr();
        return lo + Math.floor(Math.random() * (hi - lo + 1));
      }
      case 'pol': {
        need(2);
        const x = realOnly(a[0]), y = realOnly(a[1]);
        if (x === 0 && y === 0) throw mathErr();
        const r = Math.hypot(x, y), t = Math.atan2(y, x) / ANGLE[this.settings.angle];
        scope.r = r; scope.θ = t;
        return { pair: true, labels: ['r', 'θ'], values: [r, t] };
      }
      case 'rec': {
        need(2);
        const r = realOnly(a[0]), t = realOnly(a[1]) * ANGLE[this.settings.angle];
        const x = r * Math.cos(t), y = r * Math.sin(t);
        const cx = Math.abs(x) < 1e-14 * r ? 0 : x, cy = Math.abs(y) < 1e-14 * r ? 0 : y;
        return { pair: true, labels: ['x', 'y'], values: [cx, cy] };
      }
      case 'arg': need(1); return this.angleOut(isNum(a[0]) ? (a[0] < 0 ? Math.PI : 0) : Math.atan2(a[0].im, a[0].re));
      case 'conj': need(1); return isNum(a[0]) ? a[0] : M.conj(a[0]);
      case 're': need(1); return isNum(a[0]) ? a[0] : a[0].re;
      case 'im': need(1); return isNum(a[0]) ? 0 : a[0].im;
      case 'det': need(1); return M.det(a[0]);
      default: throw new CalcError('Syntax ERROR');
    }
  }

  ev(node, scope) {
    switch (node.k) {
      case 'num': return node.v;
      case 'const': return node.n === 'pi' ? Math.PI : node.n === 'e' ? Math.E : M.complex(0, 1);
      case 'var': {
        if (node.n in scope) return scope[node.n];
        const vars = this.vars();
        if (node.n in vars) return vars[node.n];
        return 0;
      }
      case 'neg': { const v = this.ev(node.a, scope); return isNum(v) ? -v : clean(M.unaryMinus(v)); }
      case 'bin': {
        const a = this.ev(node.a, scope), b = this.ev(node.b, scope);
        switch (node.op) {
          case '+': return add(a, b);
          case '-': return sub(a, b);
          case '*': return mul(a, b);
          case '/': return div(a, b);
        }
        break;
      }
      case 'pow': return pow(this.ev(node.a, scope), this.ev(node.b, scope));
      case 'deg': {
        const v = this.ev(node.a, scope);
        return isNum(v) ? v * (Math.PI / 180) / ANGLE[this.settings.angle] : v;
      }
      case 'angleIn': {
        const v = this.ev(node.a, scope);
        return isNum(v) ? v * ANGLE[node.unit] / ANGLE[this.settings.angle] : v;
      }
      case 'fn': return this.call(node.n, node.args.map(x => this.ev(x, scope)), scope);
      case 'tuple': return node.items.map(x => this.ev(x, scope));
      case 'deriv': {
        const at = realOnly(this.ev(node.at, scope));
        const f = x => realOnly(this.ev(node.body, { ...scope, [node.v]: x }));
        return derivativeAt(f, at);
      }
      case 'integral': {
        const lo = realOnly(this.ev(node.lo, scope)), hi = realOnly(this.ev(node.hi, scope));
        const f = x => realOnly(this.ev(node.body, { ...scope, [node.v]: x }));
        return integrate(f, lo, hi);
      }
      case 'sum': case 'prod': {
        const lo = asInt(this.ev(node.lo, scope)), hi = asInt(this.ev(node.hi, scope));
        if (hi < lo) throw mathErr();
        if (hi - lo > 1e6) throw new CalcError('Time Out');
        let acc = node.k === 'sum' ? 0 : 1;
        for (let i = lo; i <= hi; i++) {
          const v = this.ev(node.body, { ...scope, [node.v]: i });
          acc = node.k === 'sum' ? add(acc, v) : mul(acc, v);
        }
        return acc;
      }
      case 'eq': throw new CalcError('Syntax ERROR');
    }
    throw new CalcError('Syntax ERROR');
  }

  evaluate(latex, scope = {}) {
    const ast = parseLatex(latex);
    let v = this.ev(ast, scope);
    v = clean(v);
    const flags = exprFlags(ast, this.settings.angle);
    this.check(v, flags.complex);
    return { ast, value: v, flags };
  }

  check(v, allowComplex) {
    if (isNum(v)) { if (!isFinite(v) || Math.abs(v) >= 1e100) throw mathErr(); return; }
    if (isCx(v)) {
      if (!isFinite(v.re) || !isFinite(v.im)) throw mathErr();
      if (this.settings.complex === 'off' && !allowComplex) throw new CalcError('Non-Real ERROR');
    }
  }

  fnOf(ast, v = 'x') {
    return x => {
      try {
        const r = clean(this.ev(ast, { [v]: x }));
        return isNum(r) && isFinite(r) ? r : NaN;
      } catch (e) { return NaN; }
    };
  }
}
