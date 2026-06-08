'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  StatCard,
} from '@/components/sabcrm/20ui';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ExternalLink,
  Heart,
  MessageSquare,
  Play,
  RefreshCw,
  Video,
} from 'lucide-react';

import {
  getInstagramReelInsights,
  getInstagramReels,
} from '@/app/actions/instagram.actions';
import { useProject } from '@/context/project-context';

/**
 * /dashboard/instagram/reels — Published reels for the connected IG account.
 *
 * A grid of reel thumbnails with caption preview + engagement counters.
 * Clicking a tile opens a Sheet with the full caption and on-demand insights
 * (impressions, reach, plays, saves).
 */

import * as React from 'react';

interface Reel {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

const tabular = { fontVariantNumeric: 'tabular-nums' } as const;

function safeRelative(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

const INSIGHT_LABELS: Array<{ key: string; label: string }> = [
  { key: 'plays', label: 'Plays' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'reach', label: 'Reach' },
  { key: 'saved', label: 'Saves' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'total_interactions', label: 'Interactions' },
];

export default function InstagramReelsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [reels, setReels] = useState<Reel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const [activeReel, setActiveReel] = useState<Reel | null>(null);
  const [insights, setInsights] = useState<Record<string, number>>({});
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsLoading, startInsightsLoading] = useTransition();

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const res = await getInstagramReels(projectId, 30);
      if (res.error) {
        setError(res.error);
        setReels([]);
        return;
      }
      setError(null);
      setReels((res.reels as Reel[]) ?? []);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totals = useMemo(
    () =>
      reels.reduce(
        (acc, r) => {
          acc.likes += r.like_count || 0;
          acc.comments += r.comments_count || 0;
          return acc;
        },
        { likes: 0, comments: 0 },
      ),
    [reels],
  );

  const openReel = (r: Reel) => {
    setActiveReel(r);
    setInsights({});
    setInsightsError(null);
    startInsightsLoading(async () => {
      const res = await getInstagramReelInsights(projectId, r.id);
      if (res.error) {
        setInsightsError(res.error);
        return;
      }
      setInsights(res.insights ?? {});
    });
  };

  if (!projectId) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <Card variant="outlined">
          <EmptyState
            icon={Video}
            title="No project selected"
            description="Pick a project with a connected Instagram account to view its reels."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-6 pt-6 pb-10">
      <PageHeader>
        <PageHeaderHeading>
          <PageDescription>Instagram</PageDescription>
          <PageTitle>
            <span className="inline-flex items-center gap-3">
              <Video className="h-6 w-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Reels
            </span>
          </PageTitle>
          <PageDescription>
            Recent reels published from the connected Instagram Business account.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost" iconLeft={RefreshCw} loading={loading} onClick={refresh}>
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      {error ? (
        <Alert tone="danger" title="Could not load reels">
          {error}
        </Alert>
      ) : null}

      {!error && reels.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Reels"
            value={<span style={tabular}>{reels.length.toLocaleString()}</span>}
            icon={Video}
            accent="#d6249f"
          />
          <StatCard
            label="Likes"
            value={<span style={tabular}>{totals.likes.toLocaleString()}</span>}
            icon={Heart}
            accent="#7c3aed"
          />
          <StatCard
            label="Comments"
            value={<span style={tabular}>{totals.comments.toLocaleString()}</span>}
            icon={MessageSquare}
            accent="#3b7af5"
          />
        </div>
      ) : null}

      {loading && reels.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] w-full" />
          ))}
        </div>
      ) : !error && reels.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={Video}
            title="No reels yet"
            description="This account hasn't published any reels."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {reels.map((r) => {
            const src = r.thumbnail_url || r.media_url;
            return (
              <Card
                key={r.id}
                variant="elevated"
                padding="none"
                role="button"
                tabIndex={0}
                onClick={() => openReel(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openReel(r);
                  }
                }}
                className="flex cursor-pointer flex-col overflow-hidden outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
              >
                <div className="relative aspect-[9/16] w-full overflow-hidden bg-[var(--st-bg-muted)]">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={r.caption ?? ''} className="h-full w-full object-cover" />
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent p-2 text-[11px] text-white">
                    <span className="inline-flex items-center gap-1">
                      <Play className="h-3 w-3" aria-hidden="true" /> Reel
                    </span>
                    <span>{safeRelative(r.timestamp)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 p-3">
                  <p className="line-clamp-2 text-xs text-[var(--st-text)]">{r.caption ?? 'No caption'}</p>
                  <div className="flex items-center gap-3 text-[11px] text-[var(--st-text-secondary)]" style={tabular}>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3 w-3" aria-hidden="true" /> {r.like_count ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" aria-hidden="true" /> {r.comments_count ?? 0}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={!!activeReel} onOpenChange={(o) => !o && setActiveReel(null)}>
        <SheetContent side="right" className="flex w-full max-w-md flex-col gap-4 overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Reel details</SheetTitle>
            <SheetDescription>{activeReel ? safeRelative(activeReel.timestamp) : ''}</SheetDescription>
          </SheetHeader>

          {activeReel ? (
            <div className="flex flex-col gap-4">
              <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
                {activeReel.thumbnail_url || activeReel.media_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeReel.thumbnail_url || activeReel.media_url}
                    alt={activeReel.caption ?? ''}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <p className="whitespace-pre-line text-sm text-[var(--st-text)]">
                  {activeReel.caption ?? 'No caption'}
                </p>
                <div className="flex flex-wrap items-center gap-2" style={tabular}>
                  <Badge tone="neutral">
                    <Heart className="mr-1 inline h-3 w-3" aria-hidden="true" />
                    {activeReel.like_count ?? 0}
                  </Badge>
                  <Badge tone="neutral">
                    <MessageSquare className="mr-1 inline h-3 w-3" aria-hidden="true" />
                    {activeReel.comments_count ?? 0}
                  </Badge>
                  {activeReel.permalink ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={activeReel.permalink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        Open on Instagram
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-[var(--st-text)]">Insights</p>
                {insightsError ? (
                  <Alert tone="warning" title="Insights unavailable">
                    {insightsError}
                  </Alert>
                ) : insightsLoading ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <dl className="grid grid-cols-2 gap-2">
                    {INSIGHT_LABELS.map((m) => (
                      <div
                        key={m.key}
                        className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2.5"
                      >
                        <dt className="text-[11px] text-[var(--st-text-secondary)]">{m.label}</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-[var(--st-text)]" style={tabular}>
                          {typeof insights[m.key] === 'number' ? insights[m.key].toLocaleString() : '—'}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
