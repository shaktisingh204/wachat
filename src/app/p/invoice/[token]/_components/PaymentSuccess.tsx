import { Card, ZoruCardContent } from '@/components/sabcrm/20ui/compat';

export function PaymentSuccess() {
  return (
    <Card className="border-success/20 bg-success/5">
      <ZoruCardContent className="py-8 text-center flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success-ink border border-success/20 font-mono text-xs">
          200
        </div>
        <div>
          <h3 className="text-[14px] font-bold font-mono uppercase text-success-ink tracking-tight">
            // LEDGER.BALANCED
          </h3>
          <p className="mt-1 text-[12.5px] text-zoru-ink-muted font-sans">
            This invoice has been fully settled and paid. Thank you!
          </p>
        </div>
        <div className="mt-4 w-full rounded border border-zoru-line bg-zoru-surface p-3 text-left font-mono text-[11px] leading-relaxed shadow-inner">
          <span className="text-zoru-ink-muted">{"{"}</span>
          <div className="pl-4">
            <span className="text-zoru-ink">&quot;status&quot;</span>: <span className="text-zoru-ink">&quot;paid&quot;</span>,
            <br />
            <span className="text-zoru-ink">&quot;balance_due&quot;</span>: <span className="text-zoru-ink">0.00</span>,
            <br />
            <span className="text-zoru-ink">&quot;success&quot;</span>: <span className="text-zoru-ink">true</span>
          </div>
          <span className="text-zoru-ink-muted">{"}"}</span>
        </div>
      </ZoruCardContent>
    </Card>
  );
}
