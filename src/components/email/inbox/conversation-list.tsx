'use client';

import * as React from 'react';
import { Loader2, Search, Star } from 'lucide-react';

import {
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruBadge,
  ZoruInput,
  ZoruScrollArea,
  cn,
} from '@/components/zoruui';
import type { EmailInboxThreadDoc } from '@/app/actions/email/inbox.actions';

export interface ConversationListProps {
  threads: EmailInboxThreadDoc[];
  selectedId: string | null;
  onSelect: (thread: EmailInboxThreadDoc) => void;
  query: string;
  onQueryChange: (q: string) => void;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  total: number;
}

function relTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function initialsFor(t: EmailInboxThreadDoc): string {
  const first = t.participants?.[0];
  const src = first?.name || first?.email || '?';
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase() || '?';
}

const STATUS_TONE: Record<
  EmailInboxThreadDoc['status'],
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  open: { label: 'Open', variant: 'default' },
  pending: { label: 'Pending', variant: 'secondary' },
  closed: { label: 'Closed', variant: 'outline' },
  archived: { label: 'Archived', variant: 'outline' },
};

export function ConversationList({
  threads,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  total,
}: ConversationListProps) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (!hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !loadingMore && !loading) {
            onLoadMore();
          }
        }
      },
      { root: null, rootMargin: '120px', threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loading, onLoadMore]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-zoru-surface">
      <div className="flex items-center gap-2 border-b border-zoru-line p-3">
        <ZoruInput
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          leadingSlot={<Search />}
          placeholder="Search conversations…"
        />
      </div>
      <div className="border-b border-zoru-line px-4 py-1.5 text-[11px] uppercase tracking-wide text-zoru-ink-muted">
        {loading ? 'Loading…' : `${total} conversation${total === 1 ? '' : 's'}`}
      </div>
      <ZoruScrollArea className="min-h-0 flex-1">
        {loading && threads.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-zoru-ink-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading conversations…
          </div>
        ) : threads.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1 text-center text-sm text-zoru-ink-muted">
            <div className="font-medium text-zoru-ink">No conversations</div>
            <div className="text-xs">Try a different filter or search.</div>
          </div>
        ) : (
          <ul className="divide-y divide-zoru-line">
            {threads.map((t) => {
              const selected = t._id === selectedId;
              const tone = STATUS_TONE[t.status];
              const fromName =
                t.participants?.[0]?.name ||
                t.participants?.[0]?.email ||
                '(unknown sender)';
              return (
                <li key={t._id}>
                  <button
                    type="button"
                    onClick={() => onSelect(t)}
                    className={cn(
                      'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-zoru-surface-raised focus:bg-zoru-surface-raised focus:outline-none',
                      selected && 'bg-zoru-surface-raised',
                    )}
                  >
                    <ZoruAvatar className="h-9 w-9 shrink-0">
                      <ZoruAvatarFallback className="text-[11px]">
                        {initialsFor(t)}
                      </ZoruAvatarFallback>
                    </ZoruAvatar>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'flex-1 truncate text-sm',
                            t.unread
                              ? 'font-semibold text-zoru-ink'
                              : 'text-zoru-ink',
                          )}
                        >
                          {fromName}
                        </span>
                        <span className="shrink-0 text-[11px] text-zoru-ink-muted">
                          {relTime(t.lastMessageAt)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'truncate text-sm',
                          t.unread
                            ? 'font-medium text-zoru-ink'
                            : 'text-zoru-ink-muted',
                        )}
                      >
                        {t.subject || '(no subject)'}
                      </div>
                      <div className="truncate text-xs text-zoru-ink-muted">
                        {t.lastMessagePreview}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        {t.unread && (
                          <span
                            aria-label="Unread"
                            className="h-1.5 w-1.5 rounded-full bg-zoru-ink"
                          />
                        )}
                        {t.starred && (
                          <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                        )}
                        <ZoruBadge variant={tone.variant} className="text-[10px]">
                          {tone.label}
                        </ZoruBadge>
                        {t.assignedTo && (
                          <ZoruAvatar className="h-4 w-4">
                            <ZoruAvatarFallback className="text-[8px]">
                              {t.assignedTo.slice(-2).toUpperCase()}
                            </ZoruAvatarFallback>
                          </ZoruAvatar>
                        )}
                        {(t.labels ?? []).slice(0, 2).map((l) => (
                          <span
                            key={l}
                            className="rounded-full border border-zoru-line bg-zoru-bg px-1.5 py-px text-[10px] text-zoru-ink-muted"
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex items-center justify-center py-4 text-xs text-zoru-ink-muted"
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading
                more…
              </>
            ) : (
              'Scroll for more'
            )}
          </div>
        )}
      </ZoruScrollArea>
    </div>
  );
}
