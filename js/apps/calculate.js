const ser = v => {
  if (typeof v === 'number') return v;
  if (v && v.isComplex) return { c: [v.re, v.im] };
  if (v && v.pair) return v;
  if (v && v.isMatrix) return { m: v.toArray() };
  if (Array.isArray(v)) return { m: v };
  return null;
};
const de = v => {
  if (typeof v === 'number') return v;
  if (v && v.c) return window.math.complex(v.c[0], v.c[1]);
  if (v && v.m) return v.m;
  return v;
};

const FORMATS = [
  ['standard', 'Standard'],
  ['decimal', 'Decimal'],
  ['improper', 'Improper fraction'],
  ['mixed', 'Mixed fraction'],
  ['prime', 'Prime factorisation'],
  ['recurring', 'Recurring decimal'],
  ['eng', 'Engineering'],
  ['dms', 'Degrees, minutes, seconds']
];

export const calculateApp = {
  id: 'calculate',
  title: 'Calculate',
  mount(el, ctx) {
    this.ctx = ctx;
    const { h } = ctx;
    if (!ctx.store.history) ctx.store.history = [];
    this.hist = h('div', { class: 'hist scroll' });
    this.err = h('div', { class: 'err', role: 'alert' });
    this.mf = ctx.makeField(ctx.store.calcDraft || '', { class: 'calc-input', onInput: v => { this.err.textContent = ''; this.err.classList.remove('on'); ctx.store.calcDraft = v; } });
    const entry = h('div', { class: 'entry' }, this.mf, this.err);
    el.append(h('div', { class: 'calc' }, this.hist, entry));
    this.render();
    ctx.focusField(this.mf);
  },
  unmount() { this.ctx.save(); },
  latexFor(item) {
    const v = de(item.value);
    const mode = item.mode === 'improper' ? 'standard' : item.mode;
    if (item.mode === 'improper') {
      const s = { ...this.ctx.store.settings, fraction: 'improper' };
      return this.ctx.valueLatex(v, item.flags, 'standard', s);
    }
    try { return this.ctx.valueLatex(v, item.flags, mode) || this.ctx.valueLatex(v, item.flags, 'decimal'); }
    catch (e) { return this.ctx.valueLatex(v, item.flags, 'decimal'); }
  },
  render() {
    const { h, tex, store } = this.ctx;
    this.hist.innerHTML = '';
    const items = store.history.slice(-40);
    if (!items.length) this.hist.append(h('div', { class: 'hist-empty' }, 'Type a calculation and press EXE'));
    items.forEach((item, idx) => {
      const out = this.latexFor(item);
      const row = h('button', { type: 'button', class: 'h-item' + (idx === items.length - 1 ? ' last' : ''), 'aria-label': 'Reuse this calculation' },
        h('div', { class: 'h-in', html: tex(item.latex) }),
        h('div', { class: 'h-out', html: tex(out) }));
      row.addEventListener('click', () => {
        this.mf.value = item.latex;
        store.calcDraft = item.latex;
        this.ctx.focusField(this.mf);
        this.mf.executeCommand('moveToMathfieldEnd');
      });
      this.hist.append(row);
    });
    requestAnimationFrame(() => { this.hist.scrollTop = this.hist.scrollHeight; });
  },
  beforeOperator() {
    if (this.ctx.field === this.mf && !this.mf.value.trim() && this.ctx.store.history.length) this.ctx.insert('\\mathrm{Ans}');
  },
  onAC() { this.err.textContent = ''; this.err.classList.remove('on'); this.ctx.store.calcDraft = ''; },
  onExe() {
    const { store, engine } = this.ctx;
    const latex = this.mf.value.trim();
    if (!latex) return;
    try {
      const r = engine.evaluate(latex);
      let v = r.value;
      store.vars.PreAns = store.vars.Ans;
      if (v && v.pair) store.vars.Ans = v.values[0];
      else store.vars.Ans = v;
      const mode = store.settings.io === 'dec' ? 'decimal' : 'standard';
      store.history.push({ latex, value: ser(v), flags: r.flags, mode });
      if (store.history.length > 60) store.history.splice(0, store.history.length - 60);
      this.mf.value = '';
      store.calcDraft = '';
      this.ctx.save();
      this.render();
    } catch (e) {
      this.err.textContent = e.kind || 'Math ERROR';
      this.err.classList.add('on');
    }
  },
  onSettings() { this.render(); },
  onKey(id) {
    const { store } = this.ctx;
    const last = store.history[store.history.length - 1];
    if (id === 'sd') {
      if (!last) return true;
      const exact = this.ctx.valueLatex(de(last.value), last.flags, 'standard');
      const dec = this.ctx.valueLatex(de(last.value), last.flags, 'decimal');
      if (exact === dec && last.mode !== 'decimal') return true;
      last.mode = last.mode === 'decimal' ? 'standard' : 'decimal';
      this.ctx.save();
      this.render();
      return true;
    }
    if (id === 'format') { this.openFormat(); return true; }
    return false;
  },
  openFormat() {
    const { h, tex, store } = this.ctx;
    const last = store.history[store.history.length - 1];
    if (!last) return;
    const v = de(last.value);
    const body = h('div', { class: 'formats' });
    const seen = new Set();
    for (const [mode, label] of FORMATS) {
      let out = null;
      try { out = this.latexFor({ ...last, mode }); } catch (e) { out = null; }
      const ok = out && (mode === 'standard' || mode === 'decimal' || !seen.has(out)) && !(mode === 'prime' && typeof v !== 'number');
      if (out) seen.add(out);
      const b = h('button', { type: 'button', class: 'fmt-row' + (last.mode === mode ? ' on' : ''), disabled: !ok },
        h('span', { class: 'fmt-label' }, label), h('span', { class: 'fmt-val', html: ok ? tex(out) : '' }));
      b.addEventListener('click', () => { last.mode = mode; this.ctx.save(); this.render(); this.ctx.closeSheet(); });
      body.append(b);
    }
    this.ctx.openSheet('Format', body, { tall: true });
  }
};
