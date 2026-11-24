import { CalcError } from '../parse.js';

function makeApp(cfg) {
  return {
    id: cfg.id,
    title: cfg.title,
    mount(el, ctx) {
      this.ctx = ctx;
      this.el = el;
      const bank = cfg.bankKey;
      if (!ctx.store[bank]) ctx.store[bank] = {};
      if (!ctx.store[cfg.histKey]) ctx.store[cfg.histKey] = [];
      this.showMain();
    },
    unmount() { this.ctx.save(); },
    bank() { return this.ctx.store[cfg.bankKey]; },
    dims(m) {
      if (!m) return '—';
      if (!Array.isArray(m[0])) return String(m.length) + 'D';
      return m.length + '×' + m[0].length;
    },
    showMain() {
      const { h, tex } = this.ctx;
      this.mode = 'main';
      this.ctx.showKeypad(true);
      this.ctx.setTitle(cfg.title);
      this.el.innerHTML = '';
      const chips = h('div', { class: 'mchips' });
      for (const n of cfg.names) {
        const b = h('button', { type: 'button', class: 'mchip' }, h('span', { class: 'mchip-n' }, n.replace(cfg.prefix, cfg.prefix === 'Mat' ? 'Mat ' : 'Vct ')), h('span', { class: 'mchip-d' }, this.dims(this.bank()[n])));
        b.addEventListener('click', () => this.showEdit(n));
        chips.append(b);
      }
      const ins = h('div', { class: 'toolbar ins' });
      const addIns = (label, latex, op) => {
        const b = h('button', { type: 'button' }, label);
        b.addEventListener('click', () => { if (op) this.beforeOperator(); this.ctx.insert(latex); });
        ins.append(b);
      };
      for (const n of [...cfg.names, cfg.prefix + 'Ans']) addIns(n, '\\mathrm{' + n + '}');
      for (const [label, latex, op] of cfg.fns) addIns(label, latex, op);
      this.hist = h('div', { class: 'hist scroll' });
      this.err = h('div', { class: 'err' });
      this.mf = this.ctx.makeField('', { class: 'calc-input', onInput: () => { this.err.textContent = ''; } });
      this.el.append(h('div', { class: 'calc' }, h('div', { class: 'mtop' }, h('div', { class: 'note' }, cfg.hint), chips), this.hist, h('div', { class: 'entry' }, ins, this.mf, this.err)));
      this.render();
      this.ctx.focusField(this.mf);
    },
    render() {
      const { h, tex, store } = this.ctx;
      this.hist.innerHTML = '';
      const items = store[cfg.histKey].slice(-20);
      if (!items.length) this.hist.append(h('div', { class: 'hist-empty' }, cfg.empty));
      for (const it of items) {
        const row = h('button', { type: 'button', class: 'h-item' }, h('div', { class: 'h-in', html: tex(it.latex) }), h('div', { class: 'h-out', html: tex(it.out) }));
        row.addEventListener('click', () => { this.mf.value = it.latex; this.ctx.focusField(this.mf); this.mf.executeCommand('moveToMathfieldEnd'); });
        this.hist.append(row);
      }
      requestAnimationFrame(() => { this.hist.scrollTop = this.hist.scrollHeight; });
    },
    beforeOperator() {
      if (this.mode === 'main' && this.ctx.field === this.mf && !this.mf.value.trim() && this.ctx.store[cfg.histKey].length) {
        const last = this.ctx.store[cfg.histKey].slice(-1)[0];
        this.ctx.insert(last.isArr ? '\\mathrm{' + cfg.prefix + 'Ans}' : '\\mathrm{Ans}');
      }
    },
    onExe() {
      if (this.mode === 'edit') {
        const i = this.cells.indexOf(this.ctx.field);
        if (i >= 0 && i < this.cells.length - 1) this.ctx.focusField(this.cells[i + 1]);
        else this.saveEdit();
        return;
      }
      const { store, engine } = this.ctx;
      const latex = this.mf.value.trim();
      if (!latex) return;
      try {
        const r = engine.evaluate(latex);
        const v = r.value;
        const isArr = Array.isArray(v);
        if (isArr) this.bank()[cfg.prefix + 'Ans'] = v;
        else if (typeof v === 'number') store.vars.Ans = v;
        const out = this.ctx.valueLatex(v, r.flags, store.settings.io === 'dec' ? 'decimal' : 'standard');
        store[cfg.histKey].push({ latex, out, isArr });
        if (store[cfg.histKey].length > 30) store[cfg.histKey].shift();
        this.mf.value = '';
        this.ctx.save();
        this.render();
        this.showMain();
      } catch (e) { this.err.textContent = e.kind || 'Math ERROR'; }
    },
    onKey(id) { return id === 'sd' || id === 'format'; },
    showEdit(name) {
      const { h, tex } = this.ctx;
      this.mode = 'edit';
      this.editName = name;
      this.ctx.setTitle(name);
      const cur = this.bank()[name];
      const rows0 = cur ? (Array.isArray(cur[0]) ? cur.length : 1) : (cfg.prefix === 'Mat' ? 2 : 1);
      const cols0 = cur ? (Array.isArray(cur[0]) ? cur[0].length : cur.length) : (cfg.prefix === 'Mat' ? 2 : 3);
      this.size = { r: rows0, c: cols0 };
      this.draft = {};
      if (cur) {
        const m = Array.isArray(cur[0]) ? cur : [cur];
        m.forEach((row, i) => row.forEach((v, j) => { this.draft[i + ',' + j] = plain(v); }));
      }
      const build = () => {
        this.el.innerHTML = '';
        const back = h('button', { type: 'button', class: 'back' }, '‹ ' + cfg.title);
        back.addEventListener('click', () => this.showMain());
        const wrap = h('div', { class: 'form scroll' }, back);
        if (cfg.prefix === 'Mat') {
          wrap.append(this.chipRow('Rows', [1, 2, 3, 4], this.size.r, v => { this.size.r = v; build(); }));
          wrap.append(this.chipRow('Columns', [1, 2, 3, 4], this.size.c, v => { this.size.c = v; build(); }));
        } else {
          wrap.append(this.chipRow('Dimension', [2, 3], this.size.c, v => { this.size.c = v; build(); }));
        }
        const grid = h('div', { class: 'mgrid', style: `grid-template-columns: repeat(${this.size.c}, minmax(0,1fr))` });
        this.cells = [];
        for (let i = 0; i < this.size.r; i++) for (let j = 0; j < this.size.c; j++) {
          const key = i + ',' + j;
          const mf = this.ctx.makeField(this.draft[key] || '', { class: 'cell', onInput: v => { this.draft[key] = v; } });
          this.cells.push(mf);
          grid.append(mf);
        }
        this.edErr = h('div', { class: 'err' });
        const save = h('button', { type: 'button', class: 'primary wide' }, 'Save ' + name);
        save.addEventListener('click', () => this.saveEdit());
        const del = h('button', { type: 'button', class: 'wide danger' }, 'Delete ' + name);
        del.addEventListener('click', () => { delete this.bank()[name]; this.ctx.save(); this.showMain(); });
        wrap.append(h('div', { class: 'mbracket' }, grid), this.edErr, save, del);
        this.el.append(wrap);
        this.ctx.focusField(this.cells[0]);
      };
      build();
    },
    chipRow(label, vals, cur, pick) {
      const { h } = this.ctx;
      const w = h('div', { class: 'chips' }, h('span', { class: 'chips-label' }, label));
      for (const v of vals) {
        const b = h('button', { type: 'button', class: 'chip' + (v === cur ? ' on' : '') }, String(v));
        b.addEventListener('click', () => pick(v));
        w.append(b);
      }
      return w;
    },
    saveEdit() {
      const { engine } = this.ctx;
      try {
        const m = [];
        for (let i = 0; i < this.size.r; i++) {
          const row = [];
          for (let j = 0; j < this.size.c; j++) {
            const src = this.draft[i + ',' + j];
            if (!src || !src.trim()) { row.push(0); continue; }
            const r = engine.evaluate(src);
            if (typeof r.value !== 'number') throw new CalcError('Math ERROR');
            row.push(r.value);
          }
          m.push(row);
        }
        this.bank()[this.editName] = cfg.prefix === 'Vct' ? m[0] : m;
        this.ctx.save();
        this.showMain();
      } catch (e) { this.edErr.textContent = e.kind || 'Math ERROR'; }
    }
  };
}

function plain(v) {
  if (typeof v !== 'number') return '0';
  const s = String(Number(v.toPrecision(12)));
  if (s.includes('e')) { const [m, e] = s.split('e'); return m + '\\times10^{' + parseInt(e, 10) + '}'; }
  return s;
}

export const matrixApp = makeApp({
  id: 'matrix', title: 'Matrix', prefix: 'Mat', bankKey: 'mats', histKey: 'matHist',
  names: ['MatA', 'MatB', 'MatC', 'MatD', 'MatE', 'MatF'],
  hint: 'Tap a matrix to edit it (up to 4×4). Use the buttons to put matrices and functions in a calculation.',
  empty: 'Try MatA × MatB, MatA⁻¹ or Det(MatA)',
  fns: [['x⁻¹', '^{-1}', true], ['x²', '^{2}', true], ['Det', '\\operatorname{Det}\\left(#?\\right)'], ['Trn', '\\operatorname{Trn}\\left(#?\\right)'], ['Identity', '\\operatorname{Identity}\\left(#?\\right)'], ['Ref', '\\operatorname{Ref}\\left(#?\\right)'], ['Rref', '\\operatorname{Rref}\\left(#?\\right)'], ['Abs', '\\left|#?\\right|']]
});

export const vectorApp = makeApp({
  id: 'vector', title: 'Vector', prefix: 'Vct', bankKey: 'vecs', histKey: 'vecHist',
  names: ['VctA', 'VctB', 'VctC', 'VctD'],
  hint: 'Tap a vector to edit it (2D or 3D). × between two vectors gives the dot product.',
  empty: 'Try DotP(VctA, VctB), CrossP(VctA, VctB) or |VctA|',
  fns: [['DotP', '\\operatorname{DotP}\\left(#?\\right)'], ['CrossP', '\\operatorname{CrossP}\\left(#?\\right)'], ['Angle', '\\operatorname{Angle}\\left(#?\\right)'], ['UnitV', '\\operatorname{UnitV}\\left(#?\\right)'], ['|v|', '\\left|#?\\right|'], [',', ',']]
});
