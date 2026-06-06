'use client';

/**
 * Direct-link to a specific comment. Useful for "you were mentioned"
 * notifications and email permalinks. Renders the comment + a button to
 * open the editor scrolled to its anchor range (anchor scroll deferred
 * until TipTap is wired).
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, MessageCircle } from 'lucide-react';

import { Badge, Button, Card, CardBody } from '@/components/sabcrm/20ui';
import {
  getSabwriterComment,
  resolveSabwriterComment,
} from '@/app/actions/sabwriter.actions';
import type { SabwriterCommentDoc } from '@/lib/rust-client/sabwriter-comments';

export default function SabwriterCommentPermalinkPage() {
  const params = useParams<{ docId: string; commentId: string }>();
  const docId = params?.docId ?? '';
  const commentId = params?.commentId ?? '';
  const [comment, setComment] = React.useState<SabwriterCommentDoc | null>(null);
  const [loading, setLoading] = React.useState(true);

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

  const handleResolve = async () => {
    if (!comment) return;
    const next = await resolveSabwriterComment(comment._id);
    setComment(next);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard/sabsign/docs/${docId}`} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-[var(--st-text)] inline-flex items-center gap-2">
          <MessageCircle className="h-5 w-5" /> Comment
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--st-text-secondary)]">Loading…</p>
      ) : !comment ? (
        <p className="text-sm text-[var(--st-text-secondary)]">Comment not found.</p>
      ) : (
        <Card>
          <CardBody className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Range {comment.anchor.from}–{comment.anchor.to}
              </Badge>
              {comment.resolved ? (
                <Badge>Resolved</Badge>
              ) : (
                <Badge variant="secondary">Open</Badge>
              )}
              <span className="text-xs text-[var(--st-text-secondary)] ml-auto">
                {new Date(comment.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-[var(--st-text)] whitespace-pre-wrap">
              {comment.body}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/sabsign/docs/${docId}`}>
                  Open in editor
                </Link>
              </Button>
              {!comment.resolved ? (
                <Button size="sm" onClick={handleResolve}>
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
