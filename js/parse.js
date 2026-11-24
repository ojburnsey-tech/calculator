export class CalcError extends Error {
  constructor(kind) { super(kind); this.kind = kind; }
}
const syntax = () => new CalcError('Syntax ERROR');

const TRIG = { sin: 'sin', cos: 'cos', tan: 'tan', sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', arcsin: 'asin', arccos: 'acos', arctan: 'atan', ln: 'ln', log: 'log', exp: 'exp', arg: 'arg', Re: 're', Im: 'im', det: 'det' };
const INVERSE = { sin: 'asin', cos: 'acos', tan: 'atan', sinh: 'asinh', cosh: 'acosh', tanh: 'atanh' };
const NAMED = {
  Abs: 'abs', Int: 'int', Intg: 'intg', Rnd: 'rnd', GCD: 'gcd', LCM: 'lcm', RanInt: 'ranint', 'Ran#': 'ran',
  Pol: 'pol', Rec: 'rec', sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', arsinh: 'asinh', arcosh: 'acosh', artanh: 'atanh',
  sinh_inv: 'asinh', arg: 'arg', Arg: 'arg', Conjg: 'conj', ReP: 're', ImP: 'im', Re: 're', Im: 'im', exp: 'exp', ln: 'ln', log: 'log',
  Det: 'det', Trn: 'trn', Identity: 'ide', Ref: 'ref', Rref: 'rref', DotP: 'dotp', CrossP: 'crossp', Angle: 'vangle', UnitV: 'unitv', Dim: 'dim'
};
const VARS = new Set(['x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'M', 't', 'X', 'Y']);
const SPACING = new Set([',', ';', ':', ' ', '!', 'quad', 'qquad', 'thinspace', 'medspace', 'thickspace', 'enspace']);

function readTex(s) {
  let i = 0;
  const ws = () => { while (i < s.length && s[i] === ' ') i++; };
  const readCmd = () => {
    i++;
    if (/[a-zA-Z]/.test(s[i])) { const st = i; while (i < s.length && /[a-zA-Z]/.test(s[i])) i++; return s.slice(st, i); }
    return s[i++];
  };
  const readArg = () => {
    ws();
    if (s[i] === '{') { i++; const g = readSeq('}'); i++; return g; }
    return [readItem()];
  };
  const readOpt = () => {
    ws();
    if (s[i] === '[') { i++; const g = readSeq(']'); i++; return g; }
    return null;
  };
  const readItem = () => {
    ws();
    const c = s[i];
    if (c === '{') { i++; const g = readSeq('}'); i++; return { t: 'group', items: g }; }
    if (c === '^') { i++; return { t: 'sup', items: readArg() }; }
    if (c === '_') { i++; return { t: 'sub', items: readArg() }; }
    if (c === '\\') {
      const name = readCmd();
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') return { t: 'frac', num: readArg(), den: readArg() };
      if (name === 'sqrt') { const n = readOpt(); return { t: 'sqrt', n, body: readArg() }; }
      if (['mathrm', 'operatorname', 'text', 'mathit', 'mathbf', 'textrm', 'mathsf', 'textit', 'textbf'].includes(name)) return { t: 'name', text: flat(readArg()) };
      if (name === 'left' || name === 'right') {
        ws();
        let d;
        if (s[i] === '\\') d = readCmd(); else d = s[i++];
        if (d === 'vert' || d === 'lvert' || d === 'rvert') d = '|';
        if (d === 'lbrack') d = '['; if (d === 'rbrack') d = ']';
        return { t: name, d };
      }
      if (name === 'placeholder') { readOpt(); readArg(); return { t: 'ph' }; }
      if (/^(big|Big|bigg|Bigg)[lrm]?$/.test(name)) return { t: 'sizer' };
      if (name === 'vert' || name === 'mid') return { t: 'ch', c: '|' };
      if (SPACING.has(name)) return { t: 'space' };
      return { t: 'cmd', name };
    }
    i++;
    return { t: 'ch', c };
  };
  const readSeq = (end) => {
    const out = [];
    for (;;) {
      ws();
      if (i >= s.length || s[i] === end) break;
      const it = readItem();
      if (it.t !== 'space') out.push(it);
    }
    return out;
  };
  return readSeq(undefined);
}

function flat(items) {
  return items.map(it => it.t === 'ch' ? it.c : it.t === 'name' ? it.text : it.t === 'group' ? flat(it.items) : it.t === 'cmd' ? it.name : '').join('');
}

class Stream {
  constructor(items) { this.items = items; this.i = 0; }
  peek(o = 0) { return this.items[this.i + o]; }
  next() { return this.items[this.i++]; }
  done() { return this.i >= this.items.length; }
}

const isDigit = it => it && it.t === 'ch' && /[0-9.]/.test(it.c);
const isCh = (it, c) => it && it.t === 'ch' && it.c === c;
const isCmd = (it, ...n) => it && it.t === 'cmd' && n.includes(it.name);
const isName = (it, ...n) => it && it.t === 'name' && n.includes(it.text);

function startsPrimary(it) {
  if (!it) return false;
  switch (it.t) {
    case 'ch': return /[0-9.a-zA-Zπθ(]/.test(it.c);
    case 'group': case 'frac': case 'sqrt': case 'ph': return true;
    case 'left': return true;
    case 'name': return !['C', 'P', 'R', 'r', 'g'].includes(it.text);
    case 'cmd': return ['pi', 'exponentialE', 'imaginaryI', 'int', 'sum', 'prod', 'infty', 'theta'].includes(it.name) || it.name in TRIG || it.name in INVERSE;
    default: return false;
  }
}

function parseSeq(items) {
  const st = new Stream(items);
  const node = parseExpr(st, 0);
  if (!st.done()) throw syntax();
  return node;
}

function parseExpr(st, minPrec) {
  let left = parseUnary(st);
  for (;;) {
    const it = st.peek();
    if (!it) break;
    let op = null, prec = 0;
    if (isCh(it, '+') || isCh(it, '-')) { op = it.c; prec = 10; }
    else if (isCh(it, '*') || isCmd(it, 'times', 'cdot', 'ast')) { op = '*'; prec = 20; }
    else if (isCmd(it, 'div') && isName(st.peek(1), 'R')) { op = 'rem'; prec = 5; }
    else if (isCh(it, '/') || isCmd(it, 'div')) { op = '/'; prec = 20; }
    else if (isName(it, 'C', 'P')) { op = it.text; prec = 25; }
    else if (isCh(it, ',') || isCh(it, '=') || isCh(it, '<') || isCh(it, '>') || isCmd(it, 'le', 'ge', 'leq', 'geq', 'lt', 'gt', 'ne')) break;
    else if (startsPrimary(it)) { op = 'imp'; prec = 30; }
    else break;
    if (prec < minPrec) break;
    if (op === 'rem') st.next();
    if (op !== 'imp') st.next();
    const right = parseExpr(st, prec + 1);
    if (op === 'imp') left = { k: 'bin', op: '*', a: left, b: right, imp: true };
    else if (op === 'C') left = { k: 'fn', n: 'ncr', args: [left, right] };
    else if (op === 'P') left = { k: 'fn', n: 'npr', args: [left, right] };
    else if (op === 'rem') left = { k: 'fn', n: 'rem', args: [left, right] };
    else left = { k: 'bin', op, a: left, b: right };
  }
  return left;
}

function parseUnary(st) {
  const it = st.peek();
  if (isCh(it, '-') || isCh(it, '+') || isCh(it, '−')) {
    st.next();
    const a = parseExpr(st, 26);
    return it.c === '+' ? a : { k: 'neg', a };
  }
  return parsePostfix(st, parsePrimary(st));
}

function parsePostfix(st, node) {
  for (;;) {
    const it = st.peek();
    if (!it) break;
    if (it.t === 'sup') {
      st.next();
      if (it.items.length === 1 && isCmd(it.items[0], 'circ')) { node = { k: 'deg', a: node }; continue; }
      if (it.items.length === 1 && isCmd(it.items[0], 'prime')) { node = { k: 'dms', a: node, part: 'm' }; continue; }
      node = { k: 'pow', a: node, b: parseSeq(it.items) };
    } else if (isCh(it, '!')) { st.next(); node = { k: 'fn', n: 'fact', args: [node] }; }
    else if (isCmd(it, 'degree', 'circ')) { st.next(); node = { k: 'deg', a: node }; }
    else if (isCh(it, '%') || isCmd(it, '%')) { st.next(); node = { k: 'bin', op: '/', a: node, b: { k: 'num', v: 100 } }; }
    else if (isName(it, 'r')) { st.next(); node = { k: 'angleIn', a: node, unit: 'rad' }; }
    else if (isName(it, 'g')) { st.next(); node = { k: 'angleIn', a: node, unit: 'gra' }; }
    else break;
  }
  return node;
}

function collectBalanced(st, openTest, closeTest) {
  const out = [];
  let depth = 1;
  for (;;) {
    const it = st.next();
    if (!it) throw syntax();
    if (openTest(it)) depth++;
    else if (closeTest(it)) { depth--; if (depth === 0) break; }
    out.push(it);
  }
  return out;
}

function splitCommas(items) {
  const parts = [[]];
  let depth = 0;
  for (const it of items) {
    if (it.t === 'left' || isCh(it, '(')) depth++;
    if (it.t === 'right' || isCh(it, ')')) depth--;
    if (depth === 0 && isCh(it, ',')) { parts.push([]); continue; }
    parts[parts.length - 1].push(it);
  }
  return parts;
}

function readArgs(st) {
  const it = st.peek();
  if (it && it.t === 'left' && it.d === '(') {
    st.next();
    const inner = collectBalanced(st, x => x.t === 'left', x => x.t === 'right');
    return splitCommas(inner).map(p => { if (!p.length) throw syntax(); return parseSeq(p); });
  }
  if (isCh(it, '(')) {
    st.next();
    const inner = collectBalanced(st, x => isCh(x, '('), x => isCh(x, ')'));
    return splitCommas(inner).map(p => { if (!p.length) throw syntax(); return parseSeq(p); });
  }
  if (!it || !startsPrimary(it)) throw syntax();
  return [parsePostfixOperandNoPow(st)];
}

function parsePostfixOperandNoPow(st) {
  const p = parsePrimary(st);
  return parsePostfix(st, p);
}

function makeFn(st, name) {
  let inverse = false, power = null, base = null;
  for (;;) {
    const it = st.peek();
    if (it && it.t === 'sup') {
      const txt = flat(it.items).replace('−', '-');
      if (txt === '-1' && INVERSE[name]) { inverse = true; st.next(); continue; }
      st.next(); power = parseSeq(it.items); continue;
    }
    if (it && it.t === 'sub' && name === 'log') { st.next(); base = parseSeq(it.items); continue; }
    break;
  }
  let fname = inverse ? INVERSE[name] : (TRIG[name] || NAMED[name] || name);
  const args = fname === 'ran' ? [] : readArgs(st);
  if (fname === 'log' && base) args.push(base);
  let node = { k: 'fn', n: fname, args };
  if (power) node = { k: 'pow', a: node, b: power };
  return node;
}

function parseDerivative(st) {
  const body = readArgs(st);
  if (body.length !== 1) throw syntax();
  while (st.peek() && st.peek().t === 'sizer') st.next();
  if (isCh(st.peek(), '|')) st.next();
  const sub = st.next();
  if (!sub || sub.t !== 'sub') throw syntax();
  const eq = sub.items.findIndex(x => isCh(x, '='));
  if (eq < 0) throw syntax();
  const v = flat(sub.items.slice(0, eq));
  return { k: 'deriv', body: body[0], v: v || 'x', at: parseSeq(sub.items.slice(eq + 1)) };
}

function parseIntegral(st) {
  let lo = null, hi = null;
  for (let n = 0; n < 2; n++) {
    const it = st.peek();
    if (it && it.t === 'sub') { st.next(); lo = parseSeq(it.items); }
    else if (it && it.t === 'sup') { st.next(); hi = parseSeq(it.items); }
  }
  if (!lo || !hi) throw syntax();
  const body = [];
  let v = 'x';
  for (;;) {
    const it = st.next();
    if (!it) throw syntax();
    if (isName(it, 'd')) { const nx = st.next(); if (!nx) throw syntax(); v = nx.t === 'ch' ? nx.c : flat([nx]); break; }
    if (it.t === 'name' && /^d[a-zA-Z]$/.test(it.text)) { v = it.text[1]; break; }
    if (isCh(it, 'd') && st.peek() && st.peek().t === 'ch' && /[a-zA-Z]/.test(st.peek().c) && body.length && !startsPrimary(st.peek(1))) { v = st.next().c; break; }
    body.push(it);
  }
  if (!body.length) throw syntax();
  return { k: 'integral', body: parseSeq(body), v, lo, hi };
}

function parseSum(st, kind) {
  let lo = null, hi = null, v = 'x';
  for (let n = 0; n < 2; n++) {
    const it = st.peek();
    if (it && it.t === 'sub') {
      st.next();
      const eq = it.items.findIndex(x => isCh(x, '='));
      if (eq < 0) throw syntax();
      v = flat(it.items.slice(0, eq));
      lo = parseSeq(it.items.slice(eq + 1));
    } else if (it && it.t === 'sup') { st.next(); hi = parseSeq(it.items); }
  }
  if (!lo || !hi) throw syntax();
  const args = readArgs(st);
  if (args.length !== 1) throw syntax();
  return { k: kind, body: args[0], v, lo, hi };
}

function parsePrimary(st) {
  const it = st.next();
  if (!it) throw syntax();
  if (isDigit(it)) {
    let s = it.c;
    while (isDigit(st.peek())) s += st.next().c;
    if ((s.match(/\./g) || []).length > 1 || s === '.') throw syntax();
    return { k: 'num', v: parseFloat(s), lit: s };
  }
  if (it.t === 'ph') throw syntax();
  if (it.t === 'ch') {
    if (it.c === '(') {
      const inner = collectBalanced(st, x => isCh(x, '('), x => isCh(x, ')'));
      const parts = splitCommas(inner);
      if (parts.length > 1) return { k: 'tuple', items: parts.map(parseSeq) };
      if (!inner.length) throw syntax();
      return parseSeq(inner);
    }
    if (it.c === 'π') return { k: 'const', n: 'pi' };
    if (it.c === 'θ') return { k: 'var', n: 'θ' };
    if (it.c === '|') {
      const inner = [];
      for (;;) { const x = st.next(); if (!x) throw syntax(); if (isCh(x, '|')) break; inner.push(x); }
      return { k: 'fn', n: 'abs', args: [parseSeq(inner)] };
    }
    if (/[a-zA-Z]/.test(it.c)) {
      if ((it.c === 'a' || it.c === 'b') && st.peek() && st.peek().t === 'sub') {
        const sub = flat(st.next().items).replace(/\s/g, '');
        return { k: 'var', n: it.c + '_' + sub };
      }
      if (it.c === 'e') return { k: 'const', n: 'e' };
      if (it.c === 'i') return { k: 'const', n: 'i' };
      return { k: 'var', n: it.c };
    }
    throw syntax();
  }
  if (it.t === 'group') { if (!it.items.length) throw syntax(); return parseSeq(it.items); }
  if (it.t === 'left') {
    const inner = collectBalanced(st, x => x.t === 'left', x => x.t === 'right');
    if (!inner.length) throw syntax();
    if (it.d === '|') return { k: 'fn', n: 'abs', args: [parseSeq(inner)] };
    if (it.d === '[') return parseMatrixLiteral(inner);
    const parts = splitCommas(inner);
    if (parts.length > 1) return { k: 'tuple', items: parts.map(parseSeq) };
    return parseSeq(inner);
  }
  if (it.t === 'frac') {
    const dNum = it.num.length === 1 && (isName(it.num[0], 'd') || isCh(it.num[0], 'd'));
    const dDen = flat(it.den).replace(/\s/g, '');
    if (dNum && /^d[a-zA-Z]$/.test(dDen)) return parseDerivative(st);
    if (!it.num.length || !it.den.length) throw syntax();
    return { k: 'bin', op: '/', a: parseSeq(it.num), b: parseSeq(it.den), frac: true };
  }
  if (it.t === 'sqrt') {
    if (!it.body.length) throw syntax();
    if (it.n && it.n.length) return { k: 'fn', n: 'nthroot', args: [parseSeq(it.body), parseSeq(it.n)] };
    return { k: 'fn', n: 'sqrt', args: [parseSeq(it.body)] };
  }
  if (it.t === 'name') {
    const t = it.text;
    if (t === 'Ans') return { k: 'var', n: 'Ans' };
    if (t === 'PreAns') return { k: 'var', n: 'PreAns' };
    if (t === 'e') return { k: 'const', n: 'e' };
    if (t === 'i') return { k: 'const', n: 'i' };
    if (t === 'd' && st.peek() && st.peek().t === 'ch') return { k: 'var', n: 'd' + st.next().c };
    if (t in NAMED || t in TRIG || t in INVERSE) return makeFn(st, t);
    if (/^Mat([A-F]|Ans)$/.test(t)) return { k: 'var', n: t };
    if (/^Vct([A-D]|Ans)$/.test(t)) return { k: 'var', n: t };
    if (t.length === 1 && /[a-zA-Z]/.test(t)) return { k: 'var', n: t };
    throw syntax();
  }
  if (it.t === 'cmd') {
    const n = it.name;
    if (n === 'pi') return { k: 'const', n: 'pi' };
    if (n === 'exponentialE') return { k: 'const', n: 'e' };
    if (n === 'imaginaryI') return { k: 'const', n: 'i' };
    if (n === 'theta') return { k: 'var', n: 'θ' };
    if (n === 'int') return parseIntegral(st);
    if (n === 'sum') return parseSum(st, 'sum');
    if (n === 'prod') return parseSum(st, 'prod');
    if (n in INVERSE || n in TRIG) return makeFn(st, n);
    throw syntax();
  }
  throw syntax();
}

function parseMatrixLiteral(inner) {
  const rows = splitCommas(inner).map(r => parseSeq(r));
  return { k: 'tuple', items: rows };
}

export function parseLatex(latex) {
  const src = (latex || '').replace(/\\displaystyle|\\textstyle/g, '').trim();
  if (!src) throw syntax();
  const items = readTex(src);
  const eqIdx = items.findIndex(x => isCh(x, '='));
  if (eqIdx >= 0) {
    if (items.slice(eqIdx + 1).some(x => isCh(x, '='))) throw syntax();
    return { k: 'eq', a: parseSeq(items.slice(0, eqIdx)), b: parseSeq(items.slice(eqIdx + 1)) };
  }
  return parseSeq(items);
}

export function exprFlags(node, angle) {
  const f = { root: false, pi: false, trans: false, decimal: false, numeric: false, complex: false };
  const walk = n => {
    if (!n || typeof n !== 'object') return;
    switch (n.k) {
      case 'num': if (n.lit && n.lit.includes('.')) f.decimal = true; break;
      case 'var': f.root = true; f.pi = true; break;
      case 'const': if (n.n === 'pi') f.pi = true; if (n.n === 'e') f.trans = true; if (n.n === 'i') f.complex = true; break;
      case 'pow': f.root = true; break;
      case 'deg': case 'angleIn': f.pi = true; break;
      case 'fn':
        if (['sqrt', 'nthroot'].includes(n.n)) f.root = true;
        if (['sin', 'cos', 'tan'].includes(n.n)) { f.root = true; if (angle === 'rad') f.trans = true; }
        if (['asin', 'acos', 'atan'].includes(n.n)) { if (angle === 'rad') f.pi = true; f.root = true; }
        if (['ln', 'log', 'exp', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh'].includes(n.n)) f.trans = true;
        if (['ran', 'ranint'].includes(n.n)) { f.trans = true; f.rand = n.n === 'ran'; }
        if (['pol', 'rec'].includes(n.n)) { f.root = true; f.pi = true; }
        if (n.n === 'arg') { f.pi = true; f.root = true; }
        break;
      case 'deriv': case 'integral': f.numeric = true; break;
    }
    for (const key of ['a', 'b', 'body', 'at', 'lo', 'hi']) if (n[key]) walk(n[key]);
    if (n.args) n.args.forEach(walk);
    if (n.items) n.items.forEach(walk);
  };
  walk(node);
  return f;
}

export function usesVar(node, name) {
  let found = false;
  const walk = n => {
    if (!n || typeof n !== 'object' || found) return;
    if (n.k === 'var' && n.n === name) { found = true; return; }
    if ((n.k === 'deriv' || n.k === 'integral' || n.k === 'sum' || n.k === 'prod') && n.v === name) {
      for (const key of ['lo', 'hi', 'at']) if (n[key]) walk(n[key]);
      return;
    }
    for (const key of ['a', 'b', 'body', 'at', 'lo', 'hi']) if (n[key]) walk(n[key]);
    if (n.args) n.args.forEach(walk);
    if (n.items) n.items.forEach(walk);
  };
  walk(node);
  return found;
}
