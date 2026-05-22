'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  Skeleton,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { useParams } from 'next/navigation';
import { getInstagramMediaDetails } from '@/app/actions/instagram.actions';

import { AlertCircle, ArrowLeft, ThumbsUp, MessageSquare, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { InstagramViewCommentsDialog } from '@/components/wabasimplify/instagram-view-comments-dialog';

function PageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ZoruSkeleton className="h-8 w-32" />
      <div className="grid md:grid-cols-2 gap-8">
        <ZoruSkeleton className="aspect-square w-full" />
        <div className="space-y-4">
          <ZoruSkeleton className="h-10 w-3/4" />
          <ZoruSkeleton className="h-4 w-1/4" />
          <ZoruSkeleton className="h-24 w-full" />
          <ZoruSkeleton className="h-10 w-1/2" />
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
    if (projectId && mediaId) {
      startTransition(async () => {
        const result = await getInstagramMediaDetails(projectId, mediaId);
        if (result.error) {
          setError(result.error);
        } else {
          setMedia(result.media);
        }
      });
    }
  };

  useEffect(() => {
    const storedProjectId = localStorage.getItem('activeProjectId');
    setProjectId(storedProjectId);
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, mediaId]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <ZoruAlert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <ZoruAlertTitle>Error Loading Media</ZoruAlertTitle>
        <ZoruAlertDescription>{error}</ZoruAlertDescription>
      </ZoruAlert>
    );
  }

  if (!media) {
    return <PageSkeleton />;
  }

  return (
    <>
      <InstagramViewCommentsDialog
        isOpen={viewingComments}
        onOpenChange={setViewingComments}
        media={media}
        projectId={projectId!}
        onActionComplete={fetchData}
      />
      <div className="space-y-6">
        <ZoruButton variant="ghost" asChild>
          <Link href="/dashboard/instagram/feed">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Feed
          </Link>
        </ZoruButton>
        <ZoruCard className="p-0 overflow-hidden">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="relative aspect-square">
              <Image
                src={media.media_url}
                alt={media.caption || 'Instagram Post'}
                fill
                className="object-cover rounded-l-lg"
              />
            </div>
            <div className="p-6 flex flex-col">
              <ZoruCardHeader className="p-0">
                <ZoruCardDescription>
                  {format(new Date(media.timestamp), 'PPP p')}
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="p-0 py-4 flex-grow">
                <p>{media.caption || 'No caption for this post.'}</p>
              </ZoruCardContent>
              <ZoruCardFooter className="p-0 flex flex-col items-start gap-4">
                <div className="flex gap-6 text-lg">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-5 w-5 text-zoru-ink-muted" />
                    <span className="text-zoru-ink">{media.like_count}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-zoru-ink-muted" />
                    <span className="text-zoru-ink">{media.comments_count}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <ZoruButton onClick={() => setViewingComments(true)}>View Comments</ZoruButton>
                  <ZoruButton asChild variant="outline">
                    <a href={media.permalink} target="_blank" rel="noopener noreferrer">
                      View on Instagram
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </ZoruButton>
                </div>
              </ZoruCardFooter>
            </div>
          </div>
        </ZoruCard>
      </div>
    </>
  );
}
