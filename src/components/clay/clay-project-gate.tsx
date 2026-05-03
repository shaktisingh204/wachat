'use client';

/**
 * ClayProjectGate — "pick a project first" gate for Wachat routes.
 *
 * Every Wachat page is scoped to a single WhatsApp Business Account.
 * When the user has no `activeProjectId` selected, we intercept the
 * render and show a project picker instead of the page content.
 * Selecting a project updates the project context and the gate falls
 * through to the real page.
 *
 * Routes allowlisted in `OPEN_ROUTES` are allowed to render without
 * a selected project (e.g. /dashboard itself is the list-all-projects
 * page).
 *
 * Note: gate / hook ordering / conditions are preserved exactly as
 * they were before the shadcn restyle. Only the visual chrome was
 * migrated to shadcn `Card` + `Button`.
 */

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LuArrowRight,
  LuCheck,
  LuPlus,
  LuSearch,
  LuMessageSquare,
} from 'react-icons/lu';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import { ClayButton } from './clay-button';
import { ClayInput } from './clay-input';
import { ClayBreadcrumbs } from './clay-breadcrumbs';

/**
 * Routes that are allowed to render without an active project.
 * Anything else under Wachat gets gated.
 */
const OPEN_ROUTES = new Set<string>([
  '/dashboard',
  '/dashboard/',
  '/dashboard/setup',
  '/dashboard/setup/',
  '/dashboard/setup/docs',
]);

export interface ClayProjectGateProps {
  children: React.ReactNode;
}

export function ClayProjectGate({ children }: ClayProjectGateProps) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { projects, activeProjectId, setActiveProjectId, isLoadingProject } =
    useProject();

  const [filter, setFilter] = React.useState('');

  // Routes like /dashboard (the project list) should never be gated.
  if (OPEN_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  // Project already selected — pass through
  if (activeProjectId) {
    return <>{children}</>;
  }

  // Only show WABA projects in the Wachat gate
  const wabaProjects = projects.filter((p) => !!(p as any).wabaId);

  const filteredProjects = filter.trim()
    ? wabaProjects.filter((p) =>
        p.name?.toLowerCase().includes(filter.toLowerCase().trim()),
      )
    : wabaProjects;

  const selectProject = (id: string) => {
    setActiveProjectId(id);
    // Persist immediately — the ProjectProvider reads from localStorage
    // on mount, so seeding the key here keeps the selection after
    // hard refresh.
    try {
      localStorage.setItem('activeProjectId', id);
    } catch {
      /* ignore quota errors */
    }
  };

  return (
    <div>
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: 'Select project' },
        ]}
      />

      <div className="mt-5 flex items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
            Select a project
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Wachat is scoped per WhatsApp Business Account. Pick the
            project you want to work in to continue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ClayButton
            variant="pill"
            size="md"
            onClick={() => router.push('/dashboard')}
          >
            All projects
          </ClayButton>
          <ClayButton
            variant="obsidian"
            size="md"
            leading={<LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            onClick={() => router.push('/dashboard/setup')}
          >
            Connect account
          </ClayButton>
        </div>
      </div>

      {/* Filter */}
      <div className="mt-6 max-w-md">
        <ClayInput
          sizeVariant="md"
          placeholder="Search your projects"
          leading={<LuSearch className="h-3.5 w-3.5" strokeWidth={2} />}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Project grid */}
      {isLoadingProject ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[118px] animate-pulse rounded-[14px] bg-muted"
            />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card variant="default" className="mt-8 p-10 text-center">
          {filter ? (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <LuSearch className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div className="mt-4 text-[15px] font-semibold text-foreground">
                No projects match your search
              </div>
              <div className="mt-1.5 text-[12.5px] text-muted-foreground">
                Try a different name, or clear the filter to see all your projects.
              </div>
              <ClayButton
                variant="pill"
                size="md"
                onClick={() => setFilter('')}
                className="mt-5"
              >
                Clear filter
              </ClayButton>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                <LuMessageSquare className="h-6 w-6 text-emerald-600" strokeWidth={1.75} />
              </div>
              <div className="mt-4 text-[18px] font-semibold text-foreground">
                Connect your WhatsApp Business
              </div>
              <div className="mx-auto mt-1.5 max-w-sm text-[13px] text-muted-foreground leading-relaxed">
                Link your WhatsApp Business Account via Meta to start sending
                broadcasts, managing chats, and building automations.
              </div>
              <div className="mt-5 flex items-center justify-center gap-2.5">
                <ClayButton
                  variant="obsidian"
                  size="md"
                  leading={<LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  onClick={() => router.push('/dashboard/setup')}
                >
                  Connect WhatsApp account
                </ClayButton>
              </div>
              <div className="mx-auto mt-6 grid max-w-lg grid-cols-3 gap-4 text-left">
                <div>
                  <div className="text-[12px] font-semibold text-foreground">1. Click connect</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">Open the Meta guided signup</div>
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-foreground">2. Login to Meta</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">Grant WhatsApp permissions</div>
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-foreground">3. Auto-sync</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">Your WABA appears instantly</div>
                </div>
              </div>
            </>
          )}
        </Card>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProjects.map((p) => {
            const id = p._id.toString();
            const hasPhone = Array.isArray((p as any).phoneNumbers)
              ? (p as any).phoneNumbers.length > 0
              : false;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectProject(id)}
                className={cn('group block w-full text-left')}
              >
                <Card
                  variant="default"
                  className="flex flex-col p-4 transition-transform group-hover:-translate-y-0.5 group-hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-[10px] text-[13px] font-semibold uppercase',
                        'bg-accent text-accent-foreground',
                      )}
                    >
                      {(p.name || '?').slice(0, 2)}
                    </div>
                    <LuArrowRight
                      className="h-4 w-4 text-muted-foreground/70 transition-[color,transform] group-hover:text-foreground group-hover:translate-x-0.5"
                      strokeWidth={2}
                    />
                  </div>
                  <div className="mt-3.5 text-[11.5px] font-medium text-muted-foreground">
                    WhatsApp project
                  </div>
                  <div className="mt-1 text-[15px] font-semibold text-foreground leading-tight truncate">
                    {p.name || 'Untitled project'}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span
                      className={cn(
                        'inline-flex h-1.5 w-1.5 rounded-full',
                        hasPhone ? 'bg-emerald-500' : 'bg-amber-500',
                      )}
                    />
                    {hasPhone ? 'Phone connected' : 'Setup incomplete'}
                    {p.wabaId ? (
                      <>
                        <span className="text-muted-foreground/70">·</span>
                        <span className="truncate font-mono text-[10px]">
                          WABA {String(p.wabaId).slice(-6)}
                        </span>
                      </>
                    ) : null}
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <LuCheck className="h-3 w-3" strokeWidth={2.5} />
        Your selection is remembered on this device.
      </div>
    </div>
  );
}
