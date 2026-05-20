'use client';

/**
 * Knowledge Base Categories — Deep list template (lite).
 *
 * KPIs (3): total KB categories · articles per category · most populated category.
 * Search · type filter (article/video/etc on associated KB) · bulk delete · CSV/XLSX.
 * Inline-create dialog; RowDrawer for inline edit (no detail page).
 */

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import {
  ArrowLeft,
  BookOpen,
  Download,
  FileText,
  Flame,
  Folder,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCheckbox,
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
  ZoruStatCard,
  useZoruToast,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { RowDrawer } from '@/components/crm/row-drawer';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { downloadCsv, downloadXlsx, type ExportRow } from '@/lib/crm-list-export';
import {
  deleteKnowledgeBaseCategory,
  getKnowledgeBaseCategories,
  getKnowledgeBases,
  saveKnowledgeBaseCategory,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
  WsKnowledgeBase,
  WsKnowledgeBaseCategory,
} from '@/lib/worksuite/knowledge-types';

type Row = WsKnowledgeBaseCategory & { _id: string };

interface FilterState {
  search: string;
  populated: 'all' | 'with' | 'empty';
}

const INITIAL: FilterState = { search: '', populated: 'all' };

export default function KnowledgeBaseCategoriesPage(): React.JSX.Element {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [articles, setArticles] = React.useState<
    (WsKnowledgeBase & { _id: string })[]
  >([]);
  const [loading, startTransition] = React.useTransition();
  const [filters, setFilters] = React.useState<FilterState>(INITIAL);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const fetchData = React.useCallback(() => {
    startTransition(async () => {
      try {
        const [cats, kbs] = await Promise.all([
          getKnowledgeBaseCategories(),
          getKnowledgeBases(),
        ]);
        setRows(cats as Row[]);
        setArticles(kbs as (WsKnowledgeBase & { _id: string })[]);
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

  const articlesByCat = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const a of articles) {
      if (!a.category_id) continue;
      map.set(a.category_id, (map.get(a.category_id) ?? 0) + 1);
    }
    return map;
  }, [articles]);

  const topId = React.useMemo(() => {
    let id: string | null = null;
    let max = -1;
    for (const [cid, count] of articlesByCat) {
      if (count > max) {
        id = cid;
        max = count;
      }
    }
    return id;
  }, [articlesByCat]);

  const topName = React.useMemo(
    () => (topId ? (rows.find((r) => r._id === topId)?.name ?? '—') : '—'),
    [topId, rows],
  );

  const avgArticles = React.useMemo(() => {
    if (rows.length === 0) return 0;
    return Math.round((articles.length / rows.length) * 10) / 10;
  }, [rows.length, articles.length]);

  const visible = React.useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !(r.name ?? '').toLowerCase().includes(q)) return false;
      const count = articlesByCat.get(r._id) ?? 0;
      if (filters.populated === 'with' && count === 0) return false;
      if (filters.populated === 'empty' && count > 0) return false;
      return true;
    });
  }, [rows, filters, articlesByCat]);

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
    const res = await saveKnowledgeBaseCategory(null, formData);
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
    const r = await deleteKnowledgeBaseCategory(deleteId);
    if (r.success) {
      toast({ title: 'Deleted' });
      setSelected((cur) => {
        const n = new Set(cur);
        n.delete(deleteId);
        return n;
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
      const r = await deleteKnowledgeBaseCategory(id);
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
      Articles: articlesByCat.get(r._id) ?? 0,
      Created: r.createdAt ? new Date(r.createdAt as string).toISOString() : '',
    }));
  }, [visible, articlesByCat]);

  const headers = ['Name', 'Articles', 'Created'];
  const stamp = new Date().toISOString().slice(0, 10);
  const exportCsv = React.useCallback(
    () => downloadCsv(`kb-categories-${stamp}.csv`, headers, buildExportRows()),
    [buildExportRows, stamp],
  );
  const exportXlsx = React.useCallback(
    () =>
      downloadXlsx(`kb-categories-${stamp}.xlsx`, headers, buildExportRows(), 'Categories'),
    [buildExportRows, stamp],
  );

  const filtersActive = filters.search !== '' || filters.populated !== 'all';

  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-6">
      <EntityListShell
        title="KB Categories"
        subtitle="Organise knowledge base articles by category."
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
                  Group knowledge base articles by topic.
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
            <div className="inline-flex rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-0.5">
              {(['all', 'with', 'empty'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFilters((p) => ({ ...p, populated: v }))}
                  className={
                    'rounded-[calc(var(--zoru-radius)-2px)] px-2.5 py-1 text-[12.5px] font-medium capitalize transition-colors ' +
                    (filters.populated === v
                      ? 'bg-zoru-bg text-zoru-ink shadow-[var(--zoru-shadow-sm)]'
                      : 'text-zoru-ink-muted hover:text-zoru-ink')
                  }
                >
                  {v === 'all' ? 'All' : v === 'with' ? 'With articles' : 'Empty'}
                </button>
              ))}
            </div>
            {filtersActive ? (
              <ZoruButton variant="ghost" size="sm" onClick={() => setFilters(INITIAL)}>
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
              label="Avg articles / category"
              value={avgArticles}
              icon={<FileText className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Most populated"
              value={topName}
              icon={<Flame className="h-4 w-4" />}
            />
          </div>

          <div className="flex justify-end pb-1">
            <Link
              href="/dashboard/crm/workspace/knowledge-base"
              className="inline-flex items-center gap-1 text-[12.5px] text-zoru-ink-muted hover:underline"
            >
              <ArrowLeft className="h-3 w-3" /> Back to knowledge base
            </Link>
          </div>

          <div className="overflow-x-auto rounded-[var(--zoru-radius-lg)] border border-zoru-line">
            <table className="w-full min-w-[640px] text-[13px]">
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
                  {['Name', 'Articles', 'Created', ''].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zoru-line bg-zoru-bg">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-zoru-ink-muted">
                      No categories match the current filters.
                    </td>
                  </tr>
                ) : null}
                {visible.map((r) => {
                  const count = articlesByCat.get(r._id) ?? 0;
                  const created = r.createdAt
                    ? new Date(r.createdAt as string).toLocaleDateString()
                    : '—';
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
                        {count > 0 ? (
                          <EntityRowLink
                            href={`/dashboard/crm/workspace/knowledge-base?category=${r._id}`}
                            label={r.name}
                            subtitle={`${count} article${count === 1 ? '' : 's'}`}
                          />
                        ) : (
                          <RowDrawer
                            label={r.name}
                            subtitle="No articles"
                            title={r.name}
                            description="Edit category details"
                            width="sm"
                          >
                            <div className="flex flex-col gap-3">
                              <div className="text-[12px] text-zoru-ink-muted">
                                Created {created}
                              </div>
                              <ZoruButton
                                size="sm"
                                onClick={() => {
                                  setEditing(r);
                                  setOpen(true);
                                }}
                              >
                                Edit category
                              </ZoruButton>
                              <ZoruButton
                                asChild
                                variant="outline"
                                size="sm"
                              >
                                <Link href="/dashboard/crm/workspace/knowledge-base/new">
                                  <Plus className="h-3.5 w-3.5" /> Add article in
                                  this category
                                </Link>
                              </ZoruButton>
                            </div>
                          </RowDrawer>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <ZoruBadge variant={count > 0 ? 'default' : 'ghost'}>
                          <BookOpen className="h-3 w-3" /> {count}
                        </ZoruBadge>
                      </td>
                      <td className="px-3 py-2 text-zoru-ink-muted">{created}</td>
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
        description="Articles in this category will become uncategorized but remain available."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={bulkConfirm}
        onOpenChange={setBulkConfirm}
        title={`Delete ${selected.size} categories?`}
        description="Articles in these categories will become uncategorized."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
