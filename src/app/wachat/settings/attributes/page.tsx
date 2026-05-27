'use client';

import * as React from 'react';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Hash, Layers, Tag, Type, ToggleLeft, CalendarDays, ListChecks } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { UserAttributesSettingsTab } from '@/components/zoruui-domain/user-attributes-settings-tab';
import { WaPage, PageHeader, Section, EmptyState, WaButton, MetricTile, StatusPill } from '@/components/wachat-ui';

const TYPE_ICON: Record<string, typeof Type> = {
  text: Type,
  number: Hash,
  boolean: ToggleLeft,
  date: CalendarDays,
  list: ListChecks,
};

export default function AttributesSettingsPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

  const attrs: any[] = (activeProject as any)?.userAttributes || [];

  const kpis = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const a of attrs) {
      const t = (a.type || 'text').toLowerCase();
      byType[t] = (byType[t] || 0) + 1;
    }
    return {
      total: attrs.length,
      required: attrs.filter((a) => a.required).length,
      forSegments: attrs.filter((a) => a.usedInSegments || a.useInSegments).length,
      types: Object.keys(byType).length,
      text: byType['text'] || 0,
      number: byType['number'] || 0,
    };
  }, [attrs]);

  if (isLoadingProject) {
    return (
      <WaPage>
        <PageHeader
          title="User attributes"
          description="Custom contact fields for segmentation and personalization."
          kicker="Wachat · settings"
          backHref="/wachat"
          eyebrowIcon={Tag}
        />
        <div className="h-[420px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      </WaPage>
    );
  }

  if (!activeProject) {
    return (
      <WaPage>
        <PageHeader
          title="User attributes"
          description="Custom contact fields for segmentation and personalization."
          kicker="Wachat · settings"
          backHref="/wachat"
          eyebrowIcon={Tag}
        />
        <EmptyState
          icon={CircleAlert}
          title="Select a project first"
          description="Pick a project from the Wachat home page to manage user attributes."
          action={<WaButton onClick={() => router.push('/wachat')}>Choose a project</WaButton>}
        />
      </WaPage>
    );
  }

  return (
    <WaPage>
      <PageHeader
        title="User attributes"
        description="Custom contact fields for segmentation and personalization."
        kicker="Wachat · settings"
        backHref="/wachat"
        eyebrowIcon={Tag}
      />

      {/* KPI strip */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Defined" value={kpis.total} icon={Layers} delay={0.02} />
        <MetricTile label="Required" value={kpis.required} icon={CircleAlert} delay={0.04} />
        <MetricTile label="Segment-ready" value={kpis.forSegments} icon={ListChecks} delay={0.06} />
        <MetricTile label="Distinct types" value={kpis.types} icon={Tag} delay={0.08} />
        <MetricTile label="Text fields" value={kpis.text} icon={Type} delay={0.1} />
        <MetricTile label="Number fields" value={kpis.number} icon={Hash} delay={0.12} />
      </section>

      {/* Attribute roster — appears above the editor so users get a read-only
          snapshot of every attribute with type and sample value at a glance. */}
      {attrs.length > 0 && (
        <Section
          title="Defined attributes"
          description={`${attrs.length} custom field${attrs.length === 1 ? '' : 's'} on this project.`}
        >
          <ul className="divide-y divide-zinc-100">
            {attrs.map((a) => {
              const Icon = TYPE_ICON[(a.type || 'text').toLowerCase()] || Type;
              const sample =
                a.sample ??
                a.example ??
                (a.options && Array.isArray(a.options) ? a.options.slice(0, 2).join(', ') : null) ??
                (a.type === 'boolean' ? 'true | false' : a.type === 'number' ? '42' : a.type === 'date' ? 'YYYY-MM-DD' : 'string');
              return (
                <li key={a.id || a.name} className="flex items-center gap-3 px-1 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--mt-accent-soft)' }}>
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-zinc-950">{a.name}</p>
                      {a.required && <StatusPill tone="failed">Required</StatusPill>}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[11.5px] text-zinc-500">
                      <span className="text-zinc-400">type</span> {a.type || 'text'} <span className="text-zinc-400">· sample</span> {String(sample)}
                    </p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10.5px] text-zinc-600">
                    {a.type || 'text'}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section
        title={attrs.length > 0 ? 'Manage attributes' : 'Add your first attribute'}
        description="Use these fields anywhere variables are supported, including templates, flows, and segments."
      >
        <UserAttributesSettingsTab project={activeProject} />
      </Section>
    </WaPage>
  );
}
