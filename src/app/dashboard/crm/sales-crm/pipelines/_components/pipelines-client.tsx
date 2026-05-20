'use client';

import * as React from 'react';
import {
  ZoruAccordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruButton,
  ZoruCard,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { Columns3, Download, ListChecks, Trash2, X } from 'lucide-react';
import { useTransition } from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import {
  bulkDeleteCrmPipelines,
} from '@/app/actions/crm-pipelines.actions';
import type { CrmPipelineKpis } from '@/app/actions/crm-pipelines.actions';
import { EditPipelinesDialog } from '@/components/wabasimplify/edit-pipelines-dialog';
import type { CrmPipeline } from '@/lib/definitions';

const BASE = '/dashboard/crm/sales-crm/pipelines';

interface Props {
  pipelines: CrmPipeline[];
  kpi: CrmPipelineKpis;
}

function fmtMoney(value: number, currency = 'INR'): string {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      notation: value >= 1_00_00_000 ? 'compact' : 'standard',
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function PipelinesClient({ pipelines: initialPipelines, kpi }: Props) {
  const { toast } = useZoruToast();
  const [pipelines, setPipelines] = React.useState<CrmPipeline[]>(initialPipelines);
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isPending, startTransition] = useTransition();

  React.useEffect(() => { setPipelines(initialPipelines); }, [initialPipelines]);

  const filtered = pipelines.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  }

  function handleBulkDelete() {
    const ids = [...selected];
    startTransition(async () => {
      const r = await bulkDeleteCrmPipelines(ids);
      if (r.success) {
        setPipelines((prev) => prev.filter((p) => !ids.includes(p.id)));
        setSelected(new Set());
        toast({ title: 'Deleted', description: `${r.processed} pipelines removed.` });
      } else {
        toast({ title: 'Error', description: r.error ?? 'Failed', variant: 'destructive' });
      }
    });
  }

  function handleExportCsv() {
    downloadCsv(
      `pipelines-${dateStamp()}.csv`,
      ['name', 'stages', 'stageNames'],
      filtered.map((p) => ({
        name: p.name,
        stages: p.stages?.length ?? 0,
        stageNames: (p.stages ?? []).map((s) => s.name).join(' | '),
      })),
    );
  }

  const allSelectedOnPage = filtered.length > 0 && selected.size === filtered.length;

  const bulkBar =
    selected.size > 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <div className="flex items-center gap-2 text-zoru-ink">
          <ListChecks className="h-4 w-4 text-zoru-primary" />
          {selected.size} selected
        </div>
        <div className="flex items-center gap-1">
          <ZoruButton size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </ZoruButton>
          <ZoruButton size="sm" variant="destructive" onClick={handleBulkDelete} disabled={isPending}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </ZoruButton>
          <ZoruButton size="sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X className="h-3.5 w-3.5" />
          </ZoruButton>
        </div>
      </div>
    ) : null;

  const empty =
    filtered.length === 0 ? (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
          <Columns3 className="h-6 w-6 text-accent-foreground" strokeWidth={1.75} />
        </div>
        <h3 className="text-[15px] font-semibold text-foreground">No Pipelines Found</h3>
        <p className="text-[12.5px] text-muted-foreground">
          {search ? 'No pipelines match your search.' : "You haven't created any pipelines yet."}
        </p>
        {!search ? (
          <ZoruButton onClick={() => setIsCreateOpen(true)}>
            Create Your First Pipeline
          </ZoruButton>
        ) : null}
      </div>
    ) : undefined;

  return (
    <>
      <EditPipelinesDialog
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={() => {
          // Pipelines revalidated server-side; trigger a router refresh from the page
          window.location.reload();
        }}
        initialPipelines={pipelines}
      />
      <EditPipelinesDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => { window.location.reload(); }}
        isCreating
        initialPipelines={pipelines}
      />

      <div className="space-y-5">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ZoruStatCard label="Total Pipelines" value={kpi.total} icon={<Columns3 />} />
          <ZoruStatCard
            label="In-flight Value"
            value={fmtMoney(kpi.inFlightValue, kpi.currency)}
          />
          <ZoruStatCard label="Avg Velocity (days)" value={kpi.avgVelocityDays} />
          <ZoruStatCard label="Top Pipeline" value={kpi.topPipelineName} />
        </div>

        <EntityListShell
          title="Sales Pipelines"
          subtitle="Create and manage multiple sales pipelines to track your deals."
          search={{ value: search, onChange: setSearch, placeholder: 'Search pipelines…' }}
          primaryAction={
            <div className="flex items-center gap-2">
              <ZoruButton variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
              </ZoruButton>
              <ZoruButton variant="outline" onClick={() => setIsEditOpen(true)}>
                Edit Pipelines
              </ZoruButton>
              <ZoruButton onClick={() => setIsCreateOpen(true)}>
                New Pipeline
              </ZoruButton>
            </div>
          }
          bulkBar={bulkBar}
          empty={empty}
          loading={false}
        >
          <div className="space-y-4">
            {/* Table summary */}
            <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow>
                    <ZoruTableHead className="w-8">
                      <input
                        type="checkbox"
                        checked={allSelectedOnPage}
                        onChange={toggleAll}
                        aria-label="Select all"
                        className="rounded border-zoru-line"
                      />
                    </ZoruTableHead>
                    <ZoruTableHead>Pipeline Name</ZoruTableHead>
                    <ZoruTableHead>Stages</ZoruTableHead>
                    <ZoruTableHead className="w-24">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {filtered.map((p) => (
                    <ZoruTableRow key={p.id} data-selected={selected.has(p.id)}>
                      <ZoruTableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleRow(p.id)}
                          aria-label={`Select ${p.name}`}
                          className="rounded border-zoru-line"
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        <EntityRowLink
                          href={`${BASE}/${p.id}`}
                          label={p.name}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-mono text-[12px] text-zoru-ink-muted">
                        {p.stages?.length ?? 0}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruButton asChild size="sm" variant="ghost">
                          <Link href={`${BASE}/${p.id}/edit`}>Edit</Link>
                        </ZoruButton>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}
                </ZoruTableBody>
              </ZoruTable>
            </div>

            {/* Accordion for stage details */}
            {filtered.length > 0 ? (
              <ZoruAccordion
                type="multiple"
                defaultValue={[]}
                className="w-full space-y-2"
              >
                {filtered.map((pipeline) => (
                  <ZoruAccordionItem
                    key={pipeline.id}
                    value={pipeline.id}
                    className="rounded-xl border border-border bg-card"
                  >
                    <ZoruAccordionTrigger className="px-4 py-3 text-[13.5px] font-semibold text-foreground hover:no-underline">
                      {pipeline.name}
                      <span className="ml-auto mr-2 font-normal text-[11.5px] text-muted-foreground">
                        {pipeline.stages?.length ?? 0} stage{(pipeline.stages?.length ?? 0) === 1 ? '' : 's'}
                      </span>
                    </ZoruAccordionTrigger>
                    <ZoruAccordionContent className="px-4 pb-4 pt-0">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {(pipeline.stages ?? []).map((stage) => (
                          <div
                            key={stage.id}
                            className="rounded-lg border border-border bg-secondary p-3 text-center"
                          >
                            <p className="text-[13px] font-medium text-foreground">
                              {stage.name}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {stage.chance}% chance
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <ZoruButton asChild variant="outline" size="sm">
                          <Link href={`${BASE}/${pipeline.id}`}>
                            View Detail
                          </Link>
                        </ZoruButton>
                        <ZoruButton asChild variant="outline" size="sm">
                          <Link href="/dashboard/crm/sales-crm/deals">
                            View Deals
                          </Link>
                        </ZoruButton>
                      </div>
                    </ZoruAccordionContent>
                  </ZoruAccordionItem>
                ))}
              </ZoruAccordion>
            ) : null}
          </div>
        </EntityListShell>
      </div>
    </>
  );
}
