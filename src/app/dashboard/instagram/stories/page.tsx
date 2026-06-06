'use client';

import { Alert, AlertDescription, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, EmptyState, Skeleton } from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  ExternalLink,
  PanelsTopLeft,
  RefreshCw,
  } from 'lucide-react';

import {
  getInstagramStories,
  getInstagramStoryInsights,
  } from '@/app/actions/instagram.actions';
import { useProject } from '@/context/project-context';

/**
 * /dashboard/instagram/stories — Active IG stories (24-hour expiry).
 *
 * Lists the IG account's active stories via the `/stories` edge, then
 * fetches per-story metrics (impressions, reach, exits, taps_forward) on
 * demand via `getInstagramStoryInsights`. The story tiles render
 * inline; metric tiles appear beneath each story.
 */

import * as React from 'react';

interface IgStory {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
}

const STORY_METRICS: Array<{ key: string; label: string }> = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'reach', label: 'Reach' },
  { key: 'exits', label: 'Exits' },
  { key: 'taps_forward', label: 'Taps forward' },
  { key: 'taps_back', label: 'Taps back' },
  { key: 'replies', label: 'Replies' },
];

function safeRelative(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

function StoryInsightsRow({
  projectId,
  storyId,
}: {
  projectId: string;
  storyId: string;
}): React.JSX.Element {
  const [insights, setInsights] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      const res = await getInstagramStoryInsights(projectId, storyId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setInsights(res.insights ?? {});
    });
  }, [projectId, storyId]);

  if (error) {
    return (
      <p className="mt-2 text-[11px] text-[var(--st-text-secondary)]">
        Insights unavailable — {error}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {STORY_METRICS.map((m) => (
        <div
          key={m.key}
          className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2"
        >
          <p className="text-[10px] uppercase tracking-wide text-[var(--st-text-secondary)]">{m.label}</p>
          <p className="mt-0.5 text-sm text-[var(--st-text)]">
            {typeof insights[m.key] === 'number' ? insights[m.key].toLocaleString() : '—'}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function InstagramStoriesPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [stories, setStories] = useState<IgStory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const res = await getInstagramStories(projectId);
      if (res.error) {
        setError(res.error);
        setStories([]);
        return;
      }
      setError(null);
      setStories((res.stories as IgStory[]) ?? []);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<PanelsTopLeft />}
          title="No project selected"
          description="Pick a project with a connected Instagram account to view its stories."
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
            <BreadcrumbPage>Stories</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Active stories</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Stories currently live on the connected Instagram account
            (24-hour expiry).
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
          <AlertTitle>Could not load stories</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && stories.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : stories.length === 0 ? (
        <EmptyState
          icon={<PanelsTopLeft />}
          title="No active stories"
          description="This account doesn't have any stories live right now."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {stories.map((s) => {
            const src = s.thumbnail_url || s.media_url;
            return (
              <Card key={s.id} className="flex flex-col gap-3 p-3">
                <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
                  {src ? (
                    s.media_type === 'VIDEO' ? (
                      <video
                        src={s.media_url}
                        controls={false}
                        muted
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    )
                  ) : null}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <Badge variant="outline">{s.media_type ?? 'STORY'}</Badge>
                  <span className="text-[var(--st-text-secondary)]">{safeRelative(s.timestamp)}</span>
                </div>
                <StoryInsightsRow projectId={projectId} storyId={s.id} />
                {s.permalink ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={s.permalink} target="_blank" rel="noopener noreferrer">
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
