'use client';

/**
 * Direct-link to a specific comment. Useful for "you were mentioned"
 * notifications and email permalinks. Renders the comment plus a button to
 * open the editor scrolled to its anchor range (anchor scroll deferred
 * until TipTap is wired).
 */

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  IconButton,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Spinner,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  getSabwriterComment,
  resolveSabwriterComment,
} from '@/app/actions/sabwriter.actions';
import type { SabwriterCommentDoc } from '@/lib/rust-client/sabwriter-comments';

export default function SabwriterCommentPermalinkPage() {
  const params = useParams<{ docId: string; commentId: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const docId = params?.docId ?? '';
  const commentId = params?.commentId ?? '';
  const [comment, setComment] = React.useState<SabwriterCommentDoc | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [resolving, setResolving] = React.useState(false);

  React.useEffect(() => {
    if (!commentId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const c = await getSabwriterComment(commentId);
        if (!cancelled) setComment(c);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commentId]);

  const docHref = `/sabsign/docs/${docId}`;

  const handleResolve = async () => {
    if (!comment) return;
    setResolving(true);
    try {
      const next = await resolveSabwriterComment(comment._id);
      setComment(next);
      toast.success('Comment resolved');
    } catch {
      toast.error('Could not resolve the comment');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader bordered={false} className="mb-6">
        <div className="flex items-center gap-2">
          <IconButton
            icon={ArrowLeft}
            label="Back to document"
            variant="ghost"
            size="sm"
            onClick={() => router.push(docHref)}
          />
          <PageHeaderHeading>
            <PageTitle className="inline-flex items-center gap-2">
              <MessageCircle className="h-5 w-5" aria-hidden="true" /> Comment
            </PageTitle>
          </PageHeaderHeading>
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
          <Spinner size="sm" label="Loading comment" />
          <span>Loading comment.</span>
        </div>
      ) : !comment ? (
        <EmptyState
          icon={MessageCircle}
          title="Comment not found"
          description="This comment may have been removed or the link is no longer valid."
          action={
            <Button variant="outline" size="sm" onClick={() => router.push(docHref)}>
              Open in editor
            </Button>
          }
        />
      ) : (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge tone="neutral" kind="outline">
                Range {comment.anchor.from}-{comment.anchor.to}
              </Badge>
              {comment.resolved ? (
                <Badge tone="success">Resolved</Badge>
              ) : (
                <Badge tone="neutral">Open</Badge>
              )}
              <span className="text-xs text-[var(--st-text-secondary)] ml-auto">
                {new Date(comment.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-[var(--st-text)] whitespace-pre-wrap">
              {comment.body}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push(docHref)}>
                Open in editor
              </Button>
              {!comment.resolved ? (
                <Button
                  size="sm"
                  variant="primary"
                  loading={resolving}
                  onClick={handleResolve}
                >
                  Resolve
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
