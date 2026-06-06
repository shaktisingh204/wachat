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
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  Filter,
  KanbanSquare,
  Save,
  Trash2,
  EyeOff } from 'lucide-react';

/**
 * Leadboard Preferences — per-pipeline view presets.
 *
 * §1D-style: list-of-presets settings page with editor card on the
 * left and a searchable preset list on the right.
 *  - KPI strip (Total presets · Pipelines covered · With hidden stages)
 *  - Search across pipeline_id / sort_by
 *  - Filter chips by sort field
 *  - Editor saves via saveLeadboardSettings(prev, pipelineId, patch)
 *  - Click preset → load into editor
 *
 * Preserves every key the existing save action reads: pipeline_id,
 * hide_stages[], sort_by, visible_columns[].
 */

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import {
    getMyLeadboardSettings,
    saveLeadboardSettings,
    deleteLeadboardSettings,
} from '@/app/actions/worksuite/dashboard.actions';
import type {
    WsUserLeadboardSetting,
    WsLeadboardSortBy,
} from '@/lib/worksuite/dashboard-types';

type Row = WsUserLeadboardSetting & { _id: string };

const SORTS: WsLeadboardSortBy[] = ['value', 'stage', 'created', 'owner'];

export default function LeadboardPreferencesPage() {
    const { toast } = useZoruToast();
    const [rows, setRows] = React.useState<Row[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState('');
    const [sortFilter, setSortFilter] = React.useState<'all' | WsLeadboardSortBy>(
        'all',
    );

    const [form, setForm] = React.useState({
        pipeline_id: '',
        hide_stages: '',
        sort_by: 'stage' as WsLeadboardSortBy,
        visible_columns: 'title, value, owner, stage',
    });

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = (await getMyLeadboardSettings()) as Row[];
            setRows(Array.isArray(res) ? res : []);
        } catch (e) {
            console.error('Failed to load leadboard settings', e);
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
            if (sortFilter !== 'all' && r.sort_by !== sortFilter) return false;
            if (q) {
                return [String(r.pipeline_id ?? ''), r.sort_by ?? '']
                    .some((s) => s.toLowerCase().includes(q));
            }
            return true;
        });
    }, [rows, search, sortFilter]);

    const handleSave = async () => {
        if (!form.pipeline_id.trim()) {
            toast({
                title: 'Pipeline required',
                description: 'Provide the pipeline id this preset targets.',
                variant: 'destructive',
            });
            return;
        }
        setSaving(true);
        const res = await saveLeadboardSettings(null, form.pipeline_id.trim(), {
            hide_stages: form.hide_stages
                .split(/[\n,]/)
                .map((s) => s.trim())
                .filter(Boolean),
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
        toast({ title: 'Saved', description: 'Pipeline preferences saved.' });
        refresh();
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        const res = await deleteLeadboardSettings(deletingId);
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
            pipeline_id: String(r.pipeline_id ?? ''),
            hide_stages: (r.hide_stages || []).join(', '),
            sort_by: (r.sort_by || 'stage') as WsLeadboardSortBy,
            visible_columns: (r.visible_columns || []).join(', '),
        });
    };

    const pipelinesCovered = new Set(rows.map((r) => String(r.pipeline_id ?? '')))
        .size;
    const withHidden = rows.filter((r) => (r.hide_stages?.length ?? 0) > 0).length;

    return (
        <EntityListShell
            title="Leadboard Preferences"
            subtitle="Per-pipeline deal board preferences — hide stages, reorder columns, change sort."
        >

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <StatCard
                    label="Total presets"
                    value={rows.length}
                    icon={<KanbanSquare className="h-4 w-4" />}
                />
                <StatCard
                    label="Pipelines covered"
                    value={pipelinesCovered}
                    icon={<Filter className="h-4 w-4" />}
                />
                <StatCard
                    label="With hidden stages"
                    value={withHidden}
                    icon={<EyeOff className="h-4 w-4" />}
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <Card className="p-6 lg:col-span-2">
                    <div className="pb-3">
                        <h2 className="text-[16px] text-zoru-ink">Edit preferences</h2>
                        <p className="text-[12.5px] text-zoru-ink-muted">
                            Each preset applies to one pipeline.
                        </p>
                    </div>
                    <div className="grid gap-3">
                        <div className="grid gap-1.5">
                            <Label>Pipeline</Label>
                            <EntityFormField
                                entity="pipeline"
                                name="pipeline_id"
                                initialId={form.pipeline_id || null}
                                placeholder="Select pipeline"
                                onChange={(id) =>
                                    setForm((f) => ({ ...f, pipeline_id: id ?? '' }))
                                }
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="hide-stages">
                                Hidden stages (comma separated)
                            </Label>
                            <Textarea
                                id="hide-stages"
                                rows={2}
                                value={form.hide_stages}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, hide_stages: e.target.value }))
                                }
                                placeholder="lost, archived"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Sort by</Label>
                            <Select
                                value={form.sort_by}
                                onValueChange={(v) =>
                                    setForm((f) => ({
                                        ...f,
                                        sort_by: v as WsLeadboardSortBy,
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
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="cols">
                                Visible columns (comma separated)
                            </Label>
                            <Textarea
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
                            <Button onClick={handleSave} disabled={saving}>
                                <Save className="h-4 w-4" />
                                {saving ? 'Saving…' : 'Save preferences'}
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="pb-3">
                        <h2 className="text-[16px] text-zoru-ink">Saved presets</h2>
                        <p className="text-[12.5px] text-zoru-ink-muted">
                            Click a preset to load it into the editor.
                        </p>
                    </div>
                    <div className="mb-3 flex flex-col gap-2">
                        <Input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search presets…"
                        />
                        <div className="flex flex-wrap gap-1">
                            <Button
                                type="button"
                                size="sm"
                                variant={sortFilter === 'all' ? 'default' : 'outline'}
                                onClick={() => setSortFilter('all')}
                            >
                                All
                            </Button>
                            {SORTS.map((s) => (
                                <Button
                                    key={s}
                                    type="button"
                                    size="sm"
                                    variant={sortFilter === s ? 'default' : 'outline'}
                                    onClick={() => setSortFilter(s)}
                                >
                                    {s}
                                </Button>
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
                                            Pipeline{' '}
                                            {String(r.pipeline_id ?? '').slice(-6) ||
                                                'unknown'}
                                        </p>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            <Badge variant="ghost">
                                                {r.sort_by}
                                            </Badge>
                                            {(r.hide_stages?.length ?? 0) > 0 ? (
                                                <Badge variant="warning">
                                                    {r.hide_stages!.length} hidden
                                                </Badge>
                                            ) : null}
                                        </div>
                                    </button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeletingId(r._id)}
                                        aria-label="Delete preset"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            <ZoruAlertDialog
                open={deletingId !== null}
                onOpenChange={(o) => !o && setDeletingId(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete preset?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This removes the stored leadboard preferences for that
                            pipeline.
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
        </EntityListShell>
    );
}
