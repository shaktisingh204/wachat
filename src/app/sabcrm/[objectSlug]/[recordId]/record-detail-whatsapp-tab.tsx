'use client';

/**
 * RecordDetailWhatsappTab — the "WhatsApp" tab content for
 * `RecordDetailSurface` (`record-detail-surface.tsx`). Kept in a sibling file
 * so the surface diff stays surgical.
 *
 * Reads the record's WhatsApp thread through `getSabcrmWhatsappThread`
 * (record phone → WaChat conversation, see `sabcrm-comms.actions.ts`) and
 * sends free-text session messages through `sendSabcrmWhatsappMessage`,
 * which also logs a `WHATSAPP` activity — surfaced back to the parent via
 * `onActivityLogged` so the Timeline tab updates without a refetch.
 *
 * States: loading spinner → not-connected CTA (no phone on the record, or
 * WaChat not connected → link to /wachat) → chat pane (incoming left /
 * outgoing right bubbles, day separators, timestamps, outbound status) +
 * composer. The thread is refetched after every successful send.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, RefreshCw, SendHorizontal } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui/button';
import { Input } from '@/components/sabcrm/20ui/field';
import { Alert, EmptyState } from '@/components/sabcrm/20ui/feedback';
import { Spinner } from '@/components/sabcrm/20ui/loading';

import {
  getSabcrmWhatsappThread,
  sendSabcrmWhatsappMessage,
} from '@/app/actions/sabcrm-comms.actions';
import type {
  SabcrmWhatsappMessage,
  SabcrmWhatsappThread,
} from '@/app/actions/sabcrm-comms.actions.types';
import type { SabcrmRustActivity } from '@/app/actions/sabcrm-twenty.actions.types';

/* --------------------------------------------------------------- helpers */

/** Day label for separators — "Today", "Yesterday" or a local date. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

/** Group messages into day buckets, preserving order. */
function groupByDay(
  messages: SabcrmWhatsappMessage[],
): Array<{ label: string; items: SabcrmWhatsappMessage[] }> {
  const groups: Array<{ label: string; items: SabcrmWhatsappMessage[] }> = [];
  for (const m of messages) {
    const label = m.at ? dayLabel(m.at) : 'Earlier';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(m);
    else groups.push({ label, items: [m] });
  }
  return groups;
}

/* ----------------------------------------------------------------- styles */

const stackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--st-space-3, 12px)',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--st-space-2, 8px)',
};

const mutedStyle: React.CSSProperties = {
  fontSize: 'var(--st-font-size-xs, 11px)',
  color: 'var(--st-text-tertiary, var(--st-text-secondary, var(--st-text)))',
};

const bubbleBase: React.CSSProperties = {
  maxWidth: '78%',
  padding: 'var(--st-space-2, 8px) var(--st-space-3, 12px)',
  borderRadius: 'var(--st-radius-lg, 12px)',
  fontSize: 'var(--st-font-size, 13px)',
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  color: 'var(--st-text)',
};

const bubbleIn: React.CSSProperties = {
  ...bubbleBase,
  alignSelf: 'flex-start',
  background: 'var(--st-bg-secondary, var(--st-hover, rgba(0, 0, 0, 0.05)))',
  border: '1px solid var(--st-border-light, var(--st-border))',
  borderBottomLeftRadius: 'var(--st-radius-sm, 4px)',
};

const bubbleOut: React.CSSProperties = {
  ...bubbleBase,
  alignSelf: 'flex-end',
  background: 'var(--st-accent-soft, rgba(59, 130, 246, 0.12))',
  border: '1px solid var(--st-border-light, var(--st-border))',
  borderBottomRightRadius: 'var(--st-radius-sm, 4px)',
};

/* ------------------------------------------------------------------- tab */

export interface RecordDetailWhatsappTabProps {
  projectId?: string;
  objectSlug: string;
  recordId: string;
  /** Fired when a send logged a `WHATSAPP` activity (feed the Timeline). */
  onActivityLogged?: (activity: SabcrmRustActivity) => void;
}

export function RecordDetailWhatsappTab({
  projectId,
  objectSlug,
  recordId,
  onActivityLogged,
}: RecordDetailWhatsappTabProps): React.JSX.Element {
  const router = useRouter();

  const [thread, setThread] = React.useState<SabcrmWhatsappThread | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const paneRef = React.useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(
    async (asRefresh: boolean): Promise<void> => {
      if (asRefresh) setRefreshing(true);
      const res = await getSabcrmWhatsappThread(projectId, objectSlug, recordId);
      setThread(res);
      setLoading(false);
      setRefreshing(false);
    },
    [projectId, objectSlug, recordId],
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setThread(null);
    void (async () => {
      const res = await getSabcrmWhatsappThread(projectId, objectSlug, recordId);
      if (cancelled) return;
      setThread(res);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, objectSlug, recordId]);

  // Keep the pane pinned to the newest message.
  React.useEffect(() => {
    const pane = paneRef.current;
    if (pane) pane.scrollTop = pane.scrollHeight;
  }, [thread?.messages]);

  const send = React.useCallback(() => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    void (async () => {
      const res = await sendSabcrmWhatsappMessage(
        projectId,
        objectSlug,
        recordId,
        body,
      );
      if (!res.ok) {
        setSendError(res.error);
        setSending(false);
        return;
      }
      if (res.data.activity) onActivityLogged?.(res.data.activity);
      setText('');
      await load(true); // auto-refresh the thread with the sent message
      setSending(false);
    })();
  }, [text, sending, projectId, objectSlug, recordId, onActivityLogged, load]);

  /* ---- loading ----------------------------------------------------------- */

  if (loading) {
    return (
      <div style={{ ...rowStyle, justifyContent: 'center', minHeight: 120 }}>
        <Spinner aria-label="Loading WhatsApp conversation" />
      </div>
    );
  }

  /* ---- not connected ------------------------------------------------------ */

  if (!thread || !thread.connected) {
    const reason = thread?.reason ?? 'Could not load the WhatsApp conversation.';
    const noPhone = !thread?.phone;
    return (
      <EmptyState
        size="sm"
        icon={MessageCircle}
        title={noPhone ? 'No WhatsApp number' : 'WhatsApp not connected'}
        description={reason}
        action={
          noPhone ? (
            <Button size="sm" variant="secondary" onClick={() => void load(true)}>
              Retry
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => router.push('/wachat')}
            >
              Connect WaChat
            </Button>
          )
        }
      />
    );
  }

  /* ---- chat pane + composer ------------------------------------------------ */

  const groups = groupByDay(thread.messages);

  return (
    <div style={stackStyle}>
      <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
        <span style={mutedStyle}>
          WhatsApp · {thread.phone}
        </span>
        <Button
          size="sm"
          variant="ghost"
          iconLeft={RefreshCw}
          loading={refreshing}
          onClick={() => void load(true)}
          aria-label="Refresh conversation"
        >
          Refresh
        </Button>
      </div>

      {sendError ? (
        <Alert tone="danger" title="Send failed" onClose={() => setSendError(null)}>
          {sendError}
        </Alert>
      ) : null}

      {thread.messages.length === 0 ? (
        <EmptyState
          size="sm"
          icon={MessageCircle}
          title="No messages yet"
          description={`Start the conversation — messages to ${thread.phone} appear here.`}
        />
      ) : (
        <div
          ref={paneRef}
          style={{
            ...stackStyle,
            gap: 'var(--st-space-2, 8px)',
            maxHeight: 420,
            overflowY: 'auto',
            padding: 'var(--st-space-2, 8px)',
            border: '1px solid var(--st-border)',
            borderRadius: 'var(--st-radius-md, 8px)',
          }}
          aria-label="WhatsApp conversation"
        >
          {groups.map((group) => (
            <React.Fragment key={group.label}>
              <div
                style={{
                  ...rowStyle,
                  justifyContent: 'center',
                  margin: 'var(--st-space-1, 4px) 0',
                }}
                aria-hidden="true"
              >
                <span
                  style={{
                    ...mutedStyle,
                    padding: '2px var(--st-space-2, 8px)',
                    border: '1px solid var(--st-border-light, var(--st-border))',
                    borderRadius: 'var(--st-radius-lg, 12px)',
                    background: 'var(--st-bg, transparent)',
                  }}
                >
                  {group.label}
                </span>
              </div>
              {group.items.map((m) => (
                <div key={m.id} style={m.direction === 'out' ? bubbleOut : bubbleIn}>
                  <div>{m.text || `[${m.type}]`}</div>
                  <div
                    style={{
                      ...rowStyle,
                      gap: 'var(--st-space-1, 4px)',
                      justifyContent:
                        m.direction === 'out' ? 'flex-end' : 'flex-start',
                      marginTop: 2,
                    }}
                  >
                    <span style={mutedStyle}>
                      {m.at
                        ? new Date(m.at).toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                    {m.direction === 'out' && m.status ? (
                      <span style={mutedStyle}>· {m.status}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}

      <div style={rowStyle}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message ${thread.phone}…`}
            aria-label="WhatsApp message"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
          />
        </span>
        <Button
          size="sm"
          variant="primary"
          iconLeft={SendHorizontal}
          loading={sending}
          disabled={!text.trim()}
          onClick={send}
        >
          Send
        </Button>
      </div>
    </div>
  );
}

export default RecordDetailWhatsappTab;
