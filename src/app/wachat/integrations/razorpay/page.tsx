'use client';

import * as React from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FolderX,
  Gauge,
  KeyRound,
  LinkIcon,
  Receipt,
  RefreshCw,
  Send,
  Webhook,
} from 'lucide-react';
import type { WithId } from 'mongodb';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
} from '@/components/zoruui';
import { formatUTC, fmtINR } from '@/lib/utils';
import { getProjectById } from '@/app/actions/project.actions';
import { getRazorpayLogs } from '@/app/actions/integrations.actions';
import type { Project } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { RazorpaySettingsForm } from '@/components/zoruui-domain/razorpay-settings-form';

import {
  WaPage,
  PageHeader,
  Section,
  EmptyState,
  StatusPill,
  WaButton,
  MetricTile,
  type StatusTone,
} from '@/components/wachat-ui';

function txnTone(status?: string): StatusTone {
  const s = (status ?? '').toLowerCase();
  if (s === 'captured' || s === 'paid') return 'sent';
  if (s === 'failed') return 'failed';
  if (s === 'created' || s === 'pending') return 'queued';
  return 'draft';
}

function RazorpayLogs({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<{ paymentLinks: any[]; transactions: any[] } | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const reload = React.useCallback(() => {
    startLoading(async () => {
      try {
        const data = await getRazorpayLogs(projectId);
        if (data.error) setError(data.error);
        else
          setLogs({
            paymentLinks: data.paymentLinks || [],
            transactions: data.transactions || [],
          });
      } catch (e: any) {
        setError(e.message || 'Failed to load logs');
      }
    });
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  // Aggregate KPIs from the txn list.
  const kpis = useMemo(() => {
    const txns = logs?.transactions ?? [];
    const captured = txns.filter((t) => ['captured', 'paid'].includes((t.status || '').toLowerCase()));
    const failed = txns.filter((t) => (t.status || '').toLowerCase() === 'failed');
    const totalVolumePaise = captured.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const successRate = txns.length === 0 ? 0 : Math.round((captured.length / txns.length) * 100);
    const lastTxn = txns[0];
    return {
      totalVolume: totalVolumePaise / 100,
      captured: captured.length,
      failed: failed.length,
      links: (logs?.paymentLinks ?? []).length,
      successRate,
      lastTxnAt: lastTxn?.created_at ? formatUTC(lastTxn.created_at * 1000, true) : 'No transactions yet',
    };
  }, [logs]);

  if (isLoading && !logs) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-24 rounded-2xl border border-zinc-200 bg-white animate-pulse" />
        <div className="h-48 rounded-2xl border border-zinc-200 bg-white animate-pulse" />
        <div className="h-48 rounded-2xl border border-zinc-200 bg-white animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertCircle className="h-4 w-4" />
        <ZoruAlertTitle>Error loading logs</ZoruAlertTitle>
        <ZoruAlertDescription>{error}</ZoruAlertDescription>
      </Alert>
    );
  }

  if (!logs) return null;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Total volume" value={fmtINR(kpis.totalVolume)} icon={Receipt} delay={0.02} />
        <MetricTile label="Captured" value={kpis.captured} icon={CheckCircle2} delay={0.04} />
        <MetricTile label="Failed" value={kpis.failed} icon={AlertCircle} delay={0.06} />
        <MetricTile label="Payment links" value={kpis.links} icon={LinkIcon} delay={0.08} />
        <MetricTile label="Success rate" value={<span className="text-[15px]">{kpis.successRate}%</span>} icon={Gauge} delay={0.1} />
        <MetricTile label="Last activity" value={<span className="text-[12px]">{kpis.lastTxnAt}</span>} icon={Send} delay={0.12} />
      </section>

      <Section
        title="Webhook delivery"
        description="Status of the Razorpay webhook subscription used to record captures and refunds."
        action={
          <WaButton size="sm" variant="outline" leftIcon={RefreshCw} onClick={reload} disabled={isLoading}>
            {isLoading ? 'Refreshing' : 'Refresh'}
          </WaButton>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: 'var(--mt-accent-soft)' }}>
            <Webhook className="h-4 w-4" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} />
          </span>
          <div className="flex-1 min-w-[200px]">
            <p className="text-[12.5px] font-semibold text-zinc-950">payment.captured · payment.failed · payment_link.paid</p>
            <p className="mt-0.5 font-mono text-[11px] text-zinc-500">/api/webhooks/razorpay</p>
          </div>
          <StatusPill tone={kpis.captured + kpis.failed > 0 ? 'sent' : 'queued'}>
            {kpis.captured + kpis.failed > 0 ? 'Receiving' : 'Waiting for first event'}
          </StatusPill>
        </div>
      </Section>

      <Section title="Recent transactions" description="Most recent captures and refunds.">
        {logs.transactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            description="No transactions have been processed through WhatsApp yet."
          />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {logs.transactions.map((txn) => (
              <li key={txn.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12.5px] text-zinc-900">{txn.id}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {txn.method || 'unknown method'} · {formatUTC(txn.created_at * 1000, true)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px] tabular-nums text-zinc-950">{fmtINR(txn.amount / 100)}</span>
                  <StatusPill tone={txnTone(txn.status)}>{txn.status}</StatusPill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Payment links" description="Links you have sent through WhatsApp.">
        {logs.paymentLinks.length === 0 ? (
          <EmptyState
            icon={LinkIcon}
            title="No payment links"
            description="You haven't generated any payment links yet."
          />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {logs.paymentLinks.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12.5px] text-zinc-900">{link.id}</p>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                    {link.description || 'no description'} · {formatUTC(link.created_at * 1000, true)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px] tabular-nums text-zinc-950">{fmtINR(link.amount / 100)}</span>
                  <StatusPill tone={txnTone(link.status)}>{link.status}</StatusPill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default function RazorpayIntegrationPage() {
  const { activeProject } = useProject();
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    const id = activeProject?._id?.toString();
    if (id) {
      startLoading(async () => {
        const data = await getProjectById(id);
        setProject(data);
      });
    }
  }, [activeProject]);

  const isConnected = !!(project?.razorpaySettings?.keyId && project?.razorpaySettings?.keySecret);

  return (
    <WaPage>
      <PageHeader
        title="Razorpay"
        description="Accept WhatsApp payments by connecting your Razorpay keys."
        kicker="Wachat · integrations"
        backHref="/wachat/integrations"
        eyebrowIcon={KeyRound}
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      ) : !project ? (
        <EmptyState
          icon={FolderX}
          title="No project selected"
          description="Pick a project from the Wachat home page to view and manage Razorpay settings."
        />
      ) : (
        <div className="space-y-4">
          {/* Connection summary card — derived purely from project state. */}
          <Section padded={false}>
            <div className="flex flex-wrap items-center gap-3 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://cdn.simpleicons.org/razorpay/0c4a6e" alt="" aria-hidden className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-[200px]">
                <p className="text-[14px] font-semibold tracking-tight text-zinc-950">
                  {project.name}
                </p>
                <p className="mt-0.5 font-mono text-[11.5px] text-zinc-500">
                  {isConnected ? `key_id ${project.razorpaySettings?.keyId?.slice(0, 10)}…` : 'Awaiting credentials'}
                </p>
              </div>
              <StatusPill tone={isConnected ? 'sent' : 'queued'}>
                {isConnected ? 'Connected' : 'Not connected'}
              </StatusPill>
            </div>
          </Section>

          <Section title="Razorpay credentials" description="Connect your live or test keys.">
            <RazorpaySettingsForm project={project} />
          </Section>

          {isConnected && <RazorpayLogs projectId={project._id.toString()} />}
        </div>
      )}
    </WaPage>
  );
}
