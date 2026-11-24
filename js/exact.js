const M = window.math;

const SQFREE = (() => {
  const out = [];
  for (let n = 2; n <= 1000; n++) {
    let ok = true;
    for (let p = 2; p * p <= n; p++) if (n % (p * p) === 0) { ok = false; break; }
    if (ok) out.push(n);
  }
  return out;
})();

export function rational(x, maxDen = 1e6, tol = 1e-12) {
  if (!isFinite(x)) return null;
  if (Number.isInteger(x)) return [x, 1];
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = ax;
  for (let n = 0; n < 40; n++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0, k2 = a * k1 + k0;
    if (k2 > maxDen) return null;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(ax - h1 / k1) <= tol * Math.max(1, ax)) {
      if (h1 > 9.999999999e9) return null;
      return [sign * h1, k1];
    }
    const fr = b - a;
    if (fr < 1e-16) return null;
    b = 1 / fr;
  }
  return null;
}

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }

function fracLatex(p, q, mixed) {
  const neg = p < 0;
  p = Math.abs(p);
  if (q === 1) return (neg ? '-' : '') + p;
  if (mixed && p > q) {
    const w = Math.floor(p / q), r = p % q;
    return (neg ? '-' : '') + w + '\\frac{' + r + '}{' + q + '}';
  }
  return (neg ? '-' : '') + '\\frac{' + p + '}{' + q + '}';
}

function coefSurd(p, q, inner) {
  const neg = p < 0;
  p = Math.abs(p);
  const num = (p === 1 ? '' : p) + inner;
  return (neg ? '-' : '') + (q === 1 ? num : '\\frac{' + num + '}{' + q + '}');
}

export function exactForm(x, flags, opts = {}) {
  if (!isFinite(x)) return null;
  if (Math.abs(x) >= 1e10) {
    if (Number.isInteger(x) && Math.abs(x) < 1e15) return null;
    return null;
  }
  if (flags.rand) return null;
  const mixed = opts.mixed;
  const maxDen = flags.trans || flags.numeric ? 1000 : 1e6;
  const tol = flags.trans || flags.numeric ? 1e-11 : 1e-12;
  const r = rational(x, maxDen, tol);
  if (r && (Math.abs(r[0]) < 1e10)) {
    if (r[1] === 1) return { latex: String(r[0]), kind: 'int', p: r[0], q: 1 };
    const digits = String(Math.abs(r[0])).length + String(r[1]).length;
    if (digits <= 10) return { latex: fracLatex(r[0], r[1], mixed), kind: 'frac', p: r[0], q: r[1] };
  }
  if (flags.numeric) return null;
  if (flags.root) {
    for (const n of SQFREE) {
      const c = rational(x / Math.sqrt(n), 1000, 1e-11);
      if (c && Math.abs(c[0]) < 10000) return { latex: coefSurd(c[0], c[1], '\\sqrt{' + n + '}'), kind: 'surd' };
    }
    for (let c = 1; c <= 60; c++) {
      const xc = x * c;
      for (const n of SQFREE) {
        if (n > 200) break;
        const s = Math.sqrt(n);
        for (let b = 1; b <= 60; b++) {
          for (const sb of [b, -b]) {
            const a = xc - sb * s;
            const ra = Math.round(a);
            if (ra === 0 || Math.abs(a - ra) > 1e-10 * Math.max(1, Math.abs(xc))) continue;
            if (gcd(gcd(ra, b), c) !== 1) continue;
            const bTerm = (b === 1 ? '' : b) + '\\sqrt{' + n + '}';
            const numer = ra + (sb > 0 ? '+' : '-') + bTerm;
            if (c === 1) return { latex: numer, kind: 'surd2' };
            if (ra < 0 && sb < 0) return { latex: '-\\frac{' + (-ra) + '+' + bTerm + '}{' + c + '}', kind: 'surd2' };
            return { latex: '\\frac{' + numer + '}{' + c + '}', kind: 'surd2' };
          }
        }
      }
    }
  }
  if (flags.pi) {
    const c = rational(x / Math.PI, 1000, 1e-11);
    if (c && Math.abs(c[0]) < 10000) return { latex: coefSurd(c[0], c[1], '\\pi'), kind: 'pi' };
  }
  return null;
}

export function decimalLatex(x, settings) {
  if (x === 0) return '0';
  const ax = Math.abs(x);
  const fmt = settings.format || 'norm1';
  const sciTex = (s) => {
    const [m, e] = s.split('e');
    let mm = m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m;
    if (fmt === 'sci') mm = m;
    return mm + '\\times10^{' + parseInt(e, 10) + '}';
  };
  if (fmt === 'fix') {
    if (ax >= 1e10) return sciTex(x.toExponential(9));
    return x.toFixed(settings.digits ?? 2);
  }
  if (fmt === 'sci') return sciTex(x.toExponential(Math.max(0, (settings.digits || 10) - 1)));
  const lo = fmt === 'norm2' ? 1e-9 : 1e-2;
  if (ax < lo || ax >= 1e10) return sciTex(x.toExponential(9));
  let s = x.toPrecision(10);
  if (s.includes('e')) return sciTex(Number(s).toExponential(9));
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

export function engLatex(x) {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)) / 3) * 3;
  let m = (x / Math.pow(10, e)).toPrecision(10);
  if (m.includes('.')) m = m.replace(/0+$/, '').replace(/\.$/, '');
  return m + '\\times10^{' + e + '}';
}

export function primeFactorLatex(x) {
  if (!Number.isInteger(x) || x < 2 || x > 9999999999) return null;
  let n = x;
  const parts = [];
  for (let p = 2; p * p <= n && p < 1000; p++) {
    let k = 0;
    while (n % p === 0) { n /= p; k++; }
    if (k) parts.push(k === 1 ? String(p) : p + '^{' + k + '}');
  }
  if (n > 1) {
    if (n > 1e6) parts.push('(' + n + ')');
    else parts.push(String(n));
  }
  return parts.join('\\times');
}

export function recurringLatex(p, q) {
  if (q === 1) return null;
  const neg = p < 0;
  p = Math.abs(p);
  const whole = Math.floor(p / q);
  let r = p % q;
  const seen = new Map();
  let digits = '';
  while (r !== 0 && !seen.has(r) && digits.length < 60) {
    seen.set(r, digits.length);
    r *= 10;
    digits += Math.floor(r / q);
    r %= q;
  }
  if (r === 0) return null;
  if (!seen.has(r)) return null;
  const start = seen.get(r);
  return (neg ? '-' : '') + whole + '.' + digits.slice(0, start) + '\\overline{' + digits.slice(start) + '}';
}

export function dmsLatex(x) {
  const neg = x < 0;
  let v = Math.abs(x);
  let d = Math.floor(v);
  let mFull = (v - d) * 60;
  let m = Math.floor(mFull + 1e-9);
  let s = (mFull - m) * 60;
  s = Math.round(s * 100) / 100;
  if (s >= 60) { s -= 60; m++; }
  if (m >= 60) { m -= 60; d++; }
  return (neg ? '-' : '') + d + '^{\\circ}' + m + '^{\\prime}' + String(s).replace(/\.0+$/, '') + '^{\\prime\\prime}';
}

export function realLatex(x, flags, settings, mode) {
  if (mode === 'decimal') return decimalLatex(x, settings);
  if (mode === 'eng') return engLatex(x);
  if (mode === 'dms') return dmsLatex(x);
  if (mode === 'prime') {
    const r = rational(x, 1e6, 1e-12);
    if (!r) return null;
    const neg = r[0] < 0 ? '-' : '';
    const num = Math.abs(r[0]) === 1 ? '1' : primeFactorLatex(Math.abs(r[0]));
    if (!num) return null;
    if (r[1] === 1) return neg + num;
    const den = primeFactorLatex(r[1]);
    return den ? neg + '\\frac{' + num + '}{' + den + '}' : null;
  }
  const ex = exactForm(x, flags, { mixed: mode === 'mixed' || (mode === 'standard' && settings.fraction === 'mixed') });
  if (mode === 'recurring') {
    const r = rational(x, 1e6, 1e-12);
    return r ? recurringLatex(r[0], r[1]) : null;
  }
  if (ex) return ex.latex;
  return decimalLatex(x, settings);
}

export function complexLatex(z, flags, settings, mode, angleFactor) {
  const asPolar = settings.complex === 'polar';
  if (asPolar) {
    const r = Math.hypot(z.re, z.im);
    const t = Math.atan2(z.im, z.re) / angleFactor;
    return realLatex(r, flags, settings, mode) + '\\angle ' + realLatex(t, { ...flags, pi: true }, settings, mode);
  }
  const re = z.re, im = z.im;
  let out = '';
  if (re !== 0) out += realLatex(re, flags, settings, mode);
  if (im !== 0) {
    let t = realLatex(Math.abs(im), flags, settings, mode);
    if (t === '1') t = '';
    out += (im < 0 ? '-' : (re !== 0 ? '+' : '')) + t + '\\mathrm{i}';
  }
  return out || '0';
}

export function matrixLatex(m, flags, settings, mode) {
  const arr = Array.isArray(m) ? m : m.toArray();
  const rows = Array.isArray(arr[0]) ? arr : [arr];
  const cell = v => typeof v === 'number' ? realLatex(v, flags, settings, mode) : complexLatex(v, flags, settings, mode, 1);
  return '\\begin{bmatrix}' + rows.map(r => r.map(cell).join('&')).join('\\\\') + '\\end{bmatrix}';
}

export function valueLatex(v, flags, settings, mode, angleFactor) {
  if (typeof v === 'number') {
    const out = realLatex(v, flags, settings, mode);
    return out ?? decimalLatex(v, settings);
  }
  if (v && v.pair) return v.labels.map((l, i) => l + '=' + realLatex(v.values[i], flags, settings, mode)).join(',\\;');
  if (v && v.isComplex) return complexLatex(v, flags, settings, mode, angleFactor);
  if (v && (v.isMatrix || Array.isArray(v))) return matrixLatex(v, flags, settings, mode);
  return String(v);
}

export function hasExactForm(v, flags) {
  if (typeof v !== 'number') return false;
  return !!exactForm(v, flags, {});
}
