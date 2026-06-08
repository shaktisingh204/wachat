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
  Skeleton,
  StatCard,
} from '@/components/sabcrm/20ui';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Clapperboard, ExternalLink, RefreshCw } from 'lucide-react';

import {
  getInstagramStories,
  getInstagramStoryInsights,
} from '@/app/actions/instagram.actions';
import { useProject } from '@/context/project-context';

/**
 * /dashboard/instagram/stories — Active IG stories (24-hour expiry).
 *
 * Lists the account's active stories via the `/stories` edge, then fetches
 * per-story metrics (impressions, reach, exits, taps_forward) on demand. Story
 * tiles render inline; metric tiles appear beneath each story.
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

const tabular = { fontVariantNumeric: 'tabular-nums' } as const;

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
      <p className="text-[11px] text-[var(--st-text-secondary)]">Insights unavailable — {error}</p>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {STORY_METRICS.map((m) => (
        <div
          key={m.key}
          className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2"
        >
          <dt className="text-[10px] uppercase tracking-wide text-[var(--st-text-secondary)]">{m.label}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-[var(--st-text)]" style={tabular}>
            {typeof insights[m.key] === 'number' ? insights[m.key].toLocaleString() : '—'}
          </dd>
        </div>
      ))}
    </dl>
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
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <Card variant="outlined">
          <EmptyState
            icon={Clapperboard}
            title="No project selected"
            description="Pick a project with a connected Instagram account to view its stories."
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
              <Clapperboard className="h-6 w-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Active stories
            </span>
          </PageTitle>
          <PageDescription>
            Stories currently live on the connected Instagram account (24-hour expiry).
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost" iconLeft={RefreshCw} loading={loading} onClick={refresh}>
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      {error ? (
        <Alert tone="danger" title="Could not load stories">
          {error}
        </Alert>
      ) : null}

      {!error && stories.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            label="Live stories"
            value={<span style={tabular}>{stories.length.toLocaleString()}</span>}
            icon={Clapperboard}
            accent="#d6249f"
            delta={{ value: 'Expire within 24 hours', tone: 'neutral' }}
          />
          <StatCard
            label="Latest published"
            value={stories[0]?.timestamp ? safeRelative(stories[0].timestamp) : '—'}
            icon={RefreshCw}
            accent="#7c3aed"
          />
        </div>
      ) : null}

      {loading && stories.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : !error && stories.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={Clapperboard}
            title="No active stories"
            description="This account doesn't have any stories live right now."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stories.map((s) => {
            const src = s.thumbnail_url || s.media_url;
            return (
              <Card key={s.id} variant="elevated" className="flex flex-col gap-3">
                <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
                  {src ? (
                    s.media_type === 'VIDEO' ? (
                      <video src={s.media_url} controls={false} muted className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    )
                  ) : null}
                </div>
                <div className="flex items-center justify-between">
                  <Badge tone="neutral">{s.media_type ?? 'STORY'}</Badge>
                  <span className="text-xs text-[var(--st-text-secondary)]">{safeRelative(s.timestamp)}</span>
                </div>
                <StoryInsightsRow projectId={projectId} storyId={s.id} />
                {s.permalink ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={s.permalink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Open on Instagram
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
