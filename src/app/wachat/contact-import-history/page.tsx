'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  Badge,
  Button,
  Card,
  StatCard,
  EmptyState,
  Skeleton,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/sabcrm/20ui';
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
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Contact Import History — rebuilt on 20ui primitives.
 *
 * Same data, same handlers. Visual primitives swapped to 20ui inside the
 * standard WachatPage frame.
 */

import * as React from 'react';

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <Badge tone="success">
          <CircleCheck size={12} aria-hidden="true" /> Completed
        </Badge>
      );
    case 'failed':
      return (
        <Badge tone="danger">
          <CircleX size={12} aria-hidden="true" /> Failed
        </Badge>
      );
    case 'processing':
      return (
        <Badge tone="info">
          <Clock size={12} aria-hidden="true" /> Processing
        </Badge>
      );
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}

export default function ContactImportHistoryPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
          tone: 'danger',
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Contacts', href: '/wachat/contacts' },
        { label: 'Import History' },
      ]}
      title="Contact Import History"
      description="View the history of all past CSV contact imports."
      width="wide"
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Total Imports" value={imports.length} />
          <StatCard
            label="Contacts Imported"
            value={totalImported.toLocaleString()}
          />
        </div>

        {isLoadingInitial ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={48} />
            ))}
          </div>
        ) : imports.length > 0 ? (
          <Card padding="none" className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr
                  className="text-[11px] uppercase tracking-wide"
                  style={{
                    color: 'var(--st-text-tertiary)',
                    borderBottom: '1px solid var(--st-border)',
                  }}
                >
                  <th className="px-5 py-3">Filename</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Success</th>
                  <th className="px-5 py-3 text-right">Failed</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((imp) => (
                  <tr
                    key={imp._id}
                    style={{ borderTop: '1px solid var(--st-border)' }}
                  >
                    <td
                      className="px-5 py-3 text-[13px]"
                      style={{ color: 'var(--st-text)' }}
                    >
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet
                          className="h-4 w-4 shrink-0"
                          style={{ color: 'var(--st-text-tertiary)' }}
                          aria-hidden="true"
                        />
                        {imp.filename || 'Unknown'}
                      </div>
                    </td>
                    <td
                      className="px-5 py-3 text-[12px] whitespace-nowrap"
                      style={{ color: 'var(--st-text-secondary)' }}
                    >
                      {imp.importedAt ? fmtDate(imp.importedAt) : '—'}
                    </td>
                    <td
                      className="px-5 py-3 text-right text-[13px] tabular-nums"
                      style={{ color: 'var(--st-text)' }}
                    >
                      {(imp.total ?? 0).toLocaleString()}
                    </td>
                    <td
                      className="px-5 py-3 text-right text-[13px] tabular-nums"
                      style={{ color: 'var(--st-status-ok)' }}
                    >
                      {(imp.success ?? 0).toLocaleString()}
                    </td>
                    <td
                      className="px-5 py-3 text-right text-[13px] tabular-nums"
                      style={{ color: 'var(--st-danger)' }}
                    >
                      {imp.failed ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={imp.status || 'completed'} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        iconLeft={Eye}
                        onClick={() => setSelected(imp)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <EmptyState
            icon={FileSpreadsheet}
            title="No import records found"
            description="Imports performed via the Contacts page will appear here."
          />
        )}
      </div>

      {/* View results drawer */}
      <Drawer
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DrawerContent side="right" className="w-full sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>
              {selected?.filename || 'Import details'}
            </DrawerTitle>
            <DrawerDescription>
              {selected?.importedAt ? fmtDate(selected.importedAt) : '—'}
            </DrawerDescription>
          </DrawerHeader>
          {selected && (
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex items-center justify-between text-[13px]">
                <span style={{ color: 'var(--st-text-secondary)' }}>Status</span>
                <StatusBadge status={selected.status || 'completed'} />
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span style={{ color: 'var(--st-text-secondary)' }}>
                  Total rows
                </span>
                <span
                  className="tabular-nums"
                  style={{ color: 'var(--st-text)' }}
                >
                  {(selected.total ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span style={{ color: 'var(--st-text-secondary)' }}>
                  Imported
                </span>
                <span
                  className="tabular-nums"
                  style={{ color: 'var(--st-status-ok)' }}
                >
                  {(selected.success ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span style={{ color: 'var(--st-text-secondary)' }}>Failed</span>
                <span
                  className="tabular-nums"
                  style={{ color: 'var(--st-danger)' }}
                >
                  {selected.failed ?? 0}
                </span>
              </div>
              {selected.errorMessage ? (
                <div
                  className="p-3 text-[12px]"
                  style={{
                    borderRadius: 'var(--st-radius)',
                    border: '1px solid var(--st-border)',
                    background: 'var(--st-bg-secondary)',
                    color: 'var(--st-text-secondary)',
                  }}
                >
                  {selected.errorMessage}
                </div>
              ) : null}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </WachatPage>
  );
}
