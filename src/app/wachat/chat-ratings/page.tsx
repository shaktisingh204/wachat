'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  Card,
  StatCard,
  EmptyState,
  Spinner,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Star, MessageSquare } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getChatRatings } from '@/app/actions/wachat-features.actions';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * /wachat/chat-ratings — Customer satisfaction stream + rating histogram,
 * rebuilt on 20ui primitives. Stars use neutral ink shades.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cx('h-3.5 w-3.5', i <= count ? 'fill-current' : '')}
          style={{ color: i <= count ? 'var(--st-text)' : 'var(--st-text-tertiary)' }}
          strokeWidth={1.75}
        />
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
      if (res.error) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Chat Ratings' },
      ]}
      title="Chat Ratings"
      description="Customer satisfaction ratings and feedback for conversations."
    >
      {isPending && ratings.length === 0 && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" label="Loading ratings" />
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Average Rating"
          icon={Star}
          value={
            <span className="flex items-center gap-2">
              {avg}
              {summary.avg ? <Stars count={Math.round(summary.avg)} /> : null}
            </span>
          }
        />
        <StatCard label="Total Ratings" value={total} />
        <Card padding="lg" className="flex flex-col gap-1">
          {dist.map((d) => (
            <div
              key={d.stars}
              className="text-[12px]"
              style={{ color: 'var(--st-text-secondary)' }}
            >
              {d.stars}-star:{' '}
              <span style={{ color: 'var(--st-text)' }}>{d.count}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Distribution chart */}
      <Card padding="lg">
        <h2 className="mb-4 text-[15px]" style={{ color: 'var(--st-text)' }}>
          Rating Distribution
        </h2>
        <div className="space-y-2.5">
          {dist.map((d) => (
            <div key={d.stars} className="flex items-center gap-3">
              <span
                className="flex w-16 items-center gap-1 text-[13px]"
                style={{ color: 'var(--st-text)' }}
              >
                {d.stars}{' '}
                <Star
                  className="h-3 w-3 fill-current"
                  aria-hidden="true"
                  style={{ color: 'var(--st-text)' }}
                />
              </span>
              <div
                className="h-5 flex-1 overflow-hidden rounded-full"
                style={{ background: 'var(--st-bg-secondary)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(d.count / maxDist) * 100}%`,
                    background: 'var(--st-text)',
                  }}
                />
              </div>
              <span
                className="w-10 text-right text-[12px]"
                style={{ color: 'var(--st-text-secondary)' }}
              >
                {d.count}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent ratings */}
      <Card padding="lg">
        <h2 className="mb-4 text-[15px]" style={{ color: 'var(--st-text)' }}>
          Recent Ratings
        </h2>
        {ratings.length === 0 && !isPending && (
          <EmptyState
            icon={MessageSquare}
            title="No ratings received yet."
          />
        )}
        <div className="space-y-3">
          {ratings.slice(0, 20).map((r) => (
            <div
              key={r._id}
              className="flex items-start gap-3 p-3"
              style={{
                border: '1px solid var(--st-border)',
                borderRadius: 'var(--st-radius)',
              }}
            >
              <Stars count={r.rating} />
              <div className="min-w-0 flex-1">
                {r.feedback && (
                  <p className="text-[13px]" style={{ color: 'var(--st-text)' }}>
                    {r.feedback}
                  </p>
                )}
                {!r.feedback && (
                  <p
                    className="text-[12px] italic"
                    style={{ color: 'var(--st-text-secondary)' }}
                  >
                    No feedback provided
                  </p>
                )}
              </div>
              <span
                className="shrink-0 text-[11.5px]"
                style={{ color: 'var(--st-text-secondary)' }}
              >
                {r.createdAt ? fmtDate(r.createdAt) : '--'}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </WachatPage>
  );
}
