'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import { AlertCircle, FolderX, LinkIcon, Receipt, KeyRound } from 'lucide-react';
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

  useEffect(() => {
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
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
    <div className="space-y-6">
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
              <li key={txn.id} className="flex items-center justify-between gap-3 px-1 py-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12.5px] text-zinc-900">{txn.id}</p>
                  <p className="mt-0.5 text-[11.5px] text-zinc-500">
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
              <li key={link.id} className="flex items-center justify-between gap-3 px-1 py-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12.5px] text-zinc-900">{link.id}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-zinc-500">
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
        <div className="space-y-6">
          <Section title="Razorpay credentials" description="Connect your live or test keys.">
            <RazorpaySettingsForm project={project} />
          </Section>

          {project.razorpaySettings?.keyId && project.razorpaySettings?.keySecret && (
            <RazorpayLogs projectId={project._id.toString()} />
          )}
        </div>
      )}
    </WaPage>
  );
}
