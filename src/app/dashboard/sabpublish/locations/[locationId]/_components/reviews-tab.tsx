'use client';

import * as React from 'react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Textarea,
} from '@/components/sabcrm/20ui/compat';
import { replySabpublishReview } from '@/app/actions/sabpublish.actions';
import type { SabpublishReviewDoc } from '@/lib/rust-client/sabpublish-reviews';

export function SabpublishReviewsTab({
  initial,
}: {
  initial: SabpublishReviewDoc[];
}) {
  const [items, setItems] = React.useState(initial);
  const [draftBy, setDraftBy] = React.useState<Record<string, string>>({});
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleReply(id: string) {
    const body = (draftBy[id] ?? '').trim();
    if (!body) return;
    setPendingId(id);
    const res = await replySabpublishReview(id, body);
    if (res.ok) {
      setItems((prev) =>
        prev.map((r) => (r._id === id ? res.data : r)),
      );
      setDraftBy((d) => ({ ...d, [id]: '' }));
    }
    setPendingId(null);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No reviews yet"
        description="Connect a provider that supports reviews to start aggregating customer feedback here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <Card key={r._id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {r.reviewerName ?? 'Anonymous'} · {r.rating}★
                </div>
                <div className="text-xs text-zoru-ink-muted">
                  {r.providerId} · {new Date(r.postedAt).toLocaleString()}
                </div>
              </div>
              <Badge variant={r.replyBody ? 'default' : 'outline'}>
                {r.replyBody ? 'replied' : 'unreplied'}
              </Badge>
            </div>
            {r.body ? <p className="text-sm">{r.body}</p> : null}
            {r.replyBody ? (
              <div className="rounded-md bg-zoru-surface-2 p-3 text-sm">
                <div className="text-xs font-medium uppercase text-zoru-ink-muted">
                  Your reply
                </div>
                <div>{r.replyBody}</div>
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  rows={2}
                  placeholder="Write a public reply…"
                  value={draftBy[r._id] ?? ''}
                  onChange={(e) =>
                    setDraftBy((d) => ({ ...d, [r._id]: e.target.value }))
                  }
                />
                <Button
                  size="sm"
                  onClick={() => handleReply(r._id)}
                  disabled={pendingId === r._id}
                >
                  {pendingId === r._id ? 'Sending…' : 'Reply'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
