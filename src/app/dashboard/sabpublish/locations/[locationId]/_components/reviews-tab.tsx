'use client';

import * as React from 'react';
import { Send, Star } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Textarea,
} from '@/components/sabcrm/20ui';
import { replySabpublishReview } from '@/app/actions/sabpublish.actions';
import type { SabpublishReviewDoc } from '@/lib/rust-client/sabpublish-reviews';

function Stars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${full} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          aria-hidden="true"
          className={
            i < full
              ? 'fill-[var(--st-warn)] text-[var(--st-warn)]'
              : 'text-[var(--st-border)]'
          }
        />
      ))}
    </span>
  );
}

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
      setItems((prev) => prev.map((r) => (r._id === id ? res.data : r)));
      setDraftBy((d) => ({ ...d, [id]: '' }));
    }
    setPendingId(null);
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardBody className="p-6">
          <EmptyState
            icon={Star}
            title="No reviews yet"
            description="Connect a provider that supports reviews to start collecting customer feedback here."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <ul className="flex list-none flex-col gap-3 p-0">
      {items.map((r) => (
        <li key={r._id}>
          <Card>
            <CardBody className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    {r.reviewerName ?? 'Anonymous'}
                    <Stars rating={r.rating} />
                  </div>
                  <div className="text-xs text-[var(--st-text-secondary)] tabular-nums">
                    {r.providerId} · {new Date(r.postedAt).toLocaleString()}
                  </div>
                </div>
                <Badge tone={r.replyBody ? 'success' : 'warning'}>
                  {r.replyBody ? 'Replied' : 'Unreplied'}
                </Badge>
              </div>
              {r.body ? (
                <p className="text-sm text-[var(--st-text)]">{r.body}</p>
              ) : null}
              {r.replyBody ? (
                <div className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-[var(--st-text-secondary)]">
                    Your reply
                  </div>
                  <div>{r.replyBody}</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    rows={2}
                    placeholder="Write a public reply"
                    value={draftBy[r._id] ?? ''}
                    onChange={(e) =>
                      setDraftBy((d) => ({ ...d, [r._id]: e.target.value }))
                    }
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    iconLeft={Send}
                    onClick={() => handleReply(r._id)}
                    loading={pendingId === r._id}
                    disabled={!(draftBy[r._id] ?? '').trim()}
                  >
                    Reply
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        </li>
      ))}
    </ul>
  );
}
