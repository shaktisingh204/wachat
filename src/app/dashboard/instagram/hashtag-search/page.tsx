'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  EmptyState,
  Input,
  Skeleton,
  zoruSonnerToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useState,
  useTransition } from 'react';
import {
  AlertCircle,
  Hash,
  RefreshCw,
  Search,
  } from 'lucide-react';

import {
  getHashtagRecentMedia,
  getHashtagTopMedia,
  searchInstagramHashtag,
  } from '@/app/actions/instagram.actions';
import { useProject } from '@/context/project-context';

/**
 * /dashboard/instagram/hashtag-search — Top + recent media for a hashtag.
 *
 * Workflow:
 *   1. Resolve the hashtag id via the Graph `ig_hashtag_search` endpoint.
 *   2. Fetch `/top_media` (highest performing) and `/recent_media`
 *      (most recent within the last 24h) in parallel.
 *   3. Render two media grids — no tab UI, just stacked sections.
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

function MediaGrid({
  items,
  emptyTitle,
}: {
  items: HashtagMedia[];
  emptyTitle: string;
}): React.JSX.Element {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Hash />}
        title={emptyTitle}
        description="Try a different hashtag, or check back later."
      />
    );
  }
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
            className="block overflow-hidden rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)]"
          >
            <div className="aspect-square w-full">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={m.caption ?? ''}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="p-2 text-[11px] text-[var(--st-text-secondary)]">
              <p className="line-clamp-2 text-[var(--st-text)]">{m.caption ?? '(no caption)'}</p>
              <div className="mt-1 flex gap-3">
                {typeof m.like_count === 'number' ? <span>♥ {m.like_count}</span> : null}
                {typeof m.comments_count === 'number' ? <span>💬 {m.comments_count}</span> : null}
              </div>
            </div>
          </a>
        );
      })}
    </div>
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
        zoruSonnerToast.error('Select a project with a connected Instagram account first.');
        return;
      }
      const cleaned = rawTag.replace(/^#/, '').trim();
      if (!cleaned) {
        zoruSonnerToast.error('Enter a hashtag to search.');
        return;
      }
      startLoading(async () => {
        setError(null);
        setTop([]);
        setRecent([]);
        setHashtagId(null);

        const idRes = await searchInstagramHashtag(projectId, cleaned);
        if (idRes.error || !idRes.hashtagId) {
          setError(idRes.error ?? 'Could not resolve hashtag id.');
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
      <div className="p-6">
        <EmptyState
          icon={<Hash />}
          title="No project selected"
          description="Pick a project with a connected Instagram account to search hashtags."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/instagram">Instagram</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Hashtag search</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Hashtag search</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Explore top-performing and recent public media for any hashtag.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => runSearch(tag)}
          disabled={loading || !tag}
        >
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Refresh
        </Button>
      </header>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(tag);
        }}
      >
        <Input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="e.g. travel"
          aria-label="Hashtag"
          className="max-w-md"
        />
        <Button type="submit" disabled={loading}>
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
        {hashtagId ? (
          <Badge variant="outline">id · {hashtagId}</Badge>
        ) : null}
      </form>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Search failed</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="aspect-square w-full" />
        </div>
      ) : !hashtagId ? (
        <EmptyState
          icon={<Hash />}
          title="Search a hashtag"
          description="Enter a hashtag above to load top and recent media."
        />
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm text-[var(--st-text)]">Top media</h2>
            <MediaGrid items={top} emptyTitle="No top media" />
          </section>
          <section className="mt-4 flex flex-col gap-2">
            <h2 className="text-sm text-[var(--st-text)]">Recent media</h2>
            <MediaGrid items={recent} emptyTitle="No recent media" />
          </section>
        </>
      )}
    </div>
  );
}
