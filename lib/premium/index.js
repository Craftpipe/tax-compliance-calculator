const { checkPro, requirePro } = require('./lib/premium/gate');
const advancedConfig = require('./lib/premium/advanced-config');
const dashboard = require('./lib/premium/dashboard');
const apiIntegration = require('./lib/premium/api-integration');

const premiumFeatures = {
  'advanced-config': advancedConfig,
  'dashboard': dashboard,
  'api-integration': apiIntegration,
};

function addPremiumCommands(program) {
  program
    .command('advanced-config')
    .description('[PRO] Manage advanced configuration options')
    .option('--get <key>', 'Retrieve a configuration value by key')
    .option('--set <key=value>', 'Set a configuration value')
    .option('--reset', 'Reset all advanced configuration to defaults')
    .option('--list', 'List all advanced configuration entries')
    .action((options) => {
      runPremium('advanced-config', { options });
    });

  program
    .command('dashboard')
    .description('[PRO] Launch the interactive metrics dashboard')
    .option('--watch', 'Keep the dashboard running and refresh automatically')
    .option('--interval <ms>', 'Refresh interval in milliseconds', '3000')
    .option('--export <file>', 'Export dashboard snapshot to a file')
    .action((options) => {
      runPremium('dashboard', { options });
    });

  program
    .command('api-integration')
    .description('[PRO] Configure and manage external API integrations')
    .option('--connect <service>', 'Connect to a named external service')
    .option('--disconnect <service>', 'Disconnect from a named external service')
    .option('--list', 'List all configured API integrations')
    .option('--test <service>', 'Test connectivity for a named service')
    .option('--token <token>', 'Provide an API token for authentication')
    .action((options) => {
      runPremium('api-integration', { options });
    });
}

function runPremium(feature, data) {
  requirePro();

  const mod = premiumFeatures[feature];

  if (!mod) {
    throw new Error(
      `Unknown premium feature: "${feature}". ` +
      `Available features are: ${Object.keys(premiumFeatures).join(', ')}.`
    );
  }

  if (typeof mod.run !== 'function') {
    throw new Error(
      `Premium feature "${feature}" does not export a run() function.`
    );
  }

  return mod.run(data);
}

module.exports = {
  addPremiumCommands,
  runPremium,
  checkPro,
};