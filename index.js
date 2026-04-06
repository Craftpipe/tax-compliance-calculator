#!/usr/bin/env node
'use strict';

/**
 * index.js
 * CLI entry point for Tax Compliance Calculator.
 * Uses commander to expose subcommands for tax calculation, report generation,
 * checklist generation, and CSV import/export.
 */

const { program } = require('commander');
const fs = require('fs');
const path = require('path');

const {
  calculateFederalTax,
  calculateStateTax,
  calculateQuarterlyEstimatedTax,
  categorizeDeductions,
  computeTotalTaxLiability,
} = require('./lib/calculator');

const {
  loadJurisdictionRules,
  getFederalBrackets,
  getStateTaxRates,
  getDeductionLimits,
  getFilingThresholds,
} = require('./lib/config');

const {
  generateComplianceReport,
  generateAuditDocument,
  formatDeductionSummary,
  formatFilingDeadlines,
} = require('./lib/report-generator');

const {
  generateFilingChecklist,
  getBusinessTypeRequirements,
  formatChecklistAsMarkdown,
  formatChecklistAsPlainText,
} = require('./lib/checklist-generator');

const {
  parseIncomeCSV,
  parseExpensesCSV,
  exportResultsToCSV,
  validateCSVRow,
} = require('./lib/csv-handler');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a file and return its contents as a string.
 * Exits with a helpful message if the file is not found.
 */
function readFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: File not found: ${resolved}`);
    process.exit(1);
  }
  return fs.readFileSync(resolved, 'utf8');
}

/**
 * Write content to a file, creating parent directories as needed.
 */
function writeFile(filePath, content) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, 'utf8');
  console.log(`Output written to: ${resolved}`);
}

/**
 * Parse a comma-separated list of key=value pairs into an object.
 * Example: "income=80000,state=CA,filingStatus=single"
 */
function parseKV(str) {
  const result = {};
  if (!str) return result;
  str.split(',').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    result[key] = val;
  });
  return result;
}

/**
 * Coerce a string value to a number where appropriate.
 */
function coerceNumber(val, fallback = 0) {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

// ---------------------------------------------------------------------------
// CLI setup
// ---------------------------------------------------------------------------

program
  .name('tax-compliance-calculator')
  .description(
    'Tax Compliance Calculator — compute taxes, generate reports and filing checklists for freelancers and small businesses.'
  )
  .version('1.0.0');

// ---------------------------------------------------------------------------
// Command: calculate
// ---------------------------------------------------------------------------

program
  .command('calculate')
  .description('Calculate federal and state tax liability from provided income and deduction data.')
  .option('-i, --income <number>', 'Gross income (USD)', '0')
  .option('-s, --state <code>', 'Two-letter state code (e.g. CA, TX, NY)', 'CA')
  .option(
    '-f, --filing-status <status>',
    'Filing status: single | married_filing_jointly | married_filing_separately | head_of_household',
    'single'
  )
  .option('-d, --deductions <number>', 'Total itemized deductions (USD); 0 uses standard deduction', '0')
  .option('-b, --business-type <type>', 'Business type for SE tax: sole_proprietor | llc_single | llc_multi | s_corp | c_corp | partnership', 'sole_proprietor')
  .option('--self-employed', 'Flag income as self-employment income (adds SE tax)', false)
  .option('--income-csv <file>', 'Path to income CSV file (overrides --income)')
  .option('--expenses-csv <file>', 'Path to expenses CSV file (overrides --deductions)')
  .option('-o, --output <file>', 'Write JSON results to this file instead of stdout')
  .action((opts) => {
    try {
      // --- Resolve income ---
      let grossIncome = coerceNumber(opts.income);
      let deductionItems = [];

      if (opts.incomeCsv) {
        const text = readFile(opts.incomeCsv);
        const rows = parseIncomeCSV(text);
        grossIncome = rows.reduce((sum, r) => sum + coerceNumber(r.amount || r.income || r.gross || 0), 0);
        console.log(`Loaded ${rows.length} income row(s) from CSV. Total: $${grossIncome.toFixed(2)}`);
      }

      // --- Resolve deductions ---
      let totalDeductions = coerceNumber(opts.deductions);

      if (opts.expensesCsv) {
        const text = readFile(opts.expensesCsv);
        const rows = parseExpensesCSV(text);
        deductionItems = categorizeDeductions(rows);
        totalDeductions = rows.reduce((sum, r) => sum + coerceNumber(r.amount || r.expense || r.cost || 0), 0);
        console.log(`Loaded ${rows.length} expense row(s) from CSV. Total: $${totalDeductions.toFixed(2)}`);
      }

      const filingStatus = opts.filingStatus;
      const state = opts.state.toUpperCase();
      const isSelfEmployed = opts.selfEmployed;

      // --- Federal tax ---
      const federalResult = calculateFederalTax({
        grossIncome,
        filingStatus,
        deductions: totalDeductions,
        isSelfEmployed,
      });

      // --- State tax ---
      const stateResult = calculateStateTax({
        grossIncome,
        filingStatus,
        state,
        deductions: totalDeductions,
      });

      // --- Quarterly estimates ---
      const quarterlyResult = calculateQuarterlyEstimatedTax({
        grossIncome,
        filingStatus,
        state,
        isSelfEmployed,
        deductions: totalDeductions,
      });

      // --- Total liability ---
      const totalResult = computeTotalTaxLiability({
        federalTax: federalResult.federalTax,
        stateTax: stateResult.stateTax,
        selfEmploymentTax: federalResult.selfEmploymentTax || 0,
        deductions: totalDeductions,
      });

      const output = {
        grossIncome,
        filingStatus,
        state,
        isSelfEmployed,
        deductions: totalDeductions,
        federal: federalResult,
        state: stateResult,
        quarterly: quarterlyResult,
        total: totalResult,
      };

      const json = JSON.stringify(output, null, 2);

      if (opts.output) {
        writeFile(opts.output, json);
      } else {
        console.log(json);
      }
    } catch (err) {
      console.error('Calculation error:', err.message);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// Command: report
// ---------------------------------------------------------------------------

program
  .command('report')
  .description('Generate a compliance report or audit document from calculation results.')
  .option('-r, --results <file>', 'Path to JSON results file produced by the calculate command')
  .option(
    '--type <type>',
    'Report type: compliance | audit | deductions | deadlines',
    'compliance'
  )
  .option('-s, --state <code>', 'Two-letter state code for deadline formatting', 'CA')
  .option('-o, --output <file>', 'Write report to this file instead of stdout')
  .action((opts) => {
    try {
      let results = {};

      if (opts.results) {
        const text = readFile(opts.results);
        results = JSON.parse(text);
      } else {
        console.warn('Warning: No --results file provided. Generating report with empty data.');
      }

      const state = (opts.state || 'CA').toUpperCase();
      let report;

      switch (opts.type) {
        case 'audit':
          report = generateAuditDocument(results);
          break;
        case 'deductions':
          report = formatDeductionSummary(results.deductionBreakdown || results.deductions || {});
          break;
        case 'deadlines':
          report = formatFilingDeadlines(state, results);
          break;
        case 'compliance':
        default:
          report = generateComplianceReport(results);
          break;
      }

      if (opts.output) {
        writeFile(opts.output, report);
      } else {
        console.log(report);
      }
    } catch (err) {
      console.error('Report generation error:', err.message);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// Command: checklist
// ---------------------------------------------------------------------------

program
  .command('checklist')
  .description('Generate a filing checklist tailored to income level, business type, and jurisdiction.')
  .option('-i, --income <number>', 'Gross income (USD)', '0')
  .option('-s, --state <code>', 'Two-letter state code', 'CA')
  .option(
    '-b, --business-type <type>',
    'Business type: sole_proprietor | llc_single | llc_multi | s_corp | c_corp | partnership',
    'sole_proprietor'
  )
  .option(
    '--format <format>',
    'Output format: markdown | text',
    'markdown'
  )
  .option('-o, --output <file>', 'Write checklist to this file instead of stdout')
  .action((opts) => {
    try {
      const income = coerceNumber(opts.income);
      const state = opts.state.toUpperCase();
      const businessType = opts.businessType;

      const checklist = generateFilingChecklist({
        income,
        state,
        businessType,
      });

      let formatted;
      if (opts.format === 'text') {
        formatted = formatChecklistAsPlainText(checklist);
      } else {
        formatted = formatChecklistAsMarkdown(checklist);
      }

      if (opts.output) {
        writeFile(opts.output, formatted);
      } else {
        console.log(formatted);
      }
    } catch (err) {
      console.error('Checklist generation error:', err.message);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// Command: export
// ---------------------------------------------------------------------------

program
  .command('export')
  .description('Export calculation results to CSV.')
  .option('-r, --results <file>', 'Path to JSON results file produced by the calculate command')
  .option('-o, --output <file>', 'Output CSV file path', 'results.csv')
  .action((opts) => {
    try {
      let results = {};

      if (opts.results) {
        const text = readFile(opts.results);
        results = JSON.parse(text);
      } else {
        console.warn('Warning: No --results file provided. Exporting empty data.');
      }

      const csv = exportResultsToCSV(results);
      writeFile(opts.output, csv);
    } catch (err) {
      console.error('Export error:', err.message);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// Command: config
// ---------------------------------------------------------------------------

program
  .command('config')
  .description('Inspect loaded tax configuration rules for a jurisdiction.')
  .option('-s, --state <code>', 'Two-letter state code', 'CA')
  .option(
    '-f, --filing-status <status>',
    'Filing status: single | married_filing_jointly | married_filing_separately | head_of_household',
    'single'
  )
  .option(
    '--show <section>',
    'Section to display: brackets | state-rates | deduction-limits | filing-thresholds | all',
    'all'
  )
  .action((opts) => {
    try {
      const state = opts.state.toUpperCase();
      const filingStatus = opts.filingStatus;
      const show = opts.show;

      const rules = loadJurisdictionRules(state);
      const output = {};

      if (show === 'brackets' || show === 'all') {
        output.federalBrackets = getFederalBrackets(filingStatus);
      }
      if (show === 'state-rates' || show === 'all') {
        output.stateTaxRates = getStateTaxRates(state);
      }
      if (show === 'deduction-limits' || show === 'all') {
        output.deductionLimits = getDeductionLimits(state);
      }
      if (show === 'filing-thresholds' || show === 'all') {
        output.filingThresholds = getFilingThresholds(state);
      }
      if (show === 'all') {
        output.jurisdictionRules = rules;
      }

      console.log(JSON.stringify(output, null, 2));
    } catch (err) {
      console.error('Config error:', err.message);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// Command: run (all-in-one workflow)
// ---------------------------------------------------------------------------

program
  .command('run')
  .description('Full workflow: calculate taxes, generate compliance report and filing checklist in one step.')
  .option('-i, --income <number>', 'Gross income (USD)', '0')
  .option('-s, --state <code>', 'Two-letter state code', 'CA')
  .option(
    '-f, --filing-status <status>',
    'Filing status: single | married_filing_jointly | married_filing_separately | head_of_household',
    'single'
  )
  .option('-d, --deductions <number>', 'Total itemized deductions (USD); 0 uses standard deduction', '0')
  .option(
    '-b, --business-type <type>',
    'Business type: sole_proprietor | llc_single | llc_multi | s_corp | c_corp | partnership',
    'sole_proprietor'
  )
  .option('--self-employed', 'Flag income as self-employment income', false)
  .option('--income-csv <file>', 'Path to income CSV file (overrides --income)')
  .option('--expenses-csv <file>', 'Path to expenses CSV file (overrides --deductions)')
  .option('--checklist-format <format>', 'Checklist format: markdown | text', 'markdown')
  .option('-o, --output-dir <dir>', 'Directory to write all output files', '.')
  .action((opts) => {
    try {
      const state = opts.state.toUpperCase();
      const filingStatus = opts.filingStatus;
      const businessType = opts.businessType;
      const isSelfEmployed = opts.selfEmployed;
      const outputDir = opts.outputDir;

      // --- Resolve income ---
      let grossIncome = coerceNumber(opts.income);

      if (opts.incomeCsv) {
        const text = readFile(opts.incomeCsv);
        const rows = parseIncomeCSV(text);
        grossIncome = rows.reduce((sum, r) => sum + coerceNumber(r.amount || r.income || r.gross || 0), 0);
        console.log(`Loaded ${rows.length} income row(s). Total: $${grossIncome.toFixed(2)}`);
      }

      // --- Resolve deductions ---
      let totalDeductions = coerceNumber(opts.deductions);
      let deductionItems = [];

      if (opts.expensesCsv) {
        const text = readFile(opts.expensesCsv);
        const rows = parseExpensesCSV(text);
        deductionItems = categorizeDeductions(rows);
        totalDeductions = rows.reduce((sum, r) => sum + coerceNumber(r.amount || r.expense || r.cost || 0), 0);
        console.log(`Loaded ${rows.length} expense row(s). Total: $${totalDeductions.toFixed(2)}`);
      }

      // --- Calculate ---
      const federalResult = calculateFederalTax({
        grossIncome,
        filingStatus,
        deductions: totalDeductions,
        isSelfEmployed,
      });

      const stateResult = calculateStateTax({
        grossIncome,
        filingStatus,
        state,
        deductions: totalDeductions,
      });

      const quarterlyResult = calculateQuarterlyEstimatedTax({
        grossIncome,
        filingStatus,
        state,
        isSelfEmployed,
        deductions: totalDeductions,
      });

      const totalResult = computeTotalTaxLiability({
        federalTax: federalResult.federalTax,
        stateTax: stateResult.stateTax,
        selfEmploymentTax: federalResult.selfEmploymentTax || 0,
        deductions: totalDeductions,
      });

      const results = {
        grossIncome,
        filingStatus,
        state,
        isSelfEmployed,
        deductions: totalDeductions,
        deductionBreakdown: deductionItems,
        federal: federalResult,
        state: stateResult,
        quarterly: quarterlyResult,
        total: totalResult,
      };

      // --- Write results JSON ---
      const resultsPath = path.join(outputDir, 'results.json');
      writeFile(resultsPath, JSON.stringify(results, null, 2));

      // --- Generate compliance report ---
      const report = generateComplianceReport(results);
      writeFile(path.join(outputDir, 'compliance-report.txt'), report);

      // --- Generate audit document ---
      const audit = generateAuditDocument(results);
      writeFile(path.join(outputDir, 'audit-document.txt'), audit);

      // --- Generate checklist ---
      const checklist = generateFilingChecklist({ income: grossIncome, state, businessType });
      const checklistFormatted =
        opts.checklistFormat === 'text'
          ? formatChecklistAsPlainText(checklist)
          : formatChecklistAsMarkdown(checklist);
      const checklistExt = opts.checklistFormat === 'text' ? 'txt' : 'md';
      writeFile(path.join(outputDir, `filing-checklist.${checklistExt}`), checklistFormatted);

      // --- Export CSV ---
      const csv = exportResultsToCSV(results);
      writeFile(path.join(outputDir, 'results.csv'), csv);

      console.log('\nAll done! Files written to:', path.resolve(outputDir));
    } catch (err) {
      console.error('Run error:', err.message);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------

if (require.main === module) {
  program.parse(process.argv);
  if (process.argv.length <= 2) {
    program.help();
  }
}