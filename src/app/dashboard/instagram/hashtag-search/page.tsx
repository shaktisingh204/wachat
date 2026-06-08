'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Skeleton,
  toast,
} from '@/components/sabcrm/20ui';
import { useCallback, useState, useTransition } from 'react';
import { Flame, Hash, Heart, MessageSquare, Search, Sparkles } from 'lucide-react';

import {
  getHashtagRecentMedia,
  getHashtagTopMedia,
  searchInstagramHashtag,
} from '@/app/actions/instagram.actions';
import { useProject } from '@/context/project-context';

/**
 * /dashboard/instagram/hashtag-search — Top + recent media for a hashtag.
 *
 * Resolves the hashtag id via `ig_hashtag_search`, then fetches `/top_media`
 * (highest performing) and `/recent_media` (last 24h) in parallel and renders
 * two stacked media sections.
 */

import * as React from 'react';

interface HashtagMedia {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  timestamp?: string;
}

const tabular = { fontVariantNumeric: 'tabular-nums' } as const;

function MediaGrid({ items }: { items: HashtagMedia[] }): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {items.map((m) => {
        const src = m.thumbnail_url || m.media_url;
        return (
          <a
            key={m.id}
            href={m.permalink ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="group block overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] outline-none transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
          >
            <div className="aspect-square w-full bg-[var(--st-bg-muted)]">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={m.caption ?? ''} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="p-2.5">
              <p className="line-clamp-2 text-[11px] text-[var(--st-text)]">{m.caption ?? 'No caption'}</p>
              <div className="mt-1.5 flex gap-3 text-[11px] text-[var(--st-text-secondary)]" style={tabular}>
                {typeof m.like_count === 'number' ? (
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" aria-hidden="true" /> {m.like_count}
                  </span>
                ) : null}
                {typeof m.comments_count === 'number' ? (
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" aria-hidden="true" /> {m.comments_count}
                  </span>
                ) : null}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ElementType;
  items: HashtagMedia[];
}): React.JSX.Element {
  return (
    <Card variant="outlined" padding="none">
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          {title}
          <Badge tone="neutral">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <EmptyState icon={Hash} title="Nothing here yet" description="Try a different hashtag, or check back later." />
        ) : (
          <MediaGrid items={items} />
        )}
      </CardBody>
    </Card>
  );
}

export default function HashtagSearchPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [tag, setTag] = useState('');
  const [hashtagId, setHashtagId] = useState<string | null>(null);
  const [top, setTop] = useState<HashtagMedia[]>([]);
  const [recent, setRecent] = useState<HashtagMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const runSearch = useCallback(
    (rawTag: string) => {
      if (!projectId) {
        toast.error('Select a project with a connected Instagram account first.');
        return;
      }
      const cleaned = rawTag.replace(/^#/, '').trim();
      if (!cleaned) {
        toast.error('Enter a hashtag to search.');
        return;
      }
      startLoading(async () => {
        setError(null);
        setTop([]);
        setRecent([]);
        setHashtagId(null);

        const idRes = await searchInstagramHashtag(projectId, cleaned);
        if (idRes.error || !idRes.hashtagId) {
          setError(idRes.error ?? 'Could not resolve the hashtag id.');
          return;
        }
        setHashtagId(idRes.hashtagId);

        const [topRes, recentRes] = await Promise.all([
          getHashtagTopMedia(projectId, idRes.hashtagId),
          getHashtagRecentMedia(idRes.hashtagId, projectId),
        ]);
        if (topRes.error && recentRes.error) {
          setError(topRes.error);
          return;
        }
        setTop((topRes.data as HashtagMedia[]) ?? []);
        setRecent((recentRes.media as HashtagMedia[]) ?? []);
      });
    },
    [projectId],
  );

  if (!projectId) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <Card variant="outlined">
          <EmptyState
            icon={Hash}
            title="No project selected"
            description="Pick a project with a connected Instagram account to search hashtags."
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
              <Hash className="h-6 w-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Hashtag search
            </span>
          </PageTitle>
          <PageDescription>
            Explore top-performing and recent public media for any hashtag.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card variant="outlined">
        <form
          className="flex flex-col items-end gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(tag);
          }}
        >
          <div className="w-full sm:max-w-md">
            <Field label="Hashtag">
              <Input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g. travel"
                prefix="#"
                aria-label="Hashtag"
              />
            </Field>
          </div>
          <Button type="submit" iconLeft={Search} loading={loading}>
            Search
          </Button>
          {hashtagId ? <Badge tone="neutral">id · {hashtagId}</Badge> : null}
        </form>
      </Card>

      {error ? (
        <Alert tone="danger" title="Search failed">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : !hashtagId ? (
        <Card variant="outlined">
          <EmptyState
            icon={Sparkles}
            title="Search a hashtag"
            description="Enter a hashtag above to load its top and recent media."
          />
        </Card>
      ) : (
        <>
          <Section title="Top media" icon={Flame} items={top} />
          <Section title="Recent media" icon={Sparkles} items={recent} />
        </>
      )}
    </div>
  );
}
