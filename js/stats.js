const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

export function lgamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z);
  z -= 1;
  let x = LANCZOS[0];
  for (let i = 1; i < 9; i++) x += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

export function erf(x) {
  const ax = Math.abs(x);
  if (ax < 3) {
    let sum = x, term = x, n = 0;
    const x2 = x * x;
    while (Math.abs(term) > 1e-17 * Math.abs(sum) && n < 200) {
      n++;
      term *= -x2 / n;
      sum += term / (2 * n + 1);
    }
    return 2 / Math.sqrt(Math.PI) * sum;
  }
  return x > 0 ? 1 - erfcCF(ax) : erfcCF(ax) - 1;
}

function erfcCF(x) {
  let f = 0;
  for (let n = 60; n >= 1; n--) f = (n / 2) / (x + f);
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / (x + f);
}

export function normCdf(z) {
  if (z < -8) return z < -38 ? 0 : 0.5 * erfcCF(-z / Math.SQRT2);
  if (z > 8) return z > 38 ? 1 : 1 - 0.5 * erfcCF(z / Math.SQRT2);
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function normPdf(x, mu = 0, s = 1) {
  const z = (x - mu) / s;
  return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI));
}

function betacf(a, b, x) {
  const FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}

export function ibeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
  return 1 - bt * betacf(b, a, 1 - x) / b;
}

export function igamma(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 1000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
  }
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}

export const tCdf = (t, df) => {
  const x = df / (df + t * t);
  const p = 0.5 * ibeta(x, df / 2, 0.5);
  return t > 0 ? 1 - p : p;
};
export const tPdf = (t, df) => Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2)) / Math.sqrt(df * Math.PI) * Math.pow(1 + t * t / df, -(df + 1) / 2);
export const chiCdf = (x, df) => x <= 0 ? 0 : igamma(df / 2, x / 2);
export const chiPdf = (x, df) => x <= 0 ? 0 : Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - (df / 2) * Math.log(2) - lgamma(df / 2));
export const fCdf = (x, d1, d2) => x <= 0 ? 0 : ibeta(d1 * x / (d1 * x + d2), d1 / 2, d2 / 2);
export const fPdf = (x, d1, d2) => x <= 0 ? 0 : Math.exp(0.5 * (d1 * Math.log(d1 * x) + d2 * Math.log(d2) - (d1 + d2) * Math.log(d1 * x + d2)) - Math.log(x) - (lgamma(d1 / 2) + lgamma(d2 / 2) - lgamma((d1 + d2) / 2)));

export function invert(cdf, p, lo, hi) {
  let a = lo, b = hi;
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2;
    if (cdf(m) < p) a = m; else b = m;
    if (b - a < 1e-13 * Math.max(1, Math.abs(m))) break;
  }
  return (a + b) / 2;
}

export function invNorm(p) {
  if (p <= 0 || p >= 1) return NaN;
  return invert(normCdf, p, -40, 40);
}

const logC = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
export const binomPd = (x, n, p) => {
  if (x < 0 || x > n || !Number.isInteger(x)) return 0;
  if (p === 0) return x === 0 ? 1 : 0;
  if (p === 1) return x === n ? 1 : 0;
  return Math.exp(logC(n, x) + x * Math.log(p) + (n - x) * Math.log(1 - p));
};
export const binomCd = (lo, hi, n, p) => { let s = 0; for (let x = Math.max(0, Math.ceil(lo)); x <= Math.min(n, Math.floor(hi)); x++) s += binomPd(x, n, p); return Math.min(1, s); };
export const poissonPd = (x, l) => (x < 0 || !Number.isInteger(x)) ? 0 : Math.exp(-l + x * Math.log(l) - lgamma(x + 1));
export const poissonCd = (lo, hi, l) => { let s = 0; const top = Math.min(Math.floor(hi), Math.ceil(l + 40 * Math.sqrt(l) + 100)); for (let x = Math.max(0, Math.ceil(lo)); x <= top; x++) s += poissonPd(x, l); return Math.min(1, s); };
export const geoPd = (x, p) => (x < 1 || !Number.isInteger(x)) ? 0 : Math.pow(1 - p, x - 1) * p;
export const geoCd = (lo, hi, p) => {
  const L = Math.max(1, Math.ceil(lo));
  const H = Math.floor(hi);
  if (H < L) return 0;
  return Math.pow(1 - p, L - 1) - (H >= 1e9 ? 0 : Math.pow(1 - p, H));
};
export const hyperPd = (x, n, M, N) => {
  if (!Number.isInteger(x) || x < Math.max(0, n - (N - M)) || x > Math.min(n, M)) return 0;
  return Math.exp(logC(M, x) + logC(N - M, n - x) - logC(N, n));
};
export const hyperCd = (lo, hi, n, M, N) => { let s = 0; for (let x = Math.max(0, Math.ceil(lo)); x <= Math.min(n, Math.floor(hi)); x++) s += hyperPd(x, n, M, N); return Math.min(1, s); };

export function invDiscrete(cdfUpTo, area, maxX) {
  for (let x = 0; x <= maxX; x++) if (cdfUpTo(x) >= area - 1e-10) return x;
  return NaN;
}

export function expand(xs, fs) {
  const out = [];
  for (let i = 0; i < xs.length; i++) {
    const f = fs ? fs[i] : 1;
    if (f == null || isNaN(f)) continue;
    if (f < 0) throw new Error('Freq');
    for (let k = 0; k < Math.round(f); k++) out.push(xs[i]);
  }
  return out;
}

function median(sorted) {
  const n = sorted.length;
  if (!n) return NaN;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

export function oneVar(xs, fs) {
  const pairs = xs.map((x, i) => [x, fs ? fs[i] : 1]).filter(([x, f]) => !isNaN(x) && f != null && !isNaN(f) && f > 0);
  const n = pairs.reduce((s, p) => s + p[1], 0);
  if (!n) return null;
  const sx = pairs.reduce((s, [x, f]) => s + x * f, 0);
  const sx2 = pairs.reduce((s, [x, f]) => s + x * x * f, 0);
  const mean = sx / n;
  const ss = pairs.reduce((s, [x, f]) => s + f * (x - mean) * (x - mean), 0);
  const sorted = expand(pairs.map(p => p[0]), pairs.map(p => p[1])).sort((a, b) => a - b);
  const m = sorted.length;
  const lower = sorted.slice(0, Math.floor(m / 2));
  const upper = sorted.slice(Math.ceil(m / 2));
  const counts = new Map();
  for (const [x, f] of pairs) counts.set(x, (counts.get(x) || 0) + f);
  const maxF = Math.max(...counts.values());
  const modes = [...counts.entries()].filter(([, f]) => f === maxF).map(([x]) => x).sort((a, b) => a - b);
  return {
    mean, sum: sx, sum2: sx2, sd: Math.sqrt(ss / n), ssd: n > 1 ? Math.sqrt(ss / (n - 1)) : NaN, n,
    min: sorted[0], q1: m > 1 ? median(lower) : NaN, med: median(sorted), q3: m > 1 ? median(upper) : NaN, max: sorted[m - 1],
    modes, modeF: maxF
  };
}

export function twoVar(xs, ys, fs) {
  const pts = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const f = fs ? fs[i] : 1;
    if (isNaN(xs[i]) || isNaN(ys[i]) || f == null || isNaN(f) || f <= 0) continue;
    pts.push([xs[i], ys[i], f]);
  }
  const n = pts.reduce((s, p) => s + p[2], 0);
  if (!n) return null;
  const S = k => pts.reduce((s, p) => s + k(p) * p[2], 0);
  const sx = S(p => p[0]), sy = S(p => p[1]), sx2 = S(p => p[0] * p[0]), sy2 = S(p => p[1] * p[1]), sxy = S(p => p[0] * p[1]);
  const mx = sx / n, my = sy / n;
  const vx = sx2 / n - mx * mx, vy = sy2 / n - my * my;
  return {
    pts, n, sx, sy, sx2, sy2, sxy, mx, my,
    sdx: Math.sqrt(Math.max(0, vx)), sdy: Math.sqrt(Math.max(0, vy)),
    ssdx: n > 1 ? Math.sqrt(Math.max(0, vx * n / (n - 1))) : NaN, ssdy: n > 1 ? Math.sqrt(Math.max(0, vy * n / (n - 1))) : NaN,
    sx3: S(p => p[0] ** 3), sx4: S(p => p[0] ** 4), sx2y: S(p => p[0] * p[0] * p[1]),
    minX: Math.min(...pts.map(p => p[0])), maxX: Math.max(...pts.map(p => p[0])), minY: Math.min(...pts.map(p => p[1])), maxY: Math.max(...pts.map(p => p[1]))
  };
}

function linFit(pts) {
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [x, y, f] of pts) { n += f; sx += f * x; sy += f * y; sxx += f * x * x; syy += f * y * y; sxy += f * x * y; }
  const Sxx = sxx - sx * sx / n, Syy = syy - sy * sy / n, Sxy = sxy - sx * sy / n;
  if (Sxx === 0) return null;
  const b = Sxy / Sxx, a = (sy - b * sx) / n;
  const r = Syy === 0 ? NaN : Sxy / Math.sqrt(Sxx * Syy);
  return { slope: b, icept: a, r };
}

function polyFit(pts, deg) {
  const M = window.math;
  const A = [], B = [];
  for (let i = 0; i <= deg; i++) {
    A.push([]);
    for (let j = 0; j <= deg; j++) A[i].push(pts.reduce((s, [x, , f]) => s + f * x ** (i + j), 0));
    B.push(pts.reduce((s, [x, y, f]) => s + f * y * x ** i, 0));
  }
  const sol = M.lusolve(A, B).map(r => r[0]);
  return sol;
}

export const REG_TYPES = {
  lin: { name: 'Linear', form: 'y=ax+b' },
  quad: { name: 'Quadratic', form: 'y=ax^2+bx+c' },
  cubic: { name: 'Cubic', form: 'y=ax^3+bx^2+cx+d' },
  quart: { name: 'Quartic', form: 'y=ax^4+bx^3+cx^2+dx+e' },
  log: { name: 'Logarithmic', form: 'y=a+b\\ln x' },
  exp: { name: 'Exponential', form: 'y=a\\mathrm{e}^{bx}' },
  abx: { name: 'ab^x', form: 'y=ab^{x}' },
  pow: { name: 'Power', form: 'y=ax^{b}' }
};

export function regress(type, pts) {
  const fail = () => { throw new Error('Math ERROR'); };
  if (pts.length < 2) fail();
  if (type === 'lin') {
    const L = linFit(pts); if (!L) fail();
    return { coef: { a: L.slope, b: L.icept }, r: L.r, r2: L.r * L.r, f: x => L.slope * x + L.icept };
  }
  if (type === 'quad' || type === 'cubic' || type === 'quart') {
    const deg = { quad: 2, cubic: 3, quart: 4 }[type];
    if (pts.length < deg + 1) fail();
    const c = polyFit(pts, deg);
    const f = x => c.reduce((s, k, i) => s + k * x ** i, 0);
    const n = pts.reduce((s, p) => s + p[2], 0);
    const my = pts.reduce((s, p) => s + p[1] * p[2], 0) / n;
    const sse = pts.reduce((s, [x, y, w]) => s + w * (y - f(x)) ** 2, 0);
    const sst = pts.reduce((s, [, y, w]) => s + w * (y - my) ** 2, 0);
    const names = 'abcde';
    const coef = {};
    for (let i = 0; i <= deg; i++) coef[names[i]] = c[deg - i];
    return { coef, r2: sst ? 1 - sse / sst : NaN, f };
  }
  if (type === 'log') {
    if (pts.some(p => p[0] <= 0)) fail();
    const L = linFit(pts.map(([x, y, w]) => [Math.log(x), y, w])); if (!L) fail();
    return { coef: { a: L.icept, b: L.slope }, r: L.r, r2: L.r * L.r, f: x => L.icept + L.slope * Math.log(x) };
  }
  if (type === 'exp' || type === 'abx') {
    if (pts.some(p => p[1] <= 0)) fail();
    const L = linFit(pts.map(([x, y, w]) => [x, Math.log(y), w])); if (!L) fail();
    const a = Math.exp(L.icept);
    if (type === 'exp') return { coef: { a, b: L.slope }, r: L.r, r2: L.r * L.r, f: x => a * Math.exp(L.slope * x) };
    const b = Math.exp(L.slope);
    return { coef: { a, b }, r: L.r, r2: L.r * L.r, f: x => a * b ** x };
  }
  if (type === 'pow') {
    if (pts.some(p => p[0] <= 0 || p[1] <= 0)) fail();
    const L = linFit(pts.map(([x, y, w]) => [Math.log(x), Math.log(y), w])); if (!L) fail();
    const a = Math.exp(L.icept);
    return { coef: { a, b: L.slope }, r: L.r, r2: L.r * L.r, f: x => a * x ** L.slope };
  }
  fail();
}
