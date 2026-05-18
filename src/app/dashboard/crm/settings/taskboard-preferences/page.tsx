'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
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
import {
  KanbanSquare,
  Save,
  Trash2,
  Layers3,
  EyeOff,
  } from 'lucide-react';

/**
 * Taskboard Preferences — per-project view presets.
 *
 * §1D-style: list-of-presets settings page with editor card on the
 * left and a searchable preset list on the right.
 *  - KPI strip (Total presets · Scoped to project · Hide-done count)
 *  - Search across project_id / group_by / sort_by
 *  - Filter chips by group_by
 *  - Editor saves via saveTaskboardSettings(prev, projectId|null, patch)
 *  - Click preset → load into editor
 *
 * Preserves every key the existing save action reads: project_id,
 * hide_done, group_by, sort_by, visible_columns[].
 */

import * as React from 'react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import {
    getMyTaskboardSettings,
    saveTaskboardSettings,
    deleteTaskboardSettings,
} from '@/app/actions/worksuite/dashboard.actions';
import type {
    WsUserTaskboardSetting,
    WsTaskboardGroupBy,
    WsTaskboardSortBy,
} from '@/lib/worksuite/dashboard-types';

type Row = WsUserTaskboardSetting & { _id: string };

const GROUPS: WsTaskboardGroupBy[] = ['none', 'assignee', 'priority', 'label'];
const SORTS: WsTaskboardSortBy[] = ['due_date', 'priority', 'created'];

export default function TaskboardPreferencesPage() {
    const { toast } = useZoruToast();
    const [rows, setRows] = React.useState<Row[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState('');
    const [groupFilter, setGroupFilter] = React.useState<'all' | WsTaskboardGroupBy>(
        'all',
    );

    const [form, setForm] = React.useState({
        project_id: '',
        hide_done: false,
        group_by: 'none' as WsTaskboardGroupBy,
        sort_by: 'due_date' as WsTaskboardSortBy,
        visible_columns: 'todo, in_progress, review, done',
    });

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = (await getMyTaskboardSettings()) as Row[];
            setRows(Array.isArray(res) ? res : []);
        } catch (e) {
            console.error('Failed to load taskboard settings', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    const filteredRows = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (groupFilter !== 'all' && r.group_by !== groupFilter) return false;
            if (q) {
                return [
                    String(r.project_id ?? ''),
                    r.group_by ?? '',
                    r.sort_by ?? '',
                ].some((s) => s.toLowerCase().includes(q));
            }
            return true;
        });
    }, [rows, search, groupFilter]);

    const handleSave = async () => {
        setSaving(true);
        const res = await saveTaskboardSettings(null, form.project_id || null, {
            hide_done: form.hide_done,
            group_by: form.group_by,
            sort_by: form.sort_by,
            visible_columns: form.visible_columns
                .split(/[\n,]/)
                .map((s) => s.trim())
                .filter(Boolean),
        });
        setSaving(false);
        if (!res.success) {
            toast({
                title: 'Error',
                description: res.error || 'Save failed',
                variant: 'destructive',
            });
            return;
        }
        toast({ title: 'Saved', description: 'Preferences saved.' });
        refresh();
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        const res = await deleteTaskboardSettings(deletingId);
        if (res.success) {
            toast({ title: 'Deleted', description: 'Preset removed.' });
            setDeletingId(null);
            refresh();
        } else {
            toast({
                title: 'Error',
                description: res.error || 'Delete failed',
                variant: 'destructive',
            });
        }
    };

    const loadRow = (r: Row) => {
        setForm({
            project_id: r.project_id ? String(r.project_id) : '',
            hide_done: !!r.hide_done,
            group_by: (r.group_by || 'none') as WsTaskboardGroupBy,
            sort_by: (r.sort_by || 'due_date') as WsTaskboardSortBy,
            visible_columns: (r.visible_columns || []).join(', '),
        });
    };

    const scopedProjects = rows.filter((r) => !!r.project_id).length;
    const hideDoneCount = rows.filter((r) => r.hide_done).length;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Taskboard Preferences"
                subtitle="Per-project Kanban view preferences — hide done, group, sort, visible columns."
                icon={KanbanSquare}
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <ZoruStatCard
                    label="Total presets"
                    value={rows.length}
                    icon={<KanbanSquare className="h-4 w-4" />}
                />
                <ZoruStatCard
                    label="Project-scoped"
                    value={scopedProjects}
                    icon={<Layers3 className="h-4 w-4" />}
                />
                <ZoruStatCard
                    label="Hide-done enabled"
                    value={hideDoneCount}
                    icon={<EyeOff className="h-4 w-4" />}
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <ZoruCard className="p-6 lg:col-span-2">
                    <div className="pb-3">
                        <h2 className="text-[16px] text-zoru-ink">Edit preferences</h2>
                        <p className="text-[12.5px] text-zoru-ink-muted">
                            Leave project id blank for a global default that applies to
                            every project board.
                        </p>
                    </div>
                    <div className="grid gap-3">
                        <div className="grid gap-1.5">
                            <ZoruLabel htmlFor="project-id">
                                Project ID (optional)
                            </ZoruLabel>
                            <ZoruInput
                                id="project-id"
                                value={form.project_id}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        project_id: e.target.value,
                                    }))
                                }
                                placeholder="leave blank for global default"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <ZoruCheckbox
                                id="hide-done"
                                checked={form.hide_done}
                                onCheckedChange={(v) =>
                                    setForm((f) => ({ ...f, hide_done: !!v }))
                                }
                            />
                            <ZoruLabel htmlFor="hide-done">Hide completed tasks</ZoruLabel>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <ZoruLabel>Group by</ZoruLabel>
                                <ZoruSelect
                                    value={form.group_by}
                                    onValueChange={(v) =>
                                        setForm((f) => ({
                                            ...f,
                                            group_by: v as WsTaskboardGroupBy,
                                        }))
                                    }
                                >
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {GROUPS.map((g) => (
                                            <ZoruSelectItem key={g} value={g}>
                                                {g}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="grid gap-1.5">
                                <ZoruLabel>Sort by</ZoruLabel>
                                <ZoruSelect
                                    value={form.sort_by}
                                    onValueChange={(v) =>
                                        setForm((f) => ({
                                            ...f,
                                            sort_by: v as WsTaskboardSortBy,
                                        }))
                                    }
                                >
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {SORTS.map((s) => (
                                            <ZoruSelectItem key={s} value={s}>
                                                {s}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <ZoruLabel htmlFor="cols">
                                Visible columns (comma separated)
                            </ZoruLabel>
                            <ZoruTextarea
                                id="cols"
                                rows={3}
                                value={form.visible_columns}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        visible_columns: e.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div>
                            <ZoruButton onClick={handleSave} disabled={saving}>
                                <Save className="h-4 w-4" />
                                {saving ? 'Saving…' : 'Save preferences'}
                            </ZoruButton>
                        </div>
                    </div>
                </ZoruCard>

                <ZoruCard className="p-6">
                    <div className="pb-3">
                        <h2 className="text-[16px] text-zoru-ink">Saved presets</h2>
                        <p className="text-[12.5px] text-zoru-ink-muted">
                            Click a preset to load it into the editor.
                        </p>
                    </div>
                    <div className="mb-3 flex flex-col gap-2">
                        <ZoruInput
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search presets…"
                        />
                        <div className="flex flex-wrap gap-1">
                            <ZoruButton
                                type="button"
                                size="sm"
                                variant={groupFilter === 'all' ? 'default' : 'outline'}
                                onClick={() => setGroupFilter('all')}
                            >
                                All
                            </ZoruButton>
                            {GROUPS.map((g) => (
                                <ZoruButton
                                    key={g}
                                    type="button"
                                    size="sm"
                                    variant={
                                        groupFilter === g ? 'default' : 'outline'
                                    }
                                    onClick={() => setGroupFilter(g)}
                                >
                                    {g}
                                </ZoruButton>
                            ))}
                        </div>
                    </div>
                    {isLoading ? (
                        <p className="text-[13px] text-zoru-ink-muted">Loading…</p>
                    ) : filteredRows.length === 0 ? (
                        <p className="text-[13px] text-zoru-ink-muted">
                            {rows.length === 0
                                ? 'No presets yet. Save one to see it here.'
                                : 'No presets match your filter.'}
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {filteredRows.map((r) => (
                                <li
                                    key={r._id}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-zoru-line p-2"
                                >
                                    <button
                                        type="button"
                                        onClick={() => loadRow(r)}
                                        className="min-w-0 flex-1 text-left"
                                    >
                                        <p className="truncate text-[13px] text-zoru-ink">
                                            {r.project_id
                                                ? `Project ${String(r.project_id).slice(-6)}`
                                                : 'Global default'}
                                        </p>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            <ZoruBadge variant="ghost">
                                                {r.group_by}
                                            </ZoruBadge>
                                            <ZoruBadge variant="ghost">
                                                {r.sort_by}
                                            </ZoruBadge>
                                            {r.hide_done ? (
                                                <ZoruBadge variant="warning">
                                                    hide done
                                                </ZoruBadge>
                                            ) : null}
                                        </div>
                                    </button>
                                    <ZoruButton
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeletingId(r._id)}
                                        aria-label="Delete preset"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                                    </ZoruButton>
                                </li>
                            ))}
                        </ul>
                    )}
                </ZoruCard>
            </div>

            <ZoruAlertDialog
                open={deletingId !== null}
                onOpenChange={(o) => !o && setDeletingId(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete preset?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This removes the stored taskboard preferences for that
                            scope.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleDelete}>
                            Delete
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </div>
    );
}
