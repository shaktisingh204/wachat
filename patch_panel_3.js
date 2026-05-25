const fs = require('fs');
const file = 'src/app/share/estimate/[hash]/estimate-actions-panel.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /<a\n                href=\{`\/share\/invoice\/\$\{effectiveInvoiceHash\}`\}\n                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary\/90 h-10 px-4 py-2"\n              >\n                Pay Advance \/ Deposit\n              <\/a>/,
  `<Button asChild>
                <a href={\`/share/invoice/\${effectiveInvoiceHash}\`}>
                  Pay Advance / Deposit
                </a>
              </Button>`
);

code = code.replace(
  /<a\n              href=\{`\/share\/invoice\/\$\{actionInvoiceHash\}`\}\n              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary\/90 h-10 px-4 py-2"\n            >\n              Pay Advance \/ Deposit\n            <\/a>/,
  `<Button asChild>
              <a href={\`/share/invoice/\${actionInvoiceHash}\`}>
                Pay Advance / Deposit
              </a>
            </Button>`
);

fs.writeFileSync(file, code);
