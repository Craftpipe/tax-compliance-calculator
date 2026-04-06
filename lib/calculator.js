'use strict';

/**
 * lib/calculator.js
 * Core tax calculation engine for Tax Compliance Calculator.
 * Applies federal bracket logic, state-specific rates, deduction categorization,
 * and quarterly estimated tax computation.
 */

// ---------------------------------------------------------------------------
// Internal helpers & data
// ---------------------------------------------------------------------------

/**
 * 2024 US Federal income tax brackets (single filer).
 * Each bracket: { min, max, rate }
 * max === null means "no upper limit".
 */
const FEDERAL_BRACKETS_SINGLE = [
  { min: 0,       max: 11600,   rate: 0.10 },
  { min: 11600,   max: 47150,   rate: 0.12 },
  { min: 47150,   max: 100525,  rate: 0.22 },
  { min: 100525,  max: 191950,  rate: 0.24 },
  { min: 191950,  max: 243725,  rate: 0.32 },
  { min: 243725,  max: 609350,  rate: 0.35 },
  { min: 609350,  max: null,    rate: 0.37 },
];

/**
 * 2024 US Federal income tax brackets (married filing jointly).
 */
const FEDERAL_BRACKETS_MFJ = [
  { min: 0,       max: 23200,   rate: 0.10 },
  { min: 23200,   max: 94300,   rate: 0.12 },
  { min: 94300,   max: 201050,  rate: 0.22 },
  { min: 201050,  max: 383900,  rate: 0.24 },
  { min: 383900,  max: 487450,  rate: 0.32 },
  { min: 487450,  max: 731200,  rate: 0.35 },
  { min: 731200,  max: null,    rate: 0.37 },
];

/**
 * 2024 Standard deductions by filing status.
 */
const STANDARD_DEDUCTIONS = {
  single:                     13850,
  married_filing_jointly:     27700,
  married_filing_separately:  13850,
  head_of_household:          20800,
};

/**
 * Self-employment tax rate (15.3% on net SE income up to SS wage base,
 * 2.9% above). Simplified: flat 15.3% on first $160,200, 2.9% above.
 */
const SE_TAX_RATE_FULL  = 0.153;
const SE_TAX_RATE_ABOVE = 0.029;
const SE_WAGE_BASE      = 160200;

/**
 * State tax rates (flat or simplified bracket).
 * Format: { type: 'flat'|'bracket', rate?, brackets?, standardDeduction? }
 */
const STATE_TAX_RULES = {
  AL: { type: 'bracket', brackets: [
    { min: 0,     max: 500,   rate: 0.02 },
    { min: 500,   max: 3000,  rate: 0.04 },
    { min: 3000,  max: null,  rate: 0.05 },
  ], standardDeduction: 2500 },
  AK: { type: 'flat', rate: 0.00 },
  AZ: { type: 'flat', rate: 0.025 },
  AR: { type: 'bracket', brackets: [
    { min: 0,     max: 4300,  rate: 0.02 },
    { min: 4300,  max: 8500,  rate: 0.04 },
    { min: 8500,  max: null,  rate: 0.049 },
  ], standardDeduction: 2200 },
  CA: { type: 'bracket', brackets: [
    { min: 0,       max: 10099,  rate: 0.01 },
    { min: 10099,   max: 23942,  rate: 0.02 },
    { min: 23942,   max: 37788,  rate: 0.04 },
    { min: 37788,   max: 52455,  rate: 0.06 },
    { min: 52455,   max: 66295,  rate: 0.08 },
    { min: 66295,   max: 338639, rate: 0.093 },
    { min: 338639,  max: 406364, rate: 0.103 },
    { min: 406364,  max: 677275, rate: 0.113 },
    { min: 677275,  max: null,   rate: 0.123 },
  ], standardDeduction: 4803 },
  CO: { type: 'flat', rate: 0.044 },
  CT: { type: 'bracket', brackets: [
    { min: 0,       max: 10000,  rate: 0.03 },
    { min: 10000,   max: 50000,  rate: 0.05 },
    { min: 50000,   max: 100000, rate: 0.055 },
    { min: 100000,  max: 200000, rate: 0.06 },
    { min: 200000,  max: 250000, rate: 0.065 },
    { min: 250000,  max: 500000, rate: 0.069 },
    { min: 500000,  max: null,   rate: 0.0699 },
  ], standardDeduction: 0 },
  DE: { type: 'bracket', brackets: [
    { min: 0,     max: 2000,  rate: 0.00 },
    { min: 2000,  max: 5000,  rate: 0.022 },
    { min: 5000,  max: 10000, rate: 0.039 },
    { min: 10000, max: 20000, rate: 0.048 },
    { min: 20000, max: 25000, rate: 0.052 },
    { min: 25000, max: 60000, rate: 0.0555 },
    { min: 60000, max: null,  rate: 0.066 },
  ], standardDeduction: 3250 },
  FL: { type: 'flat', rate: 0.00 },
  GA: { type: 'flat', rate: 0.055 },
  HI: { type: 'bracket', brackets: [
    { min: 0,      max: 2400,   rate: 0.014 },
    { min: 2400,   max: 4800,   rate: 0.032 },
    { min: 4800,   max: 9600,   rate: 0.055 },
    { min: 9600,   max: 14400,  rate: 0.064 },
    { min: 14400,  max: 19200,  rate: 0.068 },
    { min: 19200,  max: 24000,  rate: 0.072 },
    { min: 24000,  max: 48000,  rate: 0.076 },
    { min: 48000,  max: 150000, rate: 0.079 },
    { min: 150000, max: 175000, rate: 0.0825 },
    { min: 175000, max: 200000, rate: 0.09 },
    { min: 200000, max: null,   rate: 0.11 },
  ], standardDeduction: 2200 },
  ID: { type: 'flat', rate: 0.058 },
  IL: { type: 'flat', rate: 0.0495 },
  IN: { type: 'flat', rate: 0.0315 },
  IA: { type: 'flat', rate: 0.06 },
  KS: { type: 'bracket', brackets: [
    { min: 0,      max: 15000, rate: 0.031 },
    { min: 15000,  max: 30000, rate: 0.0525 },
    { min: 30000,  max: null,  rate: 0.057 },
  ], standardDeduction: 3000 },
  KY: { type: 'flat', rate: 0.045 },
  LA: { type: 'bracket', brackets: [
    { min: 0,      max: 12500, rate: 0.0185 },
    { min: 12500,  max: 50000, rate: 0.035 },
    { min: 50000,  max: null,  rate: 0.0425 },
  ], standardDeduction: 4500 },
  ME: { type: 'bracket', brackets: [
    { min: 0,      max: 24500,  rate: 0.058 },
    { min: 24500,  max: 58050,  rate: 0.0675 },
    { min: 58050,  max: null,   rate: 0.0715 },
  ], standardDeduction: 14600 },
  MD: { type: 'bracket', brackets: [
    { min: 0,      max: 1000,   rate: 0.02 },
    { min: 1000,   max: 2000,   rate: 0.03 },
    { min: 2000,   max: 3000,   rate: 0.04 },
    { min: 3000,   max: 100000, rate: 0.0475 },
    { min: 100000, max: 125000, rate: 0.05 },
    { min: 125000, max: 150000, rate: 0.0525 },
    { min: 150000, max: 250000, rate: 0.055 },
    { min: 250000, max: null,   rate: 0.0575 },
  ], standardDeduction: 2400 },
  MA: { type: 'flat', rate: 0.05 },
  MI: { type: 'flat', rate: 0.0425 },
  MN: { type: 'bracket', brackets: [
    { min: 0,      max: 30070,  rate: 0.0535 },
    { min: 30070,  max: 98760,  rate: 0.068 },
    { min: 98760,  max: 183340, rate: 0.0785 },
    { min: 183340, max: null,   rate: 0.0985 },
  ], standardDeduction: 14575 },
  MS: { type: 'flat', rate: 0.05 },
  MO: { type: 'bracket', brackets: [
    { min: 0,     max: 1121,  rate: 0.00 },
    { min: 1121,  max: 2242,  rate: 0.015 },
    { min: 2242,  max: 3363,  rate: 0.02 },
    { min: 3363,  max: 4484,  rate: 0.025 },
    { min: 4484,  max: 5605,  rate: 0.03 },
    { min: 5605,  max: 6726,  rate: 0.035 },
    { min: 6726,  max: 7847,  rate: 0.04 },
    { min: 7847,  max: 8968,  rate: 0.045 },
    { min: 8968,  max: null,  rate: 0.048 },
  ], standardDeduction: 14600 },
  MT: { type: 'flat', rate: 0.059 },
  NE: { type: 'bracket', brackets: [
    { min: 0,      max: 3700,   rate: 0.0246 },
    { min: 3700,   max: 22170,  rate: 0.0351 },
    { min: 22170,  max: 35730,  rate: 0.0501 },
    { min: 35730,  max: null,   rate: 0.0584 },
  ], standardDeduction: 7900 },
  NV: { type: 'flat', rate: 0.00 },
  NH: { type: 'flat', rate: 0.00 },
  NJ: { type: 'bracket', brackets: [
    { min: 0,       max: 20000,  rate: 0.014 },
    { min: 20000,   max: 35000,  rate: 0.0175 },
    { min: 35000,   max: 40000,  rate: 0.035 },
    { min: 40000,   max: 75000,  rate: 0.05525 },
    { min: 75000,   max: 500000, rate: 0.0637 },
    { min: 500000,  max: 1000000,rate: 0.0897 },
    { min: 1000000, max: null,   rate: 0.1075 },
  ], standardDeduction: 0 },
  NM: { type: 'bracket', brackets: [
    { min: 0,      max: 5500,   rate: 0.017 },
    { min: 5500,   max: 11000,  rate: 0.032 },
    { min: 11000,  max: 16000,  rate: 0.047 },
    { min: 16000,  max: 210000, rate: 0.049 },
    { min: 210000, max: null,   rate: 0.059 },
  ], standardDeduction: 14600 },
  NY: { type: 'bracket', brackets: [
    { min: 0,       max: 17150,  rate: 0.04 },
    { min: 17150,   max: 23600,  rate: 0.045 },
    { min: 23600,   max: 27900,  rate: 0.0525 },
    { min: 27900,   max: 161550, rate: 0.055 },
    { min: 161550,  max: 323200, rate: 0.06 },
    { min: 323200,  max: 2155350,rate: 0.0685 },
    { min: 2155350, max: null,   rate: 0.0882 },
  ], standardDeduction: 8000 },
  NC: { type: 'flat', rate: 0.0475 },
  ND: { type: 'flat', rate: 0.025 },
  OH: { type: 'bracket', brackets: [
    { min: 0,      max: 26050,  rate: 0.00 },
    { min: 26050,  max: 100000, rate: 0.0275 },
    { min: 100000, max: null,   rate: 0.035 },
  ], standardDeduction: 0 },
  OK: { type: 'bracket', brackets: [
    { min: 0,     max: 1000,  rate: 0.0025 },
    { min: 1000,  max: 2500,  rate: 0.0075 },
    { min: 2500,  max: 3750,  rate: 0.0175 },
    { min: 3750,  max: 4900,  rate: 0.0275 },
    { min: 4900,  max: 7200,  rate: 0.0375 },
    { min: 7200,  max: null,  rate: 0.0475 },
  ], standardDeduction: 6350 },
  OR: { type: 'bracket', brackets: [
    { min: 0,      max: 4050,   rate: 0.0475 },
    { min: 4050,   max: 10200,  rate: 0.0675 },
    { min: 10200,  max: 125000, rate: 0.0875 },
    { min: 125000, max: null,   rate: 0.099 },
  ], standardDeduction: 2420 },
  PA: { type: 'flat', rate: 0.0307 },
  RI: { type: 'bracket', brackets: [
    { min: 0,      max: 73450,  rate: 0.0375 },
    { min: 73450,  max: 166950, rate: 0.0475 },
    { min: 166950, max: null,   rate: 0.0599 },
  ], standardDeduction: 9300 },
  SC: { type: 'flat', rate: 0.064 },
  SD: { type: 'flat', rate: 0.00 },
  TN: { type: 'flat', rate: 0.00 },
  TX: { type: 'flat', rate: 0.00 },
  UT: { type: 'flat', rate: 0.0465 },
  VT: { type: 'bracket', brackets: [
    { min: 0,      max: 45400,  rate: 0.0335 },
    { min: 45400,  max: 110050, rate: 0.066 },
    { min: 110050, max: 229550, rate: 0.076 },
    { min: 229550, max: null,   rate: 0.0875 },
  ], standardDeduction: 6500 },
  VA: { type: 'bracket', brackets: [
    { min: 0,     max: 3000,  rate: 0.02 },
    { min: 3000,  max: 5000,  rate: 0.03 },
    { min: 5000,  max: 17000, rate: 0.05 },
    { min: 17000, max: null,  rate: 0.0575 },
  ], standardDeduction: 8000 },
  WA: { type: 'flat', rate: 0.00 },
  WV: { type: 'bracket', brackets: [
    { min: 0,     max: 10000, rate: 0.03 },
    { min: 10000, max: 25000, rate: 0.04 },
    { min: 25000, max: 40000, rate: 0.045 },
    { min: 40000, max: 60000, rate: 0.06 },
    { min: 60000, max: null,  rate: 0.065 },
  ], standardDeduction: 0 },
  WI: { type: 'bracket', brackets: [
    { min: 0,      max: 13810,  rate: 0.035 },
    { min: 13810,  max: 27630,  rate: 0.044 },
    { min: 27630,  max: 304170, rate: 0.053 },
    { min: 304170, max: null,   rate: 0.0765 },
  ], standardDeduction: 11790 },
  WY: { type: 'flat', rate: 0.00 },
  DC: { type: 'bracket', brackets: [
    { min: 0,       max: 10000,  rate: 0.04 },
    { min: 10000,   max: 40000,  rate: 0.06 },
    { min: 40000,   max: 60000,  rate: 0.065 },
    { min: 60000,   max: 250000, rate: 0.085 },
    { min: 250000,  max: 500000, rate: 0.0925 },
    { min: 500000,  max: 1000000,rate: 0.0975 },
    { min: 1000000, max: null,   rate: 0.1075 },
  ], standardDeduction: 12950 },
};

// ---------------------------------------------------------------------------
// Internal calculation helpers
// ---------------------------------------------------------------------------

/**
 * Apply a progressive bracket table to a taxable income amount.
 * @param {number} taxableIncome
 * @param {Array}  brackets
 * @returns {number} tax owed
 */
function applyBrackets(taxableIncome, brackets) {
  let tax = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= 0) break;
    const top = bracket.max === null ? Infinity : bracket.max;
    const taxable = Math.min(taxableIncome, top - bracket.min);
    if (taxable <= 0) continue;
    tax += taxable * bracket.rate;
    taxableIncome -= taxable;
  }
  return tax;
}

/**
 * Compute self-employment tax on net SE income.
 * @param {number} netSEIncome
 * @returns {number}
 */
function computeSETax(netSEIncome) {
  if (netSEIncome <= 0) return 0;
  // SE tax is on 92.35% of net SE income
  const seBase = netSEIncome * 0.9235;
  const belowBase = Math.min(seBase, SE_WAGE_BASE);
  const aboveBase = Math.max(0, seBase - SE_WAGE_BASE);
  return belowBase * SE_TAX_RATE_FULL + aboveBase * SE_TAX_RATE_ABOVE;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Calculate federal income tax.
 *
 * Accepts either:
 *   calculateFederalTax(options)  — single options object
 *   calculateFederalTax(income, filingStatus, deductions, isSelfEmployed, businessType)
 *
 * @param {object|number} incomeOrOptions
 * @param {string}  [filingStatus='single']
 * @param {number}  [deductions=0]
 * @param {boolean} [isSelfEmployed=false]
 * @param {string}  [businessType='sole_proprietor']
 * @returns {object} result
 */
function calculateFederalTax(incomeOrOptions, filingStatus, deductions, isSelfEmployed, businessType) {
  let income, fs, ded, selfEmployed, bizType;

  if (incomeOrOptions !== null && typeof incomeOrOptions === 'object') {
    ({ income, filingStatus: fs = 'single', deductions: ded = 0,
       isSelfEmployed: selfEmployed = false, businessType: bizType = 'sole_proprietor' } = incomeOrOptions);
  } else {
    income       = incomeOrOptions || 0;
    fs           = filingStatus   || 'single';
    ded          = deductions     || 0;
    selfEmployed = isSelfEmployed || false;
    bizType      = businessType   || 'sole_proprietor';
  }

  income = parseFloat(income) || 0;
  ded    = parseFloat(ded)    || 0;

  // Choose bracket table
  const brackets = fs === 'married_filing_jointly' ? FEDERAL_BRACKETS_MFJ : FEDERAL_BRACKETS_SINGLE;

  // Standard deduction
  const standardDeduction = STANDARD_DEDUCTIONS[fs] || STANDARD_DEDUCTIONS.single;
  const actualDeduction   = ded > 0 ? Math.max(ded, standardDeduction) : standardDeduction;

  // SE tax (deduct half from AGI)
  const seTax         = selfEmployed ? computeSETax(income) : 0;
  const seTaxDeduction = seTax / 2;

  const agi            = Math.max(0, income - seTaxDeduction);
  const taxableIncome  = Math.max(0, agi - actualDeduction);
  const incomeTax      = applyBrackets(taxableIncome, brackets);
  const totalFederalTax = incomeTax + seTax;

  return {
    grossIncome:      income,
    filingStatus:     fs,
    deductionUsed:    actualDeduction,
    standardDeduction,
    seTax:            parseFloat(seTax.toFixed(2)),
    seTaxDeduction:   parseFloat(seTaxDeduction.toFixed(2)),
    agi:              parseFloat(agi.toFixed(2)),
    taxableIncome:    parseFloat(taxableIncome.toFixed(2)),
    incomeTax:        parseFloat(incomeTax.toFixed(2)),
    totalFederalTax:  parseFloat(totalFederalTax.toFixed(2)),
    effectiveRate:    income > 0 ? parseFloat((totalFederalTax / income).toFixed(4)) : 0,
    isSelfEmployed:   selfEmployed,
    businessType:     bizType,
  };
}

/**
 * Calculate state income tax.
 *
 * Accepts either:
 *   calculateStateTax(options)
 *   calculateStateTax(income, state, filingStatus, deductions, isSelfEmployed)
 *
 * @param {object|number} incomeOrOptions
 * @param {string}  [state='CA']
 * @param {string}  [filingStatus='single']
 * @param {number}  [deductions=0]
 * @param {boolean} [isSelfEmployed=false]
 * @returns {object} result
 */
function calculateStateTax(incomeOrOptions, state, filingStatus, deductions, isSelfEmployed) {
  let income, st, fs, ded, selfEmployed;

  if (incomeOrOptions !== null && typeof incomeOrOptions === 'object') {
    ({ income, state: st = 'CA', filingStatus: fs = 'single',
       deductions: ded = 0, isSelfEmployed: selfEmployed = false } = incomeOrOptions);
  } else {
    income       = incomeOrOptions || 0;
    st           = state          || 'CA';
    fs           = filingStatus   || 'single';
    ded          = deductions     || 0;
    selfEmployed = isSelfEmployed || false;
  }

  income = parseFloat(income) || 0;
  ded    = parseFloat(ded)    || 0;
  st     = (st || 'CA').toUpperCase();

  const rules = STATE_TAX_RULES[st];
  if (!rules) {
    return {
      state: st, grossIncome: income, taxableIncome: income,
      stateTax: 0, effectiveRate: 0, error: `Unknown state: ${st}`,
    };
  }

  const stateStdDed   = rules.standardDeduction || 0;
  const actualDed     = ded > 0 ? Math.max(ded, stateStdDed) : stateStdDed;
  const taxableIncome = Math.max(0, income - actualDed);

  let stateTax = 0;
  if (rules.type === 'flat') {
    stateTax = taxableIncome * rules.rate;
  } else if (rules.type === 'bracket') {
    stateTax = applyBrackets(taxableIncome, rules.brackets);
  }

  return {
    state:          st,
    grossIncome:    income,
    deductionUsed:  actualDed,
    taxableIncome:  parseFloat(taxableIncome.toFixed(2)),
    stateTax:       parseFloat(stateTax.toFixed(2)),
    effectiveRate:  income > 0 ? parseFloat((stateTax / income).toFixed(4)) : 0,
    isSelfEmployed: selfEmployed,
  };
}

/**
 * Calculate quarterly estimated tax payments.
 *
 * Accepts either:
 *   calculateQuarterlyEstimatedTax(options)
 *   calculateQuarterlyEstimatedTax(income, state, filingStatus, deductions, isSelfEmployed, priorYearTax)
 *
 * @param {object|number} incomeOrOptions
 * @param {string}  [state='CA']
 * @param {string}  [filingStatus='single']
 * @param {number}  [deductions=0]
 * @param {boolean} [isSelfEmployed=false]
 * @param {number}  [priorYearTax=0]
 * @returns {object} result
 */
function calculateQuarterlyEstimatedTax(incomeOrOptions, state, filingStatus, deductions, isSelfEmployed, priorYearTax) {
  let income, st, fs, ded, selfEmployed, priorTax;

  if (incomeOrOptions !== null && typeof incomeOrOptions === 'object') {
    ({ income, state: st = 'CA', filingStatus: fs = 'single',
       deductions: ded = 0, isSelfEmployed: selfEmployed = false,
       priorYearTax: priorTax = 0 } = incomeOrOptions);
  } else {
    income       = incomeOrOptions || 0;
    st           = state          || 'CA';
    fs           = filingStatus   || 'single';
    ded          = deductions     || 0;
    selfEmployed = isSelfEmployed || false;
    priorTax     = priorYearTax   || 0;
  }

  income   = parseFloat(income)   || 0;
  ded      = parseFloat(ded)      || 0;
  priorTax = parseFloat(priorTax) || 0;

  const fedResult   = calculateFederalTax(income, fs, ded, selfEmployed, 'sole_proprietor');
  const stateResult = calculateStateTax(income, st, fs, ded, selfEmployed);

  const totalAnnualTax = fedResult.totalFederalTax + stateResult.stateTax;

  // Safe-harbor: pay lesser of 100% of prior year tax or 90% of current year tax
  const safeHarbor90  = totalAnnualTax * 0.90;
  const safeHarbor100 = priorTax;
  const annualRequired = priorTax > 0 ? Math.min(safeHarbor90, safeHarbor100) : safeHarbor90;

  const quarterlyPayment = annualRequired / 4;

  // IRS quarterly due dates (2024)
  const dueDates = [
    { quarter: 'Q1', period: 'Jan 1 – Mar 31', due: 'April 15, 2024' },
    { quarter: 'Q2', period: 'Apr 1 – May 31', due: 'June 17, 2024' },
    { quarter: 'Q3', period: 'Jun 1 – Aug 31', due: 'September 16, 2024' },
    { quarter: 'Q4', period: 'Sep 1 – Dec 31', due: 'January 15, 2025' },
  ];

  return {
    grossIncome:       income,
    state:             st,
    filingStatus:      fs,
    federalTax:        fedResult.totalFederalTax,
    stateTax:          stateResult.stateTax,
    totalAnnualTax:    parseFloat(totalAnnualTax.toFixed(2)),
    annualRequired:    parseFloat(annualRequired.toFixed(2)),
    quarterlyPayment:  parseFloat(quarterlyPayment.toFixed(2)),
    dueDates,
    priorYearTax:      priorTax,
    isSelfEmployed:    selfEmployed,
  };
}

/**
 * Categorize deductions into standard IRS categories.
 *
 * @param {object} deductionMap  key=category, value=amount
 * @returns {object} categorized summary
 */
function categorizeDeductions(deductionMap) {
  if (!deductionMap || typeof deductionMap !== 'object') {
    return { total: 0, categories: {}, warnings: [] };
  }

  const KNOWN_CATEGORIES = [
    'home_office', 'vehicle', 'meals', 'travel', 'equipment',
    'software', 'marketing', 'professional_services', 'education',
    'health_insurance', 'retirement', 'utilities', 'phone_internet',
    'supplies', 'other',
  ];

  const categories = {};
  const warnings   = [];
  let total = 0;

  for (const [key, val] of Object.entries(deductionMap)) {
    const amount = parseFloat(val) || 0;
    if (amount < 0) {
      warnings.push(`Negative deduction ignored for category: ${key}`);
      continue;
    }
    if (!KNOWN_CATEGORIES.includes(key)) {
      warnings.push(`Unknown deduction category: ${key} — included in 'other'`);
      categories['other'] = (categories['other'] || 0) + amount;
    } else {
      categories[key] = (categories[key] || 0) + amount;
    }
    total += amount;
  }

  // Meals deduction limited to 50%
  if (categories['meals']) {
    const original = categories['meals'];
    categories['meals'] = original * 0.50;
    total -= original * 0.50;
    warnings.push(`Meals deduction limited to 50%: $${original.toFixed(2)} → $${categories['meals'].toFixed(2)}`);
  }

  return {
    total:      parseFloat(total.toFixed(2)),
    categories,
    warnings,
  };
}

/**
 * Compute total tax liability combining federal, state, and SE taxes.
 *
 * Accepts either:
 *   computeTotalTaxLiability(options)
 *   computeTotalTaxLiability(income, state, filingStatus, deductions, isSelfEmployed)
 *
 * @param {object|number} incomeOrOptions
 * @param {string}  [state='CA']
 * @param {string}  [filingStatus='single']
 * @param {number}  [deductions=0]
 * @param {boolean} [isSelfEmployed=false]
 * @returns {object} result
 */
function computeTotalTaxLiability(incomeOrOptions, state, filingStatus, deductions, isSelfEmployed) {
  let income, st, fs, ded, selfEmployed;

  if (incomeOrOptions !== null && typeof incomeOrOptions === 'object') {
    ({ income, state: st = 'CA', filingStatus: fs = 'single',
       deductions: ded = 0, isSelfEmployed: selfEmployed = false } = incomeOrOptions);
  } else {
    income       = incomeOrOptions || 0;
    st           = state          || 'CA';
    fs           = filingStatus   || 'single';
    ded          = deductions     || 0;
    selfEmployed = isSelfEmployed || false;
  }

  income = parseFloat(income) || 0;
  ded    = parseFloat(ded)    || 0;

  const fedResult   = calculateFederalTax(income, fs, ded, selfEmployed, 'sole_proprietor');
  const stateResult = calculateStateTax(income, st, fs, ded, selfEmployed);

  const totalTax = fedResult.totalFederalTax + stateResult.stateTax;

  return {
    grossIncome:      income,
    state:            st,
    filingStatus:     fs,
    isSelfEmployed:   selfEmployed,
    federalIncomeTax: fedResult.incomeTax,
    seTax:            fedResult.seTax,
    totalFederalTax:  fedResult.totalFederalTax,
    stateTax:         stateResult.stateTax,
    totalTax:         parseFloat(totalTax.toFixed(2)),
    effectiveRate:    income > 0 ? parseFloat((totalTax / income).toFixed(4)) : 0,
    deductionUsed:    fedResult.deductionUsed,
    taxableIncome:    fedResult.taxableIncome,
    federalDetails:   fedResult,
    stateDetails:     stateResult,
  };
}

module.exports = {
  calculateFederalTax,
  calculateStateTax,
  calculateQuarterlyEstimatedTax,
  categorizeDeductions,
  computeTotalTaxLiability,
};
