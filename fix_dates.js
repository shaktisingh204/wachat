const fs = require('fs');
const path = require('path');

const dirs = [
  'flow-builder',
  'flows',
  'flows/create',
  'greeting-messages',
  'interactive-messages',
  'link-tracking',
  'message-statistics',
  'integrations',
  'integrations/razorpay',
  'integrations/whatsapp-link-generator',
  'integrations/whatsapp-widget-generator',
  'media-library',
  'health'
];

dirs.forEach(dir => {
  const file = path.join(__dirname, 'src/app/wachat', dir, 'page.tsx');
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Replace import { format } from 'date-fns' with import { formatUTC } from '@/lib/utils'
  if (content.includes("import { format } from 'date-fns'")) {
    content = content.replace(/import \{ format \} from 'date-fns';/g, "import { formatUTC } from '@/lib/utils';");
    content = content.replace(/format\(new Date\(([^)]+)\),\s*'[^']+'\)/g, "formatUTC($1, true)");
    fs.writeFileSync(file, content);
    console.log('Fixed dates in', file);
  }
});
