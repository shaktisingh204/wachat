import { Card, CardBody } from '@/components/sabcrm/20ui';

export function PaymentSuccess() {
  return (
    <Card className="border-success/20 bg-success/5">
      <CardBody className="py-8 text-center flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success-ink border border-success/20 font-mono text-xs">
          200
        </div>
        <div>
          <h3 className="text-[14px] font-bold font-mono uppercase text-success-ink tracking-tight">
            // LEDGER.BALANCED
          </h3>
          <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)] font-sans">
            This invoice has been fully settled and paid. Thank you!
          </p>
        </div>
        <div className="mt-4 w-full rounded border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-left font-mono text-[11px] leading-relaxed shadow-inner">
          <span className="text-[var(--st-text-secondary)]">{"{"}</span>
          <div className="pl-4">
            <span className="text-[var(--st-text)]">&quot;status&quot;</span>: <span className="text-[var(--st-text)]">&quot;paid&quot;</span>,
            <br />
            <span className="text-[var(--st-text)]">&quot;balance_due&quot;</span>: <span className="text-[var(--st-text)]">0.00</span>,
            <br />
            <span className="text-[var(--st-text)]">&quot;success&quot;</span>: <span className="text-[var(--st-text)]">true</span>
          </div>
          <span className="text-[var(--st-text-secondary)]">{"}"}</span>
        </div>
      </CardBody>
    </Card>
  );
}
