'use client';

/**
 * SabCRM — Shared inbox client (`/sabcrm/inbox`), 20ui.
 *
 * One surface that lists recent SabMail messages with the CRM record each one
 * maps to (by from-address) and lets you reply inline without leaving the page:
 *
 *   - each row shows the sender, subject, snippet and time, plus a matched
 *     record chip (object + label) that links to the record, or an "Unmatched"
 *     badge when no record carries that address;
 *   - a "Reply" toggle opens an inline composer that posts through the gated
 *     `quickReplyTw` action — which delegates to the record-detail send path
 *     (platform transport + best-effort SabMail recording + a non-fatal EMAIL
 *     activity on the record). Reply is only offered on MATCHED rows, since the
 *     send re-resolves the recipient from the record;
 *   - a manual Refresh re-runs `getCrmInboxTw` (a live SabMail stream isn't
 *     wired here — the refresh keeps the surface dependency-free and resilient).
 *
 * Data flows down from the server page; the client owns refresh + reply state.
 * Degrades honestly: `connected: false` (no SabMail account) renders a connect
 * CTA; an empty connected inbox renders a quiet empty state. ONLY the
 * `@/components/sabcrm/20ui` barrel is imported (repo rule); the SabCRM layout
 * enforces auth / onboarding / RBAC and every action re-runs the full gate.
 */

import * as React from 'react';
import Link from 'next/link';
import { Inbox, Mail, RefreshCw, Reply, Send, User } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Spinner,
  Textarea,
  TwentyAvatar,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import type { CrmInboxResult } from '@/lib/sabcrm/crm-inbox.server';
import type { CrmInboxRow } from '@/lib/sabcrm/crm-inbox';
import { getCrmInboxTw, quickReplyTw } from '@/app/actions/sabcrm-inbox.actions';

interface InboxClientProps {
  initial: CrmInboxResult;
  initialError: string | null;
}

/** Relative-ish time, falling back to a short date. */
function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Human label for the matched object slug used on the chip. */
function objectLabel(slug: string): string {
  if (!slug) return 'Record';
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/s$/i, '')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function InboxClient({
  initial,
  initialError,
}: InboxClientProps): React.JSX.Element {
  const { activeProjectId } = useProject();
  const { toast } = useToast();

  const [data, setData] = React.useState<CrmInboxResult>(initial);
  const [error, setError] = React.useState<string | null>(initialError);
  const [refreshing, setRefreshing] = React.useState(false);
  const [, startTransition] = React.useTransition();

  const refresh = React.useCallback(() => {
    setRefreshing(true);
    startTransition(async () => {
      const res = await getCrmInboxTw(activeProjectId ?? undefined);
      if (res.ok) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
      setRefreshing(false);
    });
  }, [activeProjectId]);

  const rows = data.rows;

  return (
    <div className="mx-auto w-full max-w-[920px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Inbox</PageTitle>
          <PageDescription>
            Recent SabMail messages mapped to the CRM record they came from.
            Reply inline — it logs onto the record like any other email.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="secondary"
            iconLeft={RefreshCw}
            onClick={refresh}
            loading={refreshing}
            disabled={refreshing}
          >
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      {error ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load the inbox: {error}
          </Alert>
        </div>
      ) : null}

      {!data.connected ? (
        <Card className="my-4">
          <CardBody>
            <EmptyState
              icon={Mail}
              tone="info"
              title="SabMail isn't connected yet"
              description="Create a mail account in SabMail to start seeing inbound messages mapped to your CRM records here."
              action={
                <Button asChild variant="primary">
                  <Link href="/sabmail">
                    <Mail size={16} aria-hidden="true" style={{ marginRight: 6 }} />
                    Open SabMail
                  </Link>
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="my-4">
          <CardBody>
            <EmptyState
              icon={Inbox}
              title="No recent messages"
              description="Nothing has landed across your connected mail accounts yet."
              action={
                <Button variant="secondary" iconLeft={RefreshCw} onClick={refresh}>
                  Refresh
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="my-4 flex flex-col gap-3">
          {rows.map((row) => (
            <InboxRowCard key={row.messageId} row={row} onSent={refresh} />
          ))}
        </div>
      )}

      {refreshing && rows.length > 0 ? (
        <div className="mt-2 flex items-center gap-2 text-[13px] opacity-70">
          <Spinner size="sm" /> Refreshing…
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Row card                                                                  */
/* ------------------------------------------------------------------------ */

function InboxRowCard({
  row,
  onSent,
}: {
  row: CrmInboxRow;
  onSent: () => void;
}): React.JSX.Element {
  const { activeProjectId } = useProject();
  const { toast } = useToast();

  const [replying, setReplying] = React.useState(false);
  const [subject, setSubject] = React.useState(
    row.subject.startsWith('Re:') ? row.subject : `Re: ${row.subject}`,
  );
  const [body, setBody] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const send = React.useCallback(async () => {
    if (!row.match) return;
    if (!subject.trim()) {
      toast.error('A subject is required.');
      return;
    }
    if (!body.trim()) {
      toast.error('The reply body is empty.');
      return;
    }
    setSending(true);
    const res = await quickReplyTw(
      row.match.object,
      row.match.recordId,
      row.from,
      subject.trim(),
      body.trim(),
      activeProjectId ?? undefined,
    );
    setSending(false);
    if (res.ok) {
      toast.success('Reply sent.');
      setReplying(false);
      setBody('');
      onSent();
    } else {
      toast.error(res.error || 'Failed to send the reply.');
    }
  }, [row.match, row.from, subject, body, activeProjectId, toast, onSent]);

  return (
    <Card>
      <CardBody>
        <div className="flex items-start gap-3">
          <TwentyAvatar
            name={row.fromName || row.from || 'Unknown'}
            size="md"
            shape="round"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-medium">
                {row.fromName || row.from || 'Unknown sender'}
              </span>
              {row.unread ? <Badge tone="info">New</Badge> : null}
              <span className="ml-auto shrink-0 text-[12px] opacity-60">
                {formatWhen(row.receivedAt)}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[13px] opacity-70">{row.from}</div>

            <div className="mt-2 text-[14px] font-medium">{row.subject}</div>
            {row.snippet ? (
              <div className="mt-0.5 line-clamp-2 text-[13px] opacity-70">
                {row.snippet}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {row.match ? (
                <Link
                  href={`/sabcrm/${row.match.object}/${row.match.recordId}`}
                  className="inline-flex"
                  aria-label={`Open ${row.match.label}`}
                >
                  <Badge tone="success">
                    <User size={12} aria-hidden="true" style={{ marginRight: 4 }} />
                    {objectLabel(row.match.object)}: {row.match.label}
                  </Badge>
                </Link>
              ) : (
                <Badge tone="neutral">Unmatched</Badge>
              )}

              {row.match ? (
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Reply}
                  onClick={() => setReplying((v) => !v)}
                  aria-expanded={replying}
                >
                  {replying ? 'Cancel' : 'Reply'}
                </Button>
              ) : null}
            </div>

            {replying && row.match ? (
              <div className="mt-3 flex flex-col gap-2 rounded-md border border-[var(--zoru-border,#e5e7eb)] p-3">
                <Field label="Subject">
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject"
                  />
                </Field>
                <Field label="Message">
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={`Reply to ${row.from}…`}
                    rows={4}
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={Send}
                    onClick={send}
                    loading={sending}
                    disabled={sending}
                  >
                    Send reply
                  </Button>
                  <span className="text-[12px] opacity-60">
                    to {row.match.label}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
