'use client';

import * as React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Card,
  Checkbox,
  cn,
  EmptyState,
  IconButton,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import { Columns3, Crown, Download, Gauge, ListChecks, Trash2, Wallet, X } from 'lucide-react';
import { useTransition } from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import {
  bulkDeleteCrmPipelines,
} from '@/app/actions/crm-pipelines.actions';
import { EditPipelinesDialog } from '@/components/20ui-domain/edit-pipelines-dialog';
import type { CrmPipeline } from '@/lib/definitions';
import type { CrmPipelineKpis } from '@/app/actions/crm-pipelines.actions.types';

const BASE = '/dashboard/sabbigin/pipelines';

/**
 * 20ui pattern for a link that looks like a Button: apply the `u-btn` classes to
 * the anchor (Next.js <Link>) rather than nesting a real <button> inside an <a>.
 */
function btnLinkClass(
  variant: 'ghost' | 'outline',
  size: 'sm' | 'md' = 'sm',
): string {
  return cn('u-btn', `u-btn--${variant}`, `u-btn--${size}`);
}

interface Props {
  pipelines: CrmPipeline[];
  kpi: CrmPipelineKpis;
}

function fmtMoney(value: number, currency = 'INR'): string {
  if (!Number.isFinite(value)) return '-';
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
        toast.success({ title: 'Deleted', description: `${r.processed} pipelines removed.` });
      } else {
        toast.error({ title: 'Error', description: r.error ?? 'Failed' });
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
  const someSelectedOnPage = selected.size > 0 && !allSelectedOnPage;

  const bulkBar =
    selected.size > 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <div className="flex items-center gap-2 text-[var(--st-text)]">
          <ListChecks className="h-4 w-4 text-[var(--st-text)]" aria-hidden="true" />
          {selected.size} selected
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" iconLeft={Download} onClick={handleExportCsv}>
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="danger"
            iconLeft={Trash2}
            onClick={handleBulkDelete}
            disabled={isPending}
          >
            Delete
          </Button>
          <IconButton
            size="sm"
            variant="ghost"
            icon={X}
            label="Clear selection"
            onClick={() => setSelected(new Set())}
          />
        </div>
      </div>
    ) : null;

  const empty =
    filtered.length === 0 ? (
      <EmptyState
        icon={Columns3}
        title={search ? 'No matching pipelines' : 'No pipelines yet'}
        description={
          search
            ? 'No pipelines match your search. Try a different term.'
            : 'Create a pipeline to start tracking deals through their stages.'
        }
        action={
          !search ? (
            <Button variant="primary" iconLeft={Columns3} onClick={() => setIsCreateOpen(true)}>
              Create your first pipeline
            </Button>
          ) : undefined
        }
      />
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
          <StatCard label="Total pipelines" value={kpi.total} icon={Columns3} accent="#3b7af5" />
          <StatCard
            label="In-flight value"
            value={fmtMoney(kpi.inFlightValue, kpi.currency)}
            icon={Wallet}
            accent="#1f9d55"
          />
          <StatCard
            label="Avg velocity (days)"
            value={kpi.avgVelocityDays}
            icon={Gauge}
            accent="#7c3aed"
          />
          <StatCard label="Top pipeline" value={kpi.topPipelineName} icon={Crown} accent="#0891b2" />
        </div>

        <EntityListShell
          title="Sales pipelines"
          subtitle="Create and manage pipelines to track your deals through every stage."
          search={{ value: search, onChange: setSearch, placeholder: 'Search pipelines...' }}
          primaryAction={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" iconLeft={Download} onClick={handleExportCsv}>
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => setIsEditOpen(true)}>
                Edit pipelines
              </Button>
              <Button variant="primary" iconLeft={Columns3} onClick={() => setIsCreateOpen(true)}>
                New pipeline
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
                      <Checkbox
                        size="sm"
                        checked={allSelectedOnPage}
                        indeterminate={someSelectedOnPage}
                        onChange={toggleAll}
                        aria-label="Select all"
                      />
                    </Th>
                    <Th>Pipeline name</Th>
                    <Th align="right">Stages</Th>
                    <Th className="w-24">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {filtered.map((p) => (
                    <Tr key={p.id} selected={selected.has(p.id)}>
                      <Td>
                        <Checkbox
                          size="sm"
                          checked={selected.has(p.id)}
                          onChange={() => toggleRow(p.id)}
                          aria-label={`Select ${p.name}`}
                        />
                      </Td>
                      <Td className="font-medium text-[var(--st-text)]">
                        <EntityRowLink
                          href={`${BASE}/${p.id}`}
                          label={p.name}
                        />
                      </Td>
                      <Td align="right" className="font-mono text-[12px] tabular-nums text-[var(--st-text-secondary)]">
                        {p.stages?.length ?? 0}
                      </Td>
                      <Td>
                        <Link href={`${BASE}/${p.id}/edit`} className={btnLinkClass('ghost')}>
                          <span className="u-btn__label">Edit</span>
                        </Link>
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
                    className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
                  >
                    <AccordionTrigger className="px-4 py-3 text-[13.5px] font-semibold text-[var(--st-text)]">
                      <span className="flex w-full items-center">
                        {pipeline.name}
                        <span className="ml-auto mr-2 font-normal text-[11.5px] text-[var(--st-text-secondary)]">
                          {pipeline.stages?.length ?? 0} stage{(pipeline.stages?.length ?? 0) === 1 ? '' : 's'}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-0">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {(pipeline.stages ?? []).map((stage) => (
                          <Card key={stage.id} variant="outlined" padding="sm" className="text-center">
                            <p className="text-[13px] font-medium text-[var(--st-text)]">
                              {stage.name}
                            </p>
                            <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
                              {stage.chance}% chance
                            </p>
                          </Card>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Link href={`${BASE}/${pipeline.id}`} className={btnLinkClass('outline')}>
                          <span className="u-btn__label">View Detail</span>
                        </Link>
                        <Link
                          href={`/dashboard/sabbigin/deals?pipeline=${pipeline.id}`}
                          className={btnLinkClass('outline')}
                        >
                          <span className="u-btn__label">View Deals</span>
                        </Link>
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
