'use client';

import * as React from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { FolderX, History, Link as LinkIcon, MousePointerClick, QrCode, Send } from 'lucide-react';
import type { WithId } from 'mongodb';

import {
  WaPage,
  PageHeader,
  Section,
  PhoneFrame,
  ChatBubble,
  EmptyState,
  MetricTile,
  StatusPill,
} from '@/components/wachat-ui';
import { getProjectById } from '@/app/actions/project.actions';
import type { Project } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { WhatsappLinkGenerator } from '@/components/zoruui-domain/whatsapp-link-generator';

export default function WhatsappLinkGeneratorPage() {
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

  // Pull saved-link history from project state if present (no fabricated rows).
  const history: any[] = useMemo(() => {
    const p: any = project;
    return p?.linkHistory || p?.wachatLinkHistory || [];
  }, [project]);

  const kpis = useMemo(() => {
    return {
      links: history.length,
      clicks: history.reduce((acc, l) => acc + (Number(l.clicks) || 0), 0),
      scans: history.reduce((acc, l) => acc + (Number(l.qrScans) || 0), 0),
      conversations: history.reduce((acc, l) => acc + (Number(l.conversions) || 0), 0),
    };
  }, [history]);

  return (
    <WaPage>
      <PageHeader
        title="WhatsApp link generator"
        description="Create wa.me links with pre-filled messages and UTM parameters."
        kicker="Wachat · integrations"
        backHref="/wachat/integrations"
        eyebrowIcon={LinkIcon}
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      ) : !project ? (
        <EmptyState
          icon={FolderX}
          title="No project selected"
          description="Pick a project from the Wachat home page to generate links."
        />
      ) : (
        <div className="space-y-4">
          {/* KPI strip */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="Links" value={kpis.links} icon={LinkIcon} delay={0.02} />
            <MetricTile label="Clicks" value={kpis.clicks.toLocaleString()} icon={MousePointerClick} delay={0.04} />
            <MetricTile label="QR scans" value={kpis.scans.toLocaleString()} icon={QrCode} delay={0.06} />
            <MetricTile label="Conversations" value={kpis.conversations.toLocaleString()} icon={Send} delay={0.08} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Section title="Builder" description="Configure the link, message, and tracking.">
              <WhatsappLinkGenerator project={project} />
            </Section>

            <Section title="Preview" description="What the customer sees after they click.">
              <PhoneFrame title={project.name || 'Your business'} subtitle="business account">
                <ChatBubble who="them" text="Hi, found you via the link." time="9:41" delay={0.05} />
                <ChatBubble who="us" text="Hey! Happy to help. What can we do for you today?" time="9:41" delay={0.2} />
                <ChatBubble who="them" text="I need help with pricing." time="9:42" delay={0.4} />
                <ChatBubble who="us" kind="cta" text="Sure thing. Sending the link now." time="9:42" delay={0.55} />
              </PhoneFrame>
            </Section>
          </div>

          <Section
            title="Generated link history"
            description="Every link this project has produced, with click, scan, and conversation counts."
          >
            {history.length === 0 ? (
              <EmptyState
                icon={History}
                title="No links generated yet"
                description="Build one above. Saved links show up here with their click and QR scan counts."
              />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {history.map((row, i) => (
                  <li key={row.id || row.url || i} className="flex items-center gap-3 px-1 py-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--mt-accent-soft)' }}>
                      <LinkIcon className="h-3 w-3" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[12px] text-zinc-900">{row.url || row.shortUrl || '—'}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {row.label || row.note || 'Untitled'} · created {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] tabular-nums text-zinc-600">
                      <span><span className="text-zinc-400">clicks</span> {row.clicks ?? 0}</span>
                      <span><span className="text-zinc-400">scans</span> {row.qrScans ?? 0}</span>
                      <StatusPill tone={(row.conversions ?? 0) > 0 ? 'sent' : 'draft'}>
                        {row.conversions ?? 0} chats
                      </StatusPill>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </WaPage>
  );
}
