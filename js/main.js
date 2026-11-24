import { MathfieldElement, convertLatexToMarkup } from '../vendor/mathlive.min.mjs';
import { Engine, ANGLE } from './engine.js';
import * as parse from './parse.js';
import { valueLatex } from './exact.js';
import { calculateApp } from './apps/calculate.js';
import { equationApp } from './apps/equation.js';
import { graphApp } from './apps/graph.js';
import { matrixApp, vectorApp } from './apps/matrix.js';
import { physicsApp, periodicApp, constantsList, converterPanel, latexNumber } from './apps/physics.js';

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
let saveTimer;
function flushSave() {
  if (saveTimer === undefined) return;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
}

// Coalesce writes while typing and commit pending work before iOS suspends the app.
function save() {
  if (saveTimer === undefined) saveTimer = setTimeout(flushSave, 120);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
});
window.addEventListener('pagehide', flushSave);
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
const controlsEl = $('#controls');
const tabsEl = $('#displayTabs');
const connectionEl = $('#connection');

let field = null;
let lastJump = null;
let modifier = null;
let displayTabs = [];
let activeTab = null;
let homeTiles = [];
let homeIndex = 0;
let current = null;
let navigation = 0;

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
  return mf;
}

function setField(mf) {
  const fresh = field !== mf;
  if (fresh) lastJump = null;
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
const key = (id, label, options = {}) => ({ id, label, ...options });
const shifted = (label, act, op = false) => ({ label, act, op });

// Keep the original action IDs so the existing apps can handle the new keypad.
const COMMAND_KEYS = [
  [key('home', 'Home'), key('settings', 'Settings'), key('back', 'Back'), key('prev-tab', '|‹', { name: 'Previous tab' })],
  [
    key('up', '⌃', { name: 'Up', cls: 'up' }),
    key('left', '‹', { name: 'Left', cls: 'left', s: shifted('⇤', 'start') }),
    key('ok', 'OK', { cls: 'ok' }),
    key('right', '›', { name: 'Right', cls: 'right', s: shifted('⇥', 'end') }),
    key('down', '⌄', { name: 'Down', cls: 'down' })
  ],
  [
    key('variable', 'Variable', { s: shifted('STO', 'sto') }),
    key('catalog', 'Catalog', { s: shifted('SETUP', 'setup') }),
    key('tools', 'Tools'),
    key('next-tab', '›|', { name: 'Next tab' })
  ]
];

const MODIFIER_KEYS = [
  key('shift', 'Shift', { cls: 'shift' }),
  key('alpha', 'Alpha', { cls: 'alpha' }),
  key('pi', 'π', { s: shifted('e', '\\mathrm{e}') }),
  key('ans', 'Ans', { s: shifted('Ran#', '\\operatorname{Ran\\#}') }),
  key('sd', 'S⇔D', { name: 'Exact or decimal' })
];

const SCIENCE_KEYS = [
  key('x', '<em>x</em>', { name: 'Variable x', a: 'A', s: shifted(',', ',') }),
  key('frac', FRAC, { name: 'Fraction', a: 'B', s: shifted('θ', '\\theta') }),
  key('sqrt', '√' + BOX, { name: 'Square root', a: 'C', s: shifted('∛', '\\sqrt[3]{#?}') }),
  key('pow', '<em>x</em><sup>' + BOX + '</sup>', { name: 'Power', a: 'D', s: shifted('<sup>' + BOX + '</sup>√', '\\sqrt[#?]{#?}') }),
  key('sq', '<em>x</em><sup>2</sup>', { name: 'Square', a: 'E', s: shifted('<em>x</em><sup>−1</sup>', '^{-1}', true) }),
  key('expe', '<em>e</em><sup>' + BOX + '</sup>', { name: 'Exponential', a: 'F' }),
  key('comma', ',', { name: 'Comma' }),
  key('sin', 'sin', { s: shifted('sin<sup>−1</sup>', '\\sin^{-1}\\left(#?\\right)') }),
  key('cos', 'cos', { s: shifted('cos<sup>−1</sup>', '\\cos^{-1}\\left(#?\\right)') }),
  key('tan', 'tan', { s: shifted('tan<sup>−1</sup>', '\\tan^{-1}\\left(#?\\right)') }),
  key('lp', '(', { name: 'Open parenthesis', s: shifted('|' + BOX + '|', '\\left|#?\\right|') }),
  key('rp', ')', { name: 'Close parenthesis', s: shifted('<em>x</em>!', '!', true) }),
  key('logab', 'log<sub>' + BOX + '</sub>', { name: 'Logarithm with base', s: shifted('<em>x</em><sup>3</sup>', '^{3}', true) }),
  key('log', 'log', { s: shifted('10<sup>' + BOX + '</sup>', '10^{#?}') }),
  key('ln', 'ln', { s: shifted('e<sup>' + BOX + '</sup>', '\\mathrm{e}^{#?}') }),
  key('ddx', 'd/d<em>x</em>', { name: 'Derivative', s: shifted('°', '\\degree') }),
  key('int', '∫', { name: 'Integral', s: shifted('<em>n</em>C<em>r</em>', '\\,\\mathrm{C}\\,', true) }),
  key('sum', 'Σ', { name: 'Summation', s: shifted('<em>n</em>P<em>r</em>', '\\,\\mathrm{P}\\,', true) })
];

const NUMBER_KEYS = [
  key('7', '7', { a: 'M' }), key('8', '8'), key('9', '9'), key('del', 'DEL', { name: 'Delete', cls: 'del' }), key('ac', 'AC', { name: 'All clear', cls: 'ac' }),
  key('4', '4'), key('5', '5'), key('6', '6'), key('mul', '×', { name: 'Multiply', cls: 'op' }), key('div', '÷', { name: 'Divide', cls: 'op' }),
  key('1', '1'), key('2', '2'), key('3', '3'), key('add', '+', { name: 'Add', cls: 'op', a: 'x' }), key('sub', '−', { name: 'Subtract', cls: 'op', a: 'y' }),
  key('0', '0', { a: 'z' }), key('dot', '.', { name: 'Decimal point', s: shifted('=', '=') }), key('exp10', '×10<sup><em>x</em></sup>', { name: 'Scientific notation', s: shifted('<em>i</em>', '\\mathrm{i}') }),
  key('format', 'Format', { cls: 'small' }), key('exe', 'EXE', { cls: 'exe' })
];

const KEYS = new Map([...COMMAND_KEYS.flat(), ...MODIFIER_KEYS, ...SCIENCE_KEYS, ...NUMBER_KEYS].map(k => [k.id, k]));

const BASIC = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', dot: '.',
  x: 'x', frac: '\\frac{#?}{#?}', sqrt: '\\sqrt{#?}', sq: '^{2}', pow: '^{#?}',
  log: '\\log\\left(#?\\right)', ln: '\\ln\\left(#?\\right)', sin: '\\sin\\left(#?\\right)', cos: '\\cos\\left(#?\\right)', tan: '\\tan\\left(#?\\right)',
  logab: '\\log_{#?}\\left(#?\\right)', lp: '(', rp: ')', pi: '\\pi',
  ddx: '\\frac{\\mathrm{d}}{\\mathrm{d}x}\\left(#?\\right)\\Big|_{x=#?}', int: '\\int_{#?}^{#?}#?\\,\\mathrm{d}x', sum: '\\sum_{x=#?}^{#?}\\left(#?\\right)',
  comma: ',', expe: '\\mathrm{e}^{#?}',
  add: '+', sub: '-', mul: '\\times', div: '\\div', exp10: '\\times10^{#?}', ans: '\\mathrm{Ans}'
};
const OPERATOR_KEYS = new Set(['add', 'sub', 'mul', 'div', 'sq', 'pow']);
const modifierLabels = [];

function buildKeypad() {
  const group = (keys, cls) => {
    const grid = h('div', { class: cls });
    for (const k of keys) {
      const b = h('button', {
        class: 'key ' + (k.cls || ''), 'data-id': k.id, type: 'button', 'aria-label': k.name,
        'aria-pressed': ['shift', 'alpha'].includes(k.id) ? 'false' : null
      });
      const label = h('span', { class: 'ml', html: k.label });
      if (k.s || k.a) {
        b.append(h('span', { class: 'legends', 'aria-hidden': 'true' },
          h('span', { class: 'sl', html: k.s?.label || '' }), h('span', { class: 'al' }, k.a)));
        modifierLabels.push({ key: k, button: b, label });
      }
      b.append(label);
      b.addEventListener('pointerdown', e => {
        if (!e.isPrimary || e.button !== 0) return;
        // Keep the expression cursor in place while the on-screen keypad is used.
        e.preventDefault();
        b.classList.add('pressed');
      });
      const up = () => b.classList.remove('pressed');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('click', () => press(k.id));
      grid.append(b);
    }
    return grid;
  };
  controlsEl.append(
    group(COMMAND_KEYS[0], 'command-cluster'),
    group(COMMAND_KEYS[1], 'direction-pad'),
    group(COMMAND_KEYS[2], 'command-cluster')
  );
  keypadEl.append(
    group(MODIFIER_KEYS, 'modifier-keys'),
    group(SCIENCE_KEYS, 'science-keys'),
    group(NUMBER_KEYS, 'number-keys')
  );
}

function setModifier(next) {
  if (next === modifier) return;
  modifier = next;
  document.body.classList.toggle('shifted', next === 'shift');
  document.body.classList.toggle('alpha-on', next === 'alpha');
  for (const { key, button, label } of modifierLabels) {
    const alternate = next === 'shift' ? key.s?.label : next === 'alpha' ? key.a : undefined;
    label.innerHTML = alternate ?? key.label;
    button.classList.toggle('modifier-label', alternate !== undefined);
    if (key.name) {
      if (alternate !== undefined) button.removeAttribute('aria-label');
      else button.setAttribute('aria-label', key.name);
    }
  }
  for (const id of ['shift', 'alpha']) {
    const button = $('.key[data-id="' + id + '"]');
    if (button) button.setAttribute('aria-pressed', String(next === id));
  }
  renderStatus();
}

function press(id) {
  const k = KEYS.get(id);
  if (id === 'shift' || id === 'alpha') { setModifier(modifier === id ? null : id); return; }
  const activeModifier = modifier;
  if (modifier) setModifier(null);

  if (id === 'home') { closeSheet(); showHome(); return; }
  if (id === 'back') { goBack(); return; }
  if (id === 'settings') { if (!sheetEl.inert) closeSheet(); openSettings(); return; }
  if (!sheetEl.inert) return;
  if (id === 'prev-tab' || id === 'next-tab') { stepTab(id === 'prev-tab' ? -1 : 1); return; }
  if (!current) { pressHomeKey(id, activeModifier === 'alpha' ? k?.a : null); return; }
  if (id === 'tools') { openTools(); return; }
  if (id === 'ok') id = 'exe';

  if (activeModifier === 'alpha' && k?.a) { insert(k.a); return; }
  if (activeModifier === 'shift' && k?.s) {
    const act = k.s.act;
    if (act === 'start') { field?.executeCommand('moveToMathfieldStart'); return; }
    if (act === 'end') { field?.executeCommand('moveToMathfieldEnd'); return; }
    if (act === 'sto') { openVariables(true); return; }
    if (act === 'setup') { openSettings(); return; }
    if (current.onKey?.('s:' + k.id, act)) return;
    if (k.s.op) current.beforeOperator?.();
    insert(act);
    return;
  }
  if (current && current.onKey && current.onKey(id)) return;
  if (['del', 'left', 'right', 'exe', 'ac'].includes(id)) clearReplace(field);
  switch (id) {
    case 'del': if (field) field.executeCommand('deleteBackward'); return;
    case 'ac': if (field) { field.value = ''; field.dispatchEvent(new Event('input')); } if (current && current.onAC) current.onAC(); return;
    case 'up': case 'down': {
      const visibleFields = [...view.querySelectorAll('math-field')].filter(el => el.getClientRects().length);
      const index = visibleFields.indexOf(field);
      const next = visibleFields[index + (id === 'up' ? -1 : 1)];
      if (next) { focusField(next); next.scrollIntoView({ block: 'nearest' }); }
      return;
    }
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
let sheetReturnFocus = null;

function openSheet(title, body, opts = {}) {
  if (sheetEl.inert) sheetReturnFocus = document.activeElement;
  sheetEl.inert = false;
  view.inert = true;
  tabsEl.inert = true;
  sheetEl.innerHTML = '';
  const head = h('div', { class: 'sheet-head' },
    h('div', { class: 'sheet-bar' }, h('h2', { id: 'sheetTitle' }, title), h('button', { class: 'done', type: 'button', onclick: () => closeSheet() }, opts.doneLabel || 'Done')));
  const content = h('div', { class: 'sheet-body' }, body);
  sheetEl.append(head, content);
  sheetEl.classList.toggle('tall', !!opts.tall);
  document.body.classList.add('sheet-open');
  sheetClose = opts.onClose || null;
  sheetEl.classList.add('on');
  $('.done', sheetEl).focus({ preventScroll: true });
  return content;
}

function closeSheet() {
  if (sheetEl.inert) return;
  sheetEl.inert = true;
  view.inert = false;
  tabsEl.inert = false;
  sheetEl.classList.remove('on');
  document.body.classList.remove('sheet-open');
  const cb = sheetClose;
  const returnFocus = sheetReturnFocus;
  sheetClose = null;
  sheetReturnFocus = null;
  if (cb) cb();
  if (sheetEl.inert && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
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
  const format = { norm1: 'Norm 1', norm2: 'Norm 2', fix: 'Fix ' + s.digits, sci: 'Sci ' + s.digits };
  const parts = [
    modifier ? h('b', { class: 'st-modifier ' + modifier }, modifier === 'shift' ? 'Shift' : 'Alpha') : null,
    h('span', {}, { deg: 'Deg', rad: 'Rad', gra: 'Gra' }[s.angle]),
    h('span', {}, format[s.format]),
    s.io === 'dec' ? h('span', { title: 'Decimal output' }, 'Dec') : null,
    h('span', { class: 'status-complex' }, { off: 'Real', polar: 'r∠θ', abi: 'a+bi' }[s.complex])
  ];
  statusEl.replaceChildren(...parts.filter(Boolean));
}

const homeApp = (app, shortcut) => ({ id: app.id, title: app.title, shortcut, open: () => openApp(app) });
function lazyApp(id, title, load, shortcut) {
  let loaded;
  return { id, title, shortcut, async open() {
    const request = ++navigation;
    try {
      loaded ??= await load();
      if (request === navigation) openApp(loaded);
    } catch {
      if (request === navigation) toast('Could not open ' + title + '. Try again.');
    }
  } };
}

const HOME_APPS = [
  homeApp(calculateApp, '1'),
  lazyApp('statistics', 'Statistics', () => import('./apps/statistics.js').then(module => module.statisticsApp), '2'),
  lazyApp('distribution', 'Distribution', () => import('./apps/distribution.js').then(module => module.distributionApp), '3'),
  lazyApp('spreadsheet', 'Spreadsheet', () => import('./apps/spreadsheet.js').then(module => module.spreadsheetApp), '4'),
  homeApp(graphApp, '5'),
  { id: 'dynamic', title: 'Dynamic Graph', shortcut: '6', open: () => openApp(graphApp, app => { app.showGraph(); app.openDynamic(); }) },
  lazyApp('conics', 'Conics', () => import('./apps/conics.js').then(module => module.conicsApp), '7'),
  lazyApp('graph3d', '3D Graph', () => import('./apps/graph3d.js').then(module => module.graph3dApp), '8'),
  lazyApp('recursion', 'Recursion', () => import('./apps/recursion.js').then(module => module.recursionApp), '9'),
  homeApp(equationApp, 'A'),
  { id: 'inequality', title: 'Inequality', shortcut: 'B', open: () => openApp(equationApp, app => app.setMode('ineq')) },
  { id: 'python', title: 'Python', shortcut: 'C' },
  lazyApp('geometry', 'Geometry', () => import('./apps/geometry.js').then(module => module.geometryApp)),
  lazyApp('financial', 'Financial', () => import('./apps/financial.js').then(module => module.financialApp)),
  homeApp(matrixApp), homeApp(vectorApp),
  lazyApp('basen', 'Base-N', () => import('./apps/basen.js').then(module => module.basenApp)),
  homeApp(physicsApp), homeApp(periodicApp), { id: 'exam', title: 'Exam Mode' }
];


const CALCULATION_TABS = [calculateApp, vectorApp, matrixApp].map(app => ({
  id: app.id, label: app === calculateApp ? 'Calculation' : app.title, open: () => openApp(app)
}));

function setTabs(tabs = [], selected = null) {
  displayTabs = tabs;
  activeTab = selected;
  tabsEl.hidden = !tabs.length;
  tabsEl.replaceChildren(...tabs.map(tab => h('button', {
    type: 'button', 'aria-current': tab.id === selected ? 'page' : null,
    onclick: () => { if (tab.id !== activeTab) tab.open(); }
  }, tab.label)));
  $('.key[data-id="prev-tab"]').disabled = tabs.length < 2;
  $('.key[data-id="next-tab"]').disabled = tabs.length < 2;
}

function stepTab(offset) {
  if (!displayTabs.length) return;
  const index = displayTabs.findIndex(tab => tab.id === activeTab);
  displayTabs[(index + offset + displayTabs.length) % displayTabs.length].open();
}

function goBack() {
  if (!sheetEl.inert) { closeSheet(); return; }
  if (current?.onBack?.()) return;
  const back = $('.back', view);
  if (back) { back.click(); return; }
  showHome();
}

function openTools() {
  const body = h('div', { class: 'formats' });
  // Invoke the app's own controls so the menu and the on-screen toolbar stay in sync.
  const actions = [...view.querySelectorAll('.toolbar button, .gbar button')].filter(button => !button.disabled && button.textContent.trim() && button.getClientRects().length);
  for (const button of actions) {
    body.append(h('button', { type: 'button', class: 'fmt-row', onclick: () => { closeSheet(); button.click(); } }, button.textContent.trim()));
  }
  if (!actions.length) {
    for (const [label, action] of [['Catalog', openCatalog], ['Variables', () => openVariables(false)], ['Settings', openSettings]]) {
      body.append(h('button', { type: 'button', class: 'fmt-row', onclick: () => { closeSheet(); action(); } }, label));
    }
  }
  openSheet('Tools', body, { tall: true });
}

const ctx = {
  store, save, engine, parse, h, tex, makeField, numField, focusField, setField, insert, openSheet, closeSheet, seg,
  get field() { return field; },
  showKeypad(v) { document.body.classList.toggle('no-keys', !v); },
  setTitle(t) { titleEl.textContent = t; },
  setTabs,
  angleFactor() { return ANGLE[store.settings.angle]; },
  valueLatex: (v, flags, mode, s) => valueLatex(v, flags, s || store.settings, mode, ANGLE[store.settings.angle]),
  press,
  toast,
  openAppById(id) { HOME_APPS.find(app => app.id === id)?.open?.(); }
};

function openApp(app, afterMount) {
  navigation++;
  closeSheet();
  setModifier(null);
  if (current && current.unmount) current.unmount();
  view.innerHTML = '';
  setField(null);
  current = app;
  document.body.classList.remove('home');
  ctx.showKeypad(true);
  titleEl.textContent = app.title;
  setTabs();
  app.mount(view, ctx);
  if (CALCULATION_TABS.some(tab => tab.id === app.id)) setTabs(CALCULATION_TABS, app.id);
  afterMount?.(app);
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
  dynamic: '<svg viewBox="0 0 48 48"><path d="M8 37h32M11 31c4-2 7-17 13-17s8 15 13 17M11 22c4-2 7-15 13-15s8 13 13 15" /><path d="M6 40h36" class="thin"/></svg>',
  inequality: '<svg viewBox="0 0 48 48"><path d="m32 10-17 9 17 9M15 35h17"/></svg>',
  python: '<svg viewBox="0 0 48 48"><path d="m17 15-9 9 9 9m14-18 9 9-9 9m-4-22-6 26"/></svg>',
  exam: '<svg viewBox="0 0 48 48"><rect x="12" y="22" width="24" height="18" rx="3"/><path d="M17 21v-6a7 7 0 0 1 14 0v6m-7 8v5"/></svg>',
  periodic: '<svg viewBox="0 0 48 48"><rect x="11" y="10" width="26" height="28" rx="4"/><text x="24" y="31" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" stroke="none" font-family="-apple-system,system-ui,sans-serif">Fe</text></svg>'
};

function markHomeTile(index, focus = false) {
  homeIndex = index;
  homeTiles.forEach((tile, i) => tile.classList.toggle('selected', i === index));
  const tile = homeTiles[index];
  if (focus) tile.focus({ preventScroll: true });
  const row = tile.getBoundingClientRect();
  const grid = tile.parentElement;
  const bounds = grid.getBoundingClientRect();
  if (row.top < bounds.top) grid.scrollTop -= bounds.top - row.top;
  else if (row.bottom > bounds.bottom) grid.scrollTop += row.bottom - bounds.bottom;
}

function pressHomeKey(id, letter) {
  const shortcut = letter || id;
  const app = HOME_APPS.find(item => item.shortcut === shortcut);
  if (app) { app.open?.(); return; }
  if (id === 'exe' || id === 'ok') { homeTiles[homeIndex]?.click(); return; }

  const offset = { up: -4, down: 4, left: -1, right: 1 }[id];
  if (offset === undefined) return;
  let target = homeIndex + offset;
  while (homeTiles[target]?.disabled) target += offset;
  if (homeTiles[target]) markHomeTile(target, true);
}

function showHome() {
  navigation++;
  if (current && current.unmount) current.unmount();
  current = null;
  setField(null);
  view.innerHTML = '';
  document.body.classList.add('home');
  ctx.showKeypad(true);
  setTabs();
  titleEl.textContent = 'Home';
  homeTiles = HOME_APPS.map((app, index) => h('button', {
    type: 'button', class: 'tile tile-' + app.id, disabled: !app.open,
    'aria-label': app.open ? app.title : app.title + ' unavailable',
    onfocus: () => markHomeTile(index),
    onclick: () => { homeIndex = index; app.open(); }
  },
  app.shortcut ? h('kbd', { class: 'tile-shortcut', 'aria-hidden': 'true' }, app.shortcut) : null,
  h('span', { class: 'tile-icon', 'aria-hidden': 'true', html: ICONS[app.id] }),
  h('span', { class: 'tile-name' }, app.title)));
  view.append(h('div', { class: 'home-grid' }, homeTiles));
  markHomeTile(homeIndex);
  try { sessionStorage.removeItem('cg-app'); } catch (e) {}
}

document.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Escape') { e.preventDefault(); goBack(); return; }
  if (!sheetEl.inert && e.key === 'Tab') {
    const focusable = [...sheetEl.querySelectorAll('button, input, select, textarea')].filter(el => !el.disabled && el.getClientRects().length);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey ? e.target === first : e.target === last) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
    return;
  }
  if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && sheetEl.inert && displayTabs.length) {
    e.preventDefault();
    stepTab(e.key === 'ArrowLeft' ? -1 : 1);
    return;
  }
  if (e.altKey || current || !sheetEl.inert) return;
  const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
  if (direction) { e.preventDefault(); pressHomeKey(direction); }
  else if (e.key.length === 1 && /^[1-9a-c]$/i.test(e.key)) { e.preventDefault(); pressHomeKey(e.key.toUpperCase()); }
  else if (e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); pressHomeKey('ok'); }
});

function renderConnection() { connectionEl.hidden = navigator.onLine; }
window.addEventListener('online', renderConnection);
window.addEventListener('offline', renderConnection);
renderConnection();

buildKeypad();
renderStatus();
await customElements.whenDefined('math-field');
const last = (() => { try { return sessionStorage.getItem('cg-app'); } catch (e) { return null; } })();
showHome();
if (last) ctx.openAppById(last);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
