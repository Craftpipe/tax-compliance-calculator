'use strict';

/**
 * lib/config.js
 * Tax rules database for Tax Compliance Calculator.
 * Provides federal brackets, state rates, deduction limits, and filing thresholds.
 * Supports jurisdiction-specific rule loading.
 */

// ---------------------------------------------------------------------------
// Embedded tax rules data (2024 tax year)
// ---------------------------------------------------------------------------

const FEDERAL_BRACKETS = {
  single: [
    { min: 0,       max: 11600,  rate: 0.10 },
    { min: 11600,   max: 47150,  rate: 0.12 },
    { min: 47150,   max: 100525, rate: 0.22 },
    { min: 100525,  max: 191950, rate: 0.24 },
    { min: 191950,  max: 243725, rate: 0.32 },
    { min: 243725,  max: 609350, rate: 0.35 },
    { min: 609350,  max: null,   rate: 0.37 },
  ],
  married_filing_jointly: [
    { min: 0,       max: 23200,  rate: 0.10 },
    { min: 23200,   max: 94300,  rate: 0.12 },
    { min: 94300,   max: 201050, rate: 0.22 },
    { min: 201050,  max: 383900, rate: 0.24 },
    { min: 383900,  max: 487450, rate: 0.32 },
    { min: 487450,  max: 731200, rate: 0.35 },
    { min: 731200,  max: null,   rate: 0.37 },
  ],
  married_filing_separately: [
    { min: 0,       max: 11600,  rate: 0.10 },
    { min: 11600,   max: 47150,  rate: 0.12 },
    { min: 47150,   max: 100525, rate: 0.22 },
    { min: 100525,  max: 191950, rate: 0.24 },
    { min: 191950,  max: 243725, rate: 0.32 },
    { min: 243725,  max: 365600, rate: 0.35 },
    { min: 365600,  max: null,   rate: 0.37 },
  ],
  head_of_household: [
    { min: 0,       max: 16550,  rate: 0.10 },
    { min: 16550,   max: 63100,  rate: 0.12 },
    { min: 63100,   max: 100500, rate: 0.22 },
    { min: 100500,  max: 191950, rate: 0.24 },
    { min: 191950,  max: 243700, rate: 0.32 },
    { min: 243700,  max: 609350, rate: 0.35 },
    { min: 609350,  max: null,   rate: 0.37 },
  ],
};

const STATE_TAX_RATES = {
  AL: { type: 'bracket', standardDeduction: 2500, brackets: [
    { min: 0,     max: 500,   rate: 0.02 },
    { min: 500,   max: 3000,  rate: 0.04 },
    { min: 3000,  max: null,  rate: 0.05 },
  ]},
  AK: { type: 'none', rate: 0, standardDeduction: 0, brackets: [] },
  AZ: { type: 'flat', rate: 0.025, standardDeduction: 13850, brackets: [] },
  AR: { type: 'bracket', standardDeduction: 2200, brackets: [
    { min: 0,     max: 4300,  rate: 0.02 },
    { min: 4300,  max: 8500,  rate: 0.04 },
    { min: 8500,  max: null,  rate: 0.049 },
  ]},
  CA: { type: 'bracket', standardDeduction: 5202, brackets: [
    { min: 0,       max: 10099,  rate: 0.01 },
    { min: 10099,   max: 23942,  rate: 0.02 },
    { min: 23942,   max: 37788,  rate: 0.04 },
    { min: 37788,   max: 52455,  rate: 0.06 },
    { min: 52455,   max: 66295,  rate: 0.08 },
    { min: 66295,   max: 338639, rate: 0.093 },
    { min: 338639,  max: 406364, rate: 0.103 },
    { min: 406364,  max: 677275, rate: 0.113 },
    { min: 677275,  max: null,   rate: 0.123 },
  ]},
  CO: { type: 'flat', rate: 0.044, standardDeduction: 13850, brackets: [] },
  CT: { type: 'bracket', standardDeduction: 0, brackets: [
    { min: 0,       max: 10000,  rate: 0.03 },
    { min: 10000,   max: 50000,  rate: 0.05 },
    { min: 50000,   max: 100000, rate: 0.055 },
    { min: 100000,  max: 200000, rate: 0.06 },
    { min: 200000,  max: 250000, rate: 0.065 },
    { min: 250000,  max: 500000, rate: 0.069 },
    { min: 500000,  max: null,   rate: 0.0699 },
  ]},
  DE: { type: 'bracket', standardDeduction: 3250, brackets: [
    { min: 0,      max: 2000,  rate: 0.00 },
    { min: 2000,   max: 5000,  rate: 0.022 },
    { min: 5000,   max: 10000, rate: 0.039 },
    { min: 10000,  max: 20000, rate: 0.048 },
    { min: 20000,  max: 25000, rate: 0.052 },
    { min: 25000,  max: 60000, rate: 0.0555 },
    { min: 60000,  max: null,  rate: 0.066 },
  ]},
  FL: { type: 'none', rate: 0, standardDeduction: 0, brackets: [] },
  GA: { type: 'flat', rate: 0.055, standardDeduction: 5400, brackets: [] },
  HI: { type: 'bracket', standardDeduction: 2200, brackets: [
    { min: 0,      max: 2400,  rate: 0.014 },
    { min: 2400,   max: 4800,  rate: 0.032 },
    { min: 4800,   max: 9600,  rate: 0.055 },
    { min: 9600,   max: 14400, rate: 0.064 },
    { min: 14400,  max: 19200, rate: 0.068 },
    { min: 19200,  max: 24000, rate: 0.072 },
    { min: 24000,  max: 48000, rate: 0.076 },
    { min: 48000,  max: 150000,rate: 0.079 },
    { min: 150000, max: 175000,rate: 0.0825 },
    { min: 175000, max: 200000,rate: 0.09 },
    { min: 200000, max: null,  rate: 0.11 },
  ]},
  ID: { type: 'flat', rate: 0.058, standardDeduction: 13850, brackets: [] },
  IL: { type: 'flat', rate: 0.0495, standardDeduction: 0, brackets: [] },
  IN: { type: 'flat', rate: 0.0305, standardDeduction: 1000, brackets: [] },
  IA: { type: 'flat', rate: 0.06,   standardDeduction: 13850, brackets: [] },
  KS: { type: 'bracket', standardDeduction: 3500, brackets: [
    { min: 0,      max: 15000, rate: 0.031 },
    { min: 15000,  max: 30000, rate: 0.0525 },
    { min: 30000,  max: null,  rate: 0.057 },
  ]},
  KY: { type: 'flat', rate: 0.045, standardDeduction: 2980, brackets: [] },
  LA: { type: 'bracket', standardDeduction: 4500, brackets: [
    { min: 0,      max: 12500, rate: 0.0185 },
    { min: 12500,  max: 50000, rate: 0.035 },
    { min: 50000,  max: null,  rate: 0.0425 },
  ]},
  ME: { type: 'bracket', standardDeduction: 13850, brackets: [
    { min: 0,      max: 24500, rate: 0.058 },
    { min: 24500,  max: 58050, rate: 0.0675 },
    { min: 58050,  max: null,  rate: 0.0715 },
  ]},
  MD: { type: 'bracket', standardDeduction: 2400, brackets: [
    { min: 0,      max: 1000,  rate: 0.02 },
    { min: 1000,   max: 2000,  rate: 0.03 },
    { min: 2000,   max: 3000,  rate: 0.04 },
    { min: 3000,   max: 100000,rate: 0.0475 },
    { min: 100000, max: 125000,rate: 0.05 },
    { min: 125000, max: 150000,rate: 0.0525 },
    { min: 150000, max: 250000,rate: 0.055 },
    { min: 250000, max: null,  rate: 0.0575 },
  ]},
  MA: { type: 'flat', rate: 0.05,   standardDeduction: 0, brackets: [] },
  MI: { type: 'flat', rate: 0.0425, standardDeduction: 5000, brackets: [] },
  MN: { type: 'bracket', standardDeduction: 13825, brackets: [
    { min: 0,      max: 30070,  rate: 0.0535 },
    { min: 30070,  max: 98760,  rate: 0.068 },
    { min: 98760,  max: 183340, rate: 0.0785 },
    { min: 183340, max: null,   rate: 0.0985 },
  ]},
  MS: { type: 'flat', rate: 0.05,   standardDeduction: 2300, brackets: [] },
  MO: { type: 'bracket', standardDeduction: 13850, brackets: [
    { min: 0,      max: 1121,  rate: 0.015 },
    { min: 1121,   max: 2242,  rate: 0.02 },
    { min: 2242,   max: 3363,  rate: 0.025 },
    { min: 3363,   max: 4484,  rate: 0.03 },
    { min: 4484,   max: 5605,  rate: 0.035 },
    { min: 5605,   max: 6726,  rate: 0.04 },
    { min: 6726,   max: 7847,  rate: 0.045 },
    { min: 7847,   max: 8968,  rate: 0.05 },
    { min: 8968,   max: null,  rate: 0.054 },
  ]},
  MT: { type: 'flat', rate: 0.059, standardDeduction: 5000, brackets: [] },
  NE: { type: 'bracket', standardDeduction: 7900, brackets: [
    { min: 0,      max: 3700,  rate: 0.0246 },
    { min: 3700,   max: 22170, rate: 0.0351 },
    { min: 22170,  max: 35730, rate: 0.0501 },
    { min: 35730,  max: null,  rate: 0.0664 },
  ]},
  NV: { type: 'none', rate: 0, standardDeduction: 0, brackets: [] },
  NH: { type: 'flat', rate: 0.04,  standardDeduction: 0, brackets: [], note: 'Interest and dividends only' },
  NJ: { type: 'bracket', standardDeduction: 0, brackets: [
    { min: 0,       max: 20000,  rate: 0.014 },
    { min: 20000,   max: 35000,  rate: 0.0175 },
    { min: 35000,   max: 40000,  rate: 0.035 },
    { min: 40000,   max: 75000,  rate: 0.05525 },
    { min: 75000,   max: 500000, rate: 0.0637 },
    { min: 500000,  max: 1000000,rate: 0.0897 },
    { min: 1000000, max: null,   rate: 0.1075 },
  ]},
  NM: { type: 'bracket', standardDeduction: 13850, brackets: [
    { min: 0,      max: 5500,  rate: 0.017 },
    { min: 5500,   max: 11000, rate: 0.032 },
    { min: 11000,  max: 16000, rate: 0.047 },
    { min: 16000,  max: 210000,rate: 0.049 },
    { min: 210000, max: null,  rate: 0.059 },
  ]},
  NY: { type: 'bracket', standardDeduction: 8000, brackets: [
    { min: 0,       max: 17150,  rate: 0.04 },
    { min: 17150,   max: 23600,  rate: 0.045 },
    { min: 23600,   max: 27900,  rate: 0.0525 },
    { min: 27900,   max: 161550, rate: 0.055 },
    { min: 161550,  max: 323200, rate: 0.06 },
    { min: 323200,  max: 2155350,rate: 0.0685 },
    { min: 2155350, max: 5000000,rate: 0.0965 },
    { min: 5000000, max: 25000000,rate: 0.103 },
    { min: 25000000,max: null,   rate: 0.109 },
  ]},
  NC: { type: 'flat', rate: 0.0475, standardDeduction: 12750, brackets: [] },
  ND: { type: 'bracket', standardDeduction: 13850, brackets: [
    { min: 0,      max: 44725, rate: 0.011 },
    { min: 44725,  max: 225975,rate: 0.0204 },
    { min: 225975, max: null,  rate: 0.029 },
  ]},
  OH: { type: 'bracket', standardDeduction: 0, brackets: [
    { min: 0,      max: 26050, rate: 0.00 },
    { min: 26050,  max: 100000,rate: 0.0275 },
    { min: 100000, max: null,  rate: 0.035 },
  ]},
  OK: { type: 'bracket', standardDeduction: 6350, brackets: [
    { min: 0,     max: 1000,  rate: 0.0025 },
    { min: 1000,  max: 2500,  rate: 0.0075 },
    { min: 2500,  max: 3750,  rate: 0.0175 },
    { min: 3750,  max: 4900,  rate: 0.0275 },
    { min: 4900,  max: 7200,  rate: 0.0375 },
    { min: 7200,  max: null,  rate: 0.0475 },
  ]},
  OR: { type: 'bracket', standardDeduction: 2420, brackets: [
    { min: 0,      max: 4050,  rate: 0.0475 },
    { min: 4050,   max: 10200, rate: 0.0675 },
    { min: 10200,  max: 125000,rate: 0.0875 },
    { min: 125000, max: null,  rate: 0.099 },
  ]},
  PA: { type: 'flat', rate: 0.0307, standardDeduction: 0, brackets: [] },
  RI: { type: 'bracket', standardDeduction: 10000, brackets: [
    { min: 0,      max: 73450, rate: 0.0375 },
    { min: 73450,  max: 166950,rate: 0.0475 },
    { min: 166950, max: null,  rate: 0.0599 },
  ]},
  SC: { type: 'bracket', standardDeduction: 13850, brackets: [
    { min: 0,     max: 3460,  rate: 0.00 },
    { min: 3460,  max: 6440,  rate: 0.03 },
    { min: 6440,  max: 9910,  rate: 0.04 },
    { min: 9910,  max: 13880, rate: 0.05 },
    { min: 13880, max: 17860, rate: 0.06 },
    { min: 17860, max: null,  rate: 0.065 },
  ]},
  SD: { type: 'none', rate: 0, standardDeduction: 0, brackets: [] },
  TN: { type: 'none', rate: 0, standardDeduction: 0, brackets: [] },
  TX: { type: 'none', rate: 0, standardDeduction: 0, brackets: [] },
  UT: { type: 'flat', rate: 0.0465, standardDeduction: 0, brackets: [] },
  VT: { type: 'bracket', standardDeduction: 6500, brackets: [
    { min: 0,      max: 45400,  rate: 0.0335 },
    { min: 45400,  max: 110650, rate: 0.066 },
    { min: 110650, max: 229550, rate: 0.076 },
    { min: 229550, max: null,   rate: 0.0875 },
  ]},
  VA: { type: 'bracket', standardDeduction: 8000, brackets: [
    { min: 0,     max: 3000,  rate: 0.02 },
    { min: 3000,  max: 5000,  rate: 0.03 },
    { min: 5000,  max: 17000, rate: 0.05 },
    { min: 17000, max: null,  rate: 0.0575 },
  ]},
  WA: { type: 'none', rate: 0, standardDeduction: 0, brackets: [] },
  WV: { type: 'bracket', standardDeduction: 0, brackets: [
    { min: 0,      max: 10000, rate: 0.03 },
    { min: 10000,  max: 25000, rate: 0.04 },
    { min: 25000,  max: 40000, rate: 0.045 },
    { min: 40000,  max: 60000, rate: 0.06 },
    { min: 60000,  max: null,  rate: 0.065 },
  ]},
  WI: { type: 'bracket', standardDeduction: 12760, brackets: [
    { min: 0,      max: 13810, rate: 0.0354 },
    { min: 13810,  max: 27630, rate: 0.0465 },
    { min: 27630,  max: 304170,rate: 0.053 },
    { min: 304170, max: null,  rate: 0.0765 },
  ]},
  WY: { type: 'none', rate: 0, standardDeduction: 0, brackets: [] },
  DC: { type: 'bracket', standardDeduction: 13850, brackets: [
    { min: 0,       max: 10000,  rate: 0.04 },
    { min: 10000,   max: 40000,  rate: 0.06 },
    { min: 40000,   max: 60000,  rate: 0.065 },
    { min: 60000,   max: 250000, rate: 0.085 },
    { min: 250000,  max: 500000, rate: 0.0925 },
    { min: 500000,  max: 1000000,rate: 0.0975 },
    { min: 1000000, max: null,   rate: 0.1075 },
  ]},
};

const DEDUCTION_LIMITS = {
  standardDeduction: {
    single:                    13850,
    married_filing_jointly:    27700,
    married_filing_separately: 13850,
    head_of_household:         20800,
  },
  saltDeductionCap: 10000,
  mortgageInterestLimit: 750000,
  charitableContributionLimit: 0.60,   // 60% of AGI
  businessMealDeduction: 0.50,          // 50% of meal expenses
  homeOfficeDeductionRate: 5,           // $5 per sq ft (simplified method)
  homeOfficeMaxSqFt: 300,
  vehicleMileageRate: 0.67,             // 2024 IRS standard mileage rate (per mile)
  retirementContributionLimits: {
    traditional_ira: 7000,
    roth_ira: 7000,
    sep_ira: 69000,
    simple_ira: 16000,
    '401k': 23000,
    '403b': 23000,
    catchUp_ira: 1000,                  // additional if age 50+
    catchUp_401k: 7500,                 // additional if age 50+
  },
  hsaContributionLimits: {
    self_only: 4150,
    family: 8300,
    catchUp: 1000,                      // additional if age 55+
  },
  qualifiedBusinessIncomeDeduction: 0.20, // 20% of QBI (Section 199A)
  selfEmployedHealthInsurance: 1.00,      // 100% deductible
  selfEmploymentTaxDeduction: 0.50,       // 50% of SE tax deductible
  educationExpenses: {
    americanOpportunityCredit: 2500,
    lifetimeLearningCredit: 2000,
    tuitionAndFees: 4000,
  },
  dependentCareCredit: {
    oneDependent: 3000,
    twoOrMoreDependents: 6000,
  },
  childTaxCredit: {
    perChild: 2000,
    refundablePortion: 1600,
  },
};

const FILING_THRESHOLDS = {
  // Gross income thresholds below which filing is not required (2024)
  single: {
    under65: 13850,
    over65: 15700,
  },
  married_filing_jointly: {
    bothUnder65: 27700,
    oneOver65: 29200,
    bothOver65: 30700,
  },
  married_filing_separately: {
    any: 5,
  },
  head_of_household: {
    under65: 20800,
    over65: 22650,
  },
  qualifying_surviving_spouse: {
    under65: 27700,
    over65: 29200,
  },
  // Self-employment income threshold requiring filing
  selfEmploymentIncome: 400,
  // Quarterly estimated tax thresholds
  estimatedTax: {
    minimumOwed: 1000,
    safeHarborPriorYear: 1.00,   // 100% of prior year tax
    safeHarborHighIncome: 1.10,  // 110% if prior year AGI > $150k
    highIncomeThreshold: 150000,
    underpaymentPenaltyRate: 0.08,
  },
  // FICA / self-employment tax thresholds
  socialSecurityWageBase: 168600,
  additionalMedicareTaxThreshold: {
    single: 200000,
    married_filing_jointly: 250000,
    married_filing_separately: 125000,
  },
  additionalMedicareTaxRate: 0.009,
  // Net Investment Income Tax (NIIT)
  niitThreshold: {
    single: 200000,
    married_filing_jointly: 250000,
    married_filing_separately: 125000,
  },
  niitRate: 0.038,
  // AMT exemptions
  amtExemption: {
    single: 85700,
    married_filing_jointly: 133300,
    married_filing_separately: 66650,
  },
  amtPhaseout: {
    single: 609350,
    married_filing_jointly: 1218700,
    married_filing_separately: 609350,
  },
};

// ---------------------------------------------------------------------------
// Jurisdiction rules cache
// ---------------------------------------------------------------------------

const jurisdictionCache = {};

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * loadJurisdictionRules(jurisdiction)
 * Loads and returns the complete rule set for a given jurisdiction.
 * jurisdiction: 'federal' | US state code (e.g. 'CA', 'NY') | 'all'
 * Returns an object with federalBrackets, stateTaxRates, deductionLimits, filingThresholds.
 */
function loadJurisdictionRules(jurisdiction) {
  const jur = (typeof jurisdiction === 'string' ? jurisdiction.toUpperCase() : 'FEDERAL');

  if (jurisdictionCache[jur]) {
    return jurisdictionCache[jur];
  }

  let rules;

  if (jur === 'FEDERAL' || jur === 'ALL') {
    rules = {
      jurisdiction: jur,
      federalBrackets: FEDERAL_BRACKETS,
      stateTaxRates: jur === 'ALL' ? STATE_TAX_RATES : null,
      deductionLimits: DEDUCTION_LIMITS,
      filingThresholds: FILING_THRESHOLDS,
    };
  } else {
    const stateRules = STATE_TAX_RATES[jur] || null;
    rules = {
      jurisdiction: jur,
      federalBrackets: FEDERAL_BRACKETS,
      stateTaxRates: stateRules
        ? { [jur]: stateRules }
        : null,
      deductionLimits: DEDUCTION_LIMITS,
      filingThresholds: FILING_THRESHOLDS,
      stateFound: stateRules !== null,
    };
  }

  jurisdictionCache[jur] = rules;
  return rules;
}

/**
 * getFederalBrackets(filingStatus)
 * Returns the federal tax brackets for the given filing status.
 * filingStatus: 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household'
 * If omitted or unrecognized, returns all brackets keyed by filing status.
 */
function getFederalBrackets(filingStatus) {
  if (!filingStatus) {
    return FEDERAL_BRACKETS;
  }

  const status = String(filingStatus).toLowerCase().trim();
  const brackets = FEDERAL_BRACKETS[status];

  if (!brackets) {
    // Return all brackets if status not found
    return FEDERAL_BRACKETS;
  }

  return brackets;
}

/**
 * getStateTaxRates(stateCode)
 * Returns the tax rate rules for the given US state code (e.g. 'CA').
 * If stateCode is omitted, returns all state rates.
 * Returns null for unknown state codes.
 */
function getStateTaxRates(stateCode) {
  if (!stateCode) {
    return STATE_TAX_RATES;
  }

  const code = String(stateCode).toUpperCase().trim();
  const rates = STATE_TAX_RATES[code];

  if (rates === undefined) {
    return null;
  }

  return rates;
}

/**
 * getDeductionLimits(category)
 * Returns deduction limits for a specific category, or all limits if category is omitted.
 * category: e.g. 'standardDeduction', 'saltDeductionCap', 'retirementContributionLimits', etc.
 */
function getDeductionLimits(category) {
  if (!category) {
    return DEDUCTION_LIMITS;
  }

  const key = String(category).trim();
  const limit = DEDUCTION_LIMITS[key];

  if (limit === undefined) {
    return null;
  }

  return limit;
}

/**
 * getFilingThresholds(filingStatus)
 * Returns filing thresholds for a given filing status, or all thresholds if omitted.
 * filingStatus: 'single' | 'married_filing_jointly' | 'married_filing_separately' |
 *               'head_of_household' | 'qualifying_surviving_spouse'
 */
function getFilingThresholds(filingStatus) {
  if (!filingStatus) {
    return FILING_THRESHOLDS;
  }

  const status = String(filingStatus).toLowerCase().trim();
  const threshold = FILING_THRESHOLDS[status];

  if (threshold === undefined) {
    return null;
  }

  return threshold;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loadJurisdictionRules,
  getFederalBrackets,
  getStateTaxRates,
  getDeductionLimits,
  getFilingThresholds,
};