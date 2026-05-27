'use client';

import * as React from 'react';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  CircleAlert,
  Coins,
  Gauge,
  Settings,
  Tag,
  Users,
  Wallet,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { ProjectSettingsForm } from '@/components/zoruui-domain/project-settings-form';
import { WaPage, PageHeader, Section, EmptyState, WaButton, MetricTile, StatusPill } from '@/components/wachat-ui';

function fmtDate(d: Date | string | undefined): string {
  if (!d) return 'Unknown';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return 'Unknown';
  return dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function relTime(d: Date | string | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  const diff = Date.now() - dt.getTime();
  if (Number.isNaN(diff)) return '';
  const days = Math.floor(diff / 86400000);
  if (days >= 365) return `${Math.floor(days / 365)}y ago`;
  if (days >= 30) return `${Math.floor(days / 30)}mo ago`;
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours >= 1) return `${hours}h ago`;
  return 'just now';
}

export default function GeneralSettingsPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

  const meta = useMemo(() => {
    if (!activeProject) return null;
    const p: any = activeProject;
    return {
      created: fmtDate(p.createdAt),
      createdRel: relTime(p.createdAt),
      planName: p.plan?.name || 'Free',
      credits: typeof p.credits === 'number' ? p.credits.toLocaleString() : '0',
      agents: (p.agents || []).length,
      tags: (p.tags || []).length,
      mps: p.messagesPerSecond ?? 80,
      wabaId: p.wabaId || 'Not connected',
      reviewStatus: p.reviewStatus,
      banState: p.banState,
      numbers: (p.phoneNumbers || []).length,
    };
  }, [activeProject]);

  // Synthesized activity log entries — derived purely from fields we already
  // have on the project (no fabricated history).
  const activity = useMemo(() => {
    if (!activeProject) return [] as { label: string; when: string; tone: 'sent' | 'queued' | 'paused' | 'failed' | 'draft' }[];
    const p: any = activeProject;
    const out: { label: string; when: string; tone: 'sent' | 'queued' | 'paused' | 'failed' | 'draft' }[] = [];
    out.push({ label: 'Project created', when: fmtDate(p.createdAt), tone: 'sent' });
    if (p.wabaId) out.push({ label: `WABA linked, id ${String(p.wabaId).slice(-8)}`, when: fmtDate(p.createdAt), tone: 'sent' });
    if (p.plan?.name) out.push({ label: `Plan, ${p.plan.name}`, when: '—', tone: 'queued' });
    if (typeof p.messagesPerSecond === 'number') out.push({ label: `Messages-per-second set, ${p.messagesPerSecond}`, when: '—', tone: 'draft' });
    if (p.razorpaySettings?.keyId) out.push({ label: 'Razorpay credentials saved', when: '—', tone: 'sent' });
    if (p.violationTimestamp) out.push({ label: `Violation flagged, ${p.violationType || 'unspecified'}`, when: fmtDate(p.violationTimestamp), tone: 'failed' });
    if (p.banState && p.banState !== 'UNKNOWN') out.push({ label: `Ban state, ${p.banState}`, when: '—', tone: 'failed' });
    return out.slice(0, 20);
  }, [activeProject]);

  if (isLoadingProject) {
    return (
      <WaPage>
        <PageHeader
          title="General settings"
          description="Project name, WABA ID, tags, and basic configuration."
          kicker="Wachat · settings"
          backHref="/wachat"
          eyebrowIcon={Settings}
        />
        <div className="h-[420px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      </WaPage>
    );
  }

  if (!activeProject) {
    return (
      <WaPage>
        <PageHeader
          title="General settings"
          description="Project name, WABA ID, tags, and basic configuration."
          kicker="Wachat · settings"
          backHref="/wachat"
          eyebrowIcon={Settings}
        />
        <EmptyState
          icon={CircleAlert}
          title="Select a project first"
          description="Pick a project from the Wachat home page to manage its settings."
          action={<WaButton onClick={() => router.push('/wachat')}>Choose a project</WaButton>}
        />
      </WaPage>
    );
  }

  return (
    <WaPage>
      <PageHeader
        title="General settings"
        description="Project name, WABA ID, tags, and basic configuration."
        kicker="Wachat · settings"
        backHref="/wachat"
        eyebrowIcon={Settings}
      />

      {meta && (
        <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricTile label="Created" value={<span className="text-[15px]">{meta.created}</span>} icon={CalendarClock} delay={0.02} />
          <MetricTile label="Plan" value={<span className="text-[15px]">{meta.planName}</span>} icon={Wallet} delay={0.04} />
          <MetricTile label="Credits" value={meta.credits} icon={Coins} delay={0.06} />
          <MetricTile label="Agents" value={meta.agents} icon={Users} delay={0.08} />
          <MetricTile label="Tags" value={meta.tags} icon={Tag} delay={0.1} />
          <MetricTile label="Max msgs/sec" value={meta.mps} icon={Gauge} delay={0.12} />
        </section>
      )}

      <div className="space-y-4">
        <Section title="Project metadata" description="Read-only snapshot of identifiers and review status.">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
              <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">WABA id</dt>
              <dd className="mt-1 font-mono text-[12.5px] text-zinc-900">{meta?.wabaId}</dd>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
              <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Numbers connected</dt>
              <dd className="mt-1 font-mono text-[12.5px] text-zinc-900">{meta?.numbers}</dd>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
              <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Review status</dt>
              <dd className="mt-1">
                {meta?.reviewStatus ? (
                  <StatusPill tone={meta.reviewStatus === 'APPROVED' ? 'sent' : meta.reviewStatus === 'REJECTED' ? 'failed' : 'queued'}>
                    {meta.reviewStatus}
                  </StatusPill>
                ) : (
                  <StatusPill tone="draft">Not reviewed</StatusPill>
                )}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
              <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Ban state</dt>
              <dd className="mt-1">
                {meta?.banState && meta.banState !== 'UNKNOWN' ? (
                  <StatusPill tone="failed">{meta.banState}</StatusPill>
                ) : (
                  <StatusPill tone="sent">Healthy</StatusPill>
                )}
              </dd>
            </div>
          </dl>
        </Section>

        <Section title="Quick edit" description="Update display name, tags, and other project-level fields.">
          <ProjectSettingsForm project={activeProject} />
        </Section>

        <Section title="Recent activity" description="Lifecycle events on this project.">
          {activity.length === 0 ? (
            <p className="px-1 py-2 text-[12.5px] text-zinc-500">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {activity.map((a, i) => (
                <li key={`${a.label}-${i}`} className="flex items-center gap-3 px-1 py-2.5">
                  <StatusPill tone={a.tone}>{a.tone === 'sent' ? 'OK' : a.tone === 'failed' ? 'Alert' : a.tone === 'queued' ? 'Info' : 'Note'}</StatusPill>
                  <span className="flex-1 truncate text-[12.5px] text-zinc-800">{a.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500">{a.when}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </WaPage>
  );
}
