'use client';

/**
 * Wachat Customer Satisfaction — NPS-style dashboard using real chat ratings.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuChartBar, LuCircleCheck, LuCircleX, LuTriangleAlert, LuLoader, LuStar } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { getChatRatings } from '@/app/actions/wachat-features.actions';

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <LuStar key={i} className={`h-3.5 w-3.5 ${i <= count ? 'fill-amber-500 text-amber-500' : 'text-border'}`} strokeWidth={1.75} />
      ))}
    </span>
  );
}

export default function CustomerSatisfactionPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [ratings, setRatings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getChatRatings(String(activeProject._id));
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setRatings(res.ratings ?? []);
      setSummary(res.summary ?? {});
    });
  }, [activeProject?._id, toast]);

  useEffect(() => { load(); }, [load]);

  const total = summary.count || 0;
  const promoters = (summary.five || 0) + (summary.four || 0);
  const passives = summary.three || 0;
  const detractors = (summary.two || 0) + (summary.one || 0);
  const promPct = total ? Math.round((promoters / total) * 100) : 0;
  const passPct = total ? Math.round((passives / total) * 100) : 0;
  const detPct = total ? Math.round((detractors / total) * 100) : 0;
  const nps = promPct - detPct;

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/dashboard' },
        { label: activeProject?.name || 'Project', href: '/wachat' },
        { label: 'Customer Satisfaction' },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Customer Satisfaction</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Track NPS scores and customer feedback from conversations.</p>
        </div>
        <ClayButton variant="pill" size="sm" onClick={load} disabled={isPending}>
          {isPending ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
        </ClayButton>
      </div>

      {isPending && ratings.length === 0 ? (
        <div className="flex h-40 items-center justify-center gap-3">
          <LuLoader className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-[13px] text-muted-foreground">Loading satisfaction data...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ClayCard padded={false} className="p-5 text-center">
              <div className="text-[12px] text-muted-foreground mb-1">NPS Score</div>
              <div className="text-[40px] font-bold text-foreground leading-none">{total ? nps : '--'}</div>
              <ClayBadge tone={nps >= 50 ? 'green' : nps >= 0 ? 'amber' : 'red'} className="mt-2">
                {nps >= 50 ? 'Excellent' : nps >= 0 ? 'Good' : 'Needs Work'}
              </ClayBadge>
            </ClayCard>
            <ClayCard padded={false} className="flex items-center gap-4 p-5">
              <LuCircleCheck className="h-8 w-8 text-emerald-500 shrink-0" />
              <div>
                <div className="text-[12px] text-muted-foreground">Promoters (4-5)</div>
                <div className="text-[22px] font-semibold text-foreground leading-tight">{promPct}%</div>
              </div>
            </ClayCard>
            <ClayCard padded={false} className="flex items-center gap-4 p-5">
              <LuTriangleAlert className="h-8 w-8 text-amber-500 shrink-0" />
              <div>
                <div className="text-[12px] text-muted-foreground">Passives (3)</div>
                <div className="text-[22px] font-semibold text-foreground leading-tight">{passPct}%</div>
              </div>
            </ClayCard>
            <ClayCard padded={false} className="flex items-center gap-4 p-5">
              <LuCircleX className="h-8 w-8 text-red-400 shrink-0" />
              <div>
                <div className="text-[12px] text-muted-foreground">Detractors (1-2)</div>
                <div className="text-[22px] font-semibold text-foreground leading-tight">{detPct}%</div>
              </div>
            </ClayCard>
          </div>

          {total > 0 && (
            <ClayCard padded={false} className="p-5">
              <h2 className="text-[15px] font-semibold text-foreground mb-3">Score Distribution</h2>
              <div className="flex h-6 w-full overflow-hidden rounded-full">
                <div className="bg-emerald-400 transition-all" style={{ width: `${promPct}%` }} />
                <div className="bg-amber-300 transition-all" style={{ width: `${passPct}%` }} />
                <div className="bg-red-400 transition-all" style={{ width: `${detPct}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>Promoters {promPct}%</span><span>Passives {passPct}%</span><span>Detractors {detPct}%</span>
              </div>
            </ClayCard>
          )}

          <ClayCard padded={false} className="overflow-x-auto">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-[15px] font-semibold text-foreground">Recent Feedback ({ratings.length})</h2>
            </div>
            {ratings.length === 0 ? (
              <div className="px-5 py-12 text-center text-[13px] text-muted-foreground">No ratings yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {ratings.slice(0, 20).map((r: any, i: number) => (
                  <div key={r._id || i} className="px-5 py-3 flex items-start gap-4">
                    <Stars count={r.rating} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</span>
                      {r.feedback && <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-0.5">{r.feedback}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ClayCard>
        </>
      )}
      <div className="h-6" />
    </div>
  );
}
