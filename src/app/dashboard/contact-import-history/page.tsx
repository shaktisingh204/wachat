'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuFileSpreadsheet, LuCircleCheck, LuCircleX, LuClock, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard, ClayBadge } from '@/components/clay';
import { getImportHistory } from '@/app/actions/wachat-features.actions';

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700"><LuCircleCheck className="h-3 w-3" /> Completed</span>;
    case 'failed':
      return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700"><LuCircleX className="h-3 w-3" /> Failed</span>;
    case 'processing':
      return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700"><LuClock className="h-3 w-3" /> Processing</span>;
    default:
      return <ClayBadge tone="neutral">{status}</ClayBadge>;
  }
}

export default function ContactImportHistoryPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [imports, setImports] = useState<any[]>([]);
  const [isLoading, startTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getImportHistory(projectId);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setImports(res.imports ?? []);
    });
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalImported = imports.reduce((s, i) => s + (i.success ?? 0), 0);

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LuLoader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Contact Import History' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Contact Import History</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">View the history of all past CSV contact imports.</p>
      </div>

      <div className="flex gap-4">
        <ClayCard className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total Imports</div>
          <div className="mt-1 text-[28px] font-semibold text-foreground tabular-nums">{imports.length}</div>
        </ClayCard>
        <ClayCard className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contacts Imported</div>
          <div className="mt-1 text-[28px] font-semibold text-foreground tabular-nums">{totalImported.toLocaleString()}</div>
        </ClayCard>
      </div>

      {imports.length > 0 ? (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Filename</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Success</th>
                <th className="px-5 py-3 text-right">Failed</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <tr key={imp._id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-[13px] text-foreground font-medium flex items-center gap-2">
                    <LuFileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                    {imp.filename || 'Unknown'}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                    {imp.importedAt ? new Date(imp.importedAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-5 py-3 text-right text-[13px] text-foreground tabular-nums">{(imp.total ?? 0).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-[13px] text-emerald-600 tabular-nums">{(imp.success ?? 0).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-[13px] text-red-500 tabular-nums">{imp.failed ?? 0}</td>
                  <td className="px-5 py-3">{statusBadge(imp.status || 'completed')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      ) : (
        <ClayCard className="p-12 text-center">
          <LuFileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">No import records found.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
