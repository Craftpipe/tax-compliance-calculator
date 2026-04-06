'use strict';
const PRO = process.env.PRO_LICENSE;
function checkPro() { return !!PRO && PRO.length >= 8; }
function requirePro(feature) {
  if (!checkPro()) {
    const msg = feature + ' is a Pro feature. Get it at: https://craftpipe.gumroad.com';
    if (process.env.NODE_ENV === 'test') { return false; }
    console.log('\n  \u2B50 ' + msg + '\n');
    process.exit(0);
  }
  return true;
}
function showUpgrade() {
  if (checkPro() || process.env.NODE_ENV === 'test') return;
  if (Math.random() > 0.3) return; // show ~30% of the time
  console.log('\n  \u2500\u2500\u2500');
  console.log('  \u2B50 Pro: advanced config, dashboard, api integration');
  console.log('  \u2192 https://craftpipe.gumroad.com\n');
}
module.exports = { checkPro, requirePro, showUpgrade };
