const fs = require('fs');
const file = 'src/app/share/estimate/[hash]/estimate-actions-panel.tsx';
let code = fs.readFileSync(file, 'utf8');

// Update Props
code = code.replace(
  /declineReason: string \| null;\n\};/,
  "declineReason: string | null;\n  invoiceHash?: string | null;\n};"
);

// Update signature of function
code = code.replace(
  /export function EstimateActionsPanel\(\{ hash, status, signature, declineReason \}: Props\) \{/,
  "export function EstimateActionsPanel({ hash, status, signature, declineReason, invoiceHash }: Props) {"
);

// We need state for runtime invoiceHash from the action
code = code.replace(
  /const \[banner, setBanner\] = React.useState</,
  `const [actionInvoiceHash, setActionInvoiceHash] = React.useState<string | null>(null);\n  const [banner, setBanner] = React.useState<`
);

// We should use effectiveInvoiceHash
code = code.replace(
  /if \(status === 'accepted'\) \{/,
  `const effectiveInvoiceHash = actionInvoiceHash || invoiceHash;\n\n  if (status === 'accepted') {`
);

// Add the button to accepted card
code = code.replace(
  /<\/ZoruCardContent>\n      <\/Card>\n    \);\n  \}/,
  `  {effectiveInvoiceHash ? (
            <div className="mt-4 pt-4 border-t border-zinc-200">
              <a
                href={\`/share/invoice/\${effectiveInvoiceHash}\`}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                Pay Advance / Deposit
              </a>
            </div>
          ) : null}
        </ZoruCardContent>
      </Card>
    );
  }`
);

// Update handleAccept to save invoiceHash
code = code.replace(
  /setBanner\(\n        result\.success\n          \? \{ kind: 'success', message: result\.message \|\| 'Accepted\.' \}\n          : \{ kind: 'error', message: result\.error \},\n      \);/,
  `if (result.success && 'invoiceHash' in result && result.invoiceHash) {
        setActionInvoiceHash(result.invoiceHash);
      }
      setBanner(
        result.success
          ? { kind: 'success', message: result.message || 'Accepted.' }
          : { kind: 'error', message: result.error },
      );`
);

// And also we might want to display the "Pay advance" button in the form if the status is waiting but we accepted it without a reload (though NextJS revalidates path).
code = code.replace(
  /<SignaturePad onChange=\{setSignatureData\} \/>/,
  `{!actionInvoiceHash ? <SignaturePad onChange={setSignatureData} /> : null}`
);

code = code.replace(
  /<div className="flex flex-col gap-2 sm:flex-row">\n          <Button onClick=\{handleAccept\} disabled=\{pending\}>\n            \{pending \? 'Submitting…' : 'Accept estimate'\}\n          <\/Button>\n          <Button variant="outline" onClick=\{undefined\} disabled=\{pending\}>\n            Decline\n          <\/Button>\n        <\/div>/,
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
