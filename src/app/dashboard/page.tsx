'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { WithId } from 'mongodb';
import {
  ArrowRight,
  Bot,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Folder,
  Globe,
  MessagesSquare,
  PlusCircle,
  Search,
  Smartphone,
  Sparkles,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { ProjectCard } from '@/components/wabasimplify/project-card';
import { SeoProjectCard } from '@/components/wabasimplify/seo-project-card';
import { ProjectSearch } from '@/components/wabasimplify/project-search';
import { SyncProjectsDialog } from '@/components/wabasimplify/sync-projects-dialog';
import type { Project } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

import {
  SabButton,
  SabCard,
  SabCardBody,
  SabChip,
  SabPageHeader,
  SabPageShell,
  SabSelect,
  SabSelectContent,
  SabSelectItem,
  SabSelectTrigger,
  SabSelectValue,
} from '@/components/sab-ui';

/* ------------------------------------------------------------------ */
/*  Empty-state content                                                */
/* ------------------------------------------------------------------ */

const FEATURES: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: 'primary' | 'success' | 'info' | 'warning' | 'danger';
}[] = [
  {
    icon: MessagesSquare,
    title: 'WaChat',
    description: 'Send broadcasts, manage live chats and auto-reply to customers.',
    tone: 'success',
  },
  {
    icon: Workflow,
    title: 'SabFlow',
    description: 'No-code automation flows — drip sequences, triggers and smart responses.',
    tone: 'primary',
  },
  {
    icon: Briefcase,
    title: 'CRM',
    description: 'Leads, deals, contacts, invoices and your full sales pipeline.',
    tone: 'warning',
  },
  {
    icon: Bot,
    title: 'SabChat',
    description: 'AI-powered website chat widget to capture and convert visitors.',
    tone: 'primary',
  },
  {
    icon: Smartphone,
    title: 'SMS',
    description: 'Reach customers via SMS campaigns with delivery tracking.',
    tone: 'info',
  },
  {
    icon: Globe,
    title: 'SEO Suite',
    description: 'Audit sites, track rankings and submit pages to Google instantly.',
    tone: 'info',
  },
];

const STEPS = [
  { step: '01', title: 'Connect', description: 'Link your WhatsApp Business account in one click.' },
  { step: '02', title: 'Import', description: 'Upload a CSV or sync contacts directly from WhatsApp.' },
  { step: '03', title: 'Launch', description: 'Pick a template, select your audience, hit send.' },
];

function toneSoft(tone: 'primary' | 'success' | 'info' | 'warning' | 'danger'): string {
  const map = {
    primary: 'hsl(var(--sab-primary-soft))',
    success: 'hsl(var(--sab-success-soft))',
    info: 'hsl(var(--sab-info-soft))',
    warning: 'hsl(var(--sab-warning-soft))',
    danger: 'hsl(var(--sab-danger-soft))',
  };
  return map[tone];
}

function toneColor(tone: 'primary' | 'success' | 'info' | 'warning' | 'danger'): string {
  const map = {
    primary: 'hsl(var(--sab-primary))',
    success: 'hsl(var(--sab-success))',
    info: 'hsl(var(--sab-info))',
    warning: 'hsl(var(--sab-warning))',
    danger: 'hsl(var(--sab-danger))',
  };
  return map[tone];
}

function EmptyState({ query, reloadProjects }: { query: string; reloadProjects: () => Promise<void> }) {
  if (query) {
    return (
      <SabCard variant="featured">
        <SabCardBody>
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-[18px]"
              style={{
                background: 'var(--sab-gradient-primary-soft)',
                color: 'hsl(var(--sab-primary))',
              }}
            >
              <Search className="h-7 w-7" strokeWidth={2} />
            </span>
            <div className="flex flex-col gap-1.5">
              <h3
                className="text-[20px] font-semibold tracking-[-0.01em]"
                style={{ color: 'hsl(var(--sab-fg))' }}
              >
                No projects matched
              </h3>
              <p
                className="max-w-sm text-[14px]"
                style={{ color: 'hsl(var(--sab-fg-muted))' }}
              >
                Try a different search term or clear the filter to see all your projects.
              </p>
            </div>
          </div>
        </SabCardBody>
      </SabCard>
    );
  }

  return (
    <SabCard variant="hero" glow="primary">
      <div className="relative overflow-hidden">
        {/* Decorative gradient mesh inside the empty-state card */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: 'var(--sab-mesh-light)', opacity: 0.8 }}
        />

        <div className="relative flex flex-col gap-14 px-6 py-14 md:px-12 md:py-20">
          {/* Hero */}
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            {/* Animated icon cluster */}
            <div className="relative flex h-28 w-28 items-center justify-center">
              <div
                className="absolute inset-0 rounded-[28px] blur-2xl opacity-60"
                style={{ background: 'var(--sab-gradient-primary)' }}
              />
              <div
                className="relative flex h-24 w-24 items-center justify-center rounded-[24px]"
                style={{
                  background: 'var(--sab-gradient-primary)',
                  boxShadow: 'var(--sab-glow-primary)',
                }}
              >
                <Sparkles className="h-11 w-11 text-white" strokeWidth={2} />
              </div>
              <div
                className="absolute -right-2 -top-2 h-5 w-5 rounded-full"
                style={{ background: 'hsl(var(--sab-warning))', boxShadow: '0 4px 12px hsl(var(--sab-warning) / 0.50)' }}
              />
              <div
                className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full"
                style={{ background: 'hsl(var(--sab-info))', boxShadow: '0 4px 12px hsl(var(--sab-info) / 0.50)' }}
              />
              <div
                className="absolute -left-3 top-1/2 h-3 w-3 rounded-full"
                style={{ background: 'hsl(var(--sab-success))' }}
              />
            </div>

            <SabChip variant="primary" size="md">
              <Zap className="h-3 w-3" /> All-in-one business platform
            </SabChip>

            <h2
              className="text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] md:text-[52px]"
              style={{ color: 'hsl(var(--sab-fg))' }}
            >
              Start your{' '}
              <span
                className="sab-gradient-text"
                style={{
                  background: 'var(--sab-gradient-primary)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                journey
              </span>
            </h2>
            <p className="max-w-xl text-[16px] leading-relaxed" style={{ color: 'hsl(var(--sab-fg-muted))' }}>
              Connect your first WhatsApp or Facebook account to unlock the full dashboard —
              messaging, automation, CRM, AI chat and more.
            </p>

            <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
              <Link href="/dashboard/setup">
                <SabButton variant="primary" size="lg" leftIcon={PlusCircle}>
                  Connect your first project
                </SabButton>
              </Link>
              <SyncProjectsDialog onSuccess={reloadProjects} />
            </div>
          </div>

          {/* How it works */}
          <div className="mx-auto w-full max-w-3xl">
            <p
              className="mb-6 text-center text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'hsl(var(--sab-primary))' }}
            >
              How it works
            </p>
            <div className="relative grid gap-4 md:grid-cols-3">
              {/* Connecting gradient line (desktop) */}
              <div
                className="absolute left-[16.6%] right-[16.6%] top-5 hidden h-px md:block"
                style={{ background: 'var(--sab-gradient-primary)' }}
              />
              {STEPS.map((s) => (
                <div key={s.step} className="relative flex flex-col items-center gap-3 text-center">
                  <div
                    className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold"
                    style={{
                      background: 'hsl(var(--sab-surface))',
                      border: '2px solid hsl(var(--sab-primary))',
                      color: 'hsl(var(--sab-primary))',
                      fontFamily: 'var(--sab-font-mono)',
                      boxShadow: '0 4px 12px hsl(var(--sab-primary) / 0.20)',
                    }}
                  >
                    {s.step}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: 'hsl(var(--sab-fg))' }}>
                      {s.title}
                    </p>
                    <p className="mt-1 text-[12.5px]" style={{ color: 'hsl(var(--sab-fg-muted))' }}>
                      {s.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Features grid */}
          <div className="mx-auto w-full max-w-5xl">
            <p
              className="mb-6 text-center text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'hsl(var(--sab-primary))' }}
            >
              Everything you unlock
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="group flex flex-col gap-3 rounded-[14px] border p-4 transition hover:-translate-y-0.5"
                  style={{
                    background: 'hsl(var(--sab-surface))',
                    borderColor: 'hsl(var(--sab-border))',
                    boxShadow: 'var(--sab-shadow-xs)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-[8px]"
                      style={{ background: toneSoft(f.tone), color: toneColor(f.tone) }}
                    >
                      <f.icon className="h-[14px] w-[14px]" strokeWidth={2.25} />
                    </span>
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: toneColor(f.tone) }}
                    />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'hsl(var(--sab-fg))' }}>
                      {f.title}
                    </p>
                    <p
                      className="mt-1 line-clamp-3 text-[11px] leading-relaxed"
                      style={{ color: 'hsl(var(--sab-fg-muted))' }}
                    >
                      {f.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mx-auto max-w-sm text-center">
            <p className="mb-3 text-[13px]" style={{ color: 'hsl(var(--sab-fg-muted))' }}>
              Ready to grow your business?
            </p>
            <Link href="/dashboard/setup">
              <SabButton variant="secondary" size="lg" rightIcon={ArrowRight}>
                Get started — it&rsquo;s free
              </SabButton>
            </Link>
          </div>
        </div>
      </div>
    </SabCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SelectProjectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { projects: allProjects, reloadProjects, isLoadingProject } = useProject();

  const projects = useMemo(() => allProjects.filter((p) => !!p.wabaId), [allProjects]);

  const query = searchParams.get('query') || '';
  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 50;

  const [isClient, setIsClient] = useState(false);
  const [recentProjectIds, setRecentProjectIds] = useState<string[]>([]);

  useEffect(() => {
    setIsClient(true);
    const recent = localStorage.getItem('recentProjects');
    if (recent) {
      try {
        setRecentProjectIds(JSON.parse(recent));
      } catch {}
    }
  }, []);

  const recentProjects = useMemo(
    () =>
      projects.filter((p) => recentProjectIds.includes(p._id.toString())).slice(0, 4),
    [projects, recentProjectIds],
  );

  const filteredProjects = useMemo(() => {
    if (!projects || !Array.isArray(projects)) return [];
    if (!query) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  }, [projects, query]);

  const paginatedProjects = useMemo(() => {
    if (!Array.isArray(filteredProjects)) return [];
    return filteredProjects.slice((page - 1) * limit, page * limit);
  }, [filteredProjects, page, limit]);

  const groupedProjects = useMemo(() => {
    const grouped: { [key: string]: WithId<Project>[] } = {};
    const ungrouped: WithId<Project>[] = [];
    if (!Array.isArray(paginatedProjects)) return { grouped, ungrouped };
    paginatedProjects.forEach((p) => {
      if (p.groupId && p.groupName) {
        if (!grouped[p.groupName]) grouped[p.groupName] = [];
        grouped[p.groupName].push(p);
      } else {
        ungrouped.push(p);
      }
    });
    return { grouped, ungrouped };
  }, [paginatedProjects]);

  const totalPages = Math.ceil((filteredProjects || []).length / limit);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`?${params.toString()}`);
  };

  const handleLimitChange = (newLimit: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('limit', newLimit);
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  if (!isClient) {
    return (
      <SabPageShell>
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-8 w-8 animate-spin rounded-full border-[2px] border-t-transparent"
              style={{ borderColor: 'hsl(var(--sab-primary))', borderTopColor: 'transparent' }}
            />
            <p className="text-[13px]" style={{ color: 'hsl(var(--sab-fg-muted))' }}>
              Loading workspace…
            </p>
          </div>
        </div>
      </SabPageShell>
    );
  }

  const hasProjects = Array.isArray(projects) && projects.length > 0;

  return (
    <SabPageShell>
      <SabPageHeader
        hero
        eyebrow="SabNode · Workspace"
        title="Your projects"
        description="All your connected WhatsApp Business Accounts in one place. Select a project to start working on it."
        actions={
          hasProjects ? (
            <>
              <SyncProjectsDialog onSuccess={reloadProjects} />
              <Link href="/dashboard/setup">
                <SabButton variant="primary" leftIcon={PlusCircle}>
                  Connect new
                </SabButton>
              </Link>
            </>
          ) : null
        }
      />

      {/* Recently accessed */}
      {recentProjects.length > 0 && !query && (
        <div>
          <h2
            className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'hsl(var(--sab-primary))' }}
          >
            <Clock className="h-3.5 w-3.5" /> Recently accessed
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {recentProjects.map((p) => (
              <ProjectCard key={p._id.toString()} project={p} />
            ))}
          </div>
        </div>
      )}

      {/* Search + filter toolbar */}
      {hasProjects && (
        <SabCard>
          <SabCardBody>
            <div className="flex flex-col items-end gap-4 md:flex-row md:justify-between">
              <div className="flex w-full max-w-lg flex-col gap-1.5 md:w-auto md:flex-1">
                <label
                  className="ml-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: 'hsl(var(--sab-primary))' }}
                >
                  Find project
                </label>
                <div className="flex gap-2">
                  <div
                    className="relative flex-1 rounded-[10px] border"
                    style={{
                      background: 'hsl(var(--sab-surface))',
                      borderColor: 'hsl(var(--sab-border))',
                    }}
                  >
                    <Search
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: 'hsl(var(--sab-fg-subtle))' }}
                    />
                    <ProjectSearch
                      placeholder="Search by name, ID…"
                      className="h-10 w-full border-0 bg-transparent pl-9"
                    />
                  </div>
                  <SabButton variant="secondary" leftIcon={Filter}>
                    Filter
                  </SabButton>
                </div>
              </div>
            </div>
          </SabCardBody>
        </SabCard>
      )}

      {/* Project grid / empty state */}
      {isLoadingProject ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-[14px]"
              style={{
                background: 'hsl(var(--sab-bg-subtle))',
                border: '1px solid hsl(var(--sab-border))',
              }}
            />
          ))}
        </div>
      ) : hasProjects ? (
        <div className="flex flex-col gap-8">
          {groupedProjects.ungrouped.length > 0 && (
            <div>
              {Object.keys(groupedProjects.grouped).length > 0 && (
                <h2
                  className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: 'hsl(var(--sab-primary))' }}
                >
                  <Briefcase className="h-3.5 w-3.5" /> All projects
                </h2>
              )}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {groupedProjects.ungrouped.map((project) =>
                  project.wabaId ? (
                    <ProjectCard key={project._id.toString()} project={project} />
                  ) : (
                    <SeoProjectCard key={project._id.toString()} project={project} />
                  ),
                )}
              </div>
            </div>
          )}

          {Object.entries(groupedProjects.grouped).map(([groupName, groupProjects]) => (
            <SabCard key={groupName} variant="featured">
              <SabCardBody>
                <h2
                  className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: 'hsl(var(--sab-primary))' }}
                >
                  <Folder className="h-3.5 w-3.5" />
                  {groupName}
                  <SabChip variant="primary" size="sm">
                    {groupProjects.length}
                  </SabChip>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {groupProjects.map((project) =>
                    project.wabaId ? (
                      <ProjectCard key={project._id.toString()} project={project} />
                    ) : (
                      <SeoProjectCard key={project._id.toString()} project={project} />
                    ),
                  )}
                </div>
              </SabCardBody>
            </SabCard>
          ))}
        </div>
      ) : (
        <EmptyState query={query} reloadProjects={reloadProjects} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between pt-6"
          style={{ borderTop: '1px solid hsl(var(--sab-border))' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[12.5px]" style={{ color: 'hsl(var(--sab-fg-muted))' }}>
              Rows per page
            </span>
            <div className="w-20">
              <SabSelect value={String(limit)} onValueChange={handleLimitChange}>
                <SabSelectTrigger size="sm">
                  <SabSelectValue />
                </SabSelectTrigger>
                <SabSelectContent>
                  {['10', '25', '50', '100'].map((v) => (
                    <SabSelectItem key={v} value={v}>
                      {v}
                    </SabSelectItem>
                  ))}
                </SabSelectContent>
              </SabSelect>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[12.5px] tabular-nums"
              style={{
                color: 'hsl(var(--sab-fg-muted))',
                fontFamily: 'var(--sab-font-mono)',
              }}
            >
              Page {page} of {totalPages}
            </span>
            <SabButton
              variant="secondary"
              size="sm"
              leftIcon={ChevronLeft}
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
            >
              Prev
            </SabButton>
            <SabButton
              variant="secondary"
              size="sm"
              rightIcon={ChevronRight}
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </SabButton>
          </div>
        </div>
      )}
    </SabPageShell>
  );
}
