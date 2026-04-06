'use strict';

/**
 * lib/premium/advanced-config.js
 * Premium feature: Advanced Configuration for Tax Compliance Calculator.
 *
 * Provides multi-profile tax configuration management, custom jurisdiction
 * rule overrides, scenario comparison, config validation, and import/export
 * of named tax profiles — all on top of the free lib/config.js foundation.
 */

const fs = require('fs');
const path = require('path');
const { requirePro } = require('./gate');

const {
  loadJurisdictionRules,
  getFederalBrackets,
  getStateTaxRates,
  getDeductionLimits,
  getFilingThresholds,
} = require('../config');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const VALID_FILING_STATUSES = [
  'single',
  'married_filing_jointly',
  'married_filing_separately',
  'head_of_household',
];

const VALID_BUSINESS_TYPES = [
  'sole_proprietor',
  'llc_single',
  'llc_multi',
  's_corp',
  'c_corp',
  'partnership',
];

/**
 * Deep-clone a plain object safely.
 * @param {*} obj
 * @returns {*}
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (_) {
    return obj;
  }
}

/**
 * Resolve an absolute path from a user-supplied string.
 * @param {string} filePath
 * @returns {string}
 */
function resolvePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new TypeError('filePath must be a non-empty string');
  }
  return path.resolve(filePath);
}

/**
 * Safely read and parse a JSON file.
 * @param {string} filePath
 * @returns {object}
 */
function readJsonFile(filePath) {
  const resolved = resolvePath(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in file ${resolved}: ${e.message}`);
  }
}

/**
 * Safely write a JSON file, creating parent directories as needed.
 * @param {string} filePath
 * @param {object} data
 */
function writeJsonFile(filePath, data) {
  const resolved = resolvePath(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Profile schema validation
// ---------------------------------------------------------------------------

/**
 * Validate a tax profile object and return a list of validation errors.
 * An empty array means the profile is valid.
 *
 * @param {object} profile
 * @returns {string[]} Array of human-readable error messages.
 */
function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return ['Profile must be a non-null object.'];
  }

  const errors = [];

  // name
  if (!profile.name || typeof profile.name !== 'string' || !profile.name.trim()) {
    errors.push('profile.name is required and must be a non-empty string.');
  }

  // income
  if (profile.income !== undefined) {
    const inc = parseFloat(profile.income);
    if (isNaN(inc) || inc < 0) {
      errors.push('profile.income must be a non-negative number.');
    }
  }

  // state
  if (profile.state !== undefined) {
    if (typeof profile.state !== 'string' || !/^[A-Z]{2}$/.test(profile.state)) {
      errors.push('profile.state must be a two-letter uppercase state code (e.g. "CA").');
    }
  }

  // filingStatus
  if (profile.filingStatus !== undefined) {
    if (!VALID_FILING_STATUSES.includes(profile.filingStatus)) {
      errors.push(
        `profile.filingStatus must be one of: ${VALID_FILING_STATUSES.join(', ')}.`
      );
    }
  }

  // businessType
  if (profile.businessType !== undefined) {
    if (!VALID_BUSINESS_TYPES.includes(profile.businessType)) {
      errors.push(
        `profile.businessType must be one of: ${VALID_BUSINESS_TYPES.join(', ')}.`
      );
    }
  }

  // deductions
  if (profile.deductions !== undefined) {
    const ded = parseFloat(profile.deductions);
    if (isNaN(ded) || ded < 0) {
      errors.push('profile.deductions must be a non-negative number.');
    }
  }

  // selfEmployed
  if (profile.selfEmployed !== undefined && typeof profile.selfEmployed !== 'boolean') {
    errors.push('profile.selfEmployed must be a boolean.');
  }

  // jurisdictionOverrides
  if (profile.jurisdictionOverrides !== undefined) {
    if (
      typeof profile.jurisdictionOverrides !== 'object' ||
      Array.isArray(profile.jurisdictionOverrides) ||
      profile.jurisdictionOverrides === null
    ) {
      errors.push('profile.jurisdictionOverrides must be a plain object.');
    }
  }

  // customDeductionLimits
  if (profile.customDeductionLimits !== undefined) {
    if (
      typeof profile.customDeductionLimits !== 'object' ||
      Array.isArray(profile.customDeductionLimits) ||
      profile.customDeductionLimits === null
    ) {
      errors.push('profile.customDeductionLimits must be a plain object.');
    } else {
      for (const [key, val] of Object.entries(profile.customDeductionLimits)) {
        if (typeof val !== 'number' || val < 0) {
          errors.push(
            `profile.customDeductionLimits["${key}"] must be a non-negative number.`
          );
        }
      }
    }
  }

  // tags
  if (profile.tags !== undefined) {
    if (!Array.isArray(profile.tags)) {
      errors.push('profile.tags must be an array of strings.');
    } else {
      profile.tags.forEach((tag, i) => {
        if (typeof tag !== 'string') {
          errors.push(`profile.tags[${i}] must be a string.`);
        }
      });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// In-memory profile store (keyed by profile name)
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} */
const profileStore = new Map();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create or replace a named tax profile in the in-memory store.
 * Validates the profile before saving.
 *
 * @param {object} profile - Tax profile object. Must include a `name` field.
 * @returns {{ success: boolean, errors: string[], profile: object|null }}
 */
function saveProfile(profile) {
  requirePro('advanced-config:saveProfile');

  const errors = validateProfile(profile);
  if (errors.length > 0) {
    return { success: false, errors, profile: null };
  }

  const stored = deepClone(profile);
  stored.name = stored.name.trim();
  stored.updatedAt = new Date().toISOString();
  if (!stored.createdAt) {
    stored.createdAt = stored.updatedAt;
  }

  profileStore.set(stored.name, stored);
  return { success: true, errors: [], profile: stored };
}

/**
 * Retrieve a named tax profile from the in-memory store.
 *
 * @param {string} name - Profile name.
 * @returns {object|null} The profile, or null if not found.
 */
function getProfile(name) {
  requirePro('advanced-config:getProfile');

  if (!name || typeof name !== 'string') return null;
  const profile = profileStore.get(name.trim());
  return profile ? deepClone(profile) : null;
}

/**
 * List all stored profile names.
 *
 * @returns {string[]}
 */
function listProfiles() {
  requirePro('advanced-config:listProfiles');
  return Array.from(profileStore.keys());
}

/**
 * Delete a named profile from the in-memory store.
 *
 * @param {string} name
 * @returns {boolean} True if the profile existed and was deleted.
 */
function deleteProfile(name) {
  requirePro('advanced-config:deleteProfile');

  if (!name || typeof name !== 'string') return false;
  return profileStore.delete(name.trim());
}

/**
 * Build a resolved configuration object by merging a named profile with
 * live jurisdiction rules from the free lib/config.js module.
 *
 * The profile's `jurisdictionOverrides` and `customDeductionLimits` are
 * applied on top of the base rules, giving users full control without
 * touching the shared rule database.
 *
 * @param {string} name - Profile name.
 * @returns {object} Merged configuration ready for use by calculators.
 */
function resolveProfileConfig(name) {
  requirePro('advanced-config:resolveProfileConfig');

  const profile = getProfile(name);
  if (!profile) {
    throw new Error(`Profile not found: "${name}"`);
  }

  const state = profile.state || 'CA';
  const filingStatus = profile.filingStatus || 'single';

  // Load base rules from the free config module
  let jurisdictionRules = {};
  let federalBrackets = {};
  let stateTaxRates = {};
  let deductionLimits = {};
  let filingThresholds = {};

  try { jurisdictionRules = loadJurisdictionRules(state) || {}; } catch (_) {}
  try { federalBrackets = getFederalBrackets(filingStatus) || {}; } catch (_) {}
  try { stateTaxRates = getStateTaxRates(state) || {}; } catch (_) {}
  try { deductionLimits = getDeductionLimits(state, filingStatus) || {}; } catch (_) {}
  try { filingThresholds = getFilingThresholds(state, filingStatus) || {}; } catch (_) {}

  // Apply jurisdiction overrides from the profile
  const mergedJurisdictionRules = Object.assign(
    {},
    jurisdictionRules,
    profile.jurisdictionOverrides || {}
  );

  // Apply custom deduction limits from the profile
  const mergedDeductionLimits = Object.assign(
    {},
    deductionLimits,
    profile.customDeductionLimits || {}
  );

  return {
    profileName: profile.name,
    income: parseFloat(profile.income) || 0,
    state,
    filingStatus,
    businessType: profile.businessType || 'sole_proprietor',
    deductions: parseFloat(profile.deductions) || 0,
    selfEmployed: profile.selfEmployed === true,
    tags: Array.isArray(profile.tags) ? profile.tags : [],
    jurisdictionRules: mergedJurisdictionRules,
    federalBrackets,
    stateTaxRates,
    deductionLimits: mergedDeductionLimits,
    filingThresholds,
    resolvedAt: new Date().toISOString(),
  };
}

/**
 * Compare two named profiles side-by-side, resolving each to its full
 * configuration and highlighting differences in key fields.
 *
 * @param {string} nameA - First profile name.
 * @param {string} nameB - Second profile name.
 * @returns {object} Comparison result with resolved configs and diff summary.
 */
function compareProfiles(nameA, nameB) {
  requirePro('advanced-config:compareProfiles');

  if (!nameA || !nameB) {
    throw new TypeError('Both profile names must be provided for comparison.');
  }

  const configA = resolveProfileConfig(nameA);
  const configB = resolveProfileConfig(nameB);

  const COMPARABLE_FIELDS = [
    'income',
    'state',
    'filingStatus',
    'businessType',
    'deductions',
    'selfEmployed',
  ];

  const differences = {};
  for (const field of COMPARABLE_FIELDS) {
    const valA = configA[field];
    const valB = configB[field];
    if (valA !== valB) {
      differences[field] = { [nameA]: valA, [nameB]: valB };
    }
  }

  return {
    profileA: configA,
    profileB: configB,
    differences,
    identical: Object.keys(differences).length === 0,
    comparedAt: new Date().toISOString(),
  };
}

/**
 * Export all in-memory profiles to a JSON file.
 *
 * @param {string} filePath - Destination file path.
 * @returns {{ success: boolean, count: number, filePath: string }}
 */
function exportProfiles(filePath) {
  requirePro('advanced-config:exportProfiles');

  if (!filePath || typeof filePath !== 'string') {
    throw new TypeError('filePath must be a non-empty string.');
  }

  const profiles = Array.from(profileStore.values()).map(deepClone);
  const payload = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    profiles,
  };

  writeJsonFile(filePath, payload);

  return {
    success: true,
    count: profiles.length,
    filePath: resolvePath(filePath),
  };
}

/**
 * Import profiles from a JSON file into the in-memory store.
 * Invalid profiles are skipped and reported in the result.
 *
 * @param {string} filePath - Source file path.
 * @param {{ overwrite?: boolean }} [options]
 * @returns {{ imported: number, skipped: number, errors: object[] }}
 */
function importProfiles(filePath, options) {
  requirePro('advanced-config:importProfiles');

  const opts = Object.assign({ overwrite: false }, options || {});
  const data = readJsonFile(filePath);

  if (!data || !Array.isArray(data.profiles)) {
    throw new Error(
      'Invalid export file format: expected an object with a "profiles" array.'
    );
  }

  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (const profile of data.profiles) {
    if (!profile || typeof profile !== 'object') {
      skipped++;
      errors.push({ profile, reason: 'Not a valid object.' });
      continue;
    }

    const name = typeof profile.name === 'string' ? profile.name.trim() : '';

    if (!opts.overwrite && profileStore.has(name)) {
      skipped++;
      errors.push({ profile: name, reason: `Profile "${name}" already exists. Use overwrite:true to replace.` });
      continue;
    }

    const validationErrors = validateProfile(profile);
    if (validationErrors.length > 0) {
      skipped++;
      errors.push({ profile: name || profile, reason: validationErrors.join(' ') });
      continue;
    }

    const stored = deepClone(profile);
    stored.name = name;
    stored.importedAt = new Date().toISOString();
    profileStore.set(name, stored);
    imported++;
  }

  return { imported, skipped, errors };
}

/**
 * Apply a partial update (patch) to an existing profile.
 * Only the provided fields are updated; others are preserved.
 *
 * @param {string} name - Profile name to patch.
 * @param {object} patch - Partial profile fields to apply.
 * @returns {{ success: boolean, errors: string[], profile: object|null }}
 */
function patchProfile(name, patch) {
  requirePro('advanced-config:patchProfile');

  if (!name || typeof name !== 'string') {
    return { success: false, errors: ['name must be a non-empty string.'], profile: null };
  }

  const existing = profileStore.get(name.trim());
  if (!existing) {
    return { success: false, errors: [`Profile "${name}" not found.`], profile: null };
  }

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { success: false, errors: ['patch must be a plain object.'], profile: null };
  }

  // Merge patch into existing (shallow for top-level, deep for nested objects)
  const merged = deepClone(existing);
  for (const [key, val] of Object.entries(patch)) {
    if (key === 'name') continue; // name is immutable via patch
    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof merged[key] === 'object' &&
      merged[key] !== null &&
      !Array.isArray(merged[key])
    ) {
      merged[key] = Object.assign({}, merged[key], val);
    } else {
      merged[key] = val;
    }
  }

  const errors = validateProfile(merged);
  if (errors.length > 0) {
    return { success: false, errors, profile: null };
  }

  merged.updatedAt = new Date().toISOString();
  profileStore.set(merged.name.trim(), merged);

  return { success: true, errors: [], profile: deepClone(merged) };
}

/**
 * Generate a human-readable summary of a profile's configuration,
 * including resolved jurisdiction rules.
 *
 * @param {string} name - Profile name.
 * @returns {string} Multi-line text summary.
 */
function summarizeProfile(name) {
  requirePro('advanced-config:summarizeProfile');

  const config = resolveProfileConfig(name);

  const lines = [
    '═══════════════════════════════════════════════════',
    `  Tax Profile Summary: ${config.profileName}`,
    '═══════════════════════════════════════════════════',
    `  Income          : $${config.income.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `  State           : ${config.state}`,
    `  Filing Status   : ${config.filingStatus}`,
    `  Business Type   : ${config.businessType}`,
    `  Deductions      : $${config.deductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `  Self-Employed   : ${config.selfEmployed ? 'Yes' : 'No'}`,
    `  Tags            : ${config.tags.length > 0 ? config.tags.join(', ') : '(none)'}`,
    '',
    '  ── Jurisdiction Overrides ──────────────────────',
  ];

  const overrideKeys = Object.keys(config.jurisdictionRules);
  if (overrideKeys.length === 0) {
    lines.push('  (none — using default rules)');
  } else {
    overrideKeys.forEach((k) => {
      lines.push(`  ${k}: ${JSON.stringify(config.jurisdictionRules[k])}`);
    });
  }

  lines.push('');
  lines.push('  ── Custom Deduction Limits ─────────────────────');

  const dedKeys = Object.keys(config.deductionLimits);
  if (dedKeys.length === 0) {
    lines.push('  (none — using default limits)');
  } else {
    dedKeys.forEach((k) => {
      lines.push(`  ${k}: $${Number(config.deductionLimits[k]).toLocaleString('en-US')}`);
    });
  }

  lines.push('═══════════════════════════════════════════════════');
  lines.push(`  Resolved at: ${config.resolvedAt}`);
  lines.push('═══════════════════════════════════════════════════');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * advancedConfig — premium advanced configuration manager.
 *
 * Dispatches to sub-operations based on `action`:
 *   - save          : saveProfile(profile)
 *   - get           : getProfile(name)
 *   - list          : listProfiles()
 *   - delete        : deleteProfile(name)
 *   - resolve       : resolveProfileConfig(name)
 *   - compare       : compareProfiles(nameA, nameB)
 *   - export        : exportProfiles(filePath)
 *   - import        : importProfiles(filePath, options)
 *   - patch         : patchProfile(name, patch)
 *   - summarize     : summarizeProfile(name)
 *   - validate      : validateProfile(profile)  [no gate — utility]
 *
 * @param {string} action
 * @param {object} [params]
 * @returns {*}
 */
function advancedConfig(action, params) {
  if (!action || typeof action !== 'string') {
    throw new TypeError('advancedConfig: action must be a non-empty string.');
  }

  const p = params || {};

  switch (action.trim().toLowerCase()) {
    case 'save':
      return saveProfile(p.profile);

    case 'get':
      return getProfile(p.name);

    case 'list':
      return listProfiles();

    case 'delete':
      return deleteProfile(p.name);

    case 'resolve':
      return resolveProfileConfig(p.name);

    case 'compare':
      return compareProfiles(p.nameA, p.nameB);

    case 'export':
      return exportProfiles(p.filePath);

    case 'import':
      return importProfiles(p.filePath, p.options);

    case 'patch':
      return patchProfile(p.name, p.patch);

    case 'summarize':
      return summarizeProfile(p.name);

    case 'validate':
      // Validation is a utility — no gate required.
      return validateProfile(p.profile);

    default:
      throw new Error(
        `advancedConfig: unknown action "${action}". ` +
        'Valid actions: save, get, list, delete, resolve, compare, export, import, patch, summarize, validate.'
      );
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = advancedConfig;

// Named exports for direct use in tests and other premium modules.
module.exports.saveProfile = saveProfile;
module.exports.getProfile = getProfile;
module.exports.listProfiles = listProfiles;
module.exports.deleteProfile = deleteProfile;
module.exports.resolveProfileConfig = resolveProfileConfig;
module.exports.compareProfiles = compareProfiles;
module.exports.exportProfiles = exportProfiles;
module.exports.importProfiles = importProfiles;
module.exports.patchProfile = patchProfile;
module.exports.summarizeProfile = summarizeProfile;
module.exports.validateProfile = validateProfile;