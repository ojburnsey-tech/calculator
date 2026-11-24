import { MathfieldElement, convertLatexToMarkup } from '../vendor/mathlive.min.mjs';
import { Engine, ANGLE } from './engine.js';
import * as parse from './parse.js';
import { valueLatex } from './exact.js';
import { calculateApp } from './apps/calculate.js';
import { equationApp } from './apps/equation.js';
import { distributionApp } from './apps/distribution.js';
import { statisticsApp } from './apps/statistics.js';
import { graphApp } from './apps/graph.js';
import { matrixApp, vectorApp } from './apps/matrix.js';
import { basenApp } from './apps/basen.js';
import { physicsApp, periodicApp, constantsList, converterPanel, latexNumber } from './apps/physics.js';
import { recursionApp } from './apps/recursion.js';
import { conicsApp } from './apps/conics.js';
import { graph3dApp } from './apps/graph3d.js';
import { financialApp } from './apps/financial.js';
import { spreadsheetApp } from './apps/spreadsheet.js';
import { geometryApp } from './apps/geometry.js';

MathfieldElement.fontsDirectory = './fonts';
MathfieldElement.soundsDirectory = null;
MathfieldElement.keypressSound = null;
MathfieldElement.plonkSound = null;

const KEY = 'cg-store-v1';
const DEFAULTS = {
  settings: { angle: 'deg', io: 'math', format: 'norm1', digits: 2, complex: 'off', fraction: 'improper' },
  vars: { Ans: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, x: 0, y: 0, z: 0, M: 0 },
  lists: [[], [], [], [], [], []],
  graph: null,
  window: { xmin: -10, xmax: 10, xscl: 1, ymin: -7, ymax: 7, yscl: 1 },
  table: { start: '-5', end: '5', step: '1' }
};

function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) return { ...structuredClone(DEFAULTS), ...s, settings: { ...DEFAULTS.settings, ...s.settings }, vars: { ...DEFAULTS.vars, ...s.vars } };
  } catch (e) {}
  return structuredClone(DEFAULTS);
}

const store = loadStore();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
const engine = new Engine(store);

const $ = (s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
};

const tex = (latex, display = false) => {
  try { return convertLatexToMarkup(latex, { defaultMode: display ? 'math' : 'inline-math' }); }
  catch (e) { return latex; }
};

const view = $('#view');
const keypadEl = $('#keypad');
const titleEl = $('#title');
const statusEl = $('#status');
const homeBtn = $('#homeBtn');

let field = null;
let lastJump = null;
let shift = false;
let current = null;
const fields = new Set();

function makeField(value = '', opts = {}) {
  const mf = new MathfieldElement();
  mf.textContent = value;
  if (opts.placeholder) mf.setAttribute('placeholder', opts.placeholder);
  mf.setAttribute('math-virtual-keyboard-policy', 'manual');
  mf.addEventListener('mount', () => {
    mf.mathVirtualKeyboardPolicy = 'manual';
    mf.smartFence = false;
    mf.smartMode = false;
    mf.smartSuperscript = false;
    mf.inlineShortcuts = {};
    mf.popoverPolicy = 'off';
    mf.environmentPopoverPolicy = 'off';
    mf.menuItems = [];
    mf.removeExtraneousParentheses = false;
    mf.defaultMode = 'math';
  }, { once: true });
  mf.className = 'mf ' + (opts.class || '');
  mf.addEventListener('focusin', () => setField(mf));
  mf.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); press('exe'); }
  });
  mf.addEventListener('input', () => { if (opts.onInput) opts.onInput(mf.value); });
  fields.add(mf);
  return mf;
}

function setField(mf) {
  const fresh = field !== mf;
  if (field && fresh) { field.classList.remove('active'); clearReplace(field); }
  field = mf;
  if (fresh && mf && /\bcell\b/.test(mf.className) && mf.value) { mf._replace = true; mf.classList.add('replace'); }
  if (mf) mf.classList.add('active');
}

function focusField(mf) {
  setField(mf);
  if (mf) { try { mf.focus({ preventScroll: true }); } catch (e) { mf.focus(); } }
}

function clearReplace(mf) { if (mf && mf._replace) { mf._replace = false; mf.classList.remove('replace'); } }

function insert(latex) {
  if (!field) return;
  if (field._replace) { field.value = ''; clearReplace(field); }
  if (document.activeElement !== field) focusField(field);
  field.executeCommand(['insert', latex, { insertionMode: 'replaceSelection', selectionMode: 'placeholder', format: 'latex' }]);
}

const FRAC = '<span class="kf"><i></i><i></i></span>';
const BOX = '<i class="kb"></i>';
const KEYS_TOP = [
  [
    { id: 'shift', label: 'SHIFT', cls: 'shift' },
    { id: 'x', label: '<em>x</em>', s: { label: ',', act: ',' } },
    { id: 'frac', label: FRAC, s: { label: 'θ', act: '\\theta' } },
    { id: 'sqrt', label: '√' + BOX, s: { label: '∛', act: '\\sqrt[3]{#?}' } },
    { id: 'sq', label: '<em>x</em><sup>2</sup>', s: { label: '<em>x</em><sup>−1</sup>', act: '^{-1}', op: true } },
    { id: 'pow', label: '<em>x</em><sup>' + BOX + '</sup>', s: { label: '<sup>' + BOX + '</sup>√', act: '\\sqrt[#?]{#?}' } }
  ],
  [
    { id: 'log', label: 'log', s: { label: '10<sup>' + BOX + '</sup>', act: '10^{#?}' } },
    { id: 'ln', label: 'ln', s: { label: 'e<sup>' + BOX + '</sup>', act: '\\mathrm{e}^{#?}' } },
    { id: 'sin', label: 'sin', s: { label: 'sin<sup>−1</sup>', act: '\\sin^{-1}\\left(#?\\right)' } },
    { id: 'cos', label: 'cos', s: { label: 'cos<sup>−1</sup>', act: '\\cos^{-1}\\left(#?\\right)' } },
    { id: 'tan', label: 'tan', s: { label: 'tan<sup>−1</sup>', act: '\\tan^{-1}\\left(#?\\right)' } },
    { id: 'logab', label: 'log<sub>' + BOX + '</sub>', s: { label: '<em>x</em><sup>3</sup>', act: '^{3}', op: true } }
  ],
  [
    { id: 'lp', label: '(', s: { label: '|' + BOX + '|', act: '\\left|#?\\right|' } },
    { id: 'rp', label: ')', s: { label: '<em>x</em>!', act: '!', op: true } },
    { id: 'pi', label: 'π', s: { label: 'e', act: '\\mathrm{e}' } },
    { id: 'ddx', label: '<sup>d</sup>⁄<sub>d<em>x</em></sub>', s: { label: '°', act: '\\degree' } },
    { id: 'int', label: '∫', s: { label: '<em>n</em>C<em>r</em>', act: '\\,\\mathrm{C}\\,', op: true } },
    { id: 'sum', label: 'Σ', s: { label: '<em>n</em>P<em>r</em>', act: '\\,\\mathrm{P}\\,', op: true } }
  ],
  [
    { id: 'left', label: '◀', cls: 'nav', s: { label: '⇤', act: 'start' } },
    { id: 'right', label: '▶', cls: 'nav', s: { label: '⇥', act: 'end' } },
    { id: 'sd', label: 'S⇔D', cls: 'tool' },
    { id: 'format', label: 'FORMAT', cls: 'tool small' },
    { id: 'variable', label: 'VAR', cls: 'tool small', s: { label: 'STO', act: 'sto' } },
    { id: 'catalog', label: 'CATALOG', cls: 'tool small', s: { label: 'SETUP', act: 'setup' } }
  ]
];
const KEYS_BOTTOM = [
  [{ id: '7', label: '7' }, { id: '8', label: '8' }, { id: '9', label: '9' }, { id: 'del', label: 'DEL', cls: 'del' }, { id: 'ac', label: 'AC', cls: 'ac' }],
  [{ id: '4', label: '4' }, { id: '5', label: '5' }, { id: '6', label: '6' }, { id: 'mul', label: '×', cls: 'op' }, { id: 'div', label: '÷', cls: 'op' }],
  [{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }, { id: 'add', label: '+', cls: 'op' }, { id: 'sub', label: '−', cls: 'op' }],
  [{ id: '0', label: '0' }, { id: 'dot', label: '.', s: { label: '=', act: '=' } }, { id: 'exp10', label: '×10<sup><em>x</em></sup>', s: { label: '<em>i</em>', act: '\\mathrm{i}' } }, { id: 'ans', label: 'Ans', s: { label: 'Ran#', act: '\\operatorname{Ran\\#}' } }, { id: 'exe', label: 'EXE', cls: 'exe' }]
];

const BASIC = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', dot: '.',
  x: 'x', frac: '\\frac{#?}{#?}', sqrt: '\\sqrt{#?}', sq: '^{2}', pow: '^{#?}',
  log: '\\log\\left(#?\\right)', ln: '\\ln\\left(#?\\right)', sin: '\\sin\\left(#?\\right)', cos: '\\cos\\left(#?\\right)', tan: '\\tan\\left(#?\\right)',
  logab: '\\log_{#?}\\left(#?\\right)', lp: '(', rp: ')', pi: '\\pi',
  ddx: '\\frac{\\mathrm{d}}{\\mathrm{d}x}\\left(#?\\right)\\Big|_{x=#?}', int: '\\int_{#?}^{#?}#?\\,\\mathrm{d}x', sum: '\\sum_{x=#?}^{#?}\\left(#?\\right)',
  add: '+', sub: '-', mul: '\\times', div: '\\div', exp10: '\\times10^{#?}', ans: '\\mathrm{Ans}'
};
const OPERATOR_KEYS = new Set(['add', 'sub', 'mul', 'div', 'sq', 'pow']);

function buildKeypad() {
  keypadEl.innerHTML = '';
  const mk = (rows, cls) => {
    const grid = h('div', { class: 'grid ' + cls });
    for (const row of rows) for (const k of row) {
      const b = h('button', { class: 'key ' + (k.cls || ''), 'data-id': k.id, type: 'button' });
      if (k.s) b.append(h('span', { class: 'sl', html: k.s.label }));
      b.append(h('span', { class: 'ml', html: k.label }));
      b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('down'); });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      b.addEventListener('click', e => { e.preventDefault(); press(k.id, k); });
      grid.append(b);
    }
    return grid;
  };
  keypadEl.append(mk(KEYS_TOP, 'top'), mk(KEYS_BOTTOM, 'bottom'));
}

function setShift(v) {
  shift = v;
  keypadEl.classList.toggle('shifted', v);
  renderStatus();
}

function press(id, k) {
  k = k || [...KEYS_TOP, ...KEYS_BOTTOM].flat().find(x => x.id === id) || { id };
  if (id === 'shift') { setShift(!shift); return; }
  const wasShift = shift;
  if (shift) setShift(false);
  if (wasShift && k.s) {
    const act = k.s.act;
    if (act === 'start') { field && field.executeCommand('moveToMathfieldStart'); return; }
    if (act === 'end') { field && field.executeCommand('moveToMathfieldEnd'); return; }
    if (act === 'sto') { openVariables(true); return; }
    if (act === 'setup') { openSettings(); return; }
    if (current && current.onKey && current.onKey('s:' + k.id, act)) return;
    if (k.s.op && current && current.beforeOperator) current.beforeOperator();
    insert(act);
    return;
  }
  if (current && current.onKey && current.onKey(id)) return;
  if (['del', 'left', 'right', 'exe', 'ac'].includes(id)) clearReplace(field);
  switch (id) {
    case 'del': if (field) field.executeCommand('deleteBackward'); return;
    case 'ac': if (field) { field.value = ''; field.dispatchEvent(new Event('input')); } if (current && current.onAC) current.onAC(); return;
    case 'left': if (field) field.executeCommand('moveToPreviousChar'); return;
    case 'right': if (field) {
      let after = '';
      try { after = field.getValue(field.position, field.lastOffset, 'latex'); } catch (e) {}
      if (lastJump && lastJump.f === field && lastJump.v === field.value && lastJump.p === field.position) { lastJump = null; return; }
      if (after.includes('placeholder')) {
        const before = field.position;
        field.executeCommand('moveToNextPlaceholder');
        lastJump = field.position !== before ? { f: field, v: field.value, p: field.position } : null;
      } else { lastJump = null; field.executeCommand('moveToNextChar'); }
    } return;
    case 'exe': if (current && current.onExe) current.onExe(); return;
    case 'catalog': openCatalog(); return;
    case 'variable': openVariables(false); return;
    case 'sd': case 'format': return;
  }
  if (BASIC[id] !== undefined) {
    if (OPERATOR_KEYS.has(id) && current && current.beforeOperator) current.beforeOperator();
    insert(BASIC[id]);
  }
}

const sheetEl = $('#sheet');
const scrimEl = $('#scrim');
let sheetClose = null;

function openSheet(title, body, opts = {}) {
  sheetEl.innerHTML = '';
  const head = h('div', { class: 'sheet-head' },
    h('div', { class: 'grab' }),
    h('div', { class: 'sheet-bar' }, h('h2', {}, title), h('button', { class: 'done', type: 'button', onclick: () => closeSheet() }, opts.doneLabel || 'Done')));
  const content = h('div', { class: 'sheet-body' }, body);
  sheetEl.append(head, content);
  sheetEl.classList.toggle('tall', !!opts.tall);
  sheetEl.classList.toggle('with-keys', !!opts.keys);
  document.body.classList.add('sheet-open');
  document.body.classList.toggle('sheet-keys', !!opts.keys);
  sheetClose = opts.onClose || null;
  requestAnimationFrame(() => sheetEl.classList.add('on'));
  return content;
}

function closeSheet() {
  sheetEl.classList.remove('on');
  document.body.classList.remove('sheet-open', 'sheet-keys');
  const cb = sheetClose; sheetClose = null;
  if (cb) cb();
}
scrimEl.addEventListener('click', () => closeSheet());

function seg(options, value, onChange) {
  const wrap = h('div', { class: 'seg' });
  for (const [v, label] of options) {
    const b = h('button', { type: 'button', class: v === value ? 'on' : '' }, label);
    b.addEventListener('click', () => { [...wrap.children].forEach(c => c.classList.remove('on')); b.classList.add('on'); onChange(v); });
    wrap.append(b);
  }
  return wrap;
}

function numField(value = '', opts = {}) {
  const input = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', class: 'num-in', value: String(value), 'aria-label': opts.label || 'Number' });
  const pm = h('button', { type: 'button', class: 'pm', 'aria-label': 'Change sign' }, '±');
  pm.addEventListener('click', () => {
    const v = input.value.trim();
    input.value = v.startsWith('-') || v.startsWith('−') ? v.slice(1) : '-' + v;
    input.dispatchEvent(new Event('input'));
  });
  if (opts.onInput) input.addEventListener('input', () => opts.onInput(input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); if (opts.onEnter) opts.onEnter(); } });
  const el = h('div', { class: 'num-wrap' }, input, opts.noSign ? null : pm);
  return {
    el, input,
    get() {
      const raw = input.value.trim().replace(/−/g, '-').replace(/×/g, '*');
      if (raw === '') return opts.empty !== undefined ? opts.empty : NaN;
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
      try {
        const latex = raw.replace(/pi|π/g, '\\pi ').replace(/sqrt\(([^)]*)\)/g, '\\sqrt{$1}').replace(/\*/g, '\\times ').replace(/\//g, '\\div ');
        const r = engine.evaluate(latex);
        return typeof r.value === 'number' ? r.value : NaN;
      } catch (e) { return NaN; }
    },
    set(v) { input.value = String(v); }
  };
}

function openSettings() {
  const s = store.settings;
  const set = (k, v) => { s[k] = v; save(); renderStatus(); if (current && current.onSettings) current.onSettings(); };
  const row = (label, ctl) => h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, label), ctl);
  const digits = h('div', { class: 'digits' });
  const renderDigits = () => {
    digits.innerHTML = '';
    if (s.format !== 'fix' && s.format !== 'sci') return;
    const range = s.format === 'fix' ? [0, 9] : [1, 10];
    for (let d = range[0]; d <= range[1]; d++) {
      const b = h('button', { type: 'button', class: s.digits === d ? 'on' : '' }, String(d));
      b.addEventListener('click', () => { set('digits', d); renderDigits(); });
      digits.append(b);
    }
  };
  renderDigits();
  const body = h('div', { class: 'settings' },
    row('Angle unit', seg([['deg', 'Degree'], ['rad', 'Radian'], ['gra', 'Gradian']], s.angle, v => set('angle', v))),
    row('Input / output', seg([['math', 'Math / Math'], ['dec', 'Math / Decimal']], s.io, v => set('io', v))),
    row('Number format', h('div', {}, seg([['norm1', 'Norm 1'], ['norm2', 'Norm 2'], ['fix', 'Fix'], ['sci', 'Sci']], s.format, v => { if (v === 'fix') s.digits = Math.min(s.digits ?? 2, 9); if (v === 'sci') s.digits = Math.max(1, s.digits || 10); set('format', v); renderDigits(); }), digits)),
    row('Fraction result', seg([['improper', 'd/c'], ['mixed', 'a b/c']], s.fraction, v => set('fraction', v))),
    row('Complex result', seg([['off', 'Real'], ['abi', 'a+bi'], ['polar', 'r∠θ']], s.complex, v => set('complex', v)))
  );
  openSheet('Settings', body);
}

const CATALOG = [
  ['Probability', [['nCr', '\\,\\mathrm{C}\\,', true], ['nPr', '\\,\\mathrm{P}\\,', true], ['x!', '!', true], ['Ran#', '\\operatorname{Ran\\#}'], ['RanInt(a,b)', '\\operatorname{RanInt}\\left(#?\\right)']]],
  ['Numeric', [['Abs', '\\left|#?\\right|'], ['Int', '\\operatorname{Int}\\left(#?\\right)'], ['Intg', '\\operatorname{Intg}\\left(#?\\right)'], ['Rnd', '\\operatorname{Rnd}\\left(#?\\right)'], ['GCD(a,b)', '\\operatorname{GCD}\\left(#?\\right)'], ['LCM(a,b)', '\\operatorname{LCM}\\left(#?\\right)'], ['Pol(x,y)', '\\operatorname{Pol}\\left(#?\\right)'], ['Rec(r,θ)', '\\operatorname{Rec}\\left(#?\\right)']]],
  ['Hyperbolic', [['sinh', '\\sinh\\left(#?\\right)'], ['cosh', '\\cosh\\left(#?\\right)'], ['tanh', '\\tanh\\left(#?\\right)'], ['sinh⁻¹', '\\sinh^{-1}\\left(#?\\right)'], ['cosh⁻¹', '\\cosh^{-1}\\left(#?\\right)'], ['tanh⁻¹', '\\tanh^{-1}\\left(#?\\right)']]],
  ['Angle', [['° degrees', '\\degree'], ['r radians', '\\mathrm{r}'], ['g gradians', '\\mathrm{g}']]],
  ['Calculus', [['d/dx', BASIC.ddx], ['∫ dx', BASIC.int], ['Σ sum', BASIC.sum], ['Π product', '\\prod_{x=#?}^{#?}\\left(#?\\right)']]],
  ['Complex', [['i', '\\mathrm{i}'], ['arg', '\\operatorname{arg}\\left(#?\\right)'], ['Conjg', '\\operatorname{Conjg}\\left(#?\\right)'], ['ReP', '\\operatorname{ReP}\\left(#?\\right)'], ['ImP', '\\operatorname{ImP}\\left(#?\\right)']]],
  ['Powers and roots', [['x²', '^{2}', true], ['x³', '^{3}', true], ['x⁻¹', '^{-1}', true], ['xⁿ', '^{#?}', true], ['√', '\\sqrt{#?}'], ['∛', '\\sqrt[3]{#?}'], ['ⁿ√', '\\sqrt[#?]{#?}'], ['10ˣ', '10^{#?}'], ['eˣ', '\\mathrm{e}^{#?}'], ['logₐb', BASIC.logab]]],
  ['Other', [['Ans', '\\mathrm{Ans}'], ['%', '\\%', true], ['÷R remainder', '\\div\\mathrm{R}', true], [',', ','], ['=', '=']]]
];

function openCatalog() {
  const body = h('div', { class: 'catalog' });
  for (const [group, items] of CATALOG) {
    body.append(h('div', { class: 'cat-h' }, group));
    const grid = h('div', { class: 'cat-grid' });
    for (const [label, latex, op] of items) {
      grid.append(h('button', { type: 'button', class: 'cat-item', onclick: () => { closeSheet(); if (op && current && current.beforeOperator) current.beforeOperator(); insert(latex); } }, label));
    }
    body.append(grid);
  }
  body.append(h('div', { class: 'cat-h' }, 'Science'), h('div', { class: 'cat-grid two' },
    h('button', { type: 'button', class: 'cat-item', onclick: () => openConstants() }, 'Scientific constants'),
    h('button', { type: 'button', class: 'cat-item', onclick: () => openConversion() }, 'Unit conversion')));
  openSheet('Catalog', body, { tall: true });
}

function openConstants() {
  const target = field;
  const body = constantsList(ctx, c => { closeSheet(); if (target) focusField(target); insert(latexNumber(c.val)); });
  openSheet('Scientific constants', body, { tall: true });
}

function openConversion() {
  const target = field;
  const body = converterPanel(ctx, { useLabel: 'Insert result', onUse: v => { closeSheet(); if (target) focusField(target); insert(latexNumber(v)); } });
  openSheet('Unit conversion', body, { tall: true });
}

function toast(msg) {
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('on'));
  setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 300); }, 1600);
}

const VAR_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z', 'M'];
function openVariables(storeMode) {
  const fmt = v => {
    try { return tex(valueLatex(v, { root: false, pi: false }, store.settings, 'decimal', ANGLE[store.settings.angle])); }
    catch (e) { return String(v); }
  };
  const body = h('div', { class: 'vars' });
  body.append(h('p', { class: 'note' }, storeMode ? 'Tap a variable to store Ans in it.' : 'Tap a variable to put it in your calculation. Use Store to save Ans in it.'));
  const ansRow = h('div', { class: 'var-row' }, h('div', { class: 'var-name' }, 'Ans'), h('div', { class: 'var-val', html: fmt(store.vars.Ans) }));
  body.append(ansRow);
  for (const n of VAR_NAMES) {
    const val = h('div', { class: 'var-val', html: fmt(store.vars[n] ?? 0) });
    const stoBtn = h('button', { type: 'button', class: 'pill', onclick: e => { e.stopPropagation(); store.vars[n] = store.vars.Ans; save(); val.innerHTML = fmt(store.vars[n]); } }, 'Store');
    const row = h('button', { type: 'button', class: 'var-row', onclick: () => {
      if (storeMode) { store.vars[n] = store.vars.Ans; save(); val.innerHTML = fmt(store.vars[n]); return; }
      closeSheet(); insert(n === 'x' || n === 'y' || n === 'z' ? n : n);
    } }, h('div', { class: 'var-name' }, h('em', {}, n)), val, storeMode ? null : stoBtn);
    body.append(row);
  }
  body.append(h('button', { type: 'button', class: 'wide danger', onclick: () => { for (const n of VAR_NAMES) store.vars[n] = 0; save(); closeSheet(); } }, 'Clear all variables'));
  openSheet(storeMode ? 'Store Ans' : 'Variables', body, { tall: true });
}

function renderStatus() {
  const s = store.settings;
  const parts = [];
  if (shift) parts.push('<b class="st-shift">S</b>');
  parts.push('<span>' + { deg: 'Deg', rad: 'Rad', gra: 'Gra' }[s.angle] + '</span>');
  if (s.io === 'dec') parts.push('<span>Dec</span>');
  if (s.format === 'fix') parts.push('<span>Fix' + s.digits + '</span>');
  if (s.format === 'sci') parts.push('<span>Sci' + s.digits + '</span>');
  if (s.complex !== 'off') parts.push('<span>' + (s.complex === 'polar' ? 'r∠θ' : 'a+bi') + '</span>');
  statusEl.innerHTML = parts.join('');
}

const APPS = [calculateApp, statisticsApp, distributionApp, spreadsheetApp, graphApp, geometryApp, recursionApp, conicsApp, graph3dApp, equationApp, matrixApp, vectorApp, basenApp, financialApp, physicsApp, periodicApp];

const ctx = {
  store, save, engine, parse, h, tex, makeField, numField, focusField, setField, insert, openSheet, closeSheet, seg,
  get field() { return field; },
  showKeypad(v) { document.body.classList.toggle('no-keys', !v); },
  setTitle(t) { titleEl.textContent = t; },
  angleFactor() { return ANGLE[store.settings.angle]; },
  valueLatex: (v, flags, mode, s) => valueLatex(v, flags, s || store.settings, mode, ANGLE[store.settings.angle]),
  press,
  toast,
  openAppById(id) { const a = APPS.find(x => x.id === id); if (a) openApp(a); }
};

function cleanupFields() {
  for (const f of [...fields]) if (!document.contains(f)) fields.delete(f);
}

function openApp(app) {
  if (current && current.unmount) current.unmount();
  view.innerHTML = '';
  field = null;
  current = app;
  document.body.classList.remove('home');
  ctx.showKeypad(true);
  titleEl.textContent = app.title;
  app.mount(view, ctx);
  cleanupFields();
  try { sessionStorage.setItem('cg-app', app.id); } catch (e) {}
}

const ICONS = {
  calculate: '<svg viewBox="0 0 48 48"><rect x="9" y="7" width="30" height="34" rx="6"/><rect x="14" y="12" width="20" height="8" rx="2" class="f"/><circle cx="17" cy="27" r="2" class="f"/><circle cx="24" cy="27" r="2" class="f"/><circle cx="31" cy="27" r="2" class="f"/><circle cx="17" cy="34" r="2" class="f"/><circle cx="24" cy="34" r="2" class="f"/><circle cx="31" cy="34" r="2" class="f"/></svg>',
  equation: '<svg viewBox="0 0 48 48"><path d="M10 17h28M10 31h28" /><path d="M24 10v14" /></svg>',
  statistics: '<svg viewBox="0 0 48 48"><path d="M11 38V24M20 38V14M29 38V20M38 38V9"/></svg>',
  distribution: '<svg viewBox="0 0 48 48"><path d="M7 37c6 0 8-24 17-24s11 24 17 24"/><path d="M7 37h34"/></svg>',
  graph: '<svg viewBox="0 0 48 48"><path d="M8 24h32M24 8v32" class="thin"/><path d="M9 36c7-1 9-24 15-24s8 18 15 20"/></svg>',
  spreadsheet: '<svg viewBox="0 0 48 48"><rect x="8" y="9" width="32" height="30" rx="4"/><path d="M8 19h32M8 29h32M19 9v30M30 9v30" class="thin"/></svg>',
  geometry: '<svg viewBox="0 0 48 48"><path d="M10 37 24 10l14 27Z"/><circle cx="24" cy="28" r="7" class="thin"/></svg>',
  recursion: '<svg viewBox="0 0 48 48"><circle cx="11" cy="35" r="2.5" class="f"/><circle cx="19" cy="29" r="2.5" class="f"/><circle cx="27" cy="21" r="2.5" class="f"/><circle cx="35" cy="11" r="2.5" class="f"/><path d="M8 40h32" class="thin"/></svg>',
  conics: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="24" rx="16" ry="10"/><path d="M8 8c10 6 22 6 32 0M8 40c10-6 22-6 32 0" class="thin"/></svg>',
  graph3d: '<svg viewBox="0 0 48 48"><path d="M24 8 39 16v16L24 40 9 32V16Z"/><path d="M9 16l15 8 15-8M24 24v16" class="thin"/></svg>',
  matrix: '<svg viewBox="0 0 48 48"><path d="M14 9h-4v30h4M34 9h4v30h-4"/><circle cx="19" cy="18" r="2.2" class="f"/><circle cx="29" cy="18" r="2.2" class="f"/><circle cx="19" cy="30" r="2.2" class="f"/><circle cx="29" cy="30" r="2.2" class="f"/></svg>',
  vector: '<svg viewBox="0 0 48 48"><path d="M10 38 36 12M24 12h12v12"/></svg>',
  basen: '<svg viewBox="0 0 48 48"><text x="24" y="31" text-anchor="middle" font-size="17" font-weight="700" fill="#fff" stroke="none" font-family="-apple-system,system-ui,sans-serif">0x1F</text></svg>',
  financial: '<svg viewBox="0 0 48 48"><path d="M30 13c-2-3-12-4-12 5 0 6 0 10-4 17h20M13 26h14"/></svg>',
  physics: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="3" class="f"/><ellipse cx="24" cy="24" rx="16" ry="6.5" class="thin"/><ellipse cx="24" cy="24" rx="16" ry="6.5" transform="rotate(60 24 24)" class="thin"/><ellipse cx="24" cy="24" rx="16" ry="6.5" transform="rotate(-60 24 24)" class="thin"/></svg>',
  periodic: '<svg viewBox="0 0 48 48"><rect x="11" y="10" width="26" height="28" rx="4"/><text x="24" y="31" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" stroke="none" font-family="-apple-system,system-ui,sans-serif">Fe</text></svg>'
};

function showHome() {
  if (current && current.unmount) current.unmount();
  current = null;
  field = null;
  view.innerHTML = '';
  document.body.classList.add('home');
  ctx.showKeypad(false);
  titleEl.textContent = 'Home';
  const grid = h('div', { class: 'home-grid' });
  for (const app of APPS) {
    grid.append(h('button', { type: 'button', class: 'tile tile-' + app.id, onclick: () => openApp(app) },
      h('span', { class: 'tile-icon', html: ICONS[app.id] }), h('span', { class: 'tile-name' }, app.title)));
  }
  view.append(grid);
  try { sessionStorage.removeItem('cg-app'); } catch (e) {}
}

homeBtn.addEventListener('click', () => { closeSheet(); showHome(); });
$('#setBtn').addEventListener('click', () => openSettings());

document.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'MATH-FIELD') return;
  if (e.key === 'Escape') closeSheet();
});
['gesturestart', 'gesturechange', 'gestureend', 'dblclick'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', e => { if (e.touches.length > 1 && !e.target.closest('canvas')) e.preventDefault(); }, { passive: false });

buildKeypad();
renderStatus();
await customElements.whenDefined('math-field');
const last = (() => { try { return sessionStorage.getItem('cg-app'); } catch (e) { return null; } })();
const lastApp = APPS.find(a => a.id === last);
if (lastApp) openApp(lastApp); else showHome();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
