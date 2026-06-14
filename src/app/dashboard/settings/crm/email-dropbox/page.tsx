'use client';

/**
 * SabCRM — BCC-dropbox settings (`/dashboard/settings/crm/email-dropbox`).
 *
 * One copyable per-project inbound address (`crm+<token>@<mail-domain>`) reps
 * can BCC from any mail client so the message auto-logs onto the matching CRM
 * record. Two toggles:
 *
 *   - ENABLED — master switch for the whole dropbox (inbound capture + send
 *     self-logging both respect it).
 *   - AUTO-BCC — when on, record-detail sends silently BCC the dropbox so they
 *     self-log without the rep doing anything.
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; every action
 * independently re-runs the full gate. Degrades to loading / empty / error and
 * never crashes. When no mail domain is configured the address is unavailable —
 * the page surfaces a clear callout instead of a broken address.
 */

import * as React from 'react';
import { Inbox, Copy, Check, RefreshCw } from 'lucide-react';

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
  Skeleton,
  Field,
  Input,
  Switch,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  getDropboxAddressTw,
  setDropboxConfigTw,
  type DropboxStatus,
} from '@/app/actions/sabcrm-dropbox.actions';

export default function EmailDropboxSettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();

  const [status, setStatus] = React.useState<DropboxStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!activeProjectId) return;
    setError(null);
    const res = await getDropboxAddressTw(activeProjectId);
    if (res.ok) setStatus(res.data);
    else setError(res.error);
    setLoading(false);
  }, [activeProjectId]);

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    (async () => {
      await load();
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId, load]);

  const save = React.useCallback(
    async (patch: { enabled?: boolean; autoBcc?: boolean }) => {
      if (!activeProjectId) return;
      setSaving(true);
      setError(null);
      const res = await setDropboxConfigTw(patch, activeProjectId);
      if (res.ok) setStatus(res.data);
      else setError(res.error);
      setSaving(false);
    },
    [activeProjectId],
  );

  const copyAddress = React.useCallback(async () => {
    if (!status?.address) return;
    try {
      await navigator.clipboard.writeText(status.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the address is still selectable in the input */
    }
  }, [status?.address]);

  const busy = loading || isLoadingProject;

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>BCC dropbox</PageTitle>
          <PageDescription>
            A per-project inbound address. BCC it from any mail client and the
            message auto-logs onto the CRM record that owns the other person&apos;s
            email — so correspondence sent outside the CRM still lands on the
            timeline.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="ghost"
            iconLeft={RefreshCw}
            onClick={load}
            disabled={busy || saving}
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

      {!busy && status && !status.enabled && (
        <Alert tone="neutral" className="mb-[var(--st-space-3)]">
          The dropbox is turned off. Inbound capture and send self-logging are
          paused until you enable it below.
        </Alert>
      )}

      {!busy && status && status.enabled && !status.hasDomain && (
        <Alert tone="warning" className="mb-[var(--st-space-3)]">
          No mail domain is configured yet, so the dropbox address is
          unavailable. Add a domain in SabMail (or set{' '}
          <code>SABCRM_DROPBOX_DOMAIN</code>) to start using it.
        </Alert>
      )}

      {/* Address card */}
      <Card className="mb-[var(--st-space-4)] p-[var(--st-space-4)]">
        <div className="mb-[var(--st-space-3)] flex items-center gap-[var(--st-space-2)]">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
            aria-hidden="true"
          >
            <Inbox size={18} />
          </span>
          <span className="flex flex-col">
            <span className="text-[14px] font-semibold text-[var(--st-text)]">
              Your dropbox address
            </span>
            <span className="text-[12px] text-[var(--st-text-secondary)]">
              BCC this address to log email onto a matching record.
            </span>
          </span>
          {status?.enabled && (
            <Badge tone="success" kind="soft" className="ml-auto">
              On
            </Badge>
          )}
        </div>

        {busy ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Field label="Inbound address">
            <div className="flex items-center gap-[var(--st-space-2)]">
              <Input
                readOnly
                value={status?.address || 'No address available yet'}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 font-mono text-[13px]"
                aria-label="BCC dropbox address"
              />
              <Button
                variant="secondary"
                iconLeft={copied ? Check : Copy}
                onClick={copyAddress}
                disabled={!status?.address}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </Field>
        )}
      </Card>

      {/* Toggles */}
      <Card className="p-[var(--st-space-4)]">
        <div className="flex flex-col gap-[var(--st-space-4)]">
          <div className="flex items-start justify-between gap-[var(--st-space-3)]">
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-[var(--st-text)]">
                Enable dropbox
              </span>
              <span className="text-[12px] text-[var(--st-text-secondary)]">
                Master switch. When off, BCC&apos;d mail is ignored and sends
                will not self-log.
              </span>
            </div>
            <Switch
              checked={status?.enabled ?? false}
              onCheckedChange={(v) => save({ enabled: v })}
              disabled={busy || saving || !status}
              aria-label="Enable BCC dropbox"
            />
          </div>

          <div className="flex items-start justify-between gap-[var(--st-space-3)]">
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-[var(--st-text)]">
                Auto-BCC record sends
              </span>
              <span className="text-[12px] text-[var(--st-text-secondary)]">
                Silently BCC the dropbox on email sent from a record, so every
                send self-logs to the timeline.
              </span>
            </div>
            <Switch
              checked={status?.autoBcc ?? false}
              onCheckedChange={(v) => save({ autoBcc: v })}
              disabled={busy || saving || !status || !status.enabled}
              aria-label="Auto-BCC record sends"
            />
          </div>
        </div>
      </Card>
    </>
  );
}
