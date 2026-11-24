const BASES = { dec: 10, hex: 16, bin: 2, oct: 8 };
const NAMES = { dec: 'Dec', hex: 'Hex', bin: 'Bin', oct: 'Oct' };
const PREFIX = { 10: 'd', 16: 'h', 2: 'b', 8: 'o' };
const OPS = { '+': 4, '-': 4, '×': 5, '÷': 5, and: 3, xor: 2, xnor: 2, or: 1 };

class BaseErr extends Error {}

function toInt32(v) {
  if (!Number.isFinite(v)) throw new BaseErr('Math ERROR');
  if (v >= 2147483648 && v <= 4294967295) v -= 4294967296;
  if (v < -2147483648 || v > 2147483647) throw new BaseErr('Math ERROR');
  return v;
}

function evalTokens(tokens, mode) {
  let i = 0;
  const peek = () => tokens[i];
  const primary = () => {
    const t = tokens[i++];
    if (!t) throw new BaseErr('Syntax ERROR');
    if (t.t === 'pre') {
      const n = tokens[i++];
      if (!n || n.t !== 'num') throw new BaseErr('Syntax ERROR');
      return parseNum(n.s, t.base);
    }
    if (t.t === 'num') return parseNum(t.s, BASES[mode]);
    if (t.t === 'ans') return t.v;
    if (t.t === 'lp') {
      const v = expr(0);
      if (!tokens[i] || tokens[i].t !== 'rp') { if (i >= tokens.length) return v; throw new BaseErr('Syntax ERROR'); }
      i++;
      return v;
    }
    if (t.t === 'un') {
      const v = unary();
      return t.v === 'Not' ? ~v : toInt32(-v);
    }
    throw new BaseErr('Syntax ERROR');
  };
  const unary = () => primary();
  const apply = (op, a, b) => {
    switch (op) {
      case '+': return toInt32(a + b);
      case '-': return toInt32(a - b);
      case '×': return toInt32(a * b);
      case '÷': if (b === 0) throw new BaseErr('Math ERROR'); return toInt32(Math.trunc(a / b));
      case 'and': return a & b;
      case 'or': return a | b;
      case 'xor': return a ^ b;
      case 'xnor': return ~(a ^ b);
    }
  };
  const expr = (min) => {
    let left = unary();
    for (;;) {
      const t = peek();
      if (!t || t.t !== 'op') break;
      const p = OPS[t.v];
      if (p < min) break;
      i++;
      left = apply(t.v, left, expr(p + 1));
    }
    return left;
  };
  if (!tokens.length) throw new BaseErr('Syntax ERROR');
  const v = expr(0);
  if (i !== tokens.length) throw new BaseErr('Syntax ERROR');
  return v;
}

function parseNum(s, base) {
  const valid = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^[0-9]+$/, 16: /^[0-9A-F]+$/ }[base];
  if (!valid.test(s)) throw new BaseErr('Syntax ERROR');
  const v = parseInt(s, base);
  if (base === 10) return toInt32(v);
  if (v > 4294967295) throw new BaseErr('Math ERROR');
  return toInt32(v);
}

export function fmtBase(v, mode) {
  if (mode === 'dec') return String(v);
  const u = v >>> 0;
  if (mode === 'hex') return u.toString(16).toUpperCase().padStart(8, '0');
  if (mode === 'oct') return u.toString(8).padStart(11, '0');
  return u.toString(2).padStart(32, '0').replace(/(.{4})(?=.)/g, '$1 ');
}

function tokenText(t) {
  switch (t.t) {
    case 'num': return t.s;
    case 'pre': return PREFIX[t.base];
    case 'op': return ['and', 'or', 'xor', 'xnor'].includes(t.v) ? ' ' + t.v + ' ' : t.v;
    case 'un': return t.v + '(';
    case 'lp': return '(';
    case 'rp': return ')';
    case 'ans': return 'Ans';
  }
  return '';
}

export const basenApp = {
  id: 'basen',
  title: 'Base-N',
  mount(el, ctx) {
    this.ctx = ctx;
    const { h, store } = ctx;
    if (!store.basen) store.basen = { mode: 'dec', ans: 0, hist: [] };
    this.st = store.basen;
    this.tokens = [];
    this.cursor = 0;
    ctx.showKeypad(false);
    this.modeSeg = h('div');
    this.hist = h('div', { class: 'hist scroll' });
    this.line = h('div', { class: 'bn-line', 'aria-live': 'polite' });
    this.err = h('div', { class: 'err' });
    this.pad = h('div', { class: 'bn-pad' });
    el.append(h('div', { class: 'calc bn' }, h('div', { class: 'eq-top' }, this.modeSeg), this.hist, h('div', { class: 'entry' }, this.line, this.err), this.pad));
    this.renderMode();
    this.renderPad();
    this.renderHist();
    this.renderLine();
  },
  unmount() { this.ctx.save(); },
  renderMode() {
    this.modeSeg.innerHTML = '';
    this.modeSeg.append(this.ctx.seg(Object.keys(BASES).map(k => [k, NAMES[k]]), this.st.mode, v => { this.st.mode = v; this.ctx.save(); this.renderPad(); this.renderHist(); }));
  },
  renderHist() {
    const { h } = this.ctx;
    this.hist.innerHTML = '';
    const items = this.st.hist.slice(-12);
    if (!items.length) this.hist.append(h('div', { class: 'hist-empty' }, 'Integers in 32-bit two’s complement. Type a calculation and press EXE.'));
    for (const it of items) {
      const out = h('div', { class: 'bn-out' });
      for (const m of ['dec', 'hex', 'bin', 'oct']) out.append(h('div', { class: 'bn-r' + (m === this.st.mode ? ' on' : '') }, h('span', {}, NAMES[m]), h('span', {}, fmtBase(it.v, m))));
      const row = h('button', { type: 'button', class: 'h-item' }, h('div', { class: 'h-in mono' }, it.text), out);
      row.addEventListener('click', () => { this.tokens = structuredClone(it.tokens); this.cursor = this.tokens.length; this.renderLine(); });
      this.hist.append(row);
    }
    requestAnimationFrame(() => { this.hist.scrollTop = this.hist.scrollHeight; });
  },
  renderLine() {
    const { h } = this.ctx;
    this.line.innerHTML = '';
    const before = this.tokens.slice(0, this.cursor).map(tokenText).join('');
    const after = this.tokens.slice(this.cursor).map(tokenText).join('');
    this.line.append(h('span', {}, before), h('span', { class: 'bn-caret' }), h('span', {}, after));
  },
  renderPad() {
    const { h } = this.ctx;
    const base = BASES[this.st.mode];
    const rows = [
      ['A', 'B', 'C', 'D', 'E', 'F'],
      ['and', 'or', 'xor', 'xnor', 'Not', 'Neg'],
      ['d', 'h', 'b', 'o', '(', ')'],
      ['7', '8', '9', 'DEL', 'AC'],
      ['4', '5', '6', '×', '÷'],
      ['1', '2', '3', '+', '−'],
      ['0', 'Ans', '◀', '▶', 'EXE']
    ];
    this.pad.innerHTML = '';
    rows.forEach((r, ri) => {
      const g = h('div', { class: 'grid ' + (r.length === 6 ? 'top' : 'bottom') });
      for (const k of r) {
        const digitVal = /^[0-9A-F]$/.test(k) ? parseInt(k, 16) : -1;
        const disabled = digitVal >= 0 && digitVal >= base;
        const cls = k === 'EXE' ? 'exe' : (k === 'DEL' || k === 'AC') ? k.toLowerCase() : ['+', '−', '×', '÷'].includes(k) ? 'op' : (ri < 3 ? 'tool' : '');
        const b = h('button', { type: 'button', class: 'key ' + cls + (disabled ? ' dim' : '') }, h('span', { class: 'ml' }, k));
        b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('down'); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, () => b.classList.remove('down')));
        b.addEventListener('click', () => this.key(k));
        g.append(b);
      }
      this.pad.append(g);
    });
  },
  insertTok(tok) {
    this.tokens.splice(this.cursor, 0, tok);
    this.cursor++;
  },
  key(k) {
    this.err.textContent = '';
    const prev = this.tokens[this.cursor - 1];
    if (/^[0-9A-F]$/.test(k)) {
      if (prev && prev.t === 'num') prev.s += k;
      else {
        if (!this.tokens.length && this.justDone) this.justDone = false;
        this.insertTok({ t: 'num', s: k });
      }
    } else if (['d', 'h', 'b', 'o'].includes(k)) this.insertTok({ t: 'pre', base: { d: 10, h: 16, b: 2, o: 8 }[k] });
    else if (['and', 'or', 'xor', 'xnor', '+', '×', '÷'].includes(k) || k === '−') {
      if (!this.tokens.length && this.justDone) this.insertTok({ t: 'ans', v: this.st.ans });
      this.insertTok({ t: 'op', v: k === '−' ? '-' : k });
    } else if (k === 'Not' || k === 'Neg') this.insertTok({ t: 'un', v: k }), this.insertTok({ t: 'lp' });
    else if (k === '(') this.insertTok({ t: 'lp' });
    else if (k === ')') this.insertTok({ t: 'rp' });
    else if (k === 'Ans') this.insertTok({ t: 'ans', v: this.st.ans });
    else if (k === 'DEL') {
      if (prev && prev.t === 'num' && prev.s.length > 1) prev.s = prev.s.slice(0, -1);
      else if (this.cursor > 0) { this.tokens.splice(this.cursor - 1, 1); this.cursor--; }
    } else if (k === 'AC') { this.tokens = []; this.cursor = 0; }
    else if (k === '◀') this.cursor = Math.max(0, this.cursor - 1);
    else if (k === '▶') this.cursor = Math.min(this.tokens.length, this.cursor + 1);
    else if (k === 'EXE') return this.exe();
    this.renderLine();
  },
  exe() {
    if (!this.tokens.length) return;
    try {
      const toks = this.tokens.slice();
      if (toks[toks.length - 1].t === 'op') throw new BaseErr('Syntax ERROR');
      const v = evalTokens(toks, this.st.mode);
      this.st.ans = v;
      this.st.hist.push({ text: this.tokens.map(tokenText).join(''), tokens: structuredClone(this.tokens), v });
      if (this.st.hist.length > 40) this.st.hist.shift();
      this.ctx.store.vars.Ans = v;
      this.ctx.save();
      this.tokens = [];
      this.cursor = 0;
      this.justDone = true;
      this.renderHist();
      this.renderLine();
    } catch (e) { this.err.textContent = e.message || 'Syntax ERROR'; }
  }
};
