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
          <span className="rounded bg-secondary border border-border px-2 py-0.5 font-mono text-[11px] font-bold text-green-600 uppercase">
            POST
          </span>
          <span className="font-mono text-[13px] text-foreground tracking-tight">
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
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Estimate accepted. A support representative will follow up soon.
                </p>
              </div>
              <div className="mt-4 w-full rounded border border-border bg-background p-3 text-left font-mono text-[11px] leading-relaxed shadow-inner">
                <span className="text-muted-foreground">{"{"}</span>
                <div className="pl-4">
                  <span className="text-blue-600">&quot;status&quot;</span>: <span className="text-green-600">&quot;accepted&quot;</span>,
                  <br />
                  <span className="text-blue-600">&quot;code&quot;</span>: <span className="text-amber-600">200</span>,
                  <br />
                  <span className="text-blue-600">&quot;message&quot;</span>: <span className="text-green-600">&quot;Transition to quoted successful&quot;</span>
                </div>
                <span className="text-muted-foreground">{"}"}</span>
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
