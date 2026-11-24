export const CONSTANTS = [
  ['Universal', [
    ['Speed of light in vacuum', 'c_0', 299792458, 'm s^{-1}'],
    ['Planck constant', 'h', 6.62607015e-34, 'J s'],
    ['Reduced Planck constant', '\\hbar', 1.054571817e-34, 'J s'],
    ['Magnetic constant', '\\mu_0', 1.25663706212e-6, 'N A^{-2}'],
    ['Electric constant', '\\varepsilon_0', 8.8541878128e-12, 'F m^{-1}'],
    ['Impedance of vacuum', 'Z_0', 376.730313668, '\\Omega'],
    ['Newtonian constant of gravitation', 'G', 6.6743e-11, 'm^3 kg^{-1} s^{-2}'],
    ['Planck mass', 'm_P', 2.176434e-8, 'kg'],
    ['Planck length', 'l_P', 1.616255e-35, 'm'],
    ['Planck time', 't_P', 5.391247e-44, 's']
  ]],
  ['Electromagnetic', [
    ['Elementary charge', 'e', 1.602176634e-19, 'C'],
    ['Magnetic flux quantum', '\\Phi_0', 2.067833848e-15, 'Wb'],
    ['Conductance quantum', 'G_0', 7.748091729e-5, 'S'],
    ['Josephson constant', 'K_J', 483597.8484e9, 'Hz V^{-1}'],
    ['von Klitzing constant', 'R_K', 25812.80745, '\\Omega'],
    ['Bohr magneton', '\\mu_B', 9.2740100783e-24, 'J T^{-1}'],
    ['Nuclear magneton', '\\mu_N', 5.0507837461e-27, 'J T^{-1}']
  ]],
  ['Atomic and nuclear', [
    ['Electron mass', 'm_e', 9.1093837015e-31, 'kg'],
    ['Proton mass', 'm_p', 1.67262192369e-27, 'kg'],
    ['Neutron mass', 'm_n', 1.67492749804e-27, 'kg'],
    ['Muon mass', 'm_\\mu', 1.883531627e-28, 'kg'],
    ['Atomic mass constant', 'u', 1.6605390666e-27, 'kg'],
    ['Bohr radius', 'a_0', 5.29177210903e-11, 'm'],
    ['Fine-structure constant', '\\alpha', 7.2973525693e-3, ''],
    ['Classical electron radius', 'r_e', 2.8179403262e-15, 'm'],
    ['Compton wavelength', '\\lambda_C', 2.42631023867e-12, 'm'],
    ['Rydberg constant', 'R_\\infty', 10973731.56816, 'm^{-1}'],
    ['Electron magnetic moment', '\\mu_e', -9.2847647043e-24, 'J T^{-1}'],
    ['Proton magnetic moment', '\\mu_p', 1.41060679736e-26, 'J T^{-1}'],
    ['Hartree energy', 'E_h', 4.3597447222071e-18, 'J']
  ]],
  ['Physico-chemical', [
    ['Avogadro constant', 'N_A', 6.02214076e23, 'mol^{-1}'],
    ['Boltzmann constant', 'k', 1.380649e-23, 'J K^{-1}'],
    ['Molar gas constant', 'R', 8.314462618, 'J mol^{-1} K^{-1}'],
    ['Faraday constant', 'F', 96485.33212, 'C mol^{-1}'],
    ['Stefan–Boltzmann constant', '\\sigma', 5.670374419e-8, 'W m^{-2} K^{-4}'],
    ['Molar volume of ideal gas (273.15 K, 101.325 kPa)', 'V_m', 22.41396954e-3, 'm^3 mol^{-1}'],
    ['Loschmidt constant', 'n_0', 2.686780111e25, 'm^{-3}'],
    ['First radiation constant', 'c_1', 3.741771852e-16, 'W m^2'],
    ['Second radiation constant', 'c_2', 1.438776877e-2, 'm K'],
    ['Wien displacement constant', 'b', 2.897771955e-3, 'm K']
  ]],
  ['Adopted values', [
    ['Standard acceleration of gravity', 'g', 9.80665, 'm s^{-2}'],
    ['Standard atmosphere', 'atm', 101325, 'Pa'],
    ['Molar mass constant', 'M_u', 0.99999999965e-3, 'kg mol^{-1}'],
    ['Absolute zero (in °C)', 'T_0', -273.15, '°C']
  ]]
];

export const UNITS = {
  Length: [['mm', 1e-3], ['cm', 1e-2], ['m', 1], ['km', 1e3], ['µm', 1e-6], ['nm', 1e-9], ['Å', 1e-10], ['in', 0.0254], ['ft', 0.3048], ['yd', 0.9144], ['mile', 1609.344], ['nautical mile', 1852], ['light-year', 9.4607304725808e15], ['parsec', 3.0856775814913673e16]],
  Area: [['mm²', 1e-6], ['cm²', 1e-4], ['m²', 1], ['hectare', 1e4], ['km²', 1e6], ['in²', 6.4516e-4], ['ft²', 0.09290304], ['yd²', 0.83612736], ['acre', 4046.8564224], ['mile²', 2589988.110336]],
  Volume: [['mL (cm³)', 1e-6], ['L', 1e-3], ['m³', 1], ['in³', 1.6387064e-5], ['ft³', 0.028316846592], ['UK fl oz', 2.84130625e-5], ['US fl oz', 2.95735295625e-5], ['UK pint', 5.6826125e-4], ['US pint', 4.73176473e-4], ['UK gallon', 4.54609e-3], ['US gallon', 3.785411784e-3]],
  Mass: [['mg', 1e-6], ['g', 1e-3], ['kg', 1], ['tonne', 1e3], ['oz', 0.028349523125], ['lb', 0.45359237], ['stone', 6.35029318], ['UK ton', 1016.0469088], ['US ton', 907.18474], ['atomic mass unit', 1.6605390666e-27]],
  Velocity: [['m/s', 1], ['km/h', 1 / 3.6], ['mph', 0.44704], ['knot', 1852 / 3600], ['ft/s', 0.3048]],
  Pressure: [['Pa', 1], ['kPa', 1e3], ['bar', 1e5], ['atm', 101325], ['mmHg', 133.322387415], ['inHg', 3386.388640341], ['psi', 6894.757293168], ['kgf/cm²', 98066.5]],
  Energy: [['J', 1], ['kJ', 1e3], ['cal', 4.184], ['kcal', 4184], ['kWh', 3.6e6], ['eV', 1.602176634e-19], ['BTU', 1055.05585262], ['ft·lbf', 1.3558179483314004], ['kgf·m', 9.80665]],
  Power: [['W', 1], ['kW', 1e3], ['hp (metric)', 735.49875], ['hp (UK)', 745.69987158227022], ['BTU/h', 0.29307107017]],
  Time: [['s', 1], ['min', 60], ['h', 3600], ['day', 86400], ['week', 604800], ['year (365 days)', 31536000]],
  Temperature: [['°C', 'C'], ['K', 'K'], ['°F', 'F']],
  Angle: [['degree', Math.PI / 180], ['radian', 1], ['gradian', Math.PI / 200]]
};

export function convert(category, from, to, v) {
  const list = UNITS[category];
  const f = list.find(u => u[0] === from), t = list.find(u => u[0] === to);
  if (!f || !t) return NaN;
  if (category === 'Temperature') {
    const k = f[1] === 'C' ? v + 273.15 : f[1] === 'F' ? (v - 32) * 5 / 9 + 273.15 : v;
    if (k < 0) return NaN;
    return t[1] === 'C' ? k - 273.15 : t[1] === 'F' ? (k - 273.15) * 9 / 5 + 32 : k;
  }
  return v * f[1] / t[1];
}

const RAW = 'H,Hydrogen,1.008;He,Helium,4.0026;Li,Lithium,6.94;Be,Beryllium,9.0122;B,Boron,10.81;C,Carbon,12.011;N,Nitrogen,14.007;O,Oxygen,15.999;F,Fluorine,18.998;Ne,Neon,20.180;' +
  'Na,Sodium,22.990;Mg,Magnesium,24.305;Al,Aluminium,26.982;Si,Silicon,28.085;P,Phosphorus,30.974;S,Sulfur,32.06;Cl,Chlorine,35.45;Ar,Argon,39.948;' +
  'K,Potassium,39.098;Ca,Calcium,40.078;Sc,Scandium,44.956;Ti,Titanium,47.867;V,Vanadium,50.942;Cr,Chromium,51.996;Mn,Manganese,54.938;Fe,Iron,55.845;Co,Cobalt,58.933;Ni,Nickel,58.693;Cu,Copper,63.546;Zn,Zinc,65.38;Ga,Gallium,69.723;Ge,Germanium,72.630;As,Arsenic,74.922;Se,Selenium,78.971;Br,Bromine,79.904;Kr,Krypton,83.798;' +
  'Rb,Rubidium,85.468;Sr,Strontium,87.62;Y,Yttrium,88.906;Zr,Zirconium,91.224;Nb,Niobium,92.906;Mo,Molybdenum,95.95;Tc,Technetium,[98];Ru,Ruthenium,101.07;Rh,Rhodium,102.91;Pd,Palladium,106.42;Ag,Silver,107.87;Cd,Cadmium,112.41;In,Indium,114.82;Sn,Tin,118.71;Sb,Antimony,121.76;Te,Tellurium,127.60;I,Iodine,126.90;Xe,Xenon,131.29;' +
  'Cs,Caesium,132.91;Ba,Barium,137.33;La,Lanthanum,138.91;Ce,Cerium,140.12;Pr,Praseodymium,140.91;Nd,Neodymium,144.24;Pm,Promethium,[145];Sm,Samarium,150.36;Eu,Europium,151.96;Gd,Gadolinium,157.25;Tb,Terbium,158.93;Dy,Dysprosium,162.50;Ho,Holmium,164.93;Er,Erbium,167.26;Tm,Thulium,168.93;Yb,Ytterbium,173.05;Lu,Lutetium,174.97;' +
  'Hf,Hafnium,178.49;Ta,Tantalum,180.95;W,Tungsten,183.84;Re,Rhenium,186.21;Os,Osmium,190.23;Ir,Iridium,192.22;Pt,Platinum,195.08;Au,Gold,196.97;Hg,Mercury,200.59;Tl,Thallium,204.38;Pb,Lead,207.2;Bi,Bismuth,208.98;Po,Polonium,[209];At,Astatine,[210];Rn,Radon,[222];' +
  'Fr,Francium,[223];Ra,Radium,[226];Ac,Actinium,[227];Th,Thorium,232.04;Pa,Protactinium,231.04;U,Uranium,238.03;Np,Neptunium,[237];Pu,Plutonium,[244];Am,Americium,[243];Cm,Curium,[247];Bk,Berkelium,[247];Cf,Californium,[251];Es,Einsteinium,[252];Fm,Fermium,[257];Md,Mendelevium,[258];No,Nobelium,[259];Lr,Lawrencium,[266];' +
  'Rf,Rutherfordium,[267];Db,Dubnium,[268];Sg,Seaborgium,[269];Bh,Bohrium,[270];Hs,Hassium,[269];Mt,Meitnerium,[278];Ds,Darmstadtium,[281];Rg,Roentgenium,[282];Cn,Copernicium,[285];Nh,Nihonium,[286];Fl,Flerovium,[289];Mc,Moscovium,[290];Lv,Livermorium,[293];Ts,Tennessine,[294];Og,Oganesson,[294]';

const CAT = z => {
  if ([1, 6, 7, 8, 15, 16, 34].includes(z)) return 'nonmetal';
  if ([9, 17, 35, 53, 85, 117].includes(z)) return 'halogen';
  if ([2, 10, 18, 36, 54, 86, 118].includes(z)) return 'noble';
  if ([3, 11, 19, 37, 55, 87].includes(z)) return 'alkali';
  if ([4, 12, 20, 38, 56, 88].includes(z)) return 'alkaline';
  if ([5, 14, 32, 33, 51, 52].includes(z)) return 'metalloid';
  if (z >= 57 && z <= 71) return 'lanthanide';
  if (z >= 89 && z <= 103) return 'actinide';
  if ([13, 31, 49, 50, 81, 82, 83, 84].includes(z)) return 'post';
  if (z >= 109) return 'unknown';
  return 'transition';
};

const CAT_NAMES = { nonmetal: 'Reactive nonmetal', halogen: 'Halogen', noble: 'Noble gas', alkali: 'Alkali metal', alkaline: 'Alkaline earth metal', metalloid: 'Metalloid', lanthanide: 'Lanthanide', actinide: 'Actinide', post: 'Post-transition metal', transition: 'Transition metal', unknown: 'Unknown properties' };

function place(z) {
  const starts = [[1, 1], [3, 2], [11, 3], [19, 4], [37, 5], [55, 6], [87, 7]];
  let period = 1;
  for (const [s, p] of starts) if (z >= s) period = p;
  let group, row = period, col;
  if (period === 1) group = z === 1 ? 1 : 18;
  else if (period <= 3) { const i = z - starts[period - 1][0]; group = i < 2 ? i + 1 : i + 11; }
  else if (period <= 5) group = z - starts[period - 1][0] + 1;
  else {
    const s = starts[period - 1][0], i = z - s;
    if (i < 2) group = i + 1;
    else if (i < 17) { group = 3; row = period + 3; col = i + 1; }
    else group = i - 13;
  }
  if (!col) col = group;
  return { period, group: (z >= 57 && z <= 71) || (z >= 89 && z <= 103) ? 3 : group, row, col };
}

export const ELEMENTS = RAW.split(';').map((s, i) => {
  const [sym, name, mass] = s.split(',');
  const z = i + 1;
  const p = place(z);
  return { z, sym, name, mass, ...p, cat: CAT(z), catName: CAT_NAMES[CAT(z)] };
});
export { CAT_NAMES };
