'use client';

/**
 * SabCRM — Email open/click tracking settings
 * (`/dashboard/settings/crm/email-tracking`).
 *
 * A read-mostly status + activity surface (tracking has no per-tenant config
 * to toggle — it is enabled by setting the `SABCRM_TRACK_SECRET` env, which the
 * status card reflects):
 *
 *   - STATUS card — whether tracking is wired (secret configured) plus lifetime
 *     totals: tracked messages, how many were opened, how many clicked.
 *   - RECENT activity — the most recent tracked messages with their per-message
 *     open / click counts and last-event time.
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; every action
 * independently re-runs the full gate. Degrades to loading / empty / error and
 * never crashes when the engine is unreachable.
 */

import * as React from 'react';
import { MailOpen, MousePointerClick, Mail, RefreshCw } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Card,
  Badge,
  Alert,
  EmptyState,
  Skeleton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  getEmailTrackingStatusTw,
  listTrackedMessagesTw,
  type EmailTrackingStatus,
} from '@/app/actions/sabcrm-email-tracking.actions';
import type { EmailTrackMessage } from '@/lib/sabcrm/email-tracking.server';

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function statusTone(s: EmailTrackMessage['status']): 'success' | 'warning' | 'neutral' {
  if (s === 'clicked') return 'success';
  if (s === 'opened') return 'warning';
  return 'neutral';
}

interface StatProps {
  icon: typeof Mail;
  label: string;
  value: number | string;
}

function Stat({ icon: Icon, label, value }: StatProps): React.ReactElement {
  return (
    <Card className="flex items-center gap-[var(--st-space-3)] p-[var(--st-space-4)]">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
        aria-hidden="true"
      >
        <Icon size={18} />
      </span>
      <span className="flex flex-col">
        <span className="text-[20px] font-semibold leading-none text-[var(--st-text)]">
          {value}
        </span>
        <span className="text-[12px] text-[var(--st-text-secondary)]">{label}</span>
      </span>
    </Card>
  );
}

export default function EmailTrackingSettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();

  const [status, setStatus] = React.useState<EmailTrackingStatus | null>(null);
  const [messages, setMessages] = React.useState<EmailTrackMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (showSpinner: boolean) => {
      if (!activeProjectId) return;
      if (showSpinner) setRefreshing(true);
      setError(null);
      const [statusRes, msgRes] = await Promise.all([
        getEmailTrackingStatusTw(activeProjectId),
        listTrackedMessagesTw(activeProjectId, 50),
      ]);
      if (statusRes.ok) setStatus(statusRes.data);
      else setError(statusRes.error);
      if (msgRes.ok) setMessages(msgRes.data);
      else if (statusRes.ok) setError(msgRes.error);
      setLoading(false);
      setRefreshing(false);
    },
    [activeProjectId],
  );

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    (async () => {
      await load(false);
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId, load]);

  const busy = loading || isLoadingProject;

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Email tracking</PageTitle>
          <PageDescription>
            Open and click tracking for outbound CRM email. A 1×1 pixel records
            opens and links are routed through a redirect so clicks land on each
            record&apos;s timeline.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="ghost"
            iconLeft={RefreshCw}
            onClick={() => load(true)}
            disabled={busy || refreshing}
          >
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      {!busy && status && !status.configured && (
        <Alert tone="warning" className="mb-[var(--st-space-3)]">
          Tracking is not wired yet. Set the <code>SABCRM_TRACK_SECRET</code>{' '}
          environment variable to start instrumenting outbound CRM email.
        </Alert>
      )}

      {/* Status / stats */}
      <div className="mb-[var(--st-space-4)] grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-3">
        {busy ? (
          <>
            <Skeleton className="h-[68px] w-full" />
            <Skeleton className="h-[68px] w-full" />
            <Skeleton className="h-[68px] w-full" />
          </>
        ) : (
          <>
            <Stat icon={Mail} label="Tracked messages" value={status?.messages ?? 0} />
            <Stat icon={MailOpen} label="Opened" value={status?.opened ?? 0} />
            <Stat
              icon={MousePointerClick}
              label="Clicked"
              value={status?.clicked ?? 0}
            />
          </>
        )}
      </div>

      {/* Recent activity */}
      <Card className="p-[var(--st-space-4)]">
        <div className="mb-[var(--st-space-3)] flex items-center justify-between gap-[var(--st-space-2)]">
          <span className="text-[14px] font-semibold text-[var(--st-text)]">
            Recent activity
          </span>
          {status?.configured && (
            <Badge tone="success" kind="soft">
              Tracking on
            </Badge>
          )}
        </div>

        {busy ? (
          <div className="flex flex-col gap-[var(--st-space-2)]">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={MailOpen}
            title="No tracked email yet"
            description="When you send email from a CRM record, opens and clicks will show up here."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Recipient</Th>
                <Th>Subject</Th>
                <Th>Status</Th>
                <Th className="text-right">Opens</Th>
                <Th className="text-right">Clicks</Th>
                <Th>Last event</Th>
              </Tr>
            </THead>
            <TBody>
              {messages.map((m) => (
                <Tr key={m.id}>
                  <Td>{m.to || '—'}</Td>
                  <Td>
                    <span className="block max-w-[260px] truncate" title={m.subject}>
                      {m.subject || '—'}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(m.status)} kind="soft">
                      {m.status}
                    </Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{m.openCount}</Td>
                  <Td className="text-right tabular-nums">{m.clickCount}</Td>
                  <Td className="whitespace-nowrap text-[var(--st-text-secondary)]">
                    {fmtTime(m.lastEventAt || m.createdAt)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
