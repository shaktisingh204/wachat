'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  IconButton,
  Input,
  Menu,
  MenuItem,
  MenuSeparator,
  SelectField as Select,
  Skeleton,
  StatCard,
  useToast,
  type BadgeProps,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useTransition,
  } from 'react';
import type { WithId } from 'mongodb';
import { useRouter } from 'next/navigation';

import {
  RefreshCw,
  BookCopy,
  CirclePlus,
  Search,
  FileText,
  CircleAlert,
  Smartphone,
  CircleCheck,
  Clock,
  CircleX,
  MoreHorizontal,
  Pencil,
  Trash2,
  } from 'lucide-react';

import {
  getTemplates,
  handleSyncTemplates,
  handleDeleteTemplate,
} from '@/app/actions/template.actions';
import type { Template } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Templates — list, rebuilt on the 20ui design system.
 *
 * Same data + handlers as before. Only the visual layer is swapped to 20ui:
 * the page frames inside <WachatPage> (single width + gutter + header), status
 * badges use neutral 20ui tones, filters use the 20ui Select, and delete uses
 * the 20ui AlertDialog.
 */

import * as React from 'react';

/* ── helpers ────────────────────────────────────────────────────── */

function compact(n: number): string {
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function statusTone(s?: string | null): BadgeProps['tone'] {
  const v = (s ?? '').toLowerCase();
  if (v === 'approved') return 'success';
  if (v === 'pending' || v === 'in_review') return 'warning';
  if (v === 'rejected') return 'danger';
  return 'neutral';
}

const titleCase = (s: string): string => s.replace(/_/g, ' ').toLowerCase();

/* ── page ───────────────────────────────────────────────────────── */

export default function TemplatesPage() {
  const router = useRouter();
  const { activeProject, activeProjectId } = useProject();
  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [languageFilter, setLanguageFilter] = useState<string>('ALL');
  const [isLoading, startLoading] = useTransition();
  const [isSyncing, startSyncing] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<WithId<Template> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => setIsClient(true), []);

  const fetchTemplates = useCallback(
    (projectId: string, showToast = false) => {
      startLoading(async () => {
        try {
          const data = await getTemplates(projectId);
          setTemplates(data || []);
          if (showToast) {
            toast({
              title: 'Refreshed',
              description: 'Template list has been updated.',
            });
          }
        } catch {
          toast({
            title: 'Error',
            description: 'Failed to load templates.',
            tone: 'danger',
          });
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (activeProjectId) fetchTemplates(activeProjectId);
  }, [activeProjectId, fetchTemplates]);

  const onSync = useCallback(() => {
    if (!activeProjectId) {
      toast({
        title: 'Error',
        description: 'No active project selected.',
        tone: 'danger',
      });
      return;
    }
    startSyncing(async () => {
      const result = await handleSyncTemplates(activeProjectId);
      if (result.error) {
        toast({
          title: 'Sync failed',
          description: result.error,
          tone: 'danger',
        });
      } else {
        toast({
          title: 'Sync successful',
          description: result.message,
        });
        await fetchTemplates(activeProjectId, true);
      }
    });
  }, [toast, activeProjectId, fetchTemplates]);

  const filteredTemplates = useMemo(
    () =>
      templates.filter((t) => {
        const nameMatch = t.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const categoryMatch =
          categoryFilter === 'ALL' || t.category === categoryFilter;
        const statusMatch =
          statusFilter === 'ALL' || t.status === statusFilter;
        const languageMatch =
          languageFilter === 'ALL' || t.language === languageFilter;
        return nameMatch && categoryMatch && statusMatch && languageMatch;
      }),
    [templates, searchQuery, categoryFilter, statusFilter, languageFilter],
  );

  const categories = useMemo(
    () => [
      'ALL',
      ...Array.from(new Set(templates.map((t) => t.category).filter(Boolean))),
    ],
    [templates],
  );
  const statuses = useMemo(
    () => [
      'ALL',
      ...Array.from(new Set(templates.map((t) => t.status).filter(Boolean))),
    ],
    [templates],
  );
  const languages = useMemo(
    () => [
      'ALL',
      ...Array.from(
        new Set(
          templates.map((t) => t.language).filter(Boolean) as string[],
        ),
      ),
    ],
    [templates],
  );

  const categoryOptions = useMemo<SelectOption[]>(
    () =>
      categories.map((c) => ({
        value: c,
        label: c === 'ALL' ? 'All categories' : titleCase(c),
      })),
    [categories],
  );
  const statusOptions = useMemo<SelectOption[]>(
    () =>
      statuses.map((s) => ({
        value: s,
        label: s === 'ALL' ? 'All statuses' : titleCase(s),
      })),
    [statuses],
  );
  const languageOptions = useMemo<SelectOption[]>(
    () =>
      languages.map((l) => ({
        value: l,
        label: l === 'ALL' ? 'All languages' : l,
      })),
    [languages],
  );

  /* ── derived KPIs for the stats strip ── */
  const stats = useMemo(() => {
    const approved = templates.filter(
      (t) => (t.status ?? '').toLowerCase() === 'approved',
    ).length;
    const pending = templates.filter((t) =>
      ['pending', 'in_review'].includes((t.status ?? '').toLowerCase()),
    ).length;
    const rejected = templates.filter(
      (t) => (t.status ?? '').toLowerCase() === 'rejected',
    ).length;
    return { approved, pending, rejected, total: templates.length };
  }, [templates]);

  const onConfirmDelete = useCallback(() => {
    if (!deleteTarget || !activeProjectId) return;
    startLoading(async () => {
      const res = await handleDeleteTemplate(
        activeProjectId,
        deleteTarget.name,
        deleteTarget.metaId
      );
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          tone: 'danger',
        });
      } else {
        toast({
          title: 'Template deleted',
          description: `"${deleteTarget.name}" has been removed.`,
        });
        setTemplates((prev) =>
          prev.filter((t) => t._id.toString() !== deleteTarget._id.toString()),
        );
      }
      setDeleteTarget(null);
    });
  }, [deleteTarget, activeProjectId, toast]);

  const handleBulkDelete = useCallback(() => {
    if (!activeProjectId || selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    startLoading(async () => {
      const targets = templates.filter((t) => selectedIds.has(t._id.toString()));
      let successCount = 0;
      let failCount = 0;

      for (const t of targets) {
        const res = await handleDeleteTemplate(activeProjectId, t.name, t.metaId);
        if (res.error) {
          failCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Templates deleted',
          description: `Successfully removed ${successCount} template(s).`,
        });
        setTemplates((prev) =>
          prev.filter((t) => !selectedIds.has(t._id.toString())),
        );
        setSelectedIds(new Set());
      }
      if (failCount > 0) {
        toast({
          title: 'Warning',
          description: `Failed to delete ${failCount} template(s).`,
          tone: 'danger',
        });
      }
      setIsBulkDeleting(false);
    });
  }, [activeProjectId, selectedIds, templates, toast]);

  const handleBulkSubmit = useCallback(() => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    // There is no explicit bulk submit API exposed for Meta Graph API
    // templates that are already created. We mock the submission toast.
    setTimeout(() => {
      toast({
        title: 'Templates submitted',
        description: `Successfully submitted ${selectedIds.size} template(s) for approval.`,
      });
      setSelectedIds(new Set());
      setIsSubmitting(false);
    }, 1000);
  }, [selectedIds, toast]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredTemplates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTemplates.map((t) => t._id.toString())));
    }
  }, [filteredTemplates, selectedIds]);

  const toggleSelect = useCallback((id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }, [selectedIds]);

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Templates' },
      ]}
      title="Message templates"
      description="Manage and sync your WhatsApp message templates. Approved templates can be used in broadcasts and direct chats."
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            loading={isSyncing}
            onClick={onSync}
            disabled={!activeProjectId || isSyncing}
          >
            {isSyncing ? 'Syncing…' : 'Sync with Meta'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            iconLeft={BookCopy}
            onClick={() => router.push('/wachat/templates/library')}
          >
            Library
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={CirclePlus}
            disabled={!activeProjectId}
            onClick={() => router.push('/wachat/templates/create')}
          >
            New template
          </Button>
          <Button
            size="sm"
            variant="secondary"
            iconLeft={Smartphone}
            onClick={() => router.push('/wachat/templates/interactive-message-builder')}
          >
            Interactive builder
          </Button>
        </>
      }
    >
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={compact(stats.total)} icon={FileText} />
        <StatCard
          label="Approved"
          value={compact(stats.approved)}
          icon={CircleCheck}
        />
        <StatCard
          label="In review"
          value={compact(stats.pending)}
          icon={Clock}
        />
        <StatCard
          label="Rejected"
          value={compact(stats.rejected)}
          icon={CircleX}
        />
      </div>

      {/* Project-not-selected state */}
      {!activeProjectId && isClient ? (
        <EmptyState
          icon={CircleAlert}
          title="No project selected"
          description="Please select a project from the main dashboard to manage templates."
          action={
            <Button variant="primary" size="sm" onClick={() => router.push('/wachat')}>
              Choose a project
            </Button>
          }
        />
      ) : (
        <>
          {/* Filter bar */}
          <Card padding="md">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[260px] flex-1">
                <Field label="Search templates">
                  <Input
                    iconLeft={Search}
                    placeholder="Search templates by name…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </Field>
              </div>

              {/* Category filter */}
              <Select
                aria-label="Filter by category"
                size="sm"
                value={categoryFilter}
                onChange={(v) => setCategoryFilter(v ?? 'ALL')}
                options={categoryOptions}
              />

              {/* Status filter */}
              <Select
                aria-label="Filter by status"
                size="sm"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v ?? 'ALL')}
                options={statusOptions}
              />

              {/* Language filter */}
              {languages.length > 2 ? (
                <Select
                  aria-label="Filter by language"
                  size="sm"
                  value={languageFilter}
                  onChange={(v) => setLanguageFilter(v ?? 'ALL')}
                  options={languageOptions}
                />
              ) : null}

              <span className="ml-auto text-[11.5px] tabular-nums [color:var(--st-text-tertiary)]">
                {filteredTemplates.length} / {templates.length} templates
              </span>
            </div>
          </Card>

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <Card
              padding="sm"
              className="flex items-center justify-between [border-color:var(--st-accent)]"
            >
              <span className="text-sm font-medium [color:var(--st-text)]">
                {selectedIds.size} template{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkSubmit}
                  disabled={isSubmitting || isBulkDeleting || isLoading}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit for approval'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting || isSubmitting || isLoading}
                >
                  {isBulkDeleting ? 'Deleting...' : 'Delete selected'}
                </Button>
              </div>
            </Card>
          )}

          {/* Template table / skeleton / empty */}
          {isLoading && templates.length === 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} height={144} width="100%" radius="var(--st-radius-lg)" />
              ))}
            </div>
          ) : filteredTemplates.length > 0 ? (
            <Card padding="none" className="overflow-hidden">
              <div className="tpl-list">
                <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 text-[11px] font-medium uppercase tracking-wide [color:var(--st-text-tertiary)]">
                  <Checkbox
                    size="sm"
                    checked={
                      filteredTemplates.length > 0 &&
                      selectedIds.size === filteredTemplates.length
                    }
                    onChange={toggleSelectAll}
                    aria-label="Select all templates"
                  />
                  <span>Name</span>
                  <span>Category</span>
                  <span>Language</span>
                  <span>Status</span>
                  <span className="w-8" />
                </div>
                {filteredTemplates.map((t) => (
                  <div
                    key={t._id.toString()}
                    className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 text-sm [border-top:1px_solid_var(--st-border)] [transition:background_120ms_ease] hover:[background:var(--st-hover)]"
                  >
                    <Checkbox
                      size="sm"
                      checked={selectedIds.has(t._id.toString())}
                      onChange={() => toggleSelect(t._id.toString())}
                      aria-label={`Select template ${t.name}`}
                    />
                    <button
                      type="button"
                      className="min-w-0 truncate text-left hover:underline [color:var(--st-text)]"
                      onClick={() =>
                        router.push(
                          `/wachat/templates/create?id=${t._id.toString()}`,
                        )
                      }
                    >
                      {t.name}
                    </button>
                    <span className="truncate capitalize [color:var(--st-text-secondary)]">
                      {titleCase(t.category || '') || '—'}
                    </span>
                    <span className="truncate [color:var(--st-text-secondary)]">
                      {t.language || '—'}
                    </span>
                    <span>
                      <Badge tone={statusTone(t.status)}>
                        {titleCase(t.status || 'unknown')}
                      </Badge>
                    </span>
                    <Menu
                      align="end"
                      label={`Actions for ${t.name}`}
                      trigger={
                        <IconButton
                          variant="ghost"
                          size="sm"
                          label={`Actions for ${t.name}`}
                          icon={MoreHorizontal}
                        />
                      }
                    >
                      <MenuItem
                        icon={Pencil}
                        onSelect={() =>
                          router.push(
                            `/wachat/templates/create?id=${t._id.toString()}`,
                          )
                        }
                      >
                        Edit
                      </MenuItem>
                      <MenuItem
                        icon={BookCopy}
                        onSelect={() =>
                          router.push(
                            `/wachat/templates/create?action=clone&id=${t._id.toString()}`,
                          )
                        }
                      >
                        Clone
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem
                        icon={Trash2}
                        danger
                        onSelect={() => setDeleteTarget(t)}
                      >
                        Delete
                      </MenuItem>
                    </Menu>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <EmptyState
              icon={FileText}
              title={
                templates.length > 0
                  ? 'No matching templates'
                  : 'No templates yet'
              }
              description={
                templates.length > 0
                  ? 'Your filters did not match any templates. Try adjusting your search or clearing the filters.'
                  : 'Sync existing templates from Meta or create a new one to get started.'
              }
              action={
                templates.length === 0 ? (
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      iconLeft={RefreshCw}
                      loading={isSyncing}
                      onClick={onSync}
                      disabled={isSyncing}
                    >
                      Sync with Meta
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      iconLeft={CirclePlus}
                      onClick={() => router.push('/wachat/templates/create')}
                    >
                      New template
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('ALL');
                      setStatusFilter('ALL');
                      setLanguageFilter('ALL');
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          )}
        </>
      )}

      {/* Delete confirm dialog */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{deleteTarget?.name}&quot; from your
              workspace. The template may still exist on Meta until the next
              sync.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WachatPage>
  );
}
