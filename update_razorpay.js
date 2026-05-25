const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/wachat/integrations/razorpay/page.tsx');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { formatUTC, fmtINR }')) {
  content = content.replace("import type { WithId } from 'mongodb';", "import type { WithId } from 'mongodb';\nimport { formatUTC, fmtINR } from '@/lib/utils';");
}

content = content.replace(/₹\{\(txn\.amount \/ 100\)\.toFixed\(2\)\}/g, '{fmtINR(txn.amount / 100)}');
content = content.replace(/₹\{\(link\.amount \/ 100\)\.toFixed\(2\)\}/g, '{fmtINR(link.amount / 100)}');

content = content.replace(/\{new Date\(txn\.created_at \* 1000\)\.toLocaleDateString\(\)\}\{' '\}\s*\{new Date\(txn\.created_at \* 1000\)\.toLocaleTimeString\(\[\], \{ hour: '2-digit', minute: '2-digit' \}\)\}/g, '{formatUTC(txn.created_at * 1000, true)}');

content = content.replace(/\{new Date\(link\.created_at \* 1000\)\.toLocaleDateString\(\)\}\{' '\}\s*\{new Date\(link\.created_at \* 1000\)\.toLocaleTimeString\(\[\], \{ hour: '2-digit', minute: '2-digit' \}\)\}/g, '{formatUTC(link.created_at * 1000, true)}');

fs.writeFileSync(file, content);
console.log('Fixed Razorpay');
