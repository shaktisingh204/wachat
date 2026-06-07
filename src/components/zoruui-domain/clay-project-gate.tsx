'use client';

/**
 * ClayProjectGate - "pick a project first" gate for Wachat routes.
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
 * they were before. Only the visual chrome was migrated to the 20ui
 * design system.
 */

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, Check, Plus, Search, MessageSquare } from 'lucide-react';

import {
  cn,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';

/**
 * Routes that are allowed to render without an active project.
 * Anything else under Wachat gets gated.
 */
const OPEN_ROUTES = new Set<string>([
  '/wachat',
  '/dashboard/',
  '/wachat/setup',
  '/wachat/setup/',
  '/wachat/setup/docs',
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

  // Project already selected, pass through
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
    // Persist immediately. The ProjectProvider reads from localStorage
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
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Wachat</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Select project</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <PageHeaderHeading>
          <PageTitle>Select a project</PageTitle>
          <PageDescription>
            Wachat is scoped per WhatsApp Business Account. Pick the project
            you want to work in to continue.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="secondary" onClick={() => router.push('/wachat')}>
            All projects
          </Button>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => router.push('/wachat/setup')}
          >
            Connect account
          </Button>
        </PageActions>
      </PageHeader>

      {/* Filter */}
      <div className="mt-6 max-w-md">
        <Field label="Search projects">
          <Input
            iconLeft={Search}
            placeholder="Search your projects"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </Field>
      </div>

      {/* Project grid */}
      {isLoadingProject ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[118px] animate-pulse rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]"
            />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="mt-8">
          {filter ? (
            <EmptyState
              icon={Search}
              title="No projects match your search"
              description="Try a different name, or clear the filter to see all your projects."
              action={
                <Button variant="secondary" onClick={() => setFilter('')}>
                  Clear filter
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="Connect your WhatsApp Business"
              description="Link your WhatsApp Business Account via Meta to start sending broadcasts, managing chats, and building automations."
              action={
                <div className="flex flex-col items-center gap-6">
                  <Button
                    variant="primary"
                    iconLeft={Plus}
                    onClick={() => router.push('/wachat/setup')}
                  >
                    Connect WhatsApp account
                  </Button>
                  <div className="grid max-w-lg grid-cols-3 gap-4 text-left">
                    <div>
                      <div className="text-[12px] font-semibold text-[var(--st-text)]">
                        1. Click connect
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
                        Open the Meta guided signup
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold text-[var(--st-text)]">
                        2. Login to Meta
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
                        Grant WhatsApp permissions
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold text-[var(--st-text)]">
                        3. Auto-sync
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
                        Your WABA appears instantly
                      </div>
                    </div>
                  </div>
                </div>
              }
            />
          )}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProjects.map((p) => {
            const id = p._id.toString();
            const hasPhone = Array.isArray((p as any).phoneNumbers)
              ? (p as any).phoneNumbers.length > 0
              : false;
            return (
              <Card
                key={id}
                variant="interactive"
                padding="md"
                role="button"
                tabIndex={0}
                onClick={() => selectProject(id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectProject(id);
                  }
                }}
                aria-label={`Select project ${p.name || 'Untitled project'}`}
                className="group flex flex-col text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[13px] font-semibold uppercase text-[var(--st-text)]">
                    {(p.name || '?').slice(0, 2)}
                  </div>
                  <ArrowRight
                    className="h-4 w-4 text-[var(--st-text-secondary)] transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-3.5 text-[11.5px] font-medium text-[var(--st-text-secondary)]">
                  WhatsApp project
                </div>
                <div className="mt-1 truncate text-[15px] font-semibold leading-tight text-[var(--st-text)]">
                  {p.name || 'Untitled project'}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--st-text-secondary)]">
                  <span
                    className={cn(
                      'inline-flex h-1.5 w-1.5 rounded-full',
                      hasPhone
                        ? 'bg-[var(--st-status-ok)]'
                        : 'bg-[var(--st-text-tertiary)]',
                    )}
                    aria-hidden="true"
                  />
                  {hasPhone ? 'Phone connected' : 'Setup incomplete'}
                  {p.wabaId ? (
                    <>
                      <span className="text-[var(--st-text-tertiary)]">
                        &middot;
                      </span>
                      <span className="truncate font-mono text-[10px]">
                        WABA {String(p.wabaId).slice(-6)}
                      </span>
                    </>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex items-center gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
        <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
        Your selection is remembered on this device.
      </div>
    </div>
  );
}
