'use strict';

/**
 * lib/premium/dashboard.js
 * Premium feature: Interactive Tax Compliance Dashboard
 *
 * Renders a comprehensive, multi-section terminal dashboard summarising:
 *   - Tax liability breakdown (federal, state, SE tax, effective rates)
 *   - Quarterly estimated payment schedule
 *   - Deduction optimisation opportunities
 *   - Multi-jurisdiction comparison
 *   - Year-over-year trend analysis (when historical data supplied)
 *   - Filing deadline countdown
 *   - Audit-risk scoring
 *
 * Usage:
 *   const dashboard = require('./lib/premium/dashboard');
 *   const output = await dashboard({ income, state, filingStatus, ... });
 *   console.log(output);
 */

const { requirePro } = require('./gate');

const {
  calculateFederalTax,
  calculateStateTax,
  calculateQuarterlyEstimatedTax,
  categorizeDeductions,
  computeTotalTaxLiability,
} = require('../calculator');

const {
  loadJurisdictionRules,
  getStateTaxRates,
  getDeductionLimits,
  getFilingThresholds,
} = require('../config');

const {
  formatDeductionSummary,
  formatFilingDeadlines,
} = require('../report-generator');

const {
  generateFilingChecklist,
  formatChecklistAsMarkdown,
} = require('../checklist-generator');

// ---------------------------------------------------------------------------
// Internal rendering helpers
// ---------------------------------------------------------------------------

const TERM_WIDTH = 72;

function line(char = '─') {
  return char.repeat(TERM_WIDTH);
}

function header(title) {
  const pad = Math.max(0, TERM_WIDTH - title.length - 4);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return `\n${'═'.repeat(TERM_WIDTH)}\n  ${'─'.repeat(left)} ${title} ${'─'.repeat(right)}\n${'═'.repeat(TERM_WIDTH)}`;
}

function section(title) {
  const bar = '▸ ' + title;
  return `\n${bar}\n${'─'.repeat(TERM_WIDTH)}`;
}

function row(label, value, width = TERM_WIDTH) {
  const labelStr = String(label);
  const valueStr = String(value);
  const dots = Math.max(1, width - labelStr.length - valueStr.length - 2);
  return `  ${labelStr} ${'·'.repeat(dots)} ${valueStr}`;
}

function indent(text, spaces = 4) {
  return text
    .split('\n')
    .map((l) => ' '.repeat(spaces) + l)
    .join('\n');
}

function currency(n) {
  if (n == null || isNaN(n)) return '$0.00';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n) {
  if (n == null || isNaN(n)) return '0.00%';
  return Number(n).toFixed(2) + '%';
}

function progressBar(ratio, width = 30) {
  const clamped = Math.min(1, Math.max(0, ratio || 0));
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + '] ' + pct(clamped * 100);
}

// ---------------------------------------------------------------------------
// Audit-risk scorer
// ---------------------------------------------------------------------------

/**
 * Returns a score 0–100 and a label based on heuristics.
 * Higher score = higher audit risk.
 */
function computeAuditRisk(params) {
  const {
    income = 0,
    totalDeductions = 0,
    selfEmployed = false,
    businessType = 'sole_proprietor',
    homeOffice = false,
    vehicleDeduction = 0,
    mealDeduction = 0,
  } = params || {};

  let score = 0;
  const flags = [];

  // High income bracket
  if (income > 500000) { score += 20; flags.push('Income > $500k (elevated IRS scrutiny)'); }
  else if (income > 200000) { score += 10; flags.push('Income > $200k (moderate IRS scrutiny)'); }

  // Deduction-to-income ratio
  const deductionRatio = income > 0 ? totalDeductions / income : 0;
  if (deductionRatio > 0.5) { score += 25; flags.push(`Deductions are ${pct(deductionRatio * 100)} of income (unusually high)`); }
  else if (deductionRatio > 0.3) { score += 12; flags.push(`Deductions are ${pct(deductionRatio * 100)} of income (above average)`); }

  // Self-employment
  if (selfEmployed) { score += 10; flags.push('Self-employment income (Schedule C scrutiny)'); }

  // Home office
  if (homeOffice) { score += 8; flags.push('Home office deduction claimed'); }

  // Vehicle deduction
  if (vehicleDeduction > 10000) { score += 10; flags.push(`Large vehicle deduction: ${currency(vehicleDeduction)}`); }
  else if (vehicleDeduction > 0) { score += 4; flags.push(`Vehicle deduction: ${currency(vehicleDeduction)}`); }

  // Meal deduction
  if (mealDeduction > 5000) { score += 7; flags.push(`Meal/entertainment deduction: ${currency(mealDeduction)}`); }

  // Business type
  if (businessType === 'sole_proprietor') { score += 5; flags.push('Sole proprietor (Schedule C filer)'); }

  score = Math.min(100, score);

  let label, advice;
  if (score < 20) { label = '🟢 LOW'; advice = 'Your return profile is within normal ranges. Maintain organised records.'; }
  else if (score < 45) { label = '🟡 MODERATE'; advice = 'Some factors may attract attention. Ensure all deductions are documented.'; }
  else if (score < 70) { label = '🟠 ELEVATED'; advice = 'Multiple risk factors present. Consider a CPA review before filing.'; }
  else { label = '🔴 HIGH'; advice = 'Significant audit risk indicators. Professional review strongly recommended.'; }

  return { score, label, flags, advice };
}

// ---------------------------------------------------------------------------
// Quarterly schedule renderer
// ---------------------------------------------------------------------------

function renderQuarterlySchedule(quarterlyResult, taxYear) {
  if (!quarterlyResult) return '  No quarterly data available.\n';

  const year = taxYear || new Date().getFullYear();
  const deadlines = [
    { q: 'Q1', due: `April 15, ${year}`, period: `Jan 1 – Mar 31, ${year}` },
    { q: 'Q2', due: `June 17, ${year}`, period: `Apr 1 – May 31, ${year}` },
    { q: 'Q3', due: `September 16, ${year}`, period: `Jun 1 – Aug 31, ${year}` },
    { q: 'Q4', due: `January 15, ${year + 1}`, period: `Sep 1 – Dec 31, ${year}` },
  ];

  const perQ = quarterlyResult.quarterlyPayment || quarterlyResult.estimatedPayment || 0;
  const annual = quarterlyResult.annualEstimate || perQ * 4;

  let out = '';
  deadlines.forEach(({ q, due, period }) => {
    out += `\n  ${q}  ${period}\n`;
    out += `       Due: ${due}   Amount: ${currency(perQ)}\n`;
  });
  out += `\n  ${row('Annual Estimated Total', currency(annual))}\n`;
  out += `  ${row('Safe-harbour threshold (110% prior year)', currency(annual * 1.1))}\n`;
  return out;
}

// ---------------------------------------------------------------------------
// Multi-jurisdiction comparison
// ---------------------------------------------------------------------------

const COMPARISON_STATES = ['CA', 'TX', 'NY', 'FL', 'WA', 'IL', 'CO', 'NV'];

function renderJurisdictionComparison(params) {
  const { income, filingStatus, deductions, selfEmployed } = params;
  const results = [];

  COMPARISON_STATES.forEach((stateCode) => {
    try {
      const stateRules = getStateTaxRates ? getStateTaxRates(stateCode) : null;
      const stateTax = calculateStateTax
        ? calculateStateTax({ income, state: stateCode, filingStatus, deductions })
        : null;
      const stateTaxAmt = (stateTax && (stateTax.stateTax || stateTax.tax || stateTax.amount)) || 0;
      results.push({ state: stateCode, stateTax: stateTaxAmt });
    } catch (_) {
      results.push({ state: stateCode, stateTax: null });
    }
  });

  results.sort((a, b) => (a.stateTax || 0) - (b.stateTax || 0));

  let out = '';
  const maxTax = Math.max(...results.map((r) => r.stateTax || 0), 1);

  results.forEach(({ state, stateTax }) => {
    if (stateTax === null) {
      out += `  ${state.padEnd(4)} ${'N/A'.padStart(10)}  (data unavailable)\n`;
    } else {
      const bar = progressBar(stateTax / maxTax, 24);
      out += `  ${state.padEnd(4)} ${currency(stateTax).padStart(12)}  ${bar}\n`;
    }
  });

  return out;
}

// ---------------------------------------------------------------------------
// Deduction optimisation
// ---------------------------------------------------------------------------

function renderDeductionOptimisation(params) {
  const {
    income = 0,
    totalDeductions = 0,
    deductionBreakdown = {},
    state = 'CA',
    filingStatus = 'single',
  } = params;

  let limits = {};
  try {
    limits = getDeductionLimits ? (getDeductionLimits(state) || {}) : {};
  } catch (_) {}

  const standardDeduction = filingStatus === 'married_filing_jointly' ? 27700 : 13850;
  const itemizedTotal = totalDeductions || 0;
  const useItemized = itemizedTotal > standardDeduction;

  let out = '';
  out += row('Standard Deduction (2024)', currency(standardDeduction)) + '\n';
  out += row('Your Itemized Deductions', currency(itemizedTotal)) + '\n';
  out += row('Recommended Method', useItemized ? 'Itemized ✓' : 'Standard ✓') + '\n';

  if (!useItemized && itemizedTotal > 0) {
    const gap = standardDeduction - itemizedTotal;
    out += `\n  💡 You are ${currency(gap)} below the itemized threshold.\n`;
    out += `     Consider bunching deductions or increasing charitable contributions.\n`;
  } else if (useItemized) {
    const savings = itemizedTotal - standardDeduction;
    out += `\n  ✅ Itemizing saves you ${currency(savings)} vs. standard deduction.\n`;
  }

  // Breakdown
  if (deductionBreakdown && Object.keys(deductionBreakdown).length > 0) {
    out += '\n  Deduction Breakdown:\n';
    Object.entries(deductionBreakdown).forEach(([cat, amt]) => {
      if (amt && amt > 0) {
        const limitVal = limits[cat];
        const limitNote = limitVal ? `  (limit: ${currency(limitVal)})` : '';
        const overLimit = limitVal && amt > limitVal ? '  ⚠ OVER LIMIT' : '';
        out += `    ${cat.padEnd(28)} ${currency(amt)}${limitNote}${overLimit}\n`;
      }
    });
  }

  // Missed opportunities
  out += '\n  Potential Missed Deductions:\n';
  const missed = [];
  if (!deductionBreakdown.homeOffice && !deductionBreakdown.home_office) missed.push('Home office (if you work from home)');
  if (!deductionBreakdown.retirement && !deductionBreakdown.sep_ira) missed.push('SEP-IRA / Solo 401(k) contributions (up to $66,000)');
  if (!deductionBreakdown.healthInsurance && !deductionBreakdown.health_insurance) missed.push('Self-employed health insurance premiums');
  if (!deductionBreakdown.education) missed.push('Professional education & training expenses');
  if (!deductionBreakdown.software) missed.push('Business software & subscriptions');

  if (missed.length === 0) {
    out += '    ✅ No obvious missed deductions detected.\n';
  } else {
    missed.forEach((m) => { out += `    • ${m}\n`; });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Year-over-year trend
// ---------------------------------------------------------------------------

function renderYoYTrend(history) {
  if (!history || !Array.isArray(history) || history.length < 2) {
    return '  Supply at least 2 years of data via the `history` option to enable trend analysis.\n';
  }

  let out = '';
  out += `  ${'Year'.padEnd(8)} ${'Income'.padStart(14)} ${'Total Tax'.padStart(14)} ${'Eff. Rate'.padStart(10)} ${'YoY Δ Tax'.padStart(12)}\n`;
  out += `  ${'─'.repeat(62)}\n`;

  history.forEach((yr, idx) => {
    const { year, income, totalTax, effectiveRate } = yr || {};
    const prev = history[idx - 1];
    let delta = '';
    if (prev && prev.totalTax != null && totalTax != null) {
      const diff = totalTax - prev.totalTax;
      delta = (diff >= 0 ? '+' : '') + currency(diff);
    }
    out += `  ${String(year || '').padEnd(8)} ${currency(income).padStart(14)} ${currency(totalTax).padStart(14)} ${pct(effectiveRate).padStart(10)} ${delta.padStart(12)}\n`;
  });

  return out;
}

// ---------------------------------------------------------------------------
// Filing deadline countdown
// ---------------------------------------------------------------------------

function renderDeadlineCountdown(taxYear) {
  const year = taxYear || new Date().getFullYear();
  const now = new Date();

  const deadlines = [
    { label: 'Q1 Estimated Tax', date: new Date(`${year}-04-15`) },
    { label: 'Q2 Estimated Tax', date: new Date(`${year}-06-17`) },
    { label: 'Q3 Estimated Tax', date: new Date(`${year}-09-16`) },
    { label: 'Annual Return (Form 1040)', date: new Date(`${year}-04-15`) },
    { label: 'Extension Deadline', date: new Date(`${year}-10-15`) },
    { label: 'Q4 Estimated Tax', date: new Date(`${year + 1}-01-15`) },
  ];

  let out = '';
  deadlines.forEach(({ label, date }) => {
    const diffMs = date - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    let status;
    if (diffDays < 0) {
      status = `PASSED (${Math.abs(diffDays)}d ago)`;
    } else if (diffDays === 0) {
      status = '⚠ TODAY';
    } else if (diffDays <= 14) {
      status = `⚠ ${diffDays}d remaining`;
    } else {
      status = `${diffDays}d remaining`;
    }
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    out += `  ${label.padEnd(34)} ${dateStr.padEnd(14)} ${status}\n`;
  });

  return out;
}

// ---------------------------------------------------------------------------
// Main dashboard function
// ---------------------------------------------------------------------------

/**
 * Generate the full premium dashboard.
 *
 * @param {object} opts
 * @param {number}  opts.income              - Gross income (USD)
 * @param {string}  opts.state               - Two-letter state code
 * @param {string}  opts.filingStatus        - Filing status string
 * @param {number}  opts.deductions          - Total itemized deductions
 * @param {object}  opts.deductionBreakdown  - Category → amount map
 * @param {string}  opts.businessType        - Business entity type
 * @param {boolean} opts.selfEmployed        - Is income self-employment?
 * @param {boolean} opts.homeOffice          - Home office deduction claimed?
 * @param {number}  opts.vehicleDeduction    - Vehicle deduction amount
 * @param {number}  opts.mealDeduction       - Meal/entertainment deduction
 * @param {number}  opts.taxYear             - Tax year (defaults to current)
 * @param {Array}   opts.history             - Array of { year, income, totalTax, effectiveRate }
 * @param {boolean} opts.noColor             - Disable emoji/unicode decorations
 * @returns {Promise<string>}                - Rendered dashboard string
 */
async function dashboard(opts) {
  requirePro('dashboard');

  const {
    income = 0,
    state = 'CA',
    filingStatus = 'single',
    deductions = 0,
    deductionBreakdown = {},
    businessType = 'sole_proprietor',
    selfEmployed = false,
    homeOffice = false,
    vehicleDeduction = 0,
    mealDeduction = 0,
    taxYear = null,
    history = [],
  } = opts || {};

  const year = taxYear || new Date().getFullYear();

  // ── Core calculations ────────────────────────────────────────────────────

  let federalResult = {};
  let stateResult = {};
  let quarterlyResult = {};
  let totalResult = {};
  let categorised = {};

  try {
    federalResult = calculateFederalTax({ income, filingStatus, deductions }) || {};
  } catch (e) {
    federalResult = { error: e.message };
  }

  try {
    stateResult = calculateStateTax({ income, state, filingStatus, deductions }) || {};
  } catch (e) {
    stateResult = { error: e.message };
  }

  try {
    quarterlyResult = calculateQuarterlyEstimatedTax({ income, state, filingStatus, deductions, selfEmployed }) || {};
  } catch (e) {
    quarterlyResult = { error: e.message };
  }

  try {
    totalResult = computeTotalTaxLiability({ income, state, filingStatus, deductions, selfEmployed, businessType }) || {};
  } catch (e) {
    totalResult = { error: e.message };
  }

  try {
    categorised = categorizeDeductions(deductionBreakdown) || {};
  } catch (_) {
    categorised = deductionBreakdown || {};
  }

  // ── Derived values ───────────────────────────────────────────────────────

  const federalTax = federalResult.federalTax || federalResult.tax || federalResult.amount || 0;
  const stateTax   = stateResult.stateTax   || stateResult.tax   || stateResult.amount   || 0;
  const seTax      = totalResult.seTax      || totalResult.selfEmploymentTax             || 0;
  const totalTax   = totalResult.totalTax   || totalResult.total || (federalTax + stateTax + seTax);
  const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;
  const marginalRate  = federalResult.marginalRate || federalResult.bracketRate || 0;
  const taxableIncome = federalResult.taxableIncome || Math.max(0, income - deductions);
  const afterTaxIncome = income - totalTax;

  // ── Audit risk ───────────────────────────────────────────────────────────

  const auditRisk = computeAuditRisk({
    income,
    totalDeductions: deductions,
    selfEmployed,
    businessType,
    homeOffice,
    vehicleDeduction,
    mealDeduction,
  });

  // ── Checklist ────────────────────────────────────────────────────────────

  let checklistMd = '';
  try {
    const checklist = generateFilingChecklist({ income, state, filingStatus, businessType, selfEmployed });
    checklistMd = formatChecklistAsMarkdown(checklist) || '';
  } catch (_) {
    checklistMd = '  (Checklist generation unavailable)\n';
  }

  // ── Assemble dashboard ───────────────────────────────────────────────────

  const lines = [];

  // ── Title ────────────────────────────────────────────────────────────────
  lines.push(header(`TAX COMPLIANCE DASHBOARD  ·  ${year}`));
  lines.push(`  Jurisdiction: ${state}   Filing Status: ${filingStatus}   Business: ${businessType}`);
  lines.push(`  Generated: ${new Date().toLocaleString('en-US')}`);

  // ── 1. Tax Liability Summary ─────────────────────────────────────────────
  lines.push(section('1 · TAX LIABILITY SUMMARY'));
  lines.push(row('Gross Income', currency(income)));
  lines.push(row('Deductions Applied', currency(deductions)));
  lines.push(row('Taxable Income', currency(taxableIncome)));
  lines.push('  ' + line());
  lines.push(row('Federal Income Tax', currency(federalTax)));
  lines.push(row(`State Tax (${state})`, currency(stateTax)));
  if (selfEmployed) {
    lines.push(row('Self-Employment Tax (15.3%)', currency(seTax)));
  }
  lines.push('  ' + line());
  lines.push(row('TOTAL TAX LIABILITY', currency(totalTax)));
  lines.push(row('After-Tax Income', currency(afterTaxIncome)));
  lines.push('');
  lines.push(row('Effective Tax Rate', pct(effectiveRate)));
  lines.push(row('Marginal Federal Rate', pct(marginalRate)));
  lines.push('');
  lines.push('  Tax Burden Visualisation:');
  lines.push('  Federal  ' + progressBar(federalTax / (income || 1), 28));
  lines.push('  State    ' + progressBar(stateTax   / (income || 1), 28));
  if (selfEmployed) {
    lines.push('  SE Tax   ' + progressBar(seTax      / (income || 1), 28));
  }
  lines.push('  Total    ' + progressBar(totalTax   / (income || 1), 28));

  // ── 2. Quarterly Estimated Payments ─────────────────────────────────────
  lines.push(section('2 · QUARTERLY ESTIMATED PAYMENTS'));
  lines.push(renderQuarterlySchedule(quarterlyResult, year));

  // ── 3. Deduction Optimisation ────────────────────────────────────────────
  lines.push(section('3 · DEDUCTION OPTIMISATION'));
  lines.push(renderDeductionOptimisation({
    income,
    totalDeductions: deductions,
    deductionBreakdown: categorised,
    state,
    filingStatus,
  }));

  // ── 4. Audit Risk Assessment ─────────────────────────────────────────────
  lines.push(section('4 · AUDIT RISK ASSESSMENT'));
  lines.push(row('Risk Score', `${auditRisk.score} / 100`));
  lines.push(row('Risk Level', auditRisk.label));
  lines.push('');
  if (auditRisk.flags.length > 0) {
    lines.push('  Risk Factors:');
    auditRisk.flags.forEach((f) => lines.push(`    ⚑ ${f}`));
  } else {
    lines.push('  ✅ No significant risk factors detected.');
  }
  lines.push('');
  lines.push(`  Advice: ${auditRisk.advice}`);

  // ── 5. Multi-Jurisdiction Comparison ────────────────────────────────────
  lines.push(section('5 · STATE TAX COMPARISON  (same income, different states)'));
  lines.push(renderJurisdictionComparison({ income, filingStatus, deductions, selfEmployed }));

  // ── 6. Filing Deadline Countdown ─────────────────────────────────────────
  lines.push(section('6 · FILING DEADLINE COUNTDOWN'));
  lines.push(renderDeadlineCountdown(year));

  // ── 7. Year-over-Year Trend ──────────────────────────────────────────────
  lines.push(section('7 · YEAR-OVER-YEAR TREND'));
  lines.push(renderYoYTrend(history));

  // ── 8. Filing Checklist ──────────────────────────────────────────────────
  lines.push(section('8 · FILING CHECKLIST'));
  if (checklistMd) {
    lines.push(indent(checklistMd, 2));
  } else {
    lines.push('  (No checklist data available)');
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  lines.push('\n' + '═'.repeat(TERM_WIDTH));
  lines.push('  ⭐ Tax Compliance Calculator Pro  ·  https://craftpipe.gumroad.com');
  lines.push('  Disclaimer: This tool provides estimates only. Consult a qualified');
  lines.push('  tax professional before filing. Tax laws change frequently.');
  lines.push('═'.repeat(TERM_WIDTH) + '\n');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = dashboard;