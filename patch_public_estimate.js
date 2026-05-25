const fs = require('fs');
const file = 'src/app/actions/public-estimate.actions.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Add invoiceHash to PublicEstimateView
code = code.replace(
  /declineReason\?: string \| null;\n} \| null;/,
  "declineReason?: string | null;\n  invoiceHash?: string | null;\n} | null;"
);

// 2. Add invoiceHash to PublicActionResult
code = code.replace(
  /export type PublicActionResult =\n  \| \{ success: true; message\?: string \}\n  \| \{ success: false; error: string \};/,
  "export type PublicActionResult =\n  | { success: true; message?: string; invoiceHash?: string }\n  | { success: false; error: string };"
);

// 3. fetch invoiceHash in getPublicEstimate
code = code.replace(
  /if \(estimate\.status === 'accepted'\) \{/,
  `let invoiceHash: string | null = null;
    if (estimate.status === 'accepted') {
      const invoice = await db.collection('crm_invoices').findOne(
        { sourceEstimateId: estimate._id },
        { sort: { createdAt: -1 } }
      );
      if (invoice && invoice.publicHash) {
        invoiceHash = invoice.publicHash;
      }`
);

// 4. Return invoiceHash in getPublicEstimate
code = code.replace(
  /declineReason: \(estimate\.declineReason as string\) \|\| null,\n    \};/,
  "declineReason: (estimate.declineReason as string) || null,\n      invoiceHash,\n    };"
);

// 5. Generate and use invoiceHash in acceptEstimate
code = code.replace(
  /publicHash: generatePublicHash\(\),/,
  "publicHash: invoiceHash,"
);

code = code.replace(
  /try \{\n      await db\.collection\('crm_invoices'\)\.insertOne\(\{/,
  `let invoiceHash: string | undefined = undefined;
    try {
      invoiceHash = generatePublicHash();
      await db.collection('crm_invoices').insertOne({`
);

code = code.replace(
  /return \{ success: true, message: 'Estimate accepted\. An invoice has been generated\.' \};/,
  "return { success: true, message: 'Estimate accepted. An invoice has been generated.', invoiceHash };"
);

fs.writeFileSync(file, code);
