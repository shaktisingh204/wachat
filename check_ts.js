const { execSync } = require('child_process');
const dirs = [
  'flow-builder/page.tsx',
  'flows/page.tsx',
  'flows/create/page.tsx',
  'greeting-messages/page.tsx',
  'interactive-messages/page.tsx',
  'link-tracking/page.tsx',
  'message-statistics/page.tsx',
  'integrations/page.tsx',
  'integrations/razorpay/page.tsx',
  'integrations/whatsapp-link-generator/page.tsx',
  'integrations/whatsapp-widget-generator/page.tsx',
  'media-library/page.tsx',
  'health/page.tsx'
];
dirs.forEach(f => {
  try {
    execSync(`npx tsc --noEmit --jsx react-jsx src/app/wachat/${f}`, { stdio: 'ignore' });
  } catch (e) {
    console.log('Error in', f);
  }
});
console.log('Done checking.');
