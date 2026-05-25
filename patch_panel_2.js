const fs = require('fs');
const file = 'src/app/share/estimate/[hash]/estimate-actions-panel.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /<div className="flex flex-col gap-2 sm:flex-row">\n          <Button onClick=\{handleAccept\} disabled=\{pending\}>\n            \{pending \? 'Submitting…' : 'Accept estimate'\}\n          <\/Button>\n          <Button variant="outline" onClick=\{\(\) => setDeclineOpen\(true\)\} disabled=\{pending\}>\n            Decline\n          <\/Button>\n        <\/div>/,
  `{!actionInvoiceHash ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleAccept} disabled={pending}>
              {pending ? 'Submitting…' : 'Accept estimate'}
            </Button>
            <Button variant="outline" onClick={() => setDeclineOpen(true)} disabled={pending}>
              Decline
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={\`/share/invoice/\${actionInvoiceHash}\`}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Pay Advance / Deposit
            </a>
          </div>
        )}`
);

fs.writeFileSync(file, code);
