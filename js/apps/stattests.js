import * as S from '../stats.js';
import { CalcError } from '../parse.js';

const bad = () => new CalcError('Math ERROR');
const pos = v => { if (!(v > 0)) throw bad(); return v; };
const posInt = v => { if (!(v >= 1) || Math.abs(v - Math.round(v)) > 1e-9) throw bad(); return Math.round(v); };
const prob = v => { if (!(v > 0 && v < 1)) throw bad(); return v; };
const ALT = {
  mu: [['ne', '≠ μ₀'], ['lt', '< μ₀'], ['gt', '> μ₀']],
  mu2: [['ne', 'μ₁ ≠ μ₂'], ['lt', 'μ₁ < μ₂'], ['gt', 'μ₁ > μ₂']],
  p: [['ne', 'p ≠ p₀'], ['lt', 'p < p₀'], ['gt', 'p > p₀']],
  p2: [['ne', 'p₁ ≠ p₂'], ['lt', 'p₁ < p₂'], ['gt', 'p₁ > p₂']],
  rho: [['ne', 'β, ρ ≠ 0'], ['lt', 'β, ρ < 0'], ['gt', 'β, ρ > 0']],
  sig: [['ne', 'σ₁ ≠ σ₂'], ['lt', 'σ₁ < σ₂'], ['gt', 'σ₁ > σ₂']]
};
const zCrit = c => S.invNorm(0.5 + c / 2);
const tCrit = (c, df) => S.invert(x => S.tCdf(x, df), 0.5 + c / 2, 0, 1e4);
const fP = (F, d1, d2, alt) => alt === 'lt' ? S.fCdf(F, d1, d2) : alt === 'gt' ? 1 - S.fCdf(F, d1, d2) : 2 * Math.min(S.fCdf(F, d1, d2), 1 - S.fCdf(F, d1, d2));

function listSummary(L, F) {
  const r = S.oneVar(L, F);
  if (!r || r.n < 1) throw new CalcError('Dimension ERROR');
  return { mean: r.mean, sx: r.ssd, n: r.n };
}

export const TESTS = [
  { group: 'Z tests' },
  { name: '1-Sample Z Test', list: true, alt: 'mu', fVar: [['μ_0', 'mu0', '0'], ['σ', 's', '1'], ['\\overline{x}', 'xb', '0'], ['n', 'n', '10']], fList: [['μ_0', 'mu0', '0'], ['σ', 's', '1']], lists: 1,
    run(p, a) { const d = p.data || { mean: p.xb, n: posInt(p.n) }; pos(p.s); const z = (d.mean - p.mu0) / (p.s / Math.sqrt(d.n)); return [['z', z], ['p', S.pFromZ(z, a)], ['\\overline{x}', d.mean], ...(d.sx !== undefined ? [['s_x', d.sx]] : []), ['n', d.n]]; } },
  { name: '2-Sample Z Test', list: true, alt: 'mu2', fVar: [['σ_1', 's1', '1'], ['σ_2', 's2', '1'], ['\\overline{x}_1', 'x1', '0'], ['n_1', 'n1', '10'], ['\\overline{x}_2', 'x2', '0'], ['n_2', 'n2', '10']], fList: [['σ_1', 's1', '1'], ['σ_2', 's2', '1']], lists: 2,
    run(p, a) {
      const d1 = p.data || { mean: p.x1, n: posInt(p.n1) }, d2 = p.data2 || { mean: p.x2, n: posInt(p.n2) };
      const z = (d1.mean - d2.mean) / Math.sqrt(pos(p.s1) ** 2 / d1.n + pos(p.s2) ** 2 / d2.n);
      return [['z', z], ['p', S.pFromZ(z, a)], ['\\overline{x}_1', d1.mean], ['\\overline{x}_2', d2.mean], ['n_1', d1.n], ['n_2', d2.n]];
    } },
  { name: '1-Prop Z Test', alt: 'p', fVar: [['p_0', 'p0', '0.5'], ['x', 'x', '0'], ['n', 'n', '10']],
    run(p, a) { const n = posInt(p.n), ph = p.x / n; prob(p.p0); if (p.x < 0 || p.x > n) throw bad(); const z = (ph - p.p0) / Math.sqrt(p.p0 * (1 - p.p0) / n); return [['z', z], ['p', S.pFromZ(z, a)], ['\\hat{p}', ph], ['n', n]]; } },
  { name: '2-Prop Z Test', alt: 'p2', fVar: [['x_1', 'x1', '0'], ['n_1', 'n1', '10'], ['x_2', 'x2', '0'], ['n_2', 'n2', '10']],
    run(p, a) {
      const n1 = posInt(p.n1), n2 = posInt(p.n2), p1 = p.x1 / n1, p2 = p.x2 / n2, pp = (p.x1 + p.x2) / (n1 + n2);
      if (pp <= 0 || pp >= 1) throw bad();
      const z = (p1 - p2) / Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2));
      return [['z', z], ['p', S.pFromZ(z, a)], ['\\hat{p}_1', p1], ['\\hat{p}_2', p2], ['\\hat{p}', pp], ['n_1', n1], ['n_2', n2]];
    } },
  { group: 't tests' },
  { name: '1-Sample t Test', list: true, alt: 'mu', fVar: [['μ_0', 'mu0', '0'], ['\\overline{x}', 'xb', '0'], ['s_x', 'sx', '1'], ['n', 'n', '10']], fList: [['μ_0', 'mu0', '0']], lists: 1,
    run(p, a) { const d = p.data || { mean: p.xb, sx: pos(p.sx), n: posInt(p.n) }; if (d.n < 2) throw bad(); const t = (d.mean - p.mu0) / (d.sx / Math.sqrt(d.n)); return [['t', t], ['p', S.pFromT(t, d.n - 1, a)], ['df', d.n - 1], ['\\overline{x}', d.mean], ['s_x', d.sx], ['n', d.n]]; } },
  { name: '2-Sample t Test', list: true, alt: 'mu2', pooled: true, fVar: [['\\overline{x}_1', 'x1', '0'], ['s_{x1}', 's1', '1'], ['n_1', 'n1', '10'], ['\\overline{x}_2', 'x2', '0'], ['s_{x2}', 's2', '1'], ['n_2', 'n2', '10']], fList: [], lists: 2,
    run(p, a, pooled) {
      const d1 = p.data || { mean: p.x1, sx: pos(p.s1), n: posInt(p.n1) }, d2 = p.data2 || { mean: p.x2, sx: pos(p.s2), n: posInt(p.n2) };
      if (d1.n < 2 || d2.n < 2) throw bad();
      let t, df, sp;
      if (pooled) {
        df = d1.n + d2.n - 2;
        sp = Math.sqrt(((d1.n - 1) * d1.sx ** 2 + (d2.n - 1) * d2.sx ** 2) / df);
        t = (d1.mean - d2.mean) / (sp * Math.sqrt(1 / d1.n + 1 / d2.n));
      } else {
        const v1 = d1.sx ** 2 / d1.n, v2 = d2.sx ** 2 / d2.n;
        t = (d1.mean - d2.mean) / Math.sqrt(v1 + v2);
        df = (v1 + v2) ** 2 / (v1 ** 2 / (d1.n - 1) + v2 ** 2 / (d2.n - 1));
      }
      return [['t', t], ['p', S.pFromT(t, df, a)], ['df', df], ['\\overline{x}_1', d1.mean], ['\\overline{x}_2', d2.mean], ['s_{x1}', d1.sx], ['s_{x2}', d2.sx], ...(pooled ? [['s_p', sp]] : []), ['n_1', d1.n], ['n_2', d2.n]];
    } },
  { name: 'Linear Reg t Test', listOnly: true, alt: 'rho', fList: [], lists: 2, xy: true,
    run(p, a) {
      const pts = p.pts;
      const n = pts.length;
      if (n < 3) throw bad();
      const fit = S.regress('lin', pts.map(([x, y]) => [x, y, 1]));
      const b = fit.coef.a, ic = fit.coef.b, r = fit.r;
      const df = n - 2;
      const t = r * Math.sqrt(df / (1 - r * r));
      const s = Math.sqrt(pts.reduce((acc, [x, y]) => acc + (y - (b * x + ic)) ** 2, 0) / df);
      return [['t', t], ['p', S.pFromT(t, df, a)], ['df', df], ['a', ic], ['b', b], ['s', s], ['r', r], ['r^2', r * r]];
    } },
  { group: 'χ² tests' },
  { name: 'χ² GOF Test', listOnly: true, fList: [['df', 'df', '1']], lists: 2, labels: ['Observed', 'Expected'],
    run(p) {
      const [O, E] = [p.L1, p.L2];
      if (O.length !== E.length || !O.length) throw new CalcError('Dimension ERROR');
      if (E.some(v => v <= 0)) throw bad();
      const r = S.chiGOF(O, E, posInt(p.df));
      return [['\\chi^2', r.chi], ['p', r.p], ['df', r.df], ['\\text{CNTRB}', null, '\\left\\{' + r.contrib.map(v => fmtTex(v)).join(',\\,') + '\\right\\}']];
    } },
  { name: 'χ² Two-Way Test', matrix: true,
    run(p) {
      const r = S.chi2way(p.M);
      if (!isFinite(r.chi)) throw bad();
      return [['\\chi^2', r.chi], ['p', r.p], ['df', r.df], ['\\text{Expected}', null, '\\begin{bmatrix}' + r.E.map(row => row.map(fmtTex).join('&')).join('\\\\') + '\\end{bmatrix}']];
    } },
  { group: 'F and ANOVA' },
  { name: '2-Sample F Test', list: true, alt: 'sig', fVar: [['s_{x1}', 's1', '1'], ['n_1', 'n1', '10'], ['s_{x2}', 's2', '1'], ['n_2', 'n2', '10']], fList: [], lists: 2,
    run(p, a) {
      const d1 = p.data || { sx: pos(p.s1), n: posInt(p.n1) }, d2 = p.data2 || { sx: pos(p.s2), n: posInt(p.n2) };
      const F = d1.sx ** 2 / d2.sx ** 2;
      return [['F', F], ['p', fP(F, d1.n - 1, d2.n - 1, a)], ['s_{x1}', d1.sx], ['s_{x2}', d2.sx], ['n_1', d1.n], ['n_2', d2.n]];
    } },
  { name: 'One-Way ANOVA', anova: true,
    run(p) {
      const r = S.anova(p.groups);
      return [['F', r.F], ['p', r.p], ['\\text{df (factor)}', r.dfb], ['\\text{SS (factor)}', r.ssb], ['\\text{MS (factor)}', r.msb], ['\\text{df (error)}', r.dfw], ['\\text{SS (error)}', r.ssw], ['\\text{MS (error)}', r.msw]];
    } }
];

export const INTERVALS = [
  { group: 'Z intervals' },
  { name: '1-Sample Z Interval', list: true, fVar: [['\\text{C-Level}', 'c', '0.95'], ['σ', 's', '1'], ['\\overline{x}', 'xb', '0'], ['n', 'n', '10']], fList: [['\\text{C-Level}', 'c', '0.95'], ['σ', 's', '1']], lists: 1,
    run(p) { const d = p.data || { mean: p.xb, n: posInt(p.n) }; const e = zCrit(prob(p.c)) * pos(p.s) / Math.sqrt(d.n); return [['\\text{Left}', d.mean - e], ['\\text{Right}', d.mean + e], ['\\overline{x}', d.mean], ['n', d.n]]; } },
  { name: '2-Sample Z Interval', list: true, fVar: [['\\text{C-Level}', 'c', '0.95'], ['σ_1', 's1', '1'], ['σ_2', 's2', '1'], ['\\overline{x}_1', 'x1', '0'], ['n_1', 'n1', '10'], ['\\overline{x}_2', 'x2', '0'], ['n_2', 'n2', '10']], fList: [['\\text{C-Level}', 'c', '0.95'], ['σ_1', 's1', '1'], ['σ_2', 's2', '1']], lists: 2,
    run(p) { const d1 = p.data || { mean: p.x1, n: posInt(p.n1) }, d2 = p.data2 || { mean: p.x2, n: posInt(p.n2) }; const e = zCrit(prob(p.c)) * Math.sqrt(pos(p.s1) ** 2 / d1.n + pos(p.s2) ** 2 / d2.n); const m = d1.mean - d2.mean; return [['\\text{Left}', m - e], ['\\text{Right}', m + e], ['\\overline{x}_1', d1.mean], ['\\overline{x}_2', d2.mean]]; } },
  { name: '1-Prop Z Interval', fVar: [['\\text{C-Level}', 'c', '0.95'], ['x', 'x', '0'], ['n', 'n', '10']],
    run(p) { const n = posInt(p.n), ph = p.x / n; if (p.x < 0 || p.x > n) throw bad(); const e = zCrit(prob(p.c)) * Math.sqrt(ph * (1 - ph) / n); return [['\\text{Left}', ph - e], ['\\text{Right}', ph + e], ['\\hat{p}', ph], ['n', n]]; } },
  { name: '2-Prop Z Interval', fVar: [['\\text{C-Level}', 'c', '0.95'], ['x_1', 'x1', '0'], ['n_1', 'n1', '10'], ['x_2', 'x2', '0'], ['n_2', 'n2', '10']],
    run(p) { const n1 = posInt(p.n1), n2 = posInt(p.n2), p1 = p.x1 / n1, p2 = p.x2 / n2; const e = zCrit(prob(p.c)) * Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2); return [['\\text{Left}', p1 - p2 - e], ['\\text{Right}', p1 - p2 + e], ['\\hat{p}_1', p1], ['\\hat{p}_2', p2]]; } },
  { group: 't intervals' },
  { name: '1-Sample t Interval', list: true, fVar: [['\\text{C-Level}', 'c', '0.95'], ['\\overline{x}', 'xb', '0'], ['s_x', 'sx', '1'], ['n', 'n', '10']], fList: [['\\text{C-Level}', 'c', '0.95']], lists: 1,
    run(p) { const d = p.data || { mean: p.xb, sx: pos(p.sx), n: posInt(p.n) }; if (d.n < 2) throw bad(); const e = tCrit(prob(p.c), d.n - 1) * d.sx / Math.sqrt(d.n); return [['\\text{Left}', d.mean - e], ['\\text{Right}', d.mean + e], ['\\overline{x}', d.mean], ['s_x', d.sx], ['n', d.n]]; } },
  { name: '2-Sample t Interval', list: true, pooled: true, fVar: [['\\text{C-Level}', 'c', '0.95'], ['\\overline{x}_1', 'x1', '0'], ['s_{x1}', 's1', '1'], ['n_1', 'n1', '10'], ['\\overline{x}_2', 'x2', '0'], ['s_{x2}', 's2', '1'], ['n_2', 'n2', '10']], fList: [['\\text{C-Level}', 'c', '0.95']], lists: 2,
    run(p, a, pooled) {
      const d1 = p.data || { mean: p.x1, sx: pos(p.s1), n: posInt(p.n1) }, d2 = p.data2 || { mean: p.x2, sx: pos(p.s2), n: posInt(p.n2) };
      let se, df;
      if (pooled) { df = d1.n + d2.n - 2; const sp = Math.sqrt(((d1.n - 1) * d1.sx ** 2 + (d2.n - 1) * d2.sx ** 2) / df); se = sp * Math.sqrt(1 / d1.n + 1 / d2.n); }
      else { const v1 = d1.sx ** 2 / d1.n, v2 = d2.sx ** 2 / d2.n; se = Math.sqrt(v1 + v2); df = (v1 + v2) ** 2 / (v1 ** 2 / (d1.n - 1) + v2 ** 2 / (d2.n - 1)); }
      const e = tCrit(prob(p.c), df) * se, m = d1.mean - d2.mean;
      return [['\\text{Left}', m - e], ['\\text{Right}', m + e], ['df', df], ['\\overline{x}_1', d1.mean], ['\\overline{x}_2', d2.mean]];
    } }
];

function fmtTex(v) {
  if (!isFinite(v)) return '\\text{—}';
  const s = Number(v.toPrecision(6));
  return String(s);
}

export function runForm(app, spec) {
  const ctx = app.ctx;
  const { h, tex, store } = ctx;
  if (!store.testState) store.testState = {};
  const st = store.testState[spec.name] || (store.testState[spec.name] = { mode: spec.listOnly ? 'list' : 'var', alt: 'ne', pooled: false, vals: {}, l1: 0, l2: 1, groups: 3, rows: 2, cols: 2, M: {} });
  ctx.showKeypad(true);
  ctx.setTitle(spec.name);
  app.el.innerHTML = '';
  const back = h('button', { type: 'button', class: 'back' }, '‹ Back');
  back.addEventListener('click', () => app.showList(app.listKind));
  const form = h('div', { class: 'form scroll' }, back);
  const rebuild = () => runForm(app, spec);
  if (spec.list && !spec.listOnly) form.append(h('div', { class: 'field-label' }, 'Data'), ctx.seg([['list', 'List'], ['var', 'Variable']], st.mode, v => { st.mode = v; ctx.save(); rebuild(); }));
  if (spec.alt) form.append(h('div', { class: 'field-label' }, 'Alternative hypothesis'), ctx.seg(ALT[spec.alt], st.alt, v => { st.alt = v; ctx.save(); }));
  if (spec.pooled) form.append(h('div', { class: 'field-label' }, 'Pooled'), ctx.seg([[false, 'Off'], [true, 'On']], st.pooled, v => { st.pooled = v; ctx.save(); }));
  const listOpts = [0, 1, 2, 3, 4, 5].map(i => [i, 'L' + (i + 1)]);
  const useList = spec.listOnly || (spec.list && st.mode === 'list');
  if (useList && spec.lists) {
    const labels = spec.labels || (spec.xy ? ['x list', 'y list'] : spec.lists === 1 ? ['List'] : ['List 1', 'List 2']);
    form.append(h('div', { class: 'field-label' }, labels[0]), ctx.seg(listOpts, st.l1, v => { st.l1 = v; ctx.save(); }));
    if (spec.lists > 1) form.append(h('div', { class: 'field-label' }, labels[1]), ctx.seg(listOpts, st.l2, v => { st.l2 = v; ctx.save(); }));
  }
  if (spec.anova) {
    form.append(h('div', { class: 'field-label' }, 'Groups (List 1 to List n)'), ctx.seg([2, 3, 4, 5, 6].map(n => [n, String(n)]), st.groups, v => { st.groups = v; ctx.save(); }));
  }
  if (spec.matrix) {
    form.append(h('div', { class: 'field-label' }, 'Observed table size'),
      h('div', { class: 'chips' }, h('span', { class: 'chips-label' }, 'Rows'), ...[2, 3, 4, 5, 6].map(n => { const b = h('button', { type: 'button', class: 'chip' + (n === st.rows ? ' on' : '') }, String(n)); b.addEventListener('click', () => { st.rows = n; ctx.save(); rebuild(); }); return b; })),
      h('div', { class: 'chips' }, h('span', { class: 'chips-label' }, 'Cols'), ...[2, 3, 4, 5, 6].map(n => { const b = h('button', { type: 'button', class: 'chip' + (n === st.cols ? ' on' : '') }, String(n)); b.addEventListener('click', () => { st.cols = n; ctx.save(); rebuild(); }); return b; })));
  }
  app.cells = [];
  const fields = useList ? (spec.fList || []) : (spec.fVar || []);
  for (const [label, key, def] of fields) {
    const mf = ctx.makeField(st.vals[key] ?? def, { class: 'cell', onInput: v => { st.vals[key] = v; } });
    app.cells.push(mf);
    form.append(h('label', { class: 'frow' }, h('span', { class: 'flabel', html: tex(label) }), mf));
  }
  if (spec.matrix) {
    const grid = h('div', { class: 'mgrid', style: `grid-template-columns: repeat(${st.cols}, minmax(0,1fr))` });
    for (let i = 0; i < st.rows; i++) for (let j = 0; j < st.cols; j++) {
      const k = i + ',' + j;
      const mf = ctx.makeField(st.M[k] ?? '', { class: 'cell', onInput: v => { st.M[k] = v; } });
      app.cells.push(mf);
      grid.append(mf);
    }
    form.append(grid);
  }
  const out = h('div', { class: 'results' });
  const run = h('button', { type: 'button', class: 'primary wide' }, 'Execute');
  const exec = () => {
    out.innerHTML = '';
    out.classList.add('on');
    try {
      const p = {};
      for (const [, key, def] of fields) {
        const r = ctx.engine.evaluate(st.vals[key] ?? def);
        if (typeof r.value !== 'number') throw bad();
        p[key] = r.value;
      }
      const L = i => store.lists[i].filter(v => typeof v === 'number' && isFinite(v));
      if (useList && spec.lists && !spec.xy && !spec.labels) {
        p.data = listSummary(L(st.l1));
        if (spec.lists > 1) p.data2 = listSummary(L(st.l2));
      }
      if (spec.xy) {
        const xs = store.lists[st.l1], ys = store.lists[st.l2];
        if (xs.length !== ys.length) throw new CalcError('Dimension ERROR');
        p.pts = xs.map((x, i) => [x, ys[i]]);
      }
      if (spec.labels) { p.L1 = L(st.l1); p.L2 = L(st.l2); }
      if (spec.anova) {
        p.groups = Array.from({ length: st.groups }, (_, i) => L(i));
        if (p.groups.some(g => g.length < 2)) throw new CalcError('Dimension ERROR');
      }
      if (spec.matrix) {
        p.M = Array.from({ length: st.rows }, (_, i) => Array.from({ length: st.cols }, (_, j) => {
          const src = st.M[i + ',' + j];
          if (!src || !src.trim()) return 0;
          const r = ctx.engine.evaluate(src);
          if (typeof r.value !== 'number' || r.value < 0) throw bad();
          return r.value;
        }));
      }
      const rows = spec.run(p, st.alt, st.pooled);
      for (const [k, v, raw] of rows) {
        out.append(h('div', { class: 'res-row' }, h('span', { class: 'res-k', html: tex(k + '=') }), h('span', { class: 'res-v', html: tex(raw || ctx.valueLatex(Math.abs(v) < 1e-300 ? 0 : v, {}, 'decimal')) })));
      }
      const pRow = rows.find(r => r[0] === 'p');
      if (pRow) store.vars.Ans = pRow[1];
      ctx.save();
    } catch (e) {
      out.append(h('div', { class: 'res-msg bad' }, e.kind || 'Math ERROR'));
    }
    requestAnimationFrame(() => out.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };
  run.addEventListener('click', exec);
  form.append(run, out);
  app.el.append(form);
  app.execForm = exec;
  if (app.cells[0]) ctx.focusField(app.cells[0]);
  else ctx.showKeypad(false);
}
