'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuStar, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard } from '@/components/clay';
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

export default function ChatRatingsPage() {
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

  const avg = summary.avg ? summary.avg.toFixed(1) : '--';
  const total = summary.count ?? 0;
  const dist = [
    { stars: 5, count: summary.five ?? 0 },
    { stars: 4, count: summary.four ?? 0 },
    { stars: 3, count: summary.three ?? 0 },
    { stars: 2, count: summary.two ?? 0 },
    { stars: 1, count: summary.one ?? 0 },
  ];
  const maxDist = Math.max(...dist.map((d) => d.count), 1);

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Chat Ratings' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Chat Ratings</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Customer satisfaction ratings and feedback for conversations.</p>
      </div>

      {isPending && ratings.length === 0 && (
        <div className="flex justify-center py-12"><LuLoader className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ClayCard padded={false} className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-amber-50">
            <LuStar className="h-6 w-6 fill-amber-500 text-amber-500" strokeWidth={1.75} />
          </span>
          <div>
            <div className="text-[12px] text-muted-foreground">Average Rating</div>
            <div className="flex items-center gap-2">
              <span className="text-[26px] font-semibold text-foreground leading-tight">{avg}</span>
              {summary.avg ? <Stars count={Math.round(summary.avg)} /> : null}
            </div>
          </div>
        </ClayCard>
        <ClayCard padded={false} className="flex items-center gap-4 p-5">
          <div>
            <div className="text-[12px] text-muted-foreground">Total Ratings</div>
            <div className="text-[26px] font-semibold text-foreground leading-tight">{total}</div>
          </div>
        </ClayCard>
        <ClayCard padded={false} className="flex flex-col gap-1 p-5">
          {dist.map((d) => (
            <div key={d.stars} className="text-[12px] text-muted-foreground">
              {d.stars}-star: <span className="font-medium text-foreground">{d.count}</span>
            </div>
          ))}
        </ClayCard>
      </div>

      {/* Distribution chart */}
      <ClayCard padded={false} className="p-5">
        <h2 className="mb-4 text-[15px] font-semibold text-foreground">Rating Distribution</h2>
        <div className="space-y-2.5">
          {dist.map((d) => (
            <div key={d.stars} className="flex items-center gap-3">
              <span className="flex w-16 items-center gap-1 text-[13px] font-medium text-foreground">
                {d.stars} <LuStar className="h-3 w-3 fill-amber-500 text-amber-500" />
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(d.count / maxDist) * 100}%` }} />
              </div>
              <span className="w-10 text-right text-[12px] text-muted-foreground">{d.count}</span>
            </div>
          ))}
        </div>
      </ClayCard>

      {/* Recent ratings */}
      <ClayCard padded={false} className="p-5">
        <h2 className="mb-4 text-[15px] font-semibold text-foreground">Recent Ratings</h2>
        {ratings.length === 0 && !isPending && (
          <p className="py-8 text-center text-[13px] text-muted-foreground">No ratings received yet.</p>
        )}
        <div className="space-y-3">
          {ratings.slice(0, 20).map((r) => (
            <div key={r._id} className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Stars count={r.rating} />
              <div className="min-w-0 flex-1">
                {r.feedback && <p className="text-[13px] text-foreground">{r.feedback}</p>}
                {!r.feedback && <p className="text-[12px] italic text-muted-foreground">No feedback provided</p>}
              </div>
              <span className="shrink-0 text-[11.5px] text-muted-foreground">
                {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '--'}
              </span>
            </div>
          ))}
        </div>
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
