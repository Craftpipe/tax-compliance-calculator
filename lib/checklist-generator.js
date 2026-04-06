'use strict';

/**
 * lib/checklist-generator.js
 * Creates filing checklists based on income level, business type, and jurisdiction.
 * Outputs markdown or plain text.
 */

// ---------------------------------------------------------------------------
// Internal data: business type requirements
// ---------------------------------------------------------------------------

const BUSINESS_TYPE_DATA = {
  sole_proprietor: {
    label: 'Sole Proprietor',
    forms: ['Schedule C (Form 1040)', 'Schedule SE (Form 1040)', 'Form 1040'],
    documents: [
      '1099-NEC or 1099-MISC forms from clients',
      'Business income records / invoices',
      'Business expense receipts',
      'Home office records (if applicable)',
      'Vehicle mileage log (if applicable)',
      'Bank statements for business accounts',
    ],
    steps: [
      'Gather all 1099 forms received',
      'Total gross business income',
      'Categorize and total all business expenses',
      'Calculate net profit/loss on Schedule C',
      'Calculate self-employment tax on Schedule SE',
      'Deduct half of SE tax on Form 1040',
      'Report net profit on Form 1040',
    ],
  },
  llc_single: {
    label: 'Single-Member LLC',
    forms: ['Schedule C (Form 1040)', 'Schedule SE (Form 1040)', 'Form 1040'],
    documents: [
      '1099-NEC or 1099-MISC forms from clients',
      'LLC operating agreement',
      'Business income records / invoices',
      'Business expense receipts',
      'Bank statements for LLC accounts',
      'Home office records (if applicable)',
      'Vehicle mileage log (if applicable)',
    ],
    steps: [
      'Confirm LLC is treated as disregarded entity (single-member default)',
      'Gather all 1099 forms received',
      'Total gross business income',
      'Categorize and total all business expenses',
      'Calculate net profit/loss on Schedule C',
      'Calculate self-employment tax on Schedule SE',
      'Report net profit on Form 1040',
    ],
  },
  llc_multi: {
    label: 'Multi-Member LLC',
    forms: ['Form 1065 (Partnership Return)', 'Schedule K-1', 'Form 1040'],
    documents: [
      'LLC operating agreement',
      'Partnership income records',
      'Expense receipts',
      'Bank statements for LLC accounts',
      'Schedule K-1 from LLC',
    ],
    steps: [
      'File Form 1065 for the LLC',
      'Issue Schedule K-1 to each member',
      'Report K-1 income on personal Form 1040',
      'Calculate self-employment tax if applicable',
    ],
  },
  s_corp: {
    label: 'S Corporation',
    forms: ['Form 1120-S', 'Schedule K-1', 'Form 1040', 'Form W-2'],
    documents: [
      'Corporate income records',
      'Payroll records / W-2',
      'Shareholder agreement',
      'Bank statements',
      'Expense receipts',
      'Schedule K-1 from S-Corp',
    ],
    steps: [
      'File Form 1120-S for the S-Corp',
      'Issue W-2 for reasonable compensation',
      'Issue Schedule K-1 to shareholders',
      'Report W-2 and K-1 income on Form 1040',
    ],
  },
  c_corp: {
    label: 'C Corporation',
    forms: ['Form 1120', 'Form W-2', 'Form 1040'],
    documents: [
      'Corporate income records',
      'Payroll records / W-2',
      'Bank statements',
      'Expense receipts',
      'Dividend records (if applicable)',
    ],
    steps: [
      'File Form 1120 for the C-Corp',
      'Issue W-2 for salary',
      'Report W-2 income on personal Form 1040',
      'Report dividends received on Form 1040',
    ],
  },
  partnership: {
    label: 'Partnership',
    forms: ['Form 1065', 'Schedule K-1', 'Form 1040'],
    documents: [
      'Partnership agreement',
      'Partnership income records',
      'Expense receipts',
      'Bank statements',
      'Schedule K-1 from partnership',
    ],
    steps: [
      'File Form 1065 for the partnership',
      'Issue Schedule K-1 to each partner',
      'Report K-1 income on personal Form 1040',
      'Calculate self-employment tax on partnership income',
    ],
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getIncomeThresholdNotes(income) {
  income = parseFloat(income) || 0;
  const notes = [];
  if (income > 200000) {
    notes.push('Additional Medicare Tax (0.9%) may apply on income over $200,000.');
  }
  if (income > 160200) {
    notes.push('Social Security wage base ($160,200) exceeded; SS portion of SE tax capped.');
  }
  if (income < 400) {
    notes.push('Net SE income under $400 — Schedule SE may not be required.');
  }
  return notes;
}

function getStateSpecificNotes(state) {
  state = (state || '').toUpperCase();
  const noIncomeTax = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'];
  if (noIncomeTax.includes(state)) {
    return [`${state} has no state income tax — no state return required.`];
  }
  return [`File state return for ${state} by the state deadline (usually April 15).`];
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Generate a filing checklist.
 *
 * Accepts either:
 *   generateFilingChecklist(options)                          — single options object
 *   generateFilingChecklist(income, state, businessType)      — 3-arg form
 *   generateFilingChecklist(income, state, businessType, filingStatus) — 4-arg form
 *
 * @param {object|number} incomeOrOptions
 * @param {string}  [state='CA']
 * @param {string}  [businessType='sole_proprietor']
 * @param {string}  [filingStatus='single']
 * @returns {object} checklist data object
 */
function generateFilingChecklist(incomeOrOptions, state, businessType, filingStatus) {
  let income, st, bizType, fs;

  if (incomeOrOptions !== null && typeof incomeOrOptions === 'object') {
    ({
      income,
      state: st = 'CA',
      businessType: bizType = 'sole_proprietor',
      filingStatus: fs = 'single',
    } = incomeOrOptions);
  } else {
    income  = incomeOrOptions || 0;
    st      = state        || 'CA';
    bizType = businessType || 'sole_proprietor';
    fs      = filingStatus || 'single';
  }

  income  = parseFloat(income) || 0;
  st      = (st || 'CA').toUpperCase();
  bizType = bizType || 'sole_proprietor';
  fs      = fs      || 'single';

  const bizData = BUSINESS_TYPE_DATA[bizType] || BUSINESS_TYPE_DATA['sole_proprietor'];

  const incomeNotes = getIncomeThresholdNotes(income);
  const stateNotes  = getStateSpecificNotes(st);

  return {
    income,
    state:        st,
    businessType: bizType,
    filingStatus: fs,
    label:        bizData.label,
    forms:        bizData.forms,
    documents:    bizData.documents,
    steps:        bizData.steps,
    notes:        [...incomeNotes, ...stateNotes],
  };
}

/**
 * Get requirements for a specific business type.
 *
 * @param {string} businessType
 * @returns {object}
 */
function getBusinessTypeRequirements(businessType) {
  return BUSINESS_TYPE_DATA[businessType] || BUSINESS_TYPE_DATA['sole_proprietor'];
}

/**
 * Format a checklist object as Markdown.
 *
 * @param {object} checklist  Output from generateFilingChecklist.
 * @returns {string}
 */
function formatChecklistAsMarkdown(checklist) {
  if (!checklist || typeof checklist !== 'object') {
    return '# Error\nNo checklist data provided.';
  }

  const lines = [
    `# Tax Filing Checklist — ${checklist.label || checklist.businessType}`,
    '',
    `**State:** ${checklist.state}  |  **Filing Status:** ${checklist.filingStatus}  |  **Income:** $${(checklist.income || 0).toLocaleString()}`,
    '',
    '## Required Forms',
    '',
  ];

  (checklist.forms || []).forEach(f => lines.push(`- [ ] ${f}`));

  lines.push('');
  lines.push('## Documents to Gather');
  lines.push('');
  (checklist.documents || []).forEach(d => lines.push(`- [ ] ${d}`));

  lines.push('');
  lines.push('## Filing Steps');
  lines.push('');
  (checklist.steps || []).forEach((s, i) => lines.push(`${i + 1}. ${s}`));

  if (checklist.notes && checklist.notes.length > 0) {
    lines.push('');
    lines.push('## Notes & Reminders');
    lines.push('');
    checklist.notes.forEach(n => lines.push(`> ${n}`));
  }

  return lines.join('\n');
}

/**
 * Format a checklist object as plain text.
 *
 * @param {object} checklist  Output from generateFilingChecklist.
 * @returns {string}
 */
function formatChecklistAsPlainText(checklist) {
  if (!checklist || typeof checklist !== 'object') {
    return 'Error: No checklist data provided.';
  }

  const sep = '='.repeat(60);
  const sub = '-'.repeat(60);

  const lines = [
    sep,
    `TAX FILING CHECKLIST — ${(checklist.label || checklist.businessType || '').toUpperCase()}`,
    `State: ${checklist.state}  |  Filing Status: ${checklist.filingStatus}  |  Income: $${(checklist.income || 0).toLocaleString()}`,
    sep,
    '',
    'REQUIRED FORMS',
    sub,
  ];

  (checklist.forms || []).forEach(f => lines.push(`  [ ] ${f}`));

  lines.push('');
  lines.push('DOCUMENTS TO GATHER');
  lines.push(sub);
  (checklist.documents || []).forEach(d => lines.push(`  [ ] ${d}`));

  lines.push('');
  lines.push('FILING STEPS');
  lines.push(sub);
  (checklist.steps || []).forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));

  if (checklist.notes && checklist.notes.length > 0) {
    lines.push('');
    lines.push('NOTES & REMINDERS');
    lines.push(sub);
    checklist.notes.forEach(n => lines.push(`  * ${n}`));
  }

  lines.push('');
  lines.push(sep);

  return lines.join('\n');
}

module.exports = {
  generateFilingChecklist,
  getBusinessTypeRequirements,
  formatChecklistAsMarkdown,
  formatChecklistAsPlainText,
};
