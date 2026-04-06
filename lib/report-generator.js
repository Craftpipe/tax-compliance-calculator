'use strict';

/**
 * lib/report-generator.js
 * Produces plain-text compliance reports and audit-ready documentation
 * from calculation results.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function line(char, len) {
  return char.repeat(len || 60);
}

function currency(n) {
  return `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n) {
  return `${(parseFloat(n || 0) * 100).toFixed(2)}%`;
}

function today() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Generate a plain-text compliance report.
 *
 * Accepts either:
 *   generateComplianceReport(results, options)
 *   generateComplianceReport(results)   — options defaults to {}
 *
 * @param {object}      results   Output from computeTotalTaxLiability or similar.
 * @param {object}      [options] Optional display/format options.
 * @returns {string}
 */
function generateComplianceReport(results, options) {
  options = options || {};

  if (!results || typeof results !== 'object') {
    return 'Error: No results provided to generateComplianceReport.';
  }

  const title  = options.title  || 'TAX COMPLIANCE REPORT';
  const footer = options.footer || 'This report is for informational purposes only. Consult a licensed tax professional.';

  const lines = [
    line('='),
    title.toUpperCase(),
    `Generated: ${today()}`,
    line('='),
    '',
    'INCOME SUMMARY',
    line('-'),
    `Gross Income:          ${currency(results.grossIncome)}`,
    `Filing Status:         ${results.filingStatus || 'N/A'}`,
    `State:                 ${results.state || 'N/A'}`,
    `Self-Employed:         ${results.isSelfEmployed ? 'Yes' : 'No'}`,
    '',
    'DEDUCTIONS',
    line('-'),
    `Deduction Used:        ${currency(results.deductionUsed)}`,
    `Taxable Income:        ${currency(results.taxableIncome)}`,
    '',
    'TAX LIABILITY',
    line('-'),
    `Federal Income Tax:    ${currency(results.federalIncomeTax)}`,
    `Self-Employment Tax:   ${currency(results.seTax)}`,
    `Total Federal Tax:     ${currency(results.totalFederalTax)}`,
    `State Tax (${results.state || '??'}):       ${currency(results.stateTax)}`,
    `Total Tax Liability:   ${currency(results.totalTax)}`,
    `Effective Tax Rate:    ${pct(results.effectiveRate)}`,
    '',
    line('-'),
    footer,
    line('='),
  ];

  return lines.join('\n');
}

/**
 * Generate an audit-ready document.
 *
 * Accepts either:
 *   generateAuditDocument(results, options)
 *   generateAuditDocument(results)   — options defaults to {}
 *
 * @param {object}      results
 * @param {object}      [options]
 * @returns {string}
 */
function generateAuditDocument(results, options) {
  options = options || {};

  if (!results || typeof results !== 'object') {
    return 'Error: No results provided to generateAuditDocument.';
  }

  const preparer = options.preparer || 'Tax Compliance Calculator (automated)';
  const taxYear  = options.taxYear  || new Date().getFullYear() - 1;

  const fed = results.federalDetails || {};
  const st  = results.stateDetails   || {};

  const lines = [
    line('='),
    'AUDIT DOCUMENTATION PACKAGE',
    `Tax Year: ${taxYear}`,
    `Prepared by: ${preparer}`,
    `Date: ${today()}`,
    line('='),
    '',
    '1. TAXPAYER INFORMATION',
    line('-'),
    `   Filing Status:       ${results.filingStatus || 'N/A'}`,
    `   State Jurisdiction:  ${results.state || 'N/A'}`,
    `   Business Type:       ${results.businessType || fed.businessType || 'N/A'}`,
    `   Self-Employed:       ${results.isSelfEmployed ? 'Yes' : 'No'}`,
    '',
    '2. INCOME DOCUMENTATION',
    line('-'),
    `   Gross Income:        ${currency(results.grossIncome)}`,
    `   AGI (Federal):       ${currency(fed.agi)}`,
    `   SE Tax Deduction:    ${currency(fed.seTaxDeduction)}`,
    '',
    '3. DEDUCTION DOCUMENTATION',
    line('-'),
    `   Standard Deduction:  ${currency(fed.standardDeduction)}`,
    `   Deduction Applied:   ${currency(fed.deductionUsed)}`,
    `   Federal Taxable Inc: ${currency(fed.taxableIncome)}`,
    `   State Taxable Inc:   ${currency(st.taxableIncome)}`,
    '',
    '4. TAX COMPUTATION',
    line('-'),
    `   Federal Income Tax:  ${currency(fed.incomeTax)}`,
    `   Self-Employment Tax: ${currency(fed.seTax)}`,
    `   Total Federal Tax:   ${currency(fed.totalFederalTax)}`,
    `   State Tax:           ${currency(st.stateTax)}`,
    `   Total Tax Liability: ${currency(results.totalTax)}`,
    `   Effective Rate:      ${pct(results.effectiveRate)}`,
    '',
    '5. SUPPORTING RECORDS CHECKLIST',
    line('-'),
    '   [ ] W-2 / 1099 forms',
    '   [ ] Bank statements',
    '   [ ] Expense receipts',
    '   [ ] Mileage log (if applicable)',
    '   [ ] Home office measurements (if applicable)',
    '   [ ] Prior year tax return',
    '',
    line('='),
    'END OF AUDIT DOCUMENT',
    line('='),
  ];

  return lines.join('\n');
}

/**
 * Format a deduction summary.
 *
 * Accepts either:
 *   formatDeductionSummary(deductionResult, options)
 *   formatDeductionSummary(deductionResult)   — options defaults to {}
 *
 * @param {object}      deductionResult  Output from categorizeDeductions.
 * @param {object}      [options]
 * @returns {string}
 */
function formatDeductionSummary(deductionResult, options) {
  options = options || {};

  if (!deductionResult || typeof deductionResult !== 'object') {
    return 'Error: No deduction data provided to formatDeductionSummary.';
  }

  const { total = 0, categories = {}, warnings = [] } = deductionResult;
  const title = options.title || 'DEDUCTION SUMMARY';

  const lines = [
    line('='),
    title,
    `Generated: ${today()}`,
    line('-'),
  ];

  const entries = Object.entries(categories);
  if (entries.length === 0) {
    lines.push('  No deductions recorded.');
  } else {
    for (const [cat, amt] of entries) {
      const label = cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).padEnd(28);
      lines.push(`  ${label} ${currency(amt)}`);
    }
  }

  lines.push(line('-'));
  lines.push(`  ${'TOTAL'.padEnd(28)} ${currency(total)}`);

  if (warnings.length > 0) {
    lines.push('');
    lines.push('NOTES / WARNINGS');
    warnings.forEach(w => lines.push(`  * ${w}`));
  }

  lines.push(line('='));
  return lines.join('\n');
}

/**
 * Format filing deadlines for a given state and filing status.
 *
 * @param {string} state
 * @param {string} [filingStatus='single']
 * @returns {string}
 */
function formatFilingDeadlines(state, filingStatus) {
  filingStatus = filingStatus || 'single';
  state = (state || 'N/A').toUpperCase();

  const taxYear = new Date().getFullYear() - 1;

  const lines = [
    line('='),
    'FILING DEADLINES',
    `Tax Year: ${taxYear}  |  State: ${state}  |  Status: ${filingStatus}`,
    line('-'),
    `  Federal Return (Form 1040):      April 15, ${taxYear + 1}`,
    `  Federal Extension (Form 4868):   April 15, ${taxYear + 1}  (extends to Oct 15)`,
    `  Q1 Estimated Tax:                April 15, ${taxYear + 1}`,
    `  Q2 Estimated Tax:                June 16, ${taxYear + 1}`,
    `  Q3 Estimated Tax:                September 15, ${taxYear + 1}`,
    `  Q4 Estimated Tax:                January 15, ${taxYear + 2}`,
    '',
    `  State Return (${state}):`,
    `    Most states follow the federal April 15 deadline.`,
    `    Verify at your state revenue department website.`,
    line('='),
  ];

  return lines.join('\n');
}

module.exports = {
  generateComplianceReport,
  generateAuditDocument,
  formatDeductionSummary,
  formatFilingDeadlines,
};
