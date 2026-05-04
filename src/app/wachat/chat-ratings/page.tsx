'use client';

/**
 * /wachat/chat-ratings — Customer satisfaction stream + rating histogram,
 * rebuilt on ZoruUI primitives. Stars use neutral ink shades.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { Star, Loader2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useZoruToast } from '@/components/zoruui';
import { getChatRatings } from '@/app/actions/wachat-features.actions';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruCard,
  cn,
} from '@/components/zoruui';

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i <= count ? 'fill-zoru-ink text-zoru-ink' : 'text-zoru-ink-subtle',
          )}
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}

export default function ChatRatingsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [ratings, setRatings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getChatRatings(String(activeProject._id));
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setRatings(res.ratings ?? []);
      setSummary(res.summary ?? {});
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

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
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Chat Ratings</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Chat Ratings
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Customer satisfaction ratings and feedback for conversations.
        </p>
      </div>

      {isPending && ratings.length === 0 && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ZoruCard className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2">
            <Star className="h-6 w-6 fill-zoru-ink text-zoru-ink" strokeWidth={1.75} />
          </span>
          <div>
            <div className="text-[12px] text-zoru-ink-muted">Average Rating</div>
            <div className="flex items-center gap-2">
              <span className="text-[26px] text-zoru-ink leading-tight">{avg}</span>
              {summary.avg ? <Stars count={Math.round(summary.avg)} /> : null}
            </div>
          </div>
        </ZoruCard>
        <ZoruCard className="flex items-center gap-4 p-5">
          <div>
            <div className="text-[12px] text-zoru-ink-muted">Total Ratings</div>
            <div className="text-[26px] text-zoru-ink leading-tight">{total}</div>
          </div>
        </ZoruCard>
        <ZoruCard className="flex flex-col gap-1 p-5">
          {dist.map((d) => (
            <div key={d.stars} className="text-[12px] text-zoru-ink-muted">
              {d.stars}-star: <span className="text-zoru-ink">{d.count}</span>
            </div>
          ))}
        </ZoruCard>
      </div>

      {/* Distribution chart */}
      <ZoruCard className="p-5">
        <h2 className="mb-4 text-[15px] text-zoru-ink">Rating Distribution</h2>
        <div className="space-y-2.5">
          {dist.map((d) => (
            <div key={d.stars} className="flex items-center gap-3">
              <span className="flex w-16 items-center gap-1 text-[13px] text-zoru-ink">
                {d.stars} <Star className="h-3 w-3 fill-zoru-ink text-zoru-ink" />
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded-full bg-zoru-surface">
                <div
                  className="h-full rounded-full bg-zoru-ink transition-all"
                  style={{ width: `${(d.count / maxDist) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-[12px] text-zoru-ink-muted">
                {d.count}
              </span>
            </div>
          ))}
        </div>
      </ZoruCard>

      {/* Recent ratings */}
      <ZoruCard className="p-5">
        <h2 className="mb-4 text-[15px] text-zoru-ink">Recent Ratings</h2>
        {ratings.length === 0 && !isPending && (
          <p className="py-8 text-center text-[13px] text-zoru-ink-muted">
            No ratings received yet.
          </p>
        )}
        <div className="space-y-3">
          {ratings.slice(0, 20).map((r) => (
            <div
              key={r._id}
              className="flex items-start gap-3 rounded-[var(--zoru-radius)] border border-zoru-line p-3"
            >
              <Stars count={r.rating} />
              <div className="min-w-0 flex-1">
                {r.feedback && <p className="text-[13px] text-zoru-ink">{r.feedback}</p>}
                {!r.feedback && (
                  <p className="text-[12px] italic text-zoru-ink-muted">
                    No feedback provided
                  </p>
                )}
              </div>
              <span className="shrink-0 text-[11.5px] text-zoru-ink-muted">
                {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '--'}
              </span>
            </div>
          ))}
        </div>
      </ZoruCard>
      <div className="h-6" />
    </div>
  );
}
