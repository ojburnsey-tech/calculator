import * as S from '../stats.js';
import { CalcError } from '../parse.js';

const ROWS_MIN = 8;

function numLatex(ctx, v) {
  if (v === undefined || v === null || Number.isNaN(v)) return '\\text{—}';
  return ctx.valueLatex(v, {}, 'decimal');
}

function plainNum(v) {
  if (!isFinite(v)) return '';
  const s = Number(v.toPrecision(10));
  if (Math.abs(s) >= 1e10 || (Math.abs(s) < 1e-4 && s !== 0)) return s.toExponential(5).replace(/\.?0+e/, 'e');
  return String(s);
}

export const statisticsApp = {
  id: 'statistics',
  title: 'Statistics',
  mount(el, ctx) {
    this.ctx = ctx;
    this.el = el;
    const { store, h } = ctx;
    if (!store.statSet) store.statSet = { x: 0, y: 1, f: -1, reg: 'lin' };
    if (!store.lists || store.lists.length < 6) store.lists = [[], [], [], [], [], []];
    this.sel = { r: 0, c: 0 };
    const tools = h('div', { class: 'toolbar' },
      h('button', { type: 'button', onclick: () => this.openOneVar() }, '1-Var'),
      h('button', { type: 'button', onclick: () => this.openTwoVar() }, '2-Var'),
      h('button', { type: 'button', onclick: () => this.openReg() }, 'Regression'),
      h('button', { type: 'button', onclick: () => this.openEdit() }, 'Edit'));
    this.table = h('div', { class: 'stable scroll' });
    this.edit = ctx.makeField('', { class: 'calc-input stat-input' });
    this.err = h('div', { class: 'err' });
    this.cellLabel = h('div', { class: 'cell-label' });
    el.append(h('div', { class: 'stats' }, tools, this.table, h('div', { class: 'entry' }, this.cellLabel, this.edit, this.err)));
    this.render();
    ctx.focusField(this.edit);
  },
  unmount() { this.ctx.save(); },
  render() {
    const { h, store } = this.ctx;
    const L = store.lists;
    const rows = Math.max(ROWS_MIN, ...L.map(l => l.length + 1));
    const t = h('table', { class: 'grid-table' });
    const head = h('tr', {}, h('th', { class: 'rn' }, ''));
    for (let c = 0; c < 6; c++) head.append(h('th', {}, 'List ' + (c + 1)));
    t.append(h('thead', {}, head));
    const body = h('tbody');
    for (let r = 0; r < rows; r++) {
      const tr = h('tr', {}, h('td', { class: 'rn' }, String(r + 1)));
      for (let c = 0; c < 6; c++) {
        const v = L[c][r];
        const td = h('td', { class: (this.sel.r === r && this.sel.c === c) ? 'sel' : '' }, v === undefined ? '' : plainNum(v));
        td.addEventListener('click', () => { this.sel = { r, c }; this.render(); this.ctx.focusField(this.edit); });
        tr.append(td);
      }
      body.append(tr);
    }
    t.append(body);
    const scrollTop = this.table.scrollTop, scrollLeft = this.table.scrollLeft;
    this.table.innerHTML = '';
    this.table.append(t);
    this.table.scrollTop = scrollTop; this.table.scrollLeft = scrollLeft;
    const selEl = t.querySelector('td.sel');
    if (selEl) selEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.cellLabel.textContent = 'List ' + (this.sel.c + 1) + ', row ' + (this.sel.r + 1);
  },
  onExe() {
    const { store, engine } = this.ctx;
    const latex = this.edit.value.trim();
    const list = store.lists[this.sel.c];
    if (!latex) { this.sel.r = Math.min(this.sel.r + 1, list.length); this.render(); return; }
    try {
      const r = engine.evaluate(latex);
      if (typeof r.value !== 'number') throw new CalcError('Math ERROR');
      while (list.length < this.sel.r) list.push(0);
      list[this.sel.r] = r.value;
      this.sel.r++;
      this.edit.value = '';
      this.err.textContent = '';
      this.ctx.save();
      this.render();
    } catch (e) { this.err.textContent = e.kind || 'Math ERROR'; }
  },
  onKey(id) {
    if (id === 'sd' || id === 'format') return true;
    if (id === 'ac' && !this.edit.value) return false;
    return false;
  },
  openEdit() {
    const { h, store } = this.ctx;
    const c = this.sel.c;
    const body = h('div', { class: 'formats' },
      h('button', { type: 'button', class: 'fmt-row', onclick: () => { const l = store.lists[c]; if (this.sel.r < l.length) l.splice(this.sel.r, 1); this.ctx.save(); this.render(); this.ctx.closeSheet(); } }, 'Delete row ' + (this.sel.r + 1) + ' of List ' + (c + 1)),
      h('button', { type: 'button', class: 'fmt-row', onclick: () => { const l = store.lists[c]; if (this.sel.r <= l.length) l.splice(this.sel.r, 0, 0); this.ctx.save(); this.render(); this.ctx.closeSheet(); } }, 'Insert row above'),
      h('button', { type: 'button', class: 'fmt-row danger', onclick: () => { store.lists[c] = []; this.sel.r = 0; this.ctx.save(); this.render(); this.ctx.closeSheet(); } }, 'Clear List ' + (c + 1)),
      h('button', { type: 'button', class: 'fmt-row danger', onclick: () => { store.lists = [[], [], [], [], [], []]; this.sel = { r: 0, c: 0 }; this.ctx.save(); this.render(); this.ctx.closeSheet(); } }, 'Clear all lists'));
    this.ctx.openSheet('Edit lists', body);
  },
  listPicker(label, key, allowOne) {
    const { h, seg, store } = this.ctx;
    const opts = [];
    if (allowOne) opts.push([-1, '1']);
    for (let i = 0; i < 6; i++) opts.push([i, 'L' + (i + 1)]);
    return h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, label), seg(opts, store.statSet[key], v => { store.statSet[key] = v; this.ctx.save(); this.refreshSheet && this.refreshSheet(); }));
  },
  resultTable(rows) {
    const { h, tex } = this.ctx;
    const wrap = h('div', { class: 'res-table' });
    for (const [k, v, raw] of rows) wrap.append(h('div', { class: 'res-row' }, h('span', { class: 'res-k', html: tex(k + '=') }), h('span', { class: 'res-v', html: raw ? tex(raw) : tex(numLatex(this.ctx, v)) })));
    return wrap;
  },
  data(key) {
    const { store } = this.ctx;
    const i = store.statSet[key];
    return i < 0 ? null : store.lists[i];
  },
  openOneVar() {
    const { h } = this.ctx;
    const out = h('div');
    const body = h('div', { class: 'settings' }, this.listPicker('x list', 'x'), this.listPicker('Frequency', 'f', true), out);
    this.refreshSheet = () => {
      out.innerHTML = '';
      const xs = this.data('x');
      const fs = this.data('f');
      try {
        if (fs && fs.length < xs.length) throw new CalcError('Dimension ERROR');
        const r = S.oneVar(xs, fs ? fs.slice(0, xs.length) : null);
        if (!r) { out.append(h('div', { class: 'res-msg' }, 'The list is empty.')); return; }
        out.append(this.resultTable([
          ['\\overline{x}', r.mean], ['\\Sigma x', r.sum], ['\\Sigma x^2', r.sum2], ['\\sigma_x', r.sd], ['s_x', r.ssd], ['n', r.n],
          ['\\min(x)', r.min], ['Q_1', r.q1], ['\\text{Med}', r.med], ['Q_3', r.q3], ['\\max(x)', r.max],
          ['\\text{Mod}', null, r.modes.length > 3 ? r.modes.slice(0, 3).map(v => numLatex(this.ctx, v)).join(',\\,') + ',\\ldots' : r.modes.map(v => numLatex(this.ctx, v)).join(',\\,')]
        ]));
        this.ctx.store.vars.Ans = r.mean;
      } catch (e) { out.append(h('div', { class: 'res-msg bad' }, e.kind || 'Math ERROR')); }
    };
    this.refreshSheet();
    this.ctx.openSheet('1-Variable', body, { tall: true, onClose: () => { this.refreshSheet = null; } });
  },
  openTwoVar() {
    const { h } = this.ctx;
    const out = h('div');
    const body = h('div', { class: 'settings' }, this.listPicker('x list', 'x'), this.listPicker('y list', 'y'), this.listPicker('Frequency', 'f', true), out);
    this.refreshSheet = () => {
      out.innerHTML = '';
      const r = S.twoVar(this.data('x'), this.data('y'), this.data('f'));
      if (!r) { out.append(h('div', { class: 'res-msg' }, 'The lists are empty.')); return; }
      out.append(this.resultTable([
        ['\\overline{x}', r.mx], ['\\Sigma x', r.sx], ['\\Sigma x^2', r.sx2], ['\\sigma_x', r.sdx], ['s_x', r.ssdx], ['n', r.n],
        ['\\overline{y}', r.my], ['\\Sigma y', r.sy], ['\\Sigma y^2', r.sy2], ['\\sigma_y', r.sdy], ['s_y', r.ssdy],
        ['\\Sigma xy', r.sxy], ['\\Sigma x^3', r.sx3], ['\\Sigma x^2y', r.sx2y], ['\\Sigma x^4', r.sx4],
        ['\\min(x)', r.minX], ['\\max(x)', r.maxX], ['\\min(y)', r.minY], ['\\max(y)', r.maxY]
      ]));
    };
    this.refreshSheet();
    this.ctx.openSheet('2-Variable', body, { tall: true, onClose: () => { this.refreshSheet = null; } });
  },
  openReg() {
    const { h, seg, store, tex } = this.ctx;
    const out = h('div');
    const types = Object.entries(S.REG_TYPES).map(([k, v]) => [k, v.name]);
    const typeSel = h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, 'Model'), h('div', { class: 'wrap-seg' }, seg(types, store.statSet.reg, v => { store.statSet.reg = v; this.ctx.save(); this.refreshSheet(); })));
    const body = h('div', { class: 'settings' }, typeSel, this.listPicker('x list', 'x'), this.listPicker('y list', 'y'), this.listPicker('Frequency', 'f', true), out);
    this.refreshSheet = () => {
      out.innerHTML = '';
      const r2v = S.twoVar(this.data('x'), this.data('y'), this.data('f'));
      if (!r2v || r2v.pts.length < 2) { out.append(h('div', { class: 'res-msg' }, 'Enter at least two (x, y) pairs.')); return; }
      let fit;
      try { fit = S.regress(store.statSet.reg, r2v.pts); } catch (e) { out.append(h('div', { class: 'res-msg bad' }, 'Math ERROR')); return; }
      const t = S.REG_TYPES[store.statSet.reg];
      out.append(h('div', { class: 'eq-form', html: tex(t.form) }));
      const rows = Object.entries(fit.coef).map(([k, v]) => [k, v]);
      if (fit.r !== undefined) rows.push(['r', fit.r]);
      rows.push(['r^2', fit.r2]);
      out.append(this.resultTable(rows));
      const cv = h('canvas', { class: 'mini-plot' });
      out.append(cv);
      requestAnimationFrame(() => this.plot(cv, r2v, fit));
      const copy = h('button', { type: 'button', class: 'wide' }, 'Copy to Graph & Table');
      copy.addEventListener('click', () => {
        const c = fit.coef;
        const n = v => plainNum(v).replace('e', '\\times10^{').replace(/(\\times10\^\{[-0-9]+)$/, '$1}');
        const forms = {
          lin: `${n(c.a)}x+${n(c.b)}`, quad: `${n(c.a)}x^2+${n(c.b)}x+${n(c.c)}`, cubic: `${n(c.a)}x^3+${n(c.b)}x^2+${n(c.c)}x+${n(c.d)}`,
          quart: `${n(c.a)}x^4+${n(c.b)}x^3+${n(c.c)}x^2+${n(c.d)}x+${n(c.e)}`, log: `${n(c.a)}+${n(c.b)}\\ln\\left(x\\right)`,
          exp: `${n(c.a)}\\mathrm{e}^{${n(c.b)}x}`, abx: `${n(c.a)}\\times${n(c.b)}^{x}`, pow: `${n(c.a)}x^{${n(c.b)}}`
        };
        const latex = forms[store.statSet.reg].replace(/\+-/g, '-');
        if (!store.graph) store.graph = [];
        let slot = store.graph.findIndex(g => !g || !g.latex);
        if (slot < 0) slot = store.graph.length;
        store.graph[slot] = { latex, on: true };
        this.ctx.save();
        copy.textContent = 'Copied to y' + (slot + 1);
        copy.disabled = true;
      });
      out.append(copy);
    };
    this.refreshSheet();
    this.ctx.openSheet('Regression', body, { tall: true, onClose: () => { this.refreshSheet = null; } });
  },
  plot(cv, d, fit) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, hgt = cv.clientHeight;
    if (!w || !hgt) return;
    cv.width = w * dpr; cv.height = hgt * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    const css = getComputedStyle(document.body);
    const ink = css.getPropertyValue('--label').trim() || '#000';
    const faint = css.getPropertyValue('--sep').trim() || '#ccc';
    const tint = css.getPropertyValue('--tint').trim() || '#007aff';
    const padX = (d.maxX - d.minX) * 0.1 || 1, padY = (d.maxY - d.minY) * 0.15 || 1;
    const x0 = d.minX - padX, x1 = d.maxX + padX, y0 = d.minY - padY, y1 = d.maxY + padY;
    const X = x => 8 + (x - x0) / (x1 - x0) * (w - 16), Y = y => hgt - 8 - (y - y0) / (y1 - y0) * (hgt - 16);
    g.strokeStyle = faint; g.lineWidth = 1;
    if (x0 < 0 && x1 > 0) { g.beginPath(); g.moveTo(X(0), 0); g.lineTo(X(0), hgt); g.stroke(); }
    if (y0 < 0 && y1 > 0) { g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke(); }
    g.strokeStyle = tint; g.lineWidth = 2; g.beginPath();
    let pen = false;
    for (let i = 0; i <= 200; i++) {
      const x = x0 + (x1 - x0) * i / 200, y = fit.f(x);
      if (!isFinite(y)) { pen = false; continue; }
      if (!pen) { g.moveTo(X(x), Y(y)); pen = true; } else g.lineTo(X(x), Y(y));
    }
    g.stroke();
    g.fillStyle = ink;
    for (const [x, y] of d.pts) { g.beginPath(); g.arc(X(x), Y(y), 3, 0, Math.PI * 2); g.fill(); }
  }
};
