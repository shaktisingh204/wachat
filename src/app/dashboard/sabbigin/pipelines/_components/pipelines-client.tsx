'use client';

import * as React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, Card, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import { Columns3, Download, ListChecks, Trash2, X } from 'lucide-react';
import { useTransition } from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import {
  bulkDeleteCrmPipelines,
} from '@/app/actions/crm-pipelines.actions';
import { EditPipelinesDialog } from '@/components/zoruui-domain/edit-pipelines-dialog';
import type { CrmPipeline } from '@/lib/definitions';
import type { CrmPipelineKpis } from '@/app/actions/crm-pipelines.actions.types';

const BASE = '/dashboard/sabbigin/pipelines';

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
  const { toast } = useToast();
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
        <div className="flex items-center gap-2 text-[var(--st-text)]">
          <ListChecks className="h-4 w-4 text-[var(--st-text)]" />
          {selected.size} selected
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={isPending}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    ) : null;

  const empty =
    filtered.length === 0 ? (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--st-bg-muted)]">
          <Columns3 className="h-6 w-6 text-[var(--st-text)]" strokeWidth={1.75} />
        </div>
        <h3 className="text-[15px] font-semibold text-[var(--st-text)]">No Pipelines Found</h3>
        <p className="text-[12.5px] text-[var(--st-text-secondary)]">
          {search ? 'No pipelines match your search.' : "You haven't created any pipelines yet."}
        </p>
        {!search ? (
          <Button onClick={() => setIsCreateOpen(true)}>
            Create Your First Pipeline
          </Button>
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
          <StatCard label="Total Pipelines" value={kpi.total} icon={<Columns3 />} />
          <StatCard
            label="In-flight Value"
            value={fmtMoney(kpi.inFlightValue, kpi.currency)}
          />
          <StatCard label="Avg Velocity (days)" value={kpi.avgVelocityDays} />
          <StatCard label="Top Pipeline" value={kpi.topPipelineName} />
        </div>

        <EntityListShell
          title="Sales Pipelines"
          subtitle="Create and manage multiple sales pipelines to track your deals."
          search={{ value: search, onChange: setSearch, placeholder: 'Search pipelines…' }}
          primaryAction={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
              </Button>
              <Button variant="outline" onClick={() => setIsEditOpen(true)}>
                Edit Pipelines
              </Button>
              <Button onClick={() => setIsCreateOpen(true)}>
                New Pipeline
              </Button>
            </div>
          }
          bulkBar={bulkBar}
          empty={empty}
          loading={false}
        >
          <div className="space-y-4">
            {/* Table summary */}
            <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Table>
                <THead>
                  <Tr>
                    <Th className="w-8">
                      <input
                        type="checkbox"
                        checked={allSelectedOnPage}
                        onChange={toggleAll}
                        aria-label="Select all"
                        className="rounded border-[var(--st-border)]"
                      />
                    </Th>
                    <Th>Pipeline Name</Th>
                    <Th>Stages</Th>
                    <Th className="w-24">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {filtered.map((p) => (
                    <Tr key={p.id} data-selected={selected.has(p.id)}>
                      <Td>
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleRow(p.id)}
                          aria-label={`Select ${p.name}`}
                          className="rounded border-[var(--st-border)]"
                        />
                      </Td>
                      <Td className="font-medium text-[var(--st-text)]">
                        <EntityRowLink
                          href={`${BASE}/${p.id}`}
                          label={p.name}
                        />
                      </Td>
                      <Td className="font-mono text-[12px] text-[var(--st-text-secondary)]">
                        {p.stages?.length ?? 0}
                      </Td>
                      <Td>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`${BASE}/${p.id}/edit`}>Edit</Link>
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>

            {/* Accordion for stage details */}
            {filtered.length > 0 ? (
              <Accordion
                type="multiple"
                defaultValue={[]}
                className="w-full space-y-2"
              >
                {filtered.map((pipeline) => (
                  <AccordionItem
                    key={pipeline.id}
                    value={pipeline.id}
                    className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
                  >
                    <AccordionTrigger className="px-4 py-3 text-[13.5px] font-semibold text-[var(--st-text)] hover:no-underline">
                      {pipeline.name}
                      <span className="ml-auto mr-2 font-normal text-[11.5px] text-[var(--st-text-secondary)]">
                        {pipeline.stages?.length ?? 0} stage{(pipeline.stages?.length ?? 0) === 1 ? '' : 's'}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-0">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {(pipeline.stages ?? []).map((stage) => (
                          <div
                            key={stage.id}
                            className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-center"
                          >
                            <p className="text-[13px] font-medium text-[var(--st-text)]">
                              {stage.name}
                            </p>
                            <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
                              {stage.chance}% chance
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`${BASE}/${pipeline.id}`}>
                            View Detail
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href="/dashboard/crm/sales-crm/deals">
                            View Deals
                          </Link>
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : null}
          </div>
        </EntityListShell>
      </div>
    </>
  );
}
