'use client';

import {
  useZoruToast,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetTrigger,
  Skeleton,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  FileSpreadsheet,
  CircleCheck,
  CircleX,
  Clock,
  Eye,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getImportHistory } from '@/app/actions/wachat-features.actions';

/**
 * Wachat Contact Import History — rebuilt on ZoruUI primitives (phase 2).
 *
 * Same data, same handlers. Visual primitives swapped to ZoruUI.
 */

import * as React from 'react';

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="success">
          <CircleCheck /> Completed
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="danger">
          <CircleX /> Failed
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="info">
          <Clock /> Processing
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function ContactImportHistoryPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const [imports, setImports] = useState<any[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [selected, setSelected] = useState<any | null>(null);

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getImportHistory(projectId);
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      setImports(res.imports ?? []);
    });
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalImported = imports.reduce((s, i) => s + (i.success ?? 0), 0);
  const isLoadingInitial = isLoading && imports.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat/contacts">
              Contacts
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Import History</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Contact Import History
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          View the history of all past CSV contact imports.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            Total Imports
          </div>
          <div className="mt-1 text-[28px] tabular-nums text-zoru-ink">
            {imports.length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            Contacts Imported
          </div>
          <div className="mt-1 text-[28px] tabular-nums text-zoru-ink">
            {totalImported.toLocaleString()}
          </div>
        </Card>
      </div>

      {isLoadingInitial ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : imports.length > 0 ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zoru-line text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                <th className="px-5 py-3">Filename</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Success</th>
                <th className="px-5 py-3 text-right">Failed</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zoru-line">
              {imports.map((imp) => (
                <tr key={imp._id}>
                  <td className="px-5 py-3 text-[13px] text-zoru-ink">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
                      {imp.filename || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-zoru-ink-muted whitespace-nowrap">
                    {imp.importedAt
                      ? new Date(imp.importedAt).toLocaleString()
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-[13px] text-zoru-ink tabular-nums">
                    {(imp.total ?? 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-[13px] text-zoru-success tabular-nums">
                    {(imp.success ?? 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-[13px] text-zoru-danger tabular-nums">
                    {imp.failed ?? 0}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={imp.status || 'completed'} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(imp)}
                    >
                      <Eye /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState
          icon={<FileSpreadsheet />}
          title="No import records found"
          description="Imports performed via the Contacts page will appear here."
        />
      )}

      {/* View results sheet */}
      <Sheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <ZoruSheetContent side="right" className="w-full sm:max-w-md">
          <ZoruSheetHeader>
            <ZoruSheetTitle>
              {selected?.filename || 'Import details'}
            </ZoruSheetTitle>
            <ZoruSheetDescription>
              {selected?.importedAt
                ? new Date(selected.importedAt).toLocaleString()
                : '—'}
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {selected && (
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-zoru-ink-muted">Status</span>
                <StatusBadge status={selected.status || 'completed'} />
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-zoru-ink-muted">Total rows</span>
                <span className="text-zoru-ink tabular-nums">
                  {(selected.total ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-zoru-ink-muted">Imported</span>
                <span className="text-zoru-success tabular-nums">
                  {(selected.success ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-zoru-ink-muted">Failed</span>
                <span className="text-zoru-danger tabular-nums">
                  {selected.failed ?? 0}
                </span>
              </div>
              {selected.errorMessage ? (
                <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3 text-[12px] text-zoru-ink-muted">
                  {selected.errorMessage}
                </div>
              ) : null}
            </div>
          )}
        </ZoruSheetContent>
      </Sheet>

      <div className="h-6" />
    </div>
  );
}
