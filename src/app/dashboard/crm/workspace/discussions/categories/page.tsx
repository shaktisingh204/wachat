'use client';

/**
 * Discussion Categories — Deep list template (lite).
 *
 * KPIs (3): total categories · active discussions · top trending category.
 * Search + parent filter. Bulk delete via row checkboxes. CSV / XLSX export.
 * Inline-create dialog with: name, colour, description, parent.
 */

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import {
  ArrowLeft,
  Download,
  Flame,
  Folder,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCheckbox,
  ZoruColorPicker,
  ZoruDialog,
  ZoruDialogClose,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { downloadCsv, downloadXlsx, type ExportRow } from '@/lib/crm-list-export';
import {
  deleteDiscussionCategory,
  getDiscussionCategories,
  getDiscussions,
  saveDiscussionCategory,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
  WsDiscussion,
  WsDiscussionCategory,
} from '@/lib/worksuite/knowledge-types';

type CategoryRow = WsDiscussionCategory & {
  _id: string;
  color?: string;
  description?: string;
  parent?: string;
};

interface FilterState {
  search: string;
  parent: string;
}

const INITIAL: FilterState = { search: '', parent: 'all' };

export default function DiscussionCategoriesPage(): React.JSX.Element {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<CategoryRow[]>([]);
  const [discussions, setDiscussions] = React.useState<
    (WsDiscussion & { _id: string })[]
  >([]);
  const [loading, startTransition] = React.useTransition();
  const [filters, setFilters] = React.useState<FilterState>(INITIAL);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CategoryRow | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [color, setColor] = React.useState<string>('#3b82f6');

  React.useEffect(() => {
    setColor(editing?.color ?? '#3b82f6');
  }, [editing]);

  const fetchData = React.useCallback(() => {
    startTransition(async () => {
      try {
        const [cats, disc] = await Promise.all([
          getDiscussionCategories(),
          getDiscussions(),
        ]);
        setRows(cats as CategoryRow[]);
        setDiscussions(disc as (WsDiscussion & { _id: string })[]);
      } catch (err) {
        toast({
          title: 'Could not load categories',
          description: err instanceof Error ? err.message : 'Unknown',
          variant: 'destructive',
        });
      }
    });
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useDebouncedCallback(
    (v: string) => setFilters((p) => ({ ...p, search: v })),
    200,
  );

  /** Discussion counts per category id (O(n) once per render). */
  const discussionCountByCat = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const d of discussions) {
      if (!d.category_id) continue;
      map.set(d.category_id, (map.get(d.category_id) ?? 0) + 1);
    }
    return map;
  }, [discussions]);

  const topTrendingId = React.useMemo(() => {
    let topId: string | null = null;
    let topCount = -1;
    for (const [id, count] of discussionCountByCat) {
      if (count > topCount) {
        topId = id;
        topCount = count;
      }
    }
    return topId;
  }, [discussionCountByCat]);

  const topTrendingName = React.useMemo(() => {
    if (!topTrendingId) return '—';
    return rows.find((r) => r._id === topTrendingId)?.name ?? '—';
  }, [topTrendingId, rows]);

  const visible = React.useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.name ?? ''} ${r.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.parent === 'none' && r.parent) return false;
      if (filters.parent !== 'all' && filters.parent !== 'none' && r.parent !== filters.parent)
        return false;
      return true;
    });
  }, [rows, filters]);

  const allVisibleIds = React.useMemo(() => visible.map((r) => r._id), [visible]);
  const allSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someSelected = allVisibleIds.some((id) => selected.has(id));

  const toggleAll = React.useCallback(() => {
    setSelected((cur) => {
      if (allSelected) {
        const next = new Set(cur);
        for (const id of allVisibleIds) next.delete(id);
        return next;
      }
      const next = new Set(cur);
      for (const id of allVisibleIds) next.add(id);
      return next;
    });
  }, [allSelected, allVisibleIds]);

  const toggleOne = React.useCallback((id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSubmit = async (formData: FormData) => {
    if (editing?._id) formData.set('id', editing._id);
    const res = await saveDiscussionCategory(null, formData);
    if (res.message) {
      toast({ title: 'Saved' });
      setOpen(false);
      setEditing(null);
      fetchData();
    } else if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    const r = await deleteDiscussionCategory(deleteId);
    if (r.success) {
      toast({ title: 'Deleted' });
      setSelected((cur) => {
        const next = new Set(cur);
        next.delete(deleteId);
        return next;
      });
      fetchData();
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }
    setDeleteId(null);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      const r = await deleteDiscussionCategory(id);
      if (r.success) ok += 1;
      else fail += 1;
    }
    toast({
      title: fail === 0 ? 'Deleted' : 'Partial delete',
      description: `${ok} deleted, ${fail} failed.`,
      variant: fail === 0 ? undefined : 'destructive',
    });
    setSelected(new Set());
    setBulkConfirm(false);
    fetchData();
  };

  const buildExportRows = React.useCallback((): ExportRow[] => {
    return visible.map((r) => ({
      Name: r.name ?? '',
      Color: r.color ?? '',
      Parent: rows.find((x) => x._id === r.parent)?.name ?? '',
      Description: r.description ?? '',
      Discussions: discussionCountByCat.get(r._id) ?? 0,
    }));
  }, [visible, rows, discussionCountByCat]);

  const headers = ['Name', 'Color', 'Parent', 'Description', 'Discussions'];
  const stamp = new Date().toISOString().slice(0, 10);
  const exportCsv = React.useCallback(
    () => downloadCsv(`discussion-categories-${stamp}.csv`, headers, buildExportRows()),
    [buildExportRows, stamp],
  );
  const exportXlsx = React.useCallback(
    () =>
      downloadXlsx(
        `discussion-categories-${stamp}.xlsx`,
        headers,
        buildExportRows(),
        'Categories',
      ),
    [buildExportRows, stamp],
  );

  const filtersActive = filters.search !== '' || filters.parent !== 'all';

  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-6">
      <EntityListShell
        title="Discussion categories"
        subtitle="Group discussions by topic. Categories can nest under a parent."
        search={{
          value: filters.search,
          onChange: (v) => handleSearch(v),
          placeholder: 'Search categories…',
        }}
        primaryAction={
          <ZoruDialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setEditing(null);
            }}
          >
            <ZoruDialogTrigger asChild>
              <ZoruButton>
                <Plus className="h-4 w-4" /> New category
              </ZoruButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
              <ZoruDialogHeader>
                <ZoruDialogTitle>
                  {editing ? 'Edit category' : 'New category'}
                </ZoruDialogTitle>
                <ZoruDialogDescription>
                  Group discussions by topic. Set a colour for quick visual
                  grouping in the kanban.
                </ZoruDialogDescription>
              </ZoruDialogHeader>
              <form action={handleSubmit} className="grid gap-3">
                <div>
                  <ZoruLabel htmlFor="name">Name *</ZoruLabel>
                  <ZoruInput
                    id="name"
                    name="name"
                    required
                    defaultValue={editing?.name ?? ''}
                    className="mt-1.5 h-10"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <ZoruLabel>Colour</ZoruLabel>
                    <input type="hidden" name="color" value={color} />
                    <div className="mt-1.5">
                      <ZoruColorPicker value={color} onChange={setColor} />
                    </div>
                  </div>
                  <div>
                    <ZoruLabel htmlFor="parent">Parent</ZoruLabel>
                    <ZoruSelect
                      name="parent"
                      defaultValue={editing?.parent ?? ''}
                    >
                      <ZoruSelectTrigger id="parent" className="mt-1.5 h-10">
                        <ZoruSelectValue placeholder="None" />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        <ZoruSelectItem value="">None</ZoruSelectItem>
                        {rows
                          .filter((r) => r._id !== editing?._id)
                          .map((c) => (
                            <ZoruSelectItem key={c._id} value={c._id}>
                              {c.name}
                            </ZoruSelectItem>
                          ))}
                      </ZoruSelectContent>
                    </ZoruSelect>
                  </div>
                </div>
                <div>
                  <ZoruLabel htmlFor="description">Description</ZoruLabel>
                  <ZoruTextarea
                    id="description"
                    name="description"
                    rows={3}
                    defaultValue={editing?.description ?? ''}
                    className="mt-1.5"
                  />
                </div>
                <ZoruDialogFooter>
                  <ZoruDialogClose asChild>
                    <ZoruButton variant="ghost" type="button">
                      Cancel
                    </ZoruButton>
                  </ZoruDialogClose>
                  <ZoruButton type="submit">
                    {editing ? 'Save changes' : 'Create'}
                  </ZoruButton>
                </ZoruDialogFooter>
              </form>
            </ZoruDialogContent>
          </ZoruDialog>
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect
              value={filters.parent}
              onValueChange={(v) => setFilters((p) => ({ ...p, parent: v }))}
            >
              <ZoruSelectTrigger className="h-9 w-[180px]">
                <ZoruSelectValue placeholder="Parent" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">Any parent</ZoruSelectItem>
                <ZoruSelectItem value="none">No parent (root)</ZoruSelectItem>
                {rows.map((r) => (
                  <ZoruSelectItem key={r._id} value={r._id}>
                    {r.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            {filtersActive ? (
              <ZoruButton
                variant="ghost"
                size="sm"
                onClick={() => setFilters(INITIAL)}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </ZoruButton>
            ) : null}
            <div className="ml-auto flex gap-1">
              <ZoruButton variant="ghost" size="sm" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" /> CSV
              </ZoruButton>
              <ZoruButton variant="ghost" size="sm" onClick={exportXlsx}>
                <Download className="h-3.5 w-3.5" /> XLSX
              </ZoruButton>
            </div>
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-zoru-ink">
                {selected.size} selected
              </span>
              <div className="flex gap-2">
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </ZoruButton>
                <ZoruButton
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkConfirm(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        empty={
          !loading && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-4">
              <Folder className="h-5 w-5 text-zoru-ink-muted" />
              <p className="text-sm text-zoru-ink-muted">
                No categories yet — click <strong>New category</strong> above.
              </p>
            </div>
          ) : null
        }
        loading={loading && rows.length === 0}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ZoruStatCard
              label="Total categories"
              value={rows.length}
              icon={<Folder className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Active discussions"
              value={discussions.length}
              icon={<MessageSquare className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Top trending"
              value={topTrendingName}
              icon={<Flame className="h-4 w-4" />}
            />
          </div>

          <div className="flex justify-end pb-1">
            <Link
              href="/dashboard/crm/workspace/discussions"
              className="inline-flex items-center gap-1 text-[12.5px] text-zoru-ink-muted hover:underline"
            >
              <ArrowLeft className="h-3 w-3" /> Back to discussions
            </Link>
          </div>

          <div className="overflow-x-auto rounded-[var(--zoru-radius-lg)] border border-zoru-line">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                <tr>
                  <th className="w-8 px-3 py-2 text-left">
                    <ZoruCheckbox
                      checked={
                        allSelected
                          ? true
                          : someSelected
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  {['Name', 'Colour', 'Parent', 'Discussions', 'Description', ''].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zoru-line bg-zoru-bg">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-zoru-ink-muted">
                      No categories match the current filters.
                    </td>
                  </tr>
                ) : null}
                {visible.map((r) => {
                  const parent = rows.find((x) => x._id === r.parent);
                  const count = discussionCountByCat.get(r._id) ?? 0;
                  return (
                    <tr key={r._id} className="hover:bg-zoru-surface">
                      <td className="px-3 py-2">
                        <ZoruCheckbox
                          checked={selected.has(r._id)}
                          onCheckedChange={() => toggleOne(r._id)}
                          aria-label={`Select ${r.name}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <EntityRowLink
                          href={`/dashboard/crm/workspace/discussions?category=${r._id}`}
                          label={r.name}
                          subtitle={
                            count > 0 ? `${count} discussions` : 'No discussions'
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        {r.color ? (
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-block h-4 w-4 rounded-full border border-zoru-line"
                              style={{ backgroundColor: r.color }}
                            />
                            <span className="text-[12px] text-zoru-ink-muted">
                              {r.color}
                            </span>
                          </span>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {parent ? (
                          <ZoruBadge variant="ghost">{parent.name}</ZoruBadge>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <ZoruBadge variant={count > 0 ? 'default' : 'ghost'}>
                          {count}
                        </ZoruBadge>
                      </td>
                      <td className="px-3 py-2 text-zoru-ink-muted">
                        {r.description || '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(r);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </ZoruButton>
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(r._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </ZoruButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete this category?"
        description="Discussions in this category won't be deleted, but will become uncategorized."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={bulkConfirm}
        onOpenChange={setBulkConfirm}
        title={`Delete ${selected.size} categories?`}
        description="The selected categories will be permanently removed. Existing discussions become uncategorized."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
