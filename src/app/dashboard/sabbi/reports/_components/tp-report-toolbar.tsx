'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/zoruui';
import { RefreshCw } from 'lucide-react';
import {
  ReportExportButton,
  type ReportExportButtonProps,
} from './report-export-button';
import type { TpReportProject, TpReportOwner } from '@/app/actions/crm-reports.actions.types';

export interface TpReportToolbarProps {
  from?: string;
  to?: string;
  projectId?: string;
  ownerId?: string;
  projects: TpReportProject[];
  owners: TpReportOwner[];
  hideDateRange?: boolean;
  exportProps?: ReportExportButtonProps;
}

export function TpReportToolbar({
  from,
  to,
  projectId,
  ownerId,
  projects,
  owners,
  hideDateRange,
  exportProps,
}: TpReportToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const onRefresh = React.useCallback(() => {
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    router.refresh();
  }, [router, pathname, sp]);

  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-2 rounded-lg border border-zoru-line bg-zoru-surface px-3 py-2"
    >
      {!hideDateRange ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="h-9 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="h-9 rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
            />
          </label>
        </>
      ) : null}

      {projects.length > 0 ? (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">Project</span>
          <select
            name="projectId"
            defaultValue={projectId ?? ''}
            className="h-9 min-w-[160px] rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      {owners.length > 0 ? (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">Owner</span>
          <select
            name="ownerId"
            defaultValue={ownerId ?? ''}
            className="h-9 min-w-[140px] rounded-lg border border-zoru-line bg-zoru-surface px-2 text-[13px] text-zoru-ink"
          >
            <option value="">All owners</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      <Button type="submit" size="sm">Apply</Button>
      <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        Refresh
      </Button>
      {exportProps ? <ReportExportButton {...exportProps} /> : null}
    </form>
  );
}
