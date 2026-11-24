import * as S from '../stats.js';
import { CalcError } from '../parse.js';
import { TESTS, INTERVALS, runForm } from './stattests.js';
import { Plot, PALETTE, fmt, niceStep } from '../plot.js';

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
    const { store } = ctx;
    if (!store.statSet) store.statSet = { x: 0, y: 1, f: -1, reg: 'lin' };
    if (!store.statGraph) store.statGraph = { type: 'scatter', reg: false, hstart: '', hwidth: '' };
    if (!store.lists || store.lists.length < 6) store.lists = [[], [], [], [], [], []];
    this.sel = this.sel || { r: 0, c: 0 };
    this.showMain();
  },
  showMain() {
    const { h } = this.ctx;
    const el = this.el;
    this.mode = 'main';
    if (this.plot) { this.plot.dispose(); this.plot = null; }
    this.ctx.showKeypad(true);
    this.ctx.setTitle('Statistics');
    el.innerHTML = '';
    const tools = h('div', { class: 'toolbar' },
      h('button', { type: 'button', onclick: () => this.openOneVar() }, '1-Var'),
      h('button', { type: 'button', onclick: () => this.openTwoVar() }, '2-Var'),
      h('button', { type: 'button', onclick: () => this.openReg() }, 'Regression'),
      h('button', { type: 'button', onclick: () => this.showGraph() }, 'Graph'),
      h('button', { type: 'button', onclick: () => this.showList('test') }, 'Test'),
      h('button', { type: 'button', onclick: () => this.showList('interval') }, 'Interval'),
      h('button', { type: 'button', onclick: () => this.openEdit() }, 'Edit'));
    this.table = h('div', { class: 'stable scroll' });
    this.edit = this.ctx.makeField('', { class: 'calc-input stat-input' });
    this.err = h('div', { class: 'err' });
    this.cellLabel = h('div', { class: 'cell-label' });
    el.append(h('div', { class: 'stats' }, tools, this.table, h('div', { class: 'entry' }, this.cellLabel, this.edit, this.err)));
    this.render();
    this.ctx.focusField(this.edit);
  },
  showList(kind) {
    const { h } = this.ctx;
    this.mode = 'list';
    this.listKind = kind;
    if (this.plot) { this.plot.dispose(); this.plot = null; }
    this.ctx.showKeypad(false);
    this.ctx.setTitle(kind === 'test' ? 'Tests' : 'Intervals');
    this.el.innerHTML = '';
    const back = h('button', { type: 'button', class: 'back' }, '‹ Lists');
    back.addEventListener('click', () => this.showMain());
    const list = h('div', { class: 'list scroll' }, back);
    for (const spec of kind === 'test' ? TESTS : INTERVALS) {
      if (spec.group) { list.append(h('div', { class: 'list-h' }, spec.group)); continue; }
      list.append(h('button', { type: 'button', class: 'list-row', onclick: () => { this.mode = 'form'; runForm(this, spec); } }, h('span', {}, spec.name), h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')));
    }
    this.el.append(list);
  },
  graphData() {
    const { store } = this.ctx;
    const set = store.statSet;
    const clean = a => a.filter(v => typeof v === 'number' && isFinite(v));
    const xs = store.lists[set.x] || [], ys = store.lists[set.y] || [];
    const fs = set.f < 0 ? null : store.lists[set.f];
    return { xs: clean(xs), ys: clean(ys), raw: xs, fs };
  },
  showGraph() {
    const { h, store, seg } = this.ctx;
    this.mode = 'graph';
    this.ctx.showKeypad(false);
    this.ctx.setTitle('Statistics Graph');
    this.el.innerHTML = '';
    const gs = store.statGraph;
    const back = h('button', { type: 'button', class: 'back' }, '‹ Lists');
    back.addEventListener('click', () => this.showMain());
    const types = [['scatter', 'Scatter'], ['xyline', 'xy-Line'], ['hist', 'Histogram'], ['box', 'Box plot'], ['ndist', 'N-Dist'], ['pie', 'Pie'], ['bar', 'Bar']];
    const ctrl = h('div', { class: 'sg-ctrl' });
    const info = h('div', { class: 'sg-info' });
    const cv = h('canvas', { class: 'gcanvas' });
    const wrap = h('div', { class: 'gwrap' }, cv);
    const listOpts = (one) => [...(one ? [[-1, '1']] : []), ...[0, 1, 2, 3, 4, 5].map(i => [i, 'L' + (i + 1)])];
    const two = () => gs.type === 'scatter' || gs.type === 'xyline';
    const buildCtrl = () => {
      ctrl.innerHTML = '';
      ctrl.append(h('div', { class: 'wrap-seg' }, seg(types, gs.type, v => { gs.type = v; this.ctx.save(); buildCtrl(); this.fitGraph(); })));
      const row = h('div', { class: 'sg-row' });
      row.append(h('span', { class: 'set-label' }, two() ? 'x' : 'Data'), seg(listOpts(false), store.statSet.x, v => { store.statSet.x = v; this.ctx.save(); this.fitGraph(); }));
      ctrl.append(row);
      if (two()) ctrl.append(h('div', { class: 'sg-row' }, h('span', { class: 'set-label' }, 'y'), seg(listOpts(false), store.statSet.y, v => { store.statSet.y = v; this.ctx.save(); this.fitGraph(); })));
      if (['hist', 'box', 'ndist'].includes(gs.type)) ctrl.append(h('div', { class: 'sg-row' }, h('span', { class: 'set-label' }, 'Freq'), seg(listOpts(true), store.statSet.f, v => { store.statSet.f = v; this.ctx.save(); this.fitGraph(); })));
      if (gs.type === 'scatter') ctrl.append(h('div', { class: 'sg-row' }, h('span', { class: 'set-label' }, 'Regression'), seg([[false, 'Off'], [true, S.REG_TYPES[store.statSet.reg].name]], gs.reg, v => { gs.reg = v; this.ctx.save(); this.plot.draw(); })));
      if (gs.type === 'hist') {
        const st = this.ctx.numField(gs.hstart, { label: 'Start', onInput: v => { gs.hstart = v; this.ctx.save(); this.fitGraph(); } });
        const wd = this.ctx.numField(gs.hwidth, { label: 'Width', noSign: true, onInput: v => { gs.hwidth = v; this.ctx.save(); this.fitGraph(); } });
        st.input.placeholder = 'auto'; wd.input.placeholder = 'auto';
        ctrl.append(h('div', { class: 'sg-row two' }, h('label', {}, h('span', { class: 'set-label' }, 'Start'), st.el), h('label', {}, h('span', { class: 'set-label' }, 'Width'), wd.el)));
      }
    };
    this.el.append(h('div', { class: 'col' }, h('div', { class: 'sg-top scroll' }, back, ctrl), wrap, info));
    this.sgInfo = info;
    this.plot = new Plot(cv, { xmin: -1, xmax: 10, ymin: -1, ymax: 10 });
    this.plot.onDraw = (g, v, C) => this.drawStat(g, v, C);
    this.plot.observe();
    buildCtrl();
    this.fitGraph();
  },
  histBins() {
    const gs = this.ctx.store.statGraph;
    const d = this.graphData();
    const fs = d.fs ? d.raw.map((_, i) => d.fs[i]) : null;
    const vals = S.expand(d.raw.filter(v => typeof v === 'number'), fs ? fs.filter((_, i) => typeof d.raw[i] === 'number') : null);
    if (!vals.length) return null;
    const mn = Math.min(...vals), mx = Math.max(...vals);
    let width = parseFloat(gs.hwidth), start = parseFloat(String(gs.hstart).replace('−', '-'));
    if (!(width > 0)) width = niceStep(Math.max(1e-9, mx - mn), Math.ceil(Math.sqrt(vals.length)) * 70, 70) || 1;
    if (!isFinite(start)) start = Math.floor(mn / width) * width;
    const bins = [];
    for (let a = start; a <= mx + 1e-12 && bins.length < 200; a += width) bins.push({ a, b: a + width, n: 0 });
    for (const v of vals) { const i = Math.floor((v - start) / width + 1e-12); if (bins[i]) bins[i].n++; else if (v === mx && bins.length) bins[bins.length - 1].n++; }
    return { bins, width, start };
  },
  fitGraph() {
    if (!this.plot) return;
    const gs = this.ctx.store.statGraph;
    const d = this.graphData();
    const w = this.plot.win;
    const pad = (lo, hi, k = 0.12) => { const r = (hi - lo) || Math.abs(hi) || 1; return [lo - r * k, hi + r * k]; };
    this.plot.opts.axes = gs.type !== 'pie';
    this.plot.opts.pan = gs.type !== 'pie';
    if (gs.type === 'scatter' || gs.type === 'xyline') {
      if (d.xs.length && d.ys.length) { [w.xmin, w.xmax] = pad(Math.min(...d.xs), Math.max(...d.xs)); [w.ymin, w.ymax] = pad(Math.min(...d.ys), Math.max(...d.ys)); }
    } else if (gs.type === 'hist') {
      const hb = this.histBins();
      if (hb) { const top = Math.max(...hb.bins.map(b => b.n)); [w.xmin, w.xmax] = pad(hb.bins[0].a, hb.bins[hb.bins.length - 1].b, 0.06); w.ymin = -top * 0.12; w.ymax = top * 1.15; }
    } else if (gs.type === 'box') {
      if (d.xs.length) { [w.xmin, w.xmax] = pad(Math.min(...d.xs), Math.max(...d.xs)); w.ymin = -1; w.ymax = 2; }
    } else if (gs.type === 'ndist') {
      const r = this.oneVar();
      if (r && r.ssd > 0) { w.xmin = r.mean - 4 * r.ssd; w.xmax = r.mean + 4 * r.ssd; const pk = 1 / (r.ssd * Math.sqrt(2 * Math.PI)); w.ymin = -pk * 0.12; w.ymax = pk * 1.2; }
    } else if (gs.type === 'bar') {
      if (d.xs.length) { w.xmin = 0; w.xmax = d.xs.length + 1; const mx = Math.max(0, ...d.xs), mn = Math.min(0, ...d.xs); [w.ymin, w.ymax] = pad(mn, mx); }
    } else { w.xmin = -1.4; w.xmax = 1.4; w.ymin = -1.4; w.ymax = 1.4; }
    this.plot.draw();
  },
  oneVar() {
    const d = this.graphData();
    const fs = d.fs ? d.raw.map((_, i) => d.fs[i]) : null;
    try { return S.oneVar(d.raw.map(v => typeof v === 'number' ? v : NaN), fs); } catch (e) { return null; }
  },
  drawStat(g, v, C) {
    const gs = this.ctx.store.statGraph;
    const d = this.graphData();
    const info = [];
    const ink = C.tint;
    if (gs.type === 'scatter' || gs.type === 'xyline') {
      const n = Math.min(d.raw.length, this.ctx.store.lists[this.ctx.store.statSet.y].length);
      const pts = [];
      for (let i = 0; i < n; i++) { const x = d.raw[i], y = this.ctx.store.lists[this.ctx.store.statSet.y][i]; if (isFinite(x) && isFinite(y)) pts.push([x, y]); }
      if (gs.type === 'xyline') this.plot.path(g, v, pts, ink, 2);
      for (const [x, y] of pts) this.plot.dot(g, v, x, y, gs.type === 'xyline' ? ink : C.label, 3.5);
      if (gs.type === 'scatter' && gs.reg && pts.length >= 2) {
        try { const fit = S.regress(this.ctx.store.statSet.reg, pts.map(p => [p[0], p[1], 1])); this.plot.curve(g, v, fit.f, '#ff3b30', 2); info.push(S.REG_TYPES[this.ctx.store.statSet.reg].name + ' fit, r² = ' + fmt(fit.r2)); } catch (e) { info.push('Regression: Math ERROR'); }
      }
      info.unshift(pts.length + ' points');
    } else if (gs.type === 'hist') {
      const hb = this.histBins();
      if (hb) {
        for (const b of hb.bins) {
          const x0 = v.X(b.a), x1 = v.X(b.b), y0 = v.Y(0), y1 = v.Y(b.n);
          g.fillStyle = ink + '55'; g.strokeStyle = ink; g.lineWidth = 1.5;
          g.fillRect(x0, y1, x1 - x0, y0 - y1); g.strokeRect(x0 + 0.5, y1 + 0.5, x1 - x0 - 1, y0 - y1);
        }
        info.push(hb.bins.length + ' classes, width ' + fmt(hb.width) + ', start ' + fmt(hb.start));
      }
    } else if (gs.type === 'box') {
      const r = this.oneVar();
      if (r && isFinite(r.q1)) {
        const yb = v.Y(0.25), yt = v.Y(0.75), ym = v.Y(0.5);
        g.strokeStyle = ink; g.lineWidth = 2; g.fillStyle = ink + '33';
        g.fillRect(v.X(r.q1), yt, v.X(r.q3) - v.X(r.q1), yb - yt);
        g.strokeRect(v.X(r.q1), yt, v.X(r.q3) - v.X(r.q1), yb - yt);
        g.beginPath();
        g.moveTo(v.X(r.med), yt); g.lineTo(v.X(r.med), yb);
        g.moveTo(v.X(r.min), ym); g.lineTo(v.X(r.q1), ym); g.moveTo(v.X(r.q3), ym); g.lineTo(v.X(r.max), ym);
        g.moveTo(v.X(r.min), v.Y(0.4)); g.lineTo(v.X(r.min), v.Y(0.6)); g.moveTo(v.X(r.max), v.Y(0.4)); g.lineTo(v.X(r.max), v.Y(0.6));
        g.stroke();
        info.push(`min ${fmt(r.min)}  Q₁ ${fmt(r.q1)}  Med ${fmt(r.med)}  Q₃ ${fmt(r.q3)}  max ${fmt(r.max)}`);
      }
    } else if (gs.type === 'ndist') {
      const r = this.oneVar();
      if (r && r.ssd > 0) {
        this.plot.curve(g, v, x => S.normPdf(x, r.mean, r.ssd), ink, 2.5);
        info.push(`x̄ = ${fmt(r.mean)}, sₓ = ${fmt(r.ssd)}`);
      }
    } else if (gs.type === 'bar') {
      d.xs.forEach((val, i) => {
        const x0 = v.X(i + 0.6), x1 = v.X(i + 1.4), y0 = v.Y(0), y1 = v.Y(val);
        g.fillStyle = PALETTE[i % PALETTE.length];
        g.fillRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y0 - y1));
      });
      info.push(d.xs.length + ' bars');
    } else if (gs.type === 'pie') {
      const vals = d.xs.filter(x => x > 0);
      const tot = vals.reduce((a, b) => a + b, 0);
      if (tot > 0) {
        const cx = v.X(0), cy = v.Y(0), R = Math.min(v.W, v.H) * 0.38;
        let a0 = -Math.PI / 2;
        vals.forEach((val, i) => {
          const a1 = a0 + val / tot * Math.PI * 2;
          g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a1); g.closePath();
          g.fillStyle = PALETTE[i % PALETTE.length]; g.fill();
          g.strokeStyle = C.paper; g.lineWidth = 2; g.stroke();
          const am = (a0 + a1) / 2;
          g.fillStyle = '#fff'; g.font = '600 12px -apple-system, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          if (val / tot > 0.04) g.fillText((val / tot * 100).toFixed(1) + '%', cx + Math.cos(am) * R * 0.65, cy + Math.sin(am) * R * 0.65);
          a0 = a1;
        });
        info.push(vals.length + ' sectors, total ' + fmt(tot));
      }
    }
    if (!info.length) info.push('Enter data in the lists first.');
    if (this.sgInfo) this.sgInfo.textContent = info.join(' · ');
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
    if (this.mode === 'form') {
      const i = (this.cells || []).indexOf(this.ctx.field);
      if (i >= 0 && i < this.cells.length - 1) this.ctx.focusField(this.cells[i + 1]);
      else if (this.execForm) this.execForm();
      return;
    }
    if (this.mode !== 'main') return;
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
      requestAnimationFrame(() => this.miniPlot(cv, r2v, fit));
      const est = h('div', { class: 'est' });
      const xIn = this.ctx.numField('', { label: 'x' }), yIn = this.ctx.numField('', { label: 'y' });
      const yOut = h('div', { class: 'res-v' }), xOut = h('div', { class: 'res-v' });
      const upd = () => {
        const xv = xIn.get();
        yOut.innerHTML = Number.isFinite(xv) ? tex('\\hat{y}=' + numLatex(this.ctx, fit.f(xv))) : '';
        const yv = yIn.get();
        if (!Number.isFinite(yv)) { xOut.innerHTML = ''; return; }
        const lo = r2v.minX - 2 * ((r2v.maxX - r2v.minX) || 1), hi = r2v.maxX + 2 * ((r2v.maxX - r2v.minX) || 1);
        const g = x => fit.f(x) - yv;
        const sols = [];
        const N = 2000;
        let px = lo, py = g(lo);
        for (let i = 1; i <= N; i++) {
          const cx = lo + (hi - lo) * i / N, cy = g(cx);
          if (isFinite(py) && isFinite(cy) && (py === 0 || Math.sign(py) !== Math.sign(cy))) {
            let a = px, b2 = cx, fa = py;
            for (let k = 0; k < 100; k++) { const m = (a + b2) / 2, fm = g(m); if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b2 = m; }
            const r = (a + b2) / 2;
            if (!sols.some(s0 => Math.abs(s0 - r) < 1e-8 * Math.max(1, Math.abs(r)))) sols.push(r);
          }
          px = cx; py = cy;
        }
        xOut.innerHTML = sols.length ? tex(sols.slice(0, 4).map((x, i) => '\\hat{x}' + (sols.length > 1 ? '_{' + (i + 1) + '}' : '') + '=' + numLatex(this.ctx, x)).join(',\\;')) : tex('\\hat{x}:\\text{ none found}');
      };
      xIn.input.addEventListener('input', upd); yIn.input.addEventListener('input', upd);
      est.append(h('div', { class: 'set-label' }, 'Estimate'), h('div', { class: 'est-row' }, h('span', { html: tex('x=') }), xIn.el, yOut), h('div', { class: 'est-row' }, h('span', { html: tex('y=') }), yIn.el, xOut));
      out.append(est);
      const copy = h('button', { type: 'button', class: 'wide' }, 'Copy to Graph & Table');
      copy.addEventListener('click', () => {
        const c = fit.coef;
        const n = v => plainNum(v).replace('e', '\\times10^{').replace(/(\\times10\^\{[-0-9]+)$/, '$1}');
        const forms = {
          lin: `${n(c.a)}x+${n(c.b)}`, quad: `${n(c.a)}x^2+${n(c.b)}x+${n(c.c)}`, cubic: `${n(c.a)}x^3+${n(c.b)}x^2+${n(c.c)}x+${n(c.d)}`,
          quart: `${n(c.a)}x^4+${n(c.b)}x^3+${n(c.c)}x^2+${n(c.d)}x+${n(c.e)}`, log: `${n(c.a)}+${n(c.b)}\\ln\\left(x\\right)`,
          exp: `${n(c.a)}\\mathrm{e}^{${n(c.b)}x}`, abx: `${n(c.a)}\\times${n(c.b)}^{x}`, pow: `${n(c.a)}x^{${n(c.b)}}`,
          sin: `${n(c.a)}\\sin\\left(\\left(${n(c.b)}x+${n(c.c)}\\right)\\mathrm{r}\\right)+${n(c.d)}`, logistic: `\\frac{${n(c.c)}}{1+${n(c.a)}\\mathrm{e}^{-${n(c.b)}x}}`
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
  miniPlot(cv, d, fit) {
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
