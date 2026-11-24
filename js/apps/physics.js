import { CONSTANTS, UNITS, convert, ELEMENTS, CAT_NAMES } from '../data.js';

function sci(v) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e-3 && a < 1e7) return String(Number(v.toPrecision(12)));
  const [m, e] = v.toExponential(11).split('e');
  return m.replace(/\.?0+$/, '') + '\\times10^{' + parseInt(e, 10) + '}';
}

export function constantsList(ctx, onPick) {
  const { h, tex } = ctx;
  const wrap = h('div', { class: 'list' });
  for (const [group, items] of CONSTANTS) {
    wrap.append(h('div', { class: 'list-h' }, group));
    for (const [name, sym, val, unit] of items) {
      const row = h('button', { type: 'button', class: 'list-row const-row' },
        h('span', { class: 'const-sym', html: tex(sym) }),
        h('span', { class: 'const-main' }, h('span', { class: 'const-name' }, name), h('span', { class: 'const-val', html: tex(sci(val) + (unit ? '\\;\\mathrm{' + unit.replace(/ /g, '\\,') + '}' : '')) })));
      row.addEventListener('click', () => onPick({ name, sym, val, unit }));
      wrap.append(row);
    }
  }
  return wrap;
}

export function converterPanel(ctx, opts = {}) {
  const { h, store, tex } = ctx;
  if (!store.conv) store.conv = { cat: 'Length', from: 'mile', to: 'km', v: '1' };
  const st = store.conv;
  const panel = h('div', { class: 'settings conv' });
  const catBox = h('div', { class: 'set-row' });
  const out = h('div', { class: 'conv-out', 'aria-live': 'polite' });
  const val = ctx.numField(st.v, { label: 'Value', onInput: v => { st.v = v; ctx.save(); calc(); } });
  const mkSel = (key) => {
    const sel = h('select', { class: 'sel', 'aria-label': key === 'from' ? 'From unit' : 'To unit' });
    sel.addEventListener('change', () => { st[key] = sel.value; ctx.save(); calc(); });
    return sel;
  };
  const fromSel = mkSel('from'), toSel = mkSel('to');
  const fill = () => {
    const units = UNITS[st.cat];
    if (!units.some(u => u[0] === st.from)) st.from = units[0][0];
    if (!units.some(u => u[0] === st.to)) st.to = units[Math.min(1, units.length - 1)][0];
    for (const [sel, key] of [[fromSel, 'from'], [toSel, 'to']]) {
      sel.innerHTML = '';
      for (const [u] of units) sel.append(h('option', { value: u, selected: u === st[key] }, u));
    }
  };
  const swap = h('button', { type: 'button', class: 'pill swap', 'aria-label': 'Swap units' }, '⇅ Swap');
  swap.addEventListener('click', () => { [st.from, st.to] = [st.to, st.from]; fill(); ctx.save(); calc(); });
  let result = NaN;
  const calc = () => {
    const v = val.get();
    result = Number.isFinite(v) ? convert(st.cat, st.from, st.to, v) : NaN;
    out.innerHTML = Number.isFinite(result) ? tex(sci(Number(result.toPrecision(10))) + '\\ \\text{' + st.to + '}') : '<span class="muted">Enter a value</span>';
  };
  const cats = Object.keys(UNITS).map(c => [c, c]);
  catBox.append(h('div', { class: 'set-label' }, 'Quantity'), h('div', { class: 'wrap-seg' }, ctx.seg(cats, st.cat, v => { st.cat = v; fill(); ctx.save(); calc(); })));
  panel.append(catBox,
    h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, 'Value'), val.el),
    h('div', { class: 'conv-units' }, h('label', { class: 'set-row' }, h('span', { class: 'set-label' }, 'From'), fromSel), swap, h('label', { class: 'set-row' }, h('span', { class: 'set-label' }, 'To'), toSel)),
    out);
  if (opts.onUse) {
    const use = h('button', { type: 'button', class: 'primary wide' }, opts.useLabel || 'Use result');
    use.addEventListener('click', () => { if (Number.isFinite(result)) opts.onUse(result); });
    panel.append(use);
  }
  fill();
  calc();
  return panel;
}

export function latexNumber(v) {
  const s = String(Number(v.toPrecision(12)));
  if (s.includes('e')) { const [m, e] = s.split('e'); return '\\left(' + m + '\\times10^{' + parseInt(e, 10) + '}\\right)'; }
  return v < 0 ? '\\left(' + s + '\\right)' : s;
}

export const physicsApp = {
  id: 'physics',
  title: 'Physics',
  mount(el, ctx) {
    this.ctx = ctx;
    this.el = el;
    ctx.showKeypad(false);
    if (!ctx.store.physTab) ctx.store.physTab = 'const';
    this.build();
  },
  build() {
    const { h, store } = this.ctx;
    this.el.innerHTML = '';
    const top = h('div', { class: 'eq-top' }, this.ctx.seg([['const', 'Constants'], ['conv', 'Conversions']], store.physTab, v => { store.physTab = v; this.ctx.save(); this.build(); }));
    const body = h('div', { class: 'scroll pad' });
    if (store.physTab === 'const') {
      body.append(h('p', { class: 'note' }, 'CODATA 2018 values. Tap a constant to store it in Ans or use it in Calculate.'), constantsList(this.ctx, c => this.pick(c)));
    } else {
      body.append(converterPanel(this.ctx, { onUse: v => { store.vars.Ans = v; this.ctx.save(); this.ctx.toast('Stored in Ans'); }, useLabel: 'Store result in Ans' }));
    }
    this.el.append(h('div', { class: 'col' }, top, body));
  },
  pick(c) {
    const { h, tex, store } = this.ctx;
    const body = h('div', { class: 'settings' },
      h('div', { class: 'const-big', html: tex(c.sym + '=' + sci(c.val) + (c.unit ? '\\;\\mathrm{' + c.unit.replace(/ /g, '\\,') + '}' : '')) }),
      h('button', { type: 'button', class: 'primary wide', onclick: () => { store.vars.Ans = c.val; this.ctx.save(); this.ctx.closeSheet(); this.ctx.toast('Stored in Ans'); } }, 'Store in Ans'),
      h('button', { type: 'button', class: 'wide', onclick: () => { store.calcDraft = (store.calcDraft || '') + latexNumber(c.val); this.ctx.save(); this.ctx.closeSheet(); this.ctx.openAppById('calculate'); } }, 'Use in Calculate'));
    this.ctx.openSheet(c.name, body);
  }
};

export const periodicApp = {
  id: 'periodic',
  title: 'Periodic Table',
  mount(el, ctx) {
    this.ctx = ctx;
    const { h } = ctx;
    ctx.showKeypad(false);
    const grid = h('div', { class: 'ptable', role: 'grid', 'aria-label': 'Periodic table' });
    for (let g = 1; g <= 18; g++) grid.append(h('div', { class: 'pt-g', style: `grid-row:1;grid-column:${g + 1}` }, String(g)));
    for (let p = 1; p <= 7; p++) grid.append(h('div', { class: 'pt-p', style: `grid-row:${p + 1};grid-column:1` }, String(p)));
    grid.append(h('div', { class: 'pt-fmark', style: 'grid-row:7;grid-column:4' }, '57–71'), h('div', { class: 'pt-fmark', style: 'grid-row:8;grid-column:4' }, '89–103'));
    for (const e of ELEMENTS) {
      const b = h('button', { type: 'button', class: 'pt-el cat-' + e.cat, style: `grid-row:${e.row + 1};grid-column:${e.col + 1}`, 'aria-label': e.name },
        h('span', { class: 'pt-z' }, String(e.z)), h('span', { class: 'pt-s' }, e.sym));
      b.addEventListener('click', () => this.show(e));
      grid.append(b);
    }
    const legend = h('div', { class: 'pt-legend' });
    for (const [k, v] of Object.entries(CAT_NAMES)) legend.append(h('span', { class: 'pt-key cat-' + k }, v));
    el.append(h('div', { class: 'scroll pad pt-wrap' }, h('p', { class: 'note' }, 'Scroll sideways to see the whole table. Tap an element for details.'), grid, legend));
  },
  show(e) {
    const { h, store } = this.ctx;
    const massNum = parseFloat(e.mass.replace(/[\[\]]/g, ''));
    const rows = [['Atomic number', e.z], ['Symbol', e.sym], ['Atomic mass', e.mass + (e.mass.startsWith('[') ? ' (most stable isotope)' : '')], ['Group', e.group], ['Period', e.period], ['Type', e.catName]];
    const body = h('div', { class: 'settings' },
      h('div', { class: 'pt-big cat-' + e.cat }, h('span', { class: 'pt-z' }, String(e.z)), h('span', { class: 'pt-s' }, e.sym), h('span', { class: 'pt-m' }, e.mass)),
      h('div', { class: 'res-table' }, ...rows.map(([k, v]) => h('div', { class: 'res-row' }, h('span', { class: 'res-k' }, k), h('span', { class: 'res-v' }, String(v))))),
      h('button', { type: 'button', class: 'primary wide', onclick: () => { store.vars.Ans = massNum; this.ctx.save(); this.ctx.closeSheet(); this.ctx.toast('Atomic mass stored in Ans'); } }, 'Store atomic mass in Ans'));
    this.ctx.openSheet(e.name, body);
  }
};
