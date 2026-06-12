'use client';

/**
 * RecordDetailEmailTab — the "Email" tab content for `RecordDetailSurface`
 * (`record-detail-surface.tsx`). Kept in a sibling file so the surface diff
 * stays surgical — the exact pattern `record-detail-whatsapp-tab.tsx` set.
 *
 * Reads the record's email context through `getSabcrmMailContext`
 * (record EMAIL/EMAILS field → SabMail account + merged thread, see
 * `sabcrm-email.actions.ts`) and sends through `sendSabcrmEmail`, which also
 * logs an `EMAIL` activity — surfaced back to the parent via
 * `onActivityLogged` so the Timeline tab updates without a refetch.
 *
 * States: loading spinner → no-email-on-record (Retry) → SabMail-not-
 * connected CTA (→ /dashboard/sabmail) → thread list (subject, direction,
 * snippet, time) + composer (template Select that prefills via
 * `renderSabcrmEmailTemplate`, subject, body). Sends append optimistically
 * and the thread is refetched after every successful send.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, Mail, RefreshCw, SendHorizontal } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui/button';
import { Input, Textarea } from '@/components/sabcrm/20ui/field';
import { Select } from '@/components/sabcrm/20ui/select';
import { Alert, EmptyState } from '@/components/sabcrm/20ui/feedback';
import { Spinner } from '@/components/sabcrm/20ui/loading';

import {
  getSabcrmMailContext,
  renderSabcrmEmailTemplate,
  sendSabcrmEmail,
} from '@/app/actions/sabcrm-email.actions';
import type {
  SabcrmEmailMessage,
  SabcrmMailContext,
} from '@/app/actions/sabcrm-email.actions.types';
import type { SabcrmRustActivity } from '@/app/actions/sabcrm-twenty.actions.types';

/* --------------------------------------------------------------- helpers */

/** Compact local time label — date only when not today. */
function timeLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
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

const threadRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: 'var(--st-space-2, 8px) var(--st-space-3, 12px)',
  borderRadius: 'var(--st-radius-md, 8px)',
  border: '1px solid var(--st-border-light, var(--st-border))',
  background: 'var(--st-bg, transparent)',
};

const subjectStyle: React.CSSProperties = {
  fontSize: 'var(--st-font-size, 13px)',
  fontWeight: 500,
  color: 'var(--st-text)',
  overflowWrap: 'break-word',
};

const snippetStyle: React.CSSProperties = {
  fontSize: 'var(--st-font-size-xs, 11px)',
  color: 'var(--st-text-secondary, var(--st-text))',
  overflowWrap: 'break-word',
};

const directionPillStyle: React.CSSProperties = {
  ...mutedStyle,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '1px var(--st-space-2, 8px)',
  border: '1px solid var(--st-border-light, var(--st-border))',
  borderRadius: 'var(--st-radius-lg, 12px)',
  whiteSpace: 'nowrap',
};

/* ------------------------------------------------------------------- tab */

export interface RecordDetailEmailTabProps {
  projectId?: string;
  objectSlug: string;
  recordId: string;
  /** Fired when a send logged an `EMAIL` activity (feed the Timeline). */
  onActivityLogged?: (activity: SabcrmRustActivity) => void;
}

export function RecordDetailEmailTab({
  projectId,
  objectSlug,
  recordId,
  onActivityLogged,
}: RecordDetailEmailTabProps): React.JSX.Element {
  const router = useRouter();

  const [context, setContext] = React.useState<SabcrmMailContext | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);

  const [templateId, setTemplateId] = React.useState<string | null>(null);
  const [prefilling, setPrefilling] = React.useState(false);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [sending, setSending] = React.useState(false);

  /** Optimistically appended sends, cleared on every successful refetch. */
  const [optimistic, setOptimistic] = React.useState<SabcrmEmailMessage[]>([]);

  const paneRef = React.useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(
    async (asRefresh: boolean): Promise<void> => {
      if (asRefresh) setRefreshing(true);
      const res = await getSabcrmMailContext(projectId, objectSlug, recordId);
      setContext(res);
      setOptimistic([]);
      setLoading(false);
      setRefreshing(false);
    },
    [projectId, objectSlug, recordId],
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setContext(null);
    setOptimistic([]);
    void (async () => {
      const res = await getSabcrmMailContext(projectId, objectSlug, recordId);
      if (cancelled) return;
      setContext(res);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, objectSlug, recordId]);

  const thread = React.useMemo<SabcrmEmailMessage[]>(
    () => [...(context?.thread ?? []), ...optimistic],
    [context?.thread, optimistic],
  );

  // Keep the pane pinned to the newest entry.
  React.useEffect(() => {
    const pane = paneRef.current;
    if (pane) pane.scrollTop = pane.scrollHeight;
  }, [thread]);

  /** Template pick → render against the record and prefill the composer. */
  const pickTemplate = React.useCallback(
    (id: string | null) => {
      setTemplateId(id);
      if (!id) return;
      setPrefilling(true);
      void (async () => {
        const res = await renderSabcrmEmailTemplate(
          projectId,
          objectSlug,
          recordId,
          id,
        );
        if (res.ok) {
          if (res.data.subject !== undefined) setSubject(res.data.subject);
          setBody(res.data.body);
        } else {
          setSendError(res.error);
        }
        setPrefilling(false);
      })();
    },
    [projectId, objectSlug, recordId],
  );

  const canSend = subject.trim().length > 0 && body.trim().length > 0;

  const send = React.useCallback(() => {
    if (!canSend || sending) return;
    setSending(true);
    setSendError(null);
    void (async () => {
      const res = await sendSabcrmEmail(projectId, objectSlug, recordId, {
        subject: subject.trim(),
        body: body.trim(),
        templateId: templateId ?? undefined,
      });
      if (!res.ok) {
        setSendError(res.error);
        setSending(false);
        return;
      }
      if (res.data.activity) onActivityLogged?.(res.data.activity);
      // Optimistic append so the send shows immediately.
      setOptimistic((prev) => [
        ...prev,
        {
          id: `optimistic-${Date.now()}`,
          direction: 'out',
          subject: subject.trim(),
          snippet: body.trim().replace(/\s+/g, ' ').slice(0, 140),
          at: new Date().toISOString(),
          source: 'activity',
        },
      ]);
      setSubject('');
      setBody('');
      setTemplateId(null);
      await load(true); // refetch — replaces the optimistic entry
      setSending(false);
    })();
  }, [
    canSend,
    sending,
    projectId,
    objectSlug,
    recordId,
    subject,
    body,
    templateId,
    onActivityLogged,
    load,
  ]);

  /* ---- loading ----------------------------------------------------------- */

  if (loading) {
    return (
      <div style={{ ...rowStyle, justifyContent: 'center', minHeight: 120 }}>
        <Spinner aria-label="Loading email conversation" />
      </div>
    );
  }

  /* ---- not connected ------------------------------------------------------ */

  if (!context || !context.connected) {
    const reason = context?.reason ?? 'Could not load the email context.';
    const noAddress = !context?.address;
    return (
      <EmptyState
        size="sm"
        icon={Mail}
        title={noAddress ? 'No email address' : 'SabMail not connected'}
        description={reason}
        action={
          noAddress ? (
            <Button size="sm" variant="secondary" onClick={() => void load(true)}>
              Retry
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => router.push('/dashboard/sabmail')}
            >
              Connect SabMail
            </Button>
          )
        }
      />
    );
  }

  /* ---- thread + composer --------------------------------------------------- */

  return (
    <div style={stackStyle}>
      <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
        <span style={mutedStyle}>
          Email · {context.address}
          {context.account ? ` — from ${context.account.email}` : ''}
        </span>
        <Button
          size="sm"
          variant="ghost"
          iconLeft={RefreshCw}
          loading={refreshing}
          onClick={() => void load(true)}
          aria-label="Refresh email thread"
        >
          Refresh
        </Button>
      </div>

      {sendError ? (
        <Alert tone="danger" title="Send failed" onClose={() => setSendError(null)}>
          {sendError}
        </Alert>
      ) : null}

      {thread.length === 0 ? (
        <EmptyState
          size="sm"
          icon={Mail}
          title="No emails yet"
          description={`Start the conversation — emails to ${context.address} appear here.`}
        />
      ) : (
        <div
          ref={paneRef}
          style={{
            ...stackStyle,
            gap: 'var(--st-space-2, 8px)',
            maxHeight: 360,
            overflowY: 'auto',
            padding: 'var(--st-space-2, 8px)',
            border: '1px solid var(--st-border)',
            borderRadius: 'var(--st-radius-md, 8px)',
          }}
          aria-label="Email thread"
        >
          {context.threadSource === 'activities' ? (
            <span style={mutedStyle}>
              Showing the record’s logged email history.
            </span>
          ) : null}
          {thread.map((m) => (
            <div key={m.id} style={threadRowStyle}>
              <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
                <span style={subjectStyle}>{m.subject}</span>
                <span style={directionPillStyle}>
                  {m.direction === 'out' ? (
                    <ArrowUpRight size={11} aria-hidden="true" />
                  ) : (
                    <ArrowDownLeft size={11} aria-hidden="true" />
                  )}
                  {m.direction === 'out' ? 'Sent' : 'Received'}
                </span>
              </div>
              {m.snippet ? <span style={snippetStyle}>{m.snippet}</span> : null}
              <span style={mutedStyle}>{timeLabel(m.at)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ ...stackStyle, gap: 'var(--st-space-2, 8px)' }}>
        {context.templates.length > 0 ? (
          <Select
            size="sm"
            value={templateId}
            onChange={pickTemplate}
            options={context.templates.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Prefill from template…"
            clearable
            disabled={sending || prefilling}
            aria-label="Email template"
          />
        ) : null}
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          aria-label="Email subject"
          disabled={sending || prefilling}
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Write to ${context.address}…`}
          aria-label="Email body"
          rows={4}
          disabled={sending || prefilling}
        />
        <div style={{ ...rowStyle, justifyContent: 'flex-end' }}>
          <Button
            size="sm"
            variant="primary"
            iconLeft={SendHorizontal}
            loading={sending}
            disabled={!canSend}
            onClick={send}
          >
            Send email
          </Button>
        </div>
      </div>
    </div>
  );
}

export default RecordDetailEmailTab;
