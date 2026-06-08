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
} from '@/components/sabcrm/20ui';
import { useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { getInstagramMediaDetails } from '@/app/actions/instagram.actions';

import { ArrowLeft, ExternalLink, Heart, ImageOff, MessageSquare } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { InstagramViewCommentsDialog } from '@/components/20ui-domain/instagram-view-comments-dialog';

const tabular = { fontVariantNumeric: 'tabular-nums' } as const;

function DetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 pt-6 pb-10">
      <Skeleton className="h-8 w-32" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="aspect-square w-full" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export default function MediaDetailsPage() {
  const params = useParams();
  const mediaId = params.mediaId as string;
  const [media, setMedia] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [viewingComments, setViewingComments] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  const fetchData = () => {
    if (!projectId || !mediaId) return;
    startTransition(async () => {
      const result = await getInstagramMediaDetails(projectId, mediaId);
      if (result.error) setError(result.error);
      else {
        setError(null);
        setMedia(result.media);
      }
    });
  };

  useEffect(() => {
    setProjectId(localStorage.getItem('activeProjectId'));
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, mediaId]);

  if (isLoading || (!media && !error)) {
    return <DetailSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 pt-6 pb-10">
        <Button asChild variant="ghost" className="-ml-2 self-start">
          <Link href="/dashboard/instagram/feed">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to feed
          </Link>
        </Button>
        <Alert tone="danger" title="Could not load this post">
          {error}
        </Alert>
      </div>
    );
  }

  if (!media) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 pt-6 pb-10">
        <Card variant="outlined">
          <EmptyState icon={ImageOff} title="Post not found" description="This post may have been removed." />
        </Card>
      </div>
    );
  }

  return (
    <>
      {projectId ? (
        <InstagramViewCommentsDialog
          isOpen={viewingComments}
          onOpenChange={setViewingComments}
          media={media}
          projectId={projectId}
          onActionComplete={fetchData}
        />
      ) : null}

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 pt-6 pb-10">
        <PageHeader>
          <PageHeaderHeading>
            <PageDescription>Instagram · Post</PageDescription>
            <PageTitle>Post details</PageTitle>
            <PageDescription>{format(new Date(media.timestamp), 'PPP p')}</PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button asChild variant="ghost">
              <Link href="/dashboard/instagram/feed">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to feed
              </Link>
            </Button>
          </PageActions>
        </PageHeader>

        <Card variant="elevated" padding="none" className="overflow-hidden">
          <div className="grid gap-0 md:grid-cols-2">
            <div className="relative aspect-square bg-[var(--st-bg-muted)]">
              <Image
                src={media.media_url}
                alt={media.caption || 'Instagram post'}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col gap-4 p-6">
              <p className="flex-1 text-sm text-[var(--st-text)]">
                {media.caption || (
                  <span className="text-[var(--st-text-secondary)]">No caption for this post.</span>
                )}
              </p>

              <div className="flex flex-wrap gap-2" style={tabular}>
                <Badge tone="neutral">
                  <Heart className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                  {media.like_count ?? 0} likes
                </Badge>
                <Badge tone="neutral">
                  <MessageSquare className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                  {media.comments_count ?? 0} comments
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button iconLeft={MessageSquare} onClick={() => setViewingComments(true)}>
                  View comments
                </Button>
                <Button asChild variant="outline">
                  <a href={media.permalink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Open on Instagram
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
