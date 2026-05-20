'use client';

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Archive, Download, Map } from 'lucide-react';

import {
  getRoadmaps,
  getRoadmapKpis,
  deleteRoadmap,
  updateRoadmap,
  type HrmRoadmap,
} from '@/app/actions/hrm-roadmaps.actions';
import {
  ZoruButton,
  ZoruBadge,
  ZoruStatCard,
  ZoruProgress,
  ZoruCard,
  ZoruCardContent,
} from '@/components/zoruui';

/* ─── Helpers ──────────────────────────────────────────────────────── */

const STATUS_VARIANT: Record<
  HrmRoadmap['status'],
  'secondary' | 'info' | 'success' | 'ghost'
> = {
  draft: 'secondary',
  active: 'info',
  completed: 'success',
  archived: 'ghost',
};

function phaseSummary(roadmap: HrmRoadmap) {
  const totalTasks = roadmap.phases.reduce((a, p) => a + p.tasks.length, 0);
  const doneTasks = roadmap.phases.reduce(
    (a, p) => a + p.tasks.filter((t) => t.status === 'done').length,
    0,
  );
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  return { phaseCount: roadmap.phases.length, totalTasks, doneTasks, pct };
}

function exportCsv(rows: HrmRoadmap[]) {
  const headers = ['Title', 'Status', 'Phases', 'Total Tasks', 'Done', 'Progress %'];
  const lines = rows.map((r) => {
    const { phaseCount, totalTasks, doneTasks, pct } = phaseSummary(r);
    return [r.title, r.status, phaseCount, totalTasks, doneTasks, pct].join(',');
  });
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'roadmaps.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Page ─────────────────────────────────────────────────────────── */

export default function RoadmapsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<HrmRoadmap[]>([]);
  const [kpis, setKpis] = useState<{ label: string; value: number }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const [data, kpiData] = await Promise.all([getRoadmaps(), getRoadmapKpis()]);
      setRows(data);
      setKpis(kpiData);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r._id)));
    }
  }

  async function handleBulkDelete() {
    if (!selected.size) return;
    startTransition(async () => {
      await Promise.all([...selected].map((id) => deleteRoadmap(id)));
      setSelected(new Set());
      refresh();
    });
  }

  async function handleBulkArchive() {
    if (!selected.size) return;
    startTransition(async () => {
      await Promise.all(
        [...selected].map((id) => updateRoadmap(id, { status: 'archived' })),
      );
      setSelected(new Set());
      refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zoru-ink">Roadmaps</h1>
          <p className="text-sm text-zoru-ink-muted">Plan and track team initiatives phase by phase.</p>
        </div>
        <ZoruButton size="md" onClick={() => router.push('/dashboard/hrm/portal/roadmaps/new')}>
          <Plus />
          New Roadmap
        </ZoruButton>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <ZoruStatCard key={k.label} label={k.label} value={k.value} icon={<Map />} />
        ))}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-4 py-2">
          <span className="text-sm text-zoru-ink-muted">{selected.size} selected</span>
          <ZoruButton variant="ghost" size="sm" onClick={handleBulkArchive}>
            <Archive />
            Archive
          </ZoruButton>
          <ZoruButton variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 />
            Delete
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => exportCsv(rows.filter((r) => selected.has(r._id)))}
          >
            <Download />
            Export CSV
          </ZoruButton>
        </div>
      )}

      {/* Table */}
      <ZoruCard>
        <ZoruCardContent className="p-0">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-zoru-ink-muted">
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-sm text-zoru-ink-muted">
              <Map className="h-8 w-8 opacity-40" />
              <span>No roadmaps yet. Create your first one.</span>
              <ZoruButton size="sm" onClick={() => router.push('/dashboard/hrm/portal/roadmaps/new')}>
                <Plus />
                New Roadmap
              </ZoruButton>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zoru-line text-left text-xs uppercase tracking-wide text-zoru-ink-subtle">
                    <th className="px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === rows.length && rows.length > 0}
                        onChange={toggleAll}
                        className="accent-zoru-primary"
                      />
                    </th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Phases</th>
                    <th className="px-4 py-3">Total Tasks</th>
                    <th className="px-4 py-3">Done</th>
                    <th className="px-4 py-3 min-w-[120px]">Progress</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const { phaseCount, totalTasks, doneTasks, pct } = phaseSummary(row);
                    return (
                      <tr
                        key={row._id}
                        className="border-b border-zoru-line/60 transition-colors hover:bg-zoru-surface"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(row._id)}
                            onChange={() => toggleSelect(row._id)}
                            className="accent-zoru-primary"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            className="font-medium text-zoru-ink hover:text-zoru-primary hover:underline text-left"
                            onClick={() =>
                              router.push(`/dashboard/hrm/portal/roadmaps/${row._id}`)
                            }
                          >
                            {row.title}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <ZoruBadge variant={STATUS_VARIANT[row.status]}>
                            {row.status}
                          </ZoruBadge>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zoru-ink-muted">
                          {phaseCount}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zoru-ink-muted">
                          {totalTasks}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zoru-ink-muted">
                          {doneTasks}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ZoruProgress value={pct} className="flex-1" />
                            <span className="w-8 text-right text-xs tabular-nums text-zoru-ink-muted">
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <ZoruButton
                              variant="ghost"
                              size="icon-sm"
                              onClick={() =>
                                router.push(`/dashboard/hrm/portal/roadmaps/${row._id}`)
                              }
                            >
                              <Map />
                            </ZoruButton>
                            <ZoruButton
                              variant="ghost"
                              size="icon-sm"
                              onClick={async () => {
                                startTransition(async () => {
                                  await deleteRoadmap(row._id);
                                  refresh();
                                });
                              }}
                            >
                              <Trash2 className="text-zoru-danger" />
                            </ZoruButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ZoruCardContent>
      </ZoruCard>
    </div>
  );
}
