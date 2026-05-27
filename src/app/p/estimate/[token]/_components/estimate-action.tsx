import { Card, ZoruCardContent } from '@/components/zoruui';
import { EstimateAcceptForm } from '../_form';

export function EstimateAction({
  token,
  accepted,
}: {
  token: string;
  accepted: boolean;
}) {
  return (
    <div className="lg:col-span-2">
      <div className="sticky top-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="rounded bg-zoru-surface-2 border border-zoru-line px-2 py-0.5 font-mono text-[11px] font-bold text-zoru-ink uppercase">
            POST
          </span>
          <span className="font-mono text-[13px] text-zoru-ink tracking-tight">
            /v1/estimates/{token.slice(0, 8)}.../accept
          </span>
        </div>

        {accepted ? (
          <Card className="border-success/20 bg-success/5">
            <ZoruCardContent className="py-8 text-center flex flex-col items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success-ink border border-success/20 font-mono text-xs">
                200
              </div>
              <div>
                <h3 className="text-[14px] font-bold font-mono uppercase text-success-ink tracking-tight">
                  // ESTIMATE.ACCEPTED
                </h3>
                <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                  Estimate accepted. A support representative will follow up soon.
                </p>
              </div>
              <div className="mt-4 w-full rounded border border-zoru-line bg-zoru-surface p-3 text-left font-mono text-[11px] leading-relaxed shadow-inner">
                <span className="text-zoru-ink-muted">{"{"}</span>
                <div className="pl-4">
                  <span className="text-zoru-ink">&quot;status&quot;</span>: <span className="text-zoru-ink">&quot;accepted&quot;</span>,
                  <br />
                  <span className="text-zoru-ink">&quot;code&quot;</span>: <span className="text-zoru-ink">200</span>,
                  <br />
                  <span className="text-zoru-ink">&quot;message&quot;</span>: <span className="text-zoru-ink">&quot;Transition to quoted successful&quot;</span>
                </div>
                <span className="text-zoru-ink-muted">{"}"}</span>
              </div>
            </ZoruCardContent>
          </Card>
        ) : (
          <EstimateAcceptForm token={token} />
        )}
      </div>
    </div>
  );
}
