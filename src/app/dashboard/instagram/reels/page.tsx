'use client';

import { Alert, AlertDescription, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, EmptyState, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Skeleton } from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  Clapperboard,
  Eye,
  Heart,
  MessageSquare,
  Play,
  RefreshCw,
  } from 'lucide-react';

import {
  getInstagramReelInsights,
  getInstagramReels,
  } from '@/app/actions/instagram.actions';
import { useProject } from '@/context/project-context';

/**
 * /dashboard/instagram/reels — Published Reels for the connected IG account.
 *
 * Grid of reel thumbnails with caption preview + engagement counters.
 * Clicking a tile opens a Sheet with the full caption and on-demand
 * insights (impressions, reach, plays, saves).
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
  { key: 'total_interactions', label: 'Total interactions' },
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
      <div className="p-6">
        <EmptyState
          icon={<Clapperboard />}
          title="No project selected"
          description="Pick a project with a connected Instagram account to view its reels."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/instagram">Instagram</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Reels</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Reels</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Recent reels published from the connected Instagram Business account.
          </p>
        </div>
        <Button variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Refresh
        </Button>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load reels</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && reels.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Skeleton className="aspect-[9/16] w-full" />
          <Skeleton className="aspect-[9/16] w-full" />
          <Skeleton className="aspect-[9/16] w-full" />
          <Skeleton className="aspect-[9/16] w-full" />
        </div>
      ) : reels.length === 0 ? (
        <EmptyState
          icon={<Clapperboard />}
          title="No reels yet"
          description="This account hasn't published any reels."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {reels.map((r) => {
            const src = r.thumbnail_url || r.media_url;
            return (
              <Card
                key={r.id}
                className="flex cursor-pointer flex-col p-0"
                onClick={() => openReel(r)}
              >
                <div className="relative aspect-[9/16] w-full overflow-hidden rounded-t-[var(--st-radius-lg)] bg-[var(--st-bg-muted)]">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={r.caption ?? ''} className="h-full w-full object-cover" />
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2 text-[11px] text-white">
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      Reel
                    </span>
                    <span>{safeRelative(r.timestamp)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <p className="line-clamp-2 text-xs text-[var(--st-text)]">
                    {r.caption ?? '(no caption)'}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--st-text-secondary)]">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" /> {r.like_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> {r.comments_count ?? 0}
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
            <SheetDescription>
              {activeReel ? safeRelative(activeReel.timestamp) : ''}
            </SheetDescription>
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

              <div>
                <p className="text-sm text-[var(--st-text)] whitespace-pre-line">
                  {activeReel.caption ?? '(no caption)'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">♥ {activeReel.like_count ?? 0}</Badge>
                  <Badge variant="outline">💬 {activeReel.comments_count ?? 0}</Badge>
                  {activeReel.permalink ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={activeReel.permalink} target="_blank" rel="noopener noreferrer">
                        <Eye className="mr-1 h-3 w-3" /> Open on Instagram
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="text-sm text-[var(--st-text)]">Insights</p>
                {insightsError ? (
                  <Alert variant="warning" className="mt-2">
                    <AlertCircle />
                    <AlertTitle>Insights unavailable</AlertTitle>
                    <AlertDescription>{insightsError}</AlertDescription>
                  </Alert>
                ) : insightsLoading ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {INSIGHT_LABELS.map((m) => (
                      <div
                        key={m.key}
                        className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2"
                      >
                        <p className="text-[11px] text-[var(--st-text-secondary)]">{m.label}</p>
                        <p className="mt-0.5 text-sm text-[var(--st-text)]">
                          {typeof insights[m.key] === 'number'
                            ? insights[m.key].toLocaleString()
                            : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
