'use strict';

/**
 * lib/license-check.js
 * Validates PRO_LICENSE environment variable; returns feature availability object;
 * shows upgrade prompt for locked features.
 *
 * Tax Compliance Calculator
 */

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * The set of valid license key prefixes / patterns.
 * A valid PRO_LICENSE must:
 *   - Be a non-empty string
 *   - Be at least 16 characters long
 *   - Match the pattern: TCC-PRO-<alphanumeric segments>
 *     OR be any string of 32+ alphanumeric/dash characters (legacy keys)
 */
const VALID_LICENSE_REGEX = /^(TCC-PRO-[A-Z0-9]{4,}-[A-Z0-9]{4,}-[A-Z0-9]{4,}|[A-Za-z0-9\-]{32,})$/;

/**
 * Feature definitions.
 * Each entry maps a feature key to metadata used for gating and prompts.
 */
const FEATURE_DEFINITIONS = {
  // Free features
  federalTaxCalculation: {
    label: 'Federal Tax Calculation',
    premium: false,
  },
  stateTaxCalculation: {
    label: 'State Tax Calculation',
    premium: false,
  },
  quarterlyEstimatedTax: {
    label: 'Quarterly Estimated Tax',
    premium: false,
  },
  deductionCategorization: {
    label: 'Deduction Categorization',
    premium: false,
  },
  complianceReport: {
    label: 'Compliance Report',
    premium: false,
  },
  filingChecklist: {
    label: 'Filing Checklist',
    premium: false,
  },
  csvImportExport: {
    label: 'CSV Import / Export',
    premium: false,
  },

  // Premium features
  multiJurisdictionRules: {
    label: 'Multi-Jurisdiction Tax Rules (EU, UK, Canada)',
    premium: true,
    module: 'lib/premium/advanced-config.js',
  },
  htmlDashboard: {
    label: 'Interactive HTML Dashboard',
    premium: true,
    module: 'lib/premium/dashboard.js',
  },
  quarterlyBreakdownChart: {
    label: 'Quarterly Breakdown Chart',
    premium: true,
    module: 'lib/premium/dashboard.js',
  },
  deductionPieChart: {
    label: 'Deduction Pie Chart',
    premium: true,
    module: 'lib/premium/dashboard.js',
  },
  quickBooksSync: {
    label: 'QuickBooks Sync',
    premium: true,
    module: 'lib/premium/api-integration.js',
  },
  freshBooksSync: {
    label: 'FreshBooks Sync',
    premium: true,
    module: 'lib/premium/api-integration.js',
  },
  slackReminders: {
    label: 'Slack Filing Reminders',
    premium: true,
    module: 'lib/premium/api-integration.js',
  },
  emailReminders: {
    label: 'Email Filing Reminders',
    premium: true,
    module: 'lib/premium/api-integration.js',
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read and return the raw PRO_LICENSE value from the environment.
 * Returns an empty string if not set.
 */
function getRawLicense() {
  return (process.env.PRO_LICENSE || '').trim();
}

/**
 * Test whether a raw license string passes validation rules.
 * @param {string} raw
 * @returns {boolean}
 */
function isLicenseValid(raw) {
  if (!raw || typeof raw !== 'string') return false;
  if (raw.length < 16) return false;
  return VALID_LICENSE_REGEX.test(raw);
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * validateLicense()
 *
 * Reads the PRO_LICENSE environment variable and validates it.
 * Returns a result object describing the license state.
 *
 * @returns {{
 *   valid: boolean,
 *   licenseKey: string|null,
 *   tier: 'pro'|'free',
 *   message: string
 * }}
 */
function validateLicense() {
  try {
    const raw = getRawLicense();

    if (!raw) {
      return {
        valid: false,
        licenseKey: null,
        tier: 'free',
        message: 'No PRO_LICENSE environment variable found. Running in free tier.',
      };
    }

    if (isLicenseValid(raw)) {
      // Mask the key for safe display: show first 8 chars then asterisks
      const masked =
        raw.length > 8
          ? raw.substring(0, 8) + '*'.repeat(Math.min(raw.length - 8, 16))
          : raw;

      return {
        valid: true,
        licenseKey: masked,
        tier: 'pro',
        message: 'PRO_LICENSE validated successfully. All premium features unlocked.',
      };
    }

    return {
      valid: false,
      licenseKey: null,
      tier: 'free',
      message:
        'PRO_LICENSE is set but did not pass validation. Running in free tier. ' +
        'Please check your license key or contact support@heijnesdigital.com.',
    };
  } catch (err) {
    return {
      valid: false,
      licenseKey: null,
      tier: 'free',
      message: 'License validation encountered an error. Running in free tier.',
    };
  }
}

/**
 * getFeatureAvailability()
 *
 * Returns a feature availability map for all known features.
 * Premium features are only available when PRO_LICENSE is valid.
 *
 * @returns {Object.<string, { available: boolean, premium: boolean, label: string }>}
 */
function getFeatureAvailability() {
  try {
    const license = validateLicense();
    const isPro = license.valid;

    const availability = {};

    for (const key of Object.keys(FEATURE_DEFINITIONS)) {
      const def = FEATURE_DEFINITIONS[key];
      availability[key] = {
        available: def.premium ? isPro : true,
        premium: def.premium,
        label: def.label,
      };
    }

    return availability;
  } catch (err) {
    // Return all features as unavailable on error (safe default)
    const availability = {};
    for (const key of Object.keys(FEATURE_DEFINITIONS)) {
      const def = FEATURE_DEFINITIONS[key] || {};
      availability[key] = {
        available: false,
        premium: def.premium || false,
        label: def.label || key,
      };
    }
    return availability;
  }
}

/**
 * showUpgradePrompt()
 *
 * Prints a formatted upgrade prompt to stdout when a locked (premium) feature
 * is requested without a valid license.
 *
 * @param {string} [featureKey] - The feature key that was requested (optional).
 * @returns {void}
 */
function showUpgradePrompt(featureKey) {
  try {
    const license = validateLicense();

    // If license is already valid, no prompt needed — just return silently.
    if (license.valid) return;

    const featureDef =
      featureKey && FEATURE_DEFINITIONS[featureKey]
        ? FEATURE_DEFINITIONS[featureKey]
        : null;

    const border = '═'.repeat(60);
    const thin   = '─'.repeat(60);

    const lines = [
      '',
      `╔${border}╗`,
      `║${'  🔒  TAX COMPLIANCE CALCULATOR — UPGRADE TO PRO'.padEnd(60)}║`,
      `╠${border}╣`,
    ];

    if (featureDef) {
      lines.push(
        `║${''.padEnd(60)}║`,
        `║  The feature you requested requires a PRO license:`.padEnd(61) + '║',
        `║${''.padEnd(60)}║`,
        `║    ➤  ${featureDef.label}`.padEnd(61) + '║',
        `║${''.padEnd(60)}║`,
      );
    } else {
      lines.push(
        `║${''.padEnd(60)}║`,
        `║  This feature requires a PRO license.`.padEnd(61) + '║',
        `║${''.padEnd(60)}║`,
      );
    }

    lines.push(
      `║  Unlock all premium features:`.padEnd(61) + '║',
      `║${''.padEnd(60)}║`,
      `║    ✔  Multi-Jurisdiction Rules (EU, UK, Canada)`.padEnd(61) + '║',
      `║    ✔  Interactive HTML Dashboard & Charts`.padEnd(61) + '║',
      `║    ✔  QuickBooks & FreshBooks Sync`.padEnd(61) + '║',
      `║    ✔  Slack & Email Filing Reminders`.padEnd(61) + '║',
      `║${''.padEnd(60)}║`,
      `╠${border}╣`,
      `║${''.padEnd(60)}║`,
      `║  To activate PRO, set your license key:`.padEnd(61) + '║',
      `║${''.padEnd(60)}║`,
      `║    export PRO_LICENSE="your-license-key-here"`.padEnd(61) + '║',
      `║${''.padEnd(60)}║`,
      `║  Purchase or retrieve your license key at:`.padEnd(61) + '║',
      `║    https://heijnesdigital.com/tax-compliance-calculator`.padEnd(61) + '║',
      `║${''.padEnd(60)}║`,
      `║  Support: support@heijnesdigital.com`.padEnd(61) + '║',
      `║${''.padEnd(60)}║`,
      `╚${border}╝`,
      '',
    );

    process.stdout.write(lines.join('\n') + '\n');
  } catch (err) {
    // Fallback plain-text prompt if formatting fails
    process.stdout.write(
      '\n[Tax Compliance Calculator] This feature requires a PRO license.\n' +
      'Visit https://heijnesdigital.com/tax-compliance-calculator to upgrade.\n\n'
    );
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  validateLicense,
  getFeatureAvailability,
  showUpgradePrompt,
};