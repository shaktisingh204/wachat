'use client';

import {
  Alert,
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
import { useEffect, useMemo, useState, useTransition } from 'react';
import { getInstagramMedia } from '@/app/actions/instagram.actions';

import {
  Eye,
  Heart,
  MessageSquare,
  Newspaper,
  Play,
  Plus,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { InstagramViewCommentsDialog } from '@/components/20ui-domain/instagram-view-comments-dialog';

const tabular = { fontVariantNumeric: 'tabular-nums' } as const;

function FeedSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(8)].map((_, i) => (
        <Card key={i} padding="none" className="overflow-hidden">
          <Skeleton className="aspect-square w-full" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-8 w-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function InstagramFeedPage() {
  const [media, setMedia] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [viewingCommentsFor, setViewingCommentsFor] = useState<any | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const fetchData = () => {
    if (!projectId) return;
    startTransition(async () => {
      const { media: fetchedMedia, error: fetchError } = await getInstagramMedia(projectId);
      if (fetchError) setError(fetchError);
      else {
        setError(null);
        setMedia(fetchedMedia || []);
      }
    });
  };

  useEffect(() => {
    setProjectId(localStorage.getItem('activeProjectId'));
  }, []);

  useEffect(() => {
    if (projectId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const totals = useMemo(
    () =>
      media.reduce(
        (acc, m) => {
          acc.likes += m.like_count || 0;
          acc.comments += m.comments_count || 0;
          return acc;
        },
        { likes: 0, comments: 0 },
      ),
    [media],
  );

  return (
    <>
      {viewingCommentsFor && projectId ? (
        <InstagramViewCommentsDialog
          isOpen={!!viewingCommentsFor}
          onOpenChange={() => setViewingCommentsFor(null)}
          media={viewingCommentsFor}
          projectId={projectId}
          onActionComplete={fetchData}
        />
      ) : null}

      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-6 pt-6 pb-10">
        <PageHeader>
          <PageHeaderHeading>
            <PageDescription>Instagram</PageDescription>
            <PageTitle>
              <span className="inline-flex items-center gap-3">
                <Newspaper className="h-6 w-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
                Content feed
              </span>
            </PageTitle>
            <PageDescription>
              Recent posts from your connected Instagram account, with likes and comments.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="ghost" iconLeft={RefreshCw} loading={isLoading} onClick={fetchData}>
              Refresh
            </Button>
            <Button asChild>
              <Link href="/dashboard/instagram/create-post">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create post
              </Link>
            </Button>
          </PageActions>
        </PageHeader>

        {error ? (
          <Alert tone="danger" title="Could not load the feed">
            {error}
          </Alert>
        ) : null}

        {!error && media.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Posts"
              value={<span style={tabular}>{media.length.toLocaleString()}</span>}
              icon={Newspaper}
              accent="#3b7af5"
            />
            <StatCard
              label="Likes"
              value={<span style={tabular}>{totals.likes.toLocaleString()}</span>}
              icon={Heart}
              accent="#d6249f"
            />
            <StatCard
              label="Comments"
              value={<span style={tabular}>{totals.comments.toLocaleString()}</span>}
              icon={MessageSquare}
              accent="#7c3aed"
            />
          </div>
        ) : null}

        {isLoading && media.length === 0 ? (
          <FeedSkeleton />
        ) : !error && media.length === 0 ? (
          <Card variant="outlined">
            <EmptyState
              icon={Newspaper}
              title="No posts yet"
              description="Once this account publishes, posts will appear here with their engagement."
              action={
                <Button asChild>
                  <Link href="/dashboard/instagram/create-post">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create your first post
                  </Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {media.map((item) => (
              <Card key={item.id} variant="elevated" padding="none" className="flex flex-col overflow-hidden">
                <div className="relative aspect-square bg-[var(--st-bg-muted)]">
                  {item.media_type === 'VIDEO' ? (
                    <>
                      <video src={item.media_url} className="h-full w-full object-cover" controls={false} />
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--st-overlay,rgba(0,0,0,0.6))] px-2 py-0.5 text-[11px] text-white">
                        <Play className="h-3 w-3" aria-hidden="true" /> Video
                      </span>
                    </>
                  ) : (
                    <Image
                      src={item.media_url}
                      alt={item.caption || 'Instagram post'}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="text-xs text-[var(--st-text-secondary)]">
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </p>
                  <p className="line-clamp-2 flex-1 text-sm text-[var(--st-text)]">
                    {item.caption || <span className="text-[var(--st-text-secondary)]">No caption</span>}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3 text-sm text-[var(--st-text-secondary)]">
                      <span className="inline-flex items-center gap-1" style={tabular}>
                        <Heart className="h-4 w-4" aria-hidden="true" /> {item.like_count ?? 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => setViewingCommentsFor(item)}
                        className="inline-flex items-center gap-1 rounded-[var(--st-radius)] px-1 outline-none transition-colors hover:text-[var(--st-text)] focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                        style={tabular}
                      >
                        <MessageSquare className="h-4 w-4" aria-hidden="true" /> {item.comments_count ?? 0}
                      </button>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/dashboard/instagram/media/${item.id}`}>
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        Details
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
