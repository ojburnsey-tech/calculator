import { fmt } from '../plot.js';

const COLS = 26, ROWS = 99;
const colName = c => String.fromCharCode(65 + c);
const key = (c, r) => colName(c) + (r + 1);
const FN = ['sum', 'mean', 'min', 'max', 'median', 'prod', 'count', 'abs', 'sqrt', 'round', 'floor', 'ceil', 'log', 'ln', 'exp', 'sin', 'cos', 'tan', 'if'];

class SheetErr extends Error {}

export function shiftFormula(src, dr, dc) {
  return src.replace(/(\$?)([A-Z])(\$?)(\d+)/g, (m, ac, c, ar, r) => {
    const nc = ac ? c : String.fromCharCode(c.charCodeAt(0) + dc);
    const nr = ar ? r : String(Number(r) + dr);
    return ac + nc + ar + nr;
  });
}

export const spreadsheetApp = {
  id: 'spreadsheet',
  title: 'Spreadsheet',
  mount(el, ctx) {
    this.ctx = ctx;
    this.el = el;
    if (!ctx.store.sheet) ctx.store.sheet = { cells: {}, sel: [0, 0] };
    this.st = ctx.store.sheet;
    ctx.showKeypad(false);
    const { h } = ctx;
    this.ref = h('div', { class: 'sh-ref' });
    this.input = h('input', { type: 'text', class: 'num-in sh-input', autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', placeholder: 'Value, or =formula like =A1*2 or =sum(A1:A5)', 'aria-label': 'Cell contents' });
    this.input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.commit(true); } });
    const ok = h('button', { type: 'button', class: 'primary sh-ok' }, '✓');
    ok.addEventListener('click', () => this.commit(true));
    const tools = h('div', { class: 'toolbar' },
      h('button', { type: 'button', onclick: () => this.fillDown() }, 'Fill down'),
      h('button', { type: 'button', onclick: () => this.sortCol(1) }, 'Sort ↑'),
      h('button', { type: 'button', onclick: () => this.sortCol(-1) }, 'Sort ↓'),
      h('button', { type: 'button', onclick: () => this.toList() }, 'Column → List'),
      h('button', { type: 'button', onclick: () => { delete this.st.cells[key(...this.st.sel)]; this.after(); } }, 'Clear cell'),
      h('button', { type: 'button', onclick: () => { if (confirmClear(this)) { this.st.cells = {}; this.after(); } } }, 'Clear all'));
    this.grid = h('div', { class: 'stable scroll sh-grid' });
    this.msg = h('div', { class: 'sg-info' });
    el.append(h('div', { class: 'col' }, h('div', { class: 'sh-bar' }, this.ref, this.input, ok), tools, this.grid, this.msg));
    this.build();
    this.select(...this.st.sel);
  },
  unmount() { this.ctx.save(); },
  build() {
    const { h } = this.ctx;
    const t = h('table', { class: 'grid-table xsheet' });
    const hr = h('tr', {}, h('th', { class: 'rn' }, ''));
    for (let c = 0; c < COLS; c++) hr.append(h('th', {}, colName(c)));
    t.append(h('thead', {}, hr));
    const body = h('tbody');
    this.tds = [];
    for (let r = 0; r < ROWS; r++) {
      const tr = h('tr', {}, h('td', { class: 'rn' }, String(r + 1)));
      const row = [];
      for (let c = 0; c < COLS; c++) {
        const td = h('td', {});
        td.addEventListener('click', () => { this.commit(false); this.select(c, r); });
        tr.append(td);
        row.push(td);
      }
      this.tds.push(row);
      body.append(tr);
    }
    t.append(body);
    this.grid.innerHTML = '';
    this.grid.append(t);
    this.recalc();
  },
  select(c, r) {
    const [pc, pr] = this.st.sel;
    if (this.tds[pr] && this.tds[pr][pc]) this.tds[pr][pc].classList.remove('sel');
    this.st.sel = [c, r];
    this.tds[r][c].classList.add('sel');
    this.ref.textContent = key(c, r);
    this.input.value = this.st.cells[key(c, r)] || '';
    const v = this.vals[key(c, r)];
    this.msg.textContent = this.st.cells[key(c, r)] && this.st.cells[key(c, r)].startsWith('=') ? key(c, r) + ' = ' + (v instanceof Error ? v.message : typeof v === 'number' ? fmt(v) : v) : 'Tap a cell, type, then press ✓. Formulas start with =.';
  },
  commit(move) {
    const [c, r] = this.st.sel;
    const k = key(c, r);
    const v = this.input.value.trim();
    const before = this.st.cells[k] || '';
    if (v) this.st.cells[k] = v; else delete this.st.cells[k];
    if (v !== before) this.after(false);
    if (move) this.select(c, Math.min(ROWS - 1, r + 1));
  },
  after(reselect = true) {
    this.ctx.save();
    this.recalc();
    if (reselect) this.select(...this.st.sel);
  },
  recalc() {
    const cells = this.st.cells;
    const vals = {};
    const M = window.math;
    const visiting = new Set();
    const get = k => {
      if (k in vals) { if (vals[k] instanceof Error) throw vals[k]; return vals[k]; }
      const raw = cells[k];
      if (raw === undefined || raw === '') return 0;
      if (visiting.has(k)) throw new SheetErr('Circular ERROR');
      visiting.add(k);
      let v;
      try {
        if (raw.startsWith('=')) v = evalFormula(raw.slice(1));
        else { const n = Number(raw.replace('−', '-')); v = Number.isFinite(n) ? n : raw; }
        vals[k] = v;
      } catch (e) {
        vals[k] = e instanceof SheetErr ? e : new SheetErr('ERROR');
        visiting.delete(k);
        throw vals[k];
      }
      visiting.delete(k);
      return v;
    };
    const num = v => { if (typeof v !== 'number') throw new SheetErr('ERROR'); return v; };
    const range = (c1, r1, c2, r2) => {
      const out = [];
      for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
        const k2 = key(c, r);
        if (cells[k2] === undefined) continue;
        const v = get(k2);
        if (typeof v === 'number') out.push(v);
      }
      return out;
    };
    const evalFormula = src => {
      let expr = src.replace(/\s+/g, '');
      expr = expr.replace(/\$?([A-Za-z])\$?(\d+):\$?([A-Za-z])\$?(\d+)/g, (m, a, b, c2, d) => `__rng(${a.toUpperCase().charCodeAt(0) - 65},${b - 1},${c2.toUpperCase().charCodeAt(0) - 65},${d - 1})`);
      expr = expr.replace(/\$?\b([A-Za-z])\$?(\d{1,2})\b/g, (m, a, b) => `__ref(${a.toUpperCase().charCodeAt(0) - 65},${b - 1})`);
      expr = expr.replace(/\b([a-zA-Z]+)\(/g, (m, f) => FN.includes(f.toLowerCase()) ? '__' + f.toLowerCase() + '(' : m);
      const flat = args => args.flat(Infinity);
      const scope = {
        __ref: (c, r) => { if (c < 0 || c >= COLS || r < 0 || r >= ROWS) throw new SheetErr('ERROR'); return num(get(key(c, r))); },
        __rng: range,
        __sum: (...a) => flat(a).reduce((s, v) => s + v, 0),
        __mean: (...a) => { const f = flat(a); if (!f.length) throw new SheetErr('ERROR'); return f.reduce((s, v) => s + v, 0) / f.length; },
        __min: (...a) => Math.min(...flat(a)), __max: (...a) => Math.max(...flat(a)),
        __median: (...a) => { const f = flat(a).sort((x, y) => x - y); if (!f.length) throw new SheetErr('ERROR'); const n = f.length; return n % 2 ? f[(n - 1) / 2] : (f[n / 2 - 1] + f[n / 2]) / 2; },
        __prod: (...a) => flat(a).reduce((s, v) => s * v, 1),
        __count: (...a) => flat(a).length,
        __abs: Math.abs, __sqrt: x => { if (x < 0) throw new SheetErr('ERROR'); return Math.sqrt(x); }, __round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d, __floor: Math.floor, __ceil: Math.ceil,
        __log: x => Math.log10(x), __ln: Math.log, __exp: Math.exp,
        __sin: x => Math.sin(x * Math.PI / 180), __cos: x => Math.cos(x * Math.PI / 180), __tan: x => Math.tan(x * Math.PI / 180),
        __if: (c, a, b) => (c ? a : b)
      };
      let v;
      try { v = M.evaluate(expr, scope); } catch (e) { if (e instanceof SheetErr) throw e; throw new SheetErr('Syntax ERROR'); }
      if (typeof v === 'boolean') v = v ? 1 : 0;
      if (v && v.isMatrix) v = v.toArray();
      if (typeof v !== 'number' || !isFinite(v)) throw new SheetErr('Math ERROR');
      return v;
    };
    for (const k of Object.keys(cells)) { try { get(k); } catch (e) {} }
    this.vals = vals;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const k = key(c, r), td = this.tds[r][c];
      const raw = cells[k];
      if (raw === undefined) { if (td.textContent) td.textContent = ''; td.className = td.classList.contains('sel') ? 'sel' : ''; continue; }
      const v = vals[k];
      td.textContent = v instanceof Error ? v.message.replace(' ERROR', '!') : typeof v === 'number' ? fmt(v) : String(v);
      td.classList.toggle('txt', typeof v === 'string');
      td.classList.toggle('bad', v instanceof Error);
      td.classList.toggle('fx', raw.startsWith('='));
    }
  },
  fillDown() {
    const { h } = this.ctx;
    const [c, r] = this.st.sel;
    const src = this.st.cells[key(c, r)];
    if (!src) { this.msg.textContent = 'Select a cell with something in it first.'; return; }
    const nf = this.ctx.numField(5, { label: 'Rows', noSign: true });
    const body = h('div', { class: 'settings' }, h('p', { class: 'note' }, 'Copies ' + key(c, r) + ' into the cells below it. Cell references move with each row; put $ before a column or row to keep it fixed, like $A$1.'), h('label', { class: 'vrow' }, h('span', {}, 'Number of rows'), nf.el),
      h('button', { type: 'button', class: 'primary wide', onclick: () => {
        const n = Math.max(1, Math.min(ROWS - 1 - r, Math.round(nf.get())));
        for (let k = 1; k <= n; k++) this.st.cells[key(c, r + k)] = src.startsWith('=') ? shiftFormula(src, k, 0) : src;
        this.ctx.closeSheet();
        this.after();
      } }, 'Fill'));
    this.ctx.openSheet('Fill down', body);
  },
  sortCol(dir) {
    const [c] = this.st.sel;
    const items = [];
    for (let r = 0; r < ROWS; r++) { const k = key(c, r); if (this.st.cells[k] !== undefined) items.push(this.st.cells[k]); }
    if (items.some(s => s.startsWith('='))) { this.msg.textContent = 'Sort works on columns of plain values only.'; return; }
    const nums = items.map(Number);
    if (nums.some(n => !Number.isFinite(n))) { this.msg.textContent = 'Sort works on numbers only.'; return; }
    nums.sort((a, b) => dir * (a - b));
    for (let r = 0; r < ROWS; r++) delete this.st.cells[key(c, r)];
    nums.forEach((v, r) => { this.st.cells[key(c, r)] = String(v); });
    this.after();
  },
  toList() {
    const { h, store, seg } = this.ctx;
    const [c] = this.st.sel;
    const vals = [];
    for (let r = 0; r < ROWS; r++) { const v = this.vals[key(c, r)]; if (typeof v === 'number') vals.push(v); }
    let target = 0;
    const body = h('div', { class: 'settings' }, h('p', { class: 'note' }, vals.length + ' numbers in column ' + colName(c) + ' will replace the list you pick in Statistics.'),
      seg([0, 1, 2, 3, 4, 5].map(i => [i, 'List ' + (i + 1)]), 0, v => { target = v; }),
      h('button', { type: 'button', class: 'primary wide', onclick: () => { store.lists[target] = vals; this.ctx.save(); this.ctx.closeSheet(); this.ctx.toast('Copied to List ' + (target + 1)); } }, 'Copy'));
    this.ctx.openSheet('Column ' + colName(c) + ' to list', body);
  }
};

function confirmClear(app) {
  if (app.armed) { app.armed = false; return true; }
  app.armed = true;
  app.msg.textContent = 'Tap Clear all again to clear every cell.';
  setTimeout(() => { app.armed = false; }, 3000);
  return false;
}
