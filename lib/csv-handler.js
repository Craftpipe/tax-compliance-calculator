'use strict';

/**
 * lib/csv-handler.js
 * Handles CSV import and export for income, expenses, and results.
 * Uses csv-parse and csv-stringify for robust parsing.
 */

const { parse }     = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validate a single CSV row against expected columns.
 * @param {object} row
 * @param {string[]} requiredColumns
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateCSVRow(row, requiredColumns) {
  requiredColumns = requiredColumns || [];
  const errors = [];
  for (const col of requiredColumns) {
    if (row[col] === undefined || row[col] === null || row[col] === '') {
      errors.push(`Missing required column: ${col}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Parse an income CSV file.
 *
 * Accepts either:
 *   parseIncomeCSV(csvContent, options)
 *   parseIncomeCSV(csvContent)   — options defaults to {}
 *
 * Expected columns: date, description, amount, category
 *
 * @param {string} csvContent   Raw CSV string.
 * @param {object} [options]    Optional parse options.
 * @returns {{ rows: object[], total: number, errors: string[] }}
 */
function parseIncomeCSV(csvContent, options) {
  options = options || {};

  if (!csvContent || typeof csvContent !== 'string') {
    return { rows: [], total: 0, errors: ['No CSV content provided.'] };
  }

  const requiredColumns = options.requiredColumns || ['date', 'description', 'amount'];
  const errors = [];
  let rows;

  try {
    rows = parse(csvContent, {
      columns:          true,
      skip_empty_lines: true,
      trim:             true,
    });
  } catch (err) {
    return { rows: [], total: 0, errors: [`CSV parse error: ${err.message}`] };
  }

  let total = 0;
  const validated = [];

  rows.forEach((row, idx) => {
    const { valid, errors: rowErrors } = validateCSVRow(row, requiredColumns);
    if (!valid) {
      rowErrors.forEach(e => errors.push(`Row ${idx + 2}: ${e}`));
      return;
    }
    const amount = parseFloat(row.amount) || 0;
    total += amount;
    validated.push({ ...row, amount });
  });

  return { rows: validated, total: parseFloat(total.toFixed(2)), errors };
}

/**
 * Parse an expenses CSV file.
 *
 * Accepts either:
 *   parseExpensesCSV(csvContent, options)
 *   parseExpensesCSV(csvContent)   — options defaults to {}
 *
 * Expected columns: date, description, amount, category
 *
 * @param {string} csvContent
 * @param {object} [options]
 * @returns {{ rows: object[], total: number, errors: string[] }}
 */
function parseExpensesCSV(csvContent, options) {
  options = options || {};

  if (!csvContent || typeof csvContent !== 'string') {
    return { rows: [], total: 0, errors: ['No CSV content provided.'] };
  }

  const requiredColumns = options.requiredColumns || ['date', 'description', 'amount', 'category'];
  const errors = [];
  let rows;

  try {
    rows = parse(csvContent, {
      columns:          true,
      skip_empty_lines: true,
      trim:             true,
    });
  } catch (err) {
    return { rows: [], total: 0, errors: [`CSV parse error: ${err.message}`] };
  }

  let total = 0;
  const validated = [];

  rows.forEach((row, idx) => {
    const { valid, errors: rowErrors } = validateCSVRow(row, requiredColumns);
    if (!valid) {
      rowErrors.forEach(e => errors.push(`Row ${idx + 2}: ${e}`));
      return;
    }
    const amount = parseFloat(row.amount) || 0;
    total += amount;
    validated.push({ ...row, amount });
  });

  return { rows: validated, total: parseFloat(total.toFixed(2)), errors };
}

/**
 * Export calculation results to CSV format.
 *
 * Accepts either:
 *   exportResultsToCSV(results, options)
 *   exportResultsToCSV(results)   — options defaults to {}
 *
 * @param {object|object[]} results   Single result object or array of results.
 * @param {object}          [options] Optional stringify options.
 * @returns {string} CSV string
 */
function exportResultsToCSV(results, options) {
  options = options || {};

  if (!results) {
    return '';
  }

  const rows = Array.isArray(results) ? results : [results];

  // Flatten nested objects one level deep for CSV compatibility
  const flatRows = rows.map(row => {
    const flat = {};
    for (const [key, val] of Object.entries(row)) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        for (const [subKey, subVal] of Object.entries(val)) {
          if (typeof subVal !== 'object') {
            flat[`${key}_${subKey}`] = subVal;
          }
        }
      } else if (!Array.isArray(val)) {
        flat[key] = val;
      }
    }
    return flat;
  });

  try {
    return stringify(flatRows, {
      header:  true,
      cast: {
        boolean: (v) => (v ? 'true' : 'false'),
      },
      ...options,
    });
  } catch (err) {
    return `CSV export error: ${err.message}`;
  }
}

module.exports = {
  parseIncomeCSV,
  parseExpensesCSV,
  exportResultsToCSV,
  validateCSVRow,
};
