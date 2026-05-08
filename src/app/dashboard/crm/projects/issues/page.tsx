'use client';

import * as React from 'react';
import { Bug } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  getWsIssues,
  getWsProjects,
} from '@/app/actions/worksuite/projects.actions';
import type {
  WsIssue,
  WsProject,
} from '@/lib/worksuite/project-types';

const STATUS_TONES: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'secondary'> = {
  open: 'warning',
  in_progress: 'default',
  resolved: 'success',
  closed: 'secondary',
};

const PRIORITY_TONES: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'secondary'> = {
  low: 'secondary',
  medium: 'default',
  high: 'warning',
  urgent: 'danger',
};

type IssueRow = WsIssue & { _id: string };
type ProjectRow = WsProject & { _id: string };

export default function ProjectIssuesPage() {
  const [issues, setIssues] = React.useState<IssueRow[]>([]);
  const [projects, setProjects] = React.useState<ProjectRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [projectFilter, setProjectFilter] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [is, ps] = await Promise.all([
        getWsIssues() as Promise<IssueRow[]>,
        getWsProjects() as Promise<ProjectRow[]>,
      ]);
      if (cancelled) return;
      setIssues(is ?? []);
      setProjects(ps ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const projectNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(String(p._id), p.name ?? '—');
    return m;
  }, [projects]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((i) => {
      if (projectFilter !== 'all' && String(i.projectId ?? '') !== projectFilter) return false;
      if (!q) return true;
      const hay = `${i.title ?? ''} ${i.reporterName ?? ''} ${i.assigneeName ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [issues, projectFilter, search]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Issues"
        subtitle="Track bugs, blockers and incidents against your projects."
        icon={Bug}
      />

      <ZoruCard>
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <ZoruSelect value={projectFilter} onValueChange={setProjectFilter}>
              <ZoruSelectTrigger className="w-full sm:w-64">
                <ZoruSelectValue placeholder="Filter by project" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All projects</ZoruSelectItem>
                {projects.map((p) => (
                  <ZoruSelectItem key={String(p._id)} value={String(p._id)}>
                    {p.name ?? '(unnamed)'}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruInput
              placeholder="Search title, reporter, assignee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-72"
            />
          </div>
          <ZoruButton
            variant="ghost"
            onClick={() => {
              setProjectFilter('all');
              setSearch('');
            }}
          >
            Reset
          </ZoruButton>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Title</ZoruTableHead>
                <ZoruTableHead>Project</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Priority</ZoruTableHead>
                <ZoruTableHead>Reporter</ZoruTableHead>
                <ZoruTableHead>Assignee</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <ZoruTableRow key={i}>
                    <ZoruTableCell colSpan={6}>
                      <ZoruSkeleton className="h-6 w-full" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : filtered.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No issues match the filter.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((i) => (
                  <ZoruTableRow key={i._id}>
                    <ZoruTableCell className="font-medium">{i.title}</ZoruTableCell>
                    <ZoruTableCell>
                      {projectNameById.get(String(i.projectId ?? '')) ?? '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={STATUS_TONES[i.status] ?? 'default'}>
                        {i.status}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {i.priority ? (
                        <ZoruBadge variant={PRIORITY_TONES[i.priority] ?? 'default'}>
                          {i.priority}
                        </ZoruBadge>
                      ) : (
                        '—'
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell>{i.reporterName ?? '—'}</ZoruTableCell>
                    <ZoruTableCell>{i.assigneeName ?? '—'}</ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
