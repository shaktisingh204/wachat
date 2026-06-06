'use client';

import * as React from 'react';
import {
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { Download, ListChecks, Tags, Trash2, X } from 'lucide-react';
import { useTransition } from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RowDrawer } from '@/components/crm/row-drawer';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import {
  saveLeadCategory,
  deleteLeadCategory,
  bulkDeleteLeadCategories,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadCategory } from '@/lib/worksuite/crm-types';
import type { WithId } from 'mongodb';
import type { LeadCategoryKpis } from '@/app/actions/worksuite/crm-plus.actions.types';

type Row = WithId<WsLeadCategory> & { _id: string };

interface Props {
  rows: Row[];
  kpi: LeadCategoryKpis;
}

function fmtDate(v?: string | Date | null): string {
  if (!v) return '—';
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/* ─── Inline edit form inside RowDrawer ─────────────────────────── */
function CategoryEditForm({
  row,
  onDone,
}: {
  row: Row;
  onDone: () => void;
}) {
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveLeadCategory(undefined, fd);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Saved', description: 'Category updated.' });
        onDone();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="_id" value={row._id} />
      <div className="space-y-1.5">
        <Label htmlFor="cat-name">Category Name</Label>
        <Input
          id="cat-name"
          name="category_name"
          defaultValue={row.category_name}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cat-default">Default</Label>
        <Select name="is_default" defaultValue={row.is_default ? 'yes' : 'no'}>
          <ZoruSelectTrigger id="cat-default">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="no">No</ZoruSelectItem>
            <ZoruSelectItem value="yes">Yes</ZoruSelectItem>
          </ZoruSelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Saving…' : 'Save Changes'}
      </Button>
    </form>
  );
}

/* ─── Main client component ─────────────────────────────────────── */
export function CategoriesClient({ rows: initialRows, kpi }: Props) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Row[]>(initialRows);
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [drawerRefresh, setDrawerRefresh] = React.useState(0);

  // Re-sync when server re-renders pass new initialRows
  React.useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const filtered = rows.filter((r) =>
    r.category_name?.toLowerCase().includes(search.toLowerCase()),
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
      setSelected(new Set(filtered.map((r) => r._id)));
    }
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteLeadCategory(id);
      if (r.success) {
        setRows((prev) => prev.filter((x) => x._id !== id));
        toast({ title: 'Deleted', description: 'Category removed.' });
      } else {
        toast({ title: 'Error', description: r.error ?? 'Failed', variant: 'destructive' });
      }
    });
  }

  function handleBulkDelete() {
    const ids = [...selected];
    startTransition(async () => {
      const r = await bulkDeleteLeadCategories(ids);
      if (r.success) {
        setRows((prev) => prev.filter((x) => !ids.includes(x._id)));
        setSelected(new Set());
        toast({ title: 'Deleted', description: `${r.processed} categories removed.` });
      } else {
        toast({ title: 'Error', description: r.error ?? 'Failed', variant: 'destructive' });
      }
    });
  }

  function handleExportCsv() {
    downloadCsv(`categories-${dateStamp()}.csv`, ['category_name', 'is_default', 'createdAt'], filtered.map((r) => ({
      category_name: r.category_name,
      is_default: r.is_default ? 'Yes' : 'No',
      createdAt: fmtDate(r.createdAt),
    })));
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
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Tags className="h-8 w-8 text-[var(--st-text-secondary)]" strokeWidth={1.5} />
        <p className="text-[13px] text-[var(--st-text-secondary)]">
          {search ? 'No categories match your search.' : 'No categories yet.'}
        </p>
      </div>
    ) : undefined;

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Categories" value={kpi.total} icon={<Tags />} />
        <StatCard label="With Deals" value={kpi.withDeals} />
        <StatCard label="With Leads" value={kpi.withLeads} />
        <StatCard label="Most Used" value={kpi.mostUsed} />
      </div>

      <EntityListShell
        title="Lead Categories"
        subtitle="Group leads by line-of-business or product family."
        search={{ value: search, onChange: setSearch, placeholder: 'Search categories…' }}
        primaryAction={
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        }
        bulkBar={bulkBar}
        empty={empty}
        loading={false}
      >
        <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-[var(--st-border)]">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={toggleAll}
                    aria-label="Select all"
                    className="rounded border-[var(--st-border)]"
                  />
                </ZoruTableHead>
                <ZoruTableHead>Name</ZoruTableHead>
                <ZoruTableHead>Default</ZoruTableHead>
                <ZoruTableHead>Created</ZoruTableHead>
                <ZoruTableHead className="w-24">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filtered.map((row) => (
                <ZoruTableRow key={row._id} data-selected={selected.has(row._id)}>
                  <ZoruTableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(row._id)}
                      onChange={() => toggleRow(row._id)}
                      aria-label={`Select ${row.category_name}`}
                      className="rounded border-[var(--st-border)]"
                    />
                  </ZoruTableCell>
                  <ZoruTableCell className="font-medium text-[var(--st-text)]">
                    <RowDrawer
                      label={row.category_name}
                      title="Edit Category"
                      description="Update category name and default status."
                      key={`${row._id}-${drawerRefresh}`}
                    >
                      <CategoryEditForm
                        row={row}
                        onDone={() => {
                          setDrawerRefresh((n) => n + 1);
                          // Reload from server on next render cycle
                        }}
                      />
                    </RowDrawer>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <span
                      className={
                        row.is_default
                          ? 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                          : 'text-[12px] text-[var(--st-text-secondary)]'
                      }
                    >
                      {row.is_default ? 'Yes' : 'No'}
                    </span>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12px] text-[var(--st-text-secondary)]">
                    {fmtDate(row.createdAt)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(row._id)}
                      disabled={isPending}
                      aria-label={`Delete ${row.category_name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                    </Button>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </Table>
        </div>
      </EntityListShell>
    </div>
  );
}
