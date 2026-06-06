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
  ZoruCardContent,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  PageHeader,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageActions,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  } from '@dnd-kit/core';
import {
    SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  } from '@dnd-kit/sortable';
import {
    AlertTriangle,
  MessageSquareReply,
  Plus,
  RefreshCw,
  Search,
  } from 'lucide-react';

/**
 * Telegram Auto-Reply rule manager.
 *
 * Multi-tenant — every server-action call carries `activeProjectId`
 * from the project context so the Rust BFF's `require_project` guard
 * works. Media for `reply_media` actions sources from SabFiles via
 * the project-wide picker.
 */

import * as React from 'react';

import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';

import {
    createAutoReplyRuleAction,
    deleteAutoReplyRuleAction,
    getAutoReplyConflictsAction,
    listAutoReplyRulesAction,
    reorderAutoReplyRulesAction,
    setAutoReplyRuleStatusAction,
    updateAutoReplyRuleAction,
} from '@/app/actions/telegram-auto-reply.actions';
import { listTelegramBotsAction } from '@/app/actions/telegram-extra.actions';

import type {
    ConflictPair,
    RuleRow,
    UpsertBody,
} from './_types';

import {
    RuleEditorDrawer,
    type BotOption,
} from './_components/rule-editor-drawer';
import { RuleDetailDrawer } from './_components/rule-detail-drawer';
import { RuleTableRow } from './_components/rule-table-row';

const ACCENT = '#229ED9';
const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
    { value: 'all', label: 'All statuses' },
    { value: 'enabled', label: 'Enabled' },
    { value: 'disabled', label: 'Disabled' },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]['value'];

export default function TelegramAutoReplyPage() {
    const { activeProject } = useProject();
    const projectId = activeProject?._id?.toString() ?? '';
    const { toast } = useZoruToast();

    // -----------------------------------------------------------------
    //  State
    // -----------------------------------------------------------------

    const [rules, setRules] = React.useState<RuleRow[]>([]);
    const [total, setTotal] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [bots, setBots] = React.useState<BotOption[]>([]);
    const [conflicts, setConflicts] = React.useState<ConflictPair[]>([]);

    const [search, setSearch] = React.useState('');
    const [searchDebounced, setSearchDebounced] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [botFilter, setBotFilter] = React.useState<string>('all');

    const [editorOpen, setEditorOpen] = React.useState(false);
    const [editorRule, setEditorRule] = React.useState<RuleRow | null>(null);
    const [savingEditor, setSavingEditor] = React.useState(false);

    const [detailRule, setDetailRule] = React.useState<RuleRow | null>(null);
    const [detailOpen, setDetailOpen] = React.useState(false);

    const [deleteRow, setDeleteRow] = React.useState<RuleRow | null>(null);
    const [conflictsOpen, setConflictsOpen] = React.useState(false);

    // -----------------------------------------------------------------
    //  Debounce search
    // -----------------------------------------------------------------

    React.useEffect(() => {
        const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
        return () => clearTimeout(t);
    }, [search]);

    // -----------------------------------------------------------------
    //  Data loaders
    // -----------------------------------------------------------------

    const loadRules = React.useCallback(async () => {
        if (!projectId) {
            setRules([]);
            setTotal(0);
            setLoading(false);
            return;
        }
        setLoading(true);
        setLoadError(null);
        const res = await listAutoReplyRulesAction({
            projectId,
            botId: botFilter === 'all' ? undefined : botFilter,
            status: statusFilter === 'all' ? undefined : statusFilter,
            search: searchDebounced || undefined,
            page: 1,
            pageSize: PAGE_SIZE,
        });
        setLoading(false);
        if (res.error) {
            setLoadError(res.error);
            setRules([]);
            setTotal(0);
            return;
        }
        setRules(res.rules);
        setTotal(res.total);
    }, [projectId, botFilter, statusFilter, searchDebounced]);

    const loadBots = React.useCallback(async () => {
        if (!projectId) {
            setBots([]);
            return;
        }
        const res = await listTelegramBotsAction({
            projectId,
            page: 1,
            pageSize: 200,
        });
        const opts: BotOption[] = (res.bots ?? []).map((b) => ({
            id: b._id,
            label: b.username ? `@${b.username}` : b.name || b._id,
        }));
        setBots(opts);
    }, [projectId]);

    const loadConflicts = React.useCallback(async () => {
        if (!projectId) {
            setConflicts([]);
            return;
        }
        const res = await getAutoReplyConflictsAction(projectId);
        setConflicts(res.pairs ?? []);
    }, [projectId]);

    React.useEffect(() => {
        void loadRules();
    }, [loadRules]);
    React.useEffect(() => {
        void loadBots();
    }, [loadBots]);
    React.useEffect(() => {
        void loadConflicts();
    }, [loadConflicts]);

    // -----------------------------------------------------------------
    //  Derived KPIs
    // -----------------------------------------------------------------

    const kpi = React.useMemo(() => {
        const enabled = rules.filter((r) => r.status === 'enabled').length;
        const fired7d = rules.reduce((acc, r) => acc + (r.fired7d || 0), 0);
        return {
            total,
            enabled,
            fired7d,
            conflicts: conflicts.length,
        };
    }, [rules, total, conflicts]);

    // -----------------------------------------------------------------
    //  Mutations
    // -----------------------------------------------------------------

    const openCreate = () => {
        setEditorRule(null);
        setEditorOpen(true);
    };
    const openEdit = (rule: RuleRow) => {
        setEditorRule(rule);
        setEditorOpen(true);
    };
    const openDuplicate = (rule: RuleRow) => {
        const clone: RuleRow = {
            ...rule,
            _id: '',
            name: `${rule.name} (copy)`,
        };
        setEditorRule(clone);
        setEditorOpen(true);
    };

    async function handleSave(body: Omit<UpsertBody, 'projectId'>) {
        if (!projectId) return;
        setSavingEditor(true);
        const payload: UpsertBody = { projectId, ...body };
        const res =
            editorRule && editorRule._id
                ? await updateAutoReplyRuleAction(editorRule._id, payload)
                : await createAutoReplyRuleAction(payload);
        setSavingEditor(false);
        if (res.success) {
            toast({
                title: 'Saved',
                description: res.message ?? 'Rule saved.',
            });
            setEditorOpen(false);
            void loadRules();
            void loadConflicts();
        } else {
            toast({
                title: 'Save failed',
                description: res.error ?? 'Could not save the rule.',
                variant: 'destructive',
            });
        }
    }

    async function handleToggle(rule: RuleRow, enabled: boolean) {
        if (!projectId) return;
        // Optimistic update.
        setRules((prev) =>
            prev.map((r) =>
                r._id === rule._id
                    ? { ...r, status: enabled ? 'enabled' : 'disabled' }
                    : r,
            ),
        );
        const res = await setAutoReplyRuleStatusAction(rule._id, projectId, enabled);
        if (!res.success) {
            toast({
                title: 'Update failed',
                description: res.error ?? 'Could not toggle status.',
                variant: 'destructive',
            });
            // Roll back.
            setRules((prev) =>
                prev.map((r) =>
                    r._id === rule._id
                        ? { ...r, status: enabled ? 'disabled' : 'enabled' }
                        : r,
                ),
            );
        } else {
            toast({
                title: enabled ? 'Rule enabled' : 'Rule disabled',
                description: rule.name,
            });
        }
    }

    async function confirmDelete() {
        if (!deleteRow || !projectId) return;
        const res = await deleteAutoReplyRuleAction(deleteRow._id, projectId);
        if (res.success) {
            toast({ title: 'Deleted', description: 'Rule removed.' });
            setDeleteRow(null);
            void loadRules();
            void loadConflicts();
        } else {
            toast({
                title: 'Delete failed',
                description: res.error ?? 'Could not delete.',
                variant: 'destructive',
            });
        }
    }

    // -----------------------------------------------------------------
    //  Drag-reorder
    // -----------------------------------------------------------------

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    );

    async function onDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = rules.findIndex((r) => r._id === active.id);
        const newIndex = rules.findIndex((r) => r._id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        const next = arrayMove(rules, oldIndex, newIndex).map((r, i) => ({
            ...r,
            priority: i + 1,
        }));
        setRules(next);
        const res = await reorderAutoReplyRulesAction({
            projectId,
            orderedIds: next.map((r) => r._id),
        });
        if (!res.success) {
            toast({
                title: 'Reorder failed',
                description: res.error ?? 'Could not save new order.',
                variant: 'destructive',
            });
            void loadRules();
        } else {
            toast({ title: 'Order saved' });
        }
    }

    const botNameById = React.useMemo(() => {
        const m = new Map<string, string>();
        for (const b of bots) m.set(b.id, b.label);
        return m;
    }, [bots]);

    // -----------------------------------------------------------------
    //  Render
    // -----------------------------------------------------------------

    if (!projectId) {
        return (
            <div className="p-6">
                <EmptyState
                    title="No active project"
                    description="Select a project before managing Telegram auto-reply rules."
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            <PageHeader>
                <div>
                    <ZoruPageEyebrow>Telegram</ZoruPageEyebrow>
                    <ZoruPageTitle className="flex items-center gap-2">
                        <MessageSquareReply
                            className="h-6 w-6"
                            style={{ color: ACCENT }}
                        />
                        Telegram Auto-Reply
                    </ZoruPageTitle>
                    <ZoruPageDescription>
                        Rule-based auto responses for incoming Telegram messages.
                        Rules are evaluated in priority order — lower numbers run first.
                    </ZoruPageDescription>
                </div>
                <ZoruPageActions>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            void loadRules();
                            void loadConflicts();
                        }}
                        disabled={loading}
                    >
                        <RefreshCw className="mr-1.5 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button onClick={openCreate}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        New rule
                    </Button>
                </ZoruPageActions>
            </PageHeader>

            {/* Conflicts banner */}
            {conflicts.length > 0 && (
                <Card className="border-[var(--st-border)]/40 bg-[var(--st-bg-muted)]/40 dark:bg-[var(--st-text)]/10">
                    <ZoruCardContent className="flex items-center justify-between gap-3 p-4">
                        <div className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-[var(--st-text)]" />
                            <span>
                                <strong>{conflicts.length}</strong> conflicting rule
                                pair{conflicts.length === 1 ? '' : 's'} detected — two
                                or more rules share the same trigger pattern.
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConflictsOpen(true)}
                        >
                            Review conflicts
                        </Button>
                    </ZoruCardContent>
                </Card>
            )}

            {/* KPIs */}
            <div className="grid gap-3 md:grid-cols-4">
                <Kpi label="Total rules" value={kpi.total.toLocaleString()} />
                <Kpi label="Enabled" value={kpi.enabled.toLocaleString()} />
                <Kpi label="Fired (7d)" value={kpi.fired7d.toLocaleString()} />
                <Kpi
                    label="Conflicts"
                    value={kpi.conflicts.toLocaleString()}
                    accent={kpi.conflicts > 0}
                />
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative max-w-xs flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name…"
                        className="pl-8"
                    />
                </div>
                <Select value={botFilter} onValueChange={setBotFilter}>
                    <ZoruSelectTrigger className="w-[200px]">
                        <ZoruSelectValue placeholder="Bot" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="all">All bots</ZoruSelectItem>
                        {bots.map((b) => (
                            <ZoruSelectItem key={b.id} value={b.id}>
                                {b.label}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </Select>
                <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                    <ZoruSelectTrigger className="w-[160px]">
                        <ZoruSelectValue placeholder="Status" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {STATUS_OPTIONS.map((o) => (
                            <ZoruSelectItem key={o.value} value={o.value}>
                                {o.label}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </Select>
            </div>

            {/* Table */}
            <Card>
                <ZoruCardContent className="p-0">
                    {loading ? (
                        <div className="space-y-2 p-4">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ) : loadError ? (
                        <div className="p-6 text-sm text-[var(--st-text)]">{loadError}</div>
                    ) : rules.length === 0 ? (
                        <div className="p-8">
                            <EmptyState
                                title="No auto-reply rules yet"
                                description="Create your first rule to start responding to incoming Telegram messages automatically."
                                action={
                                    <Button onClick={openCreate}>
                                        <Plus className="mr-1.5 h-4 w-4" />
                                        New rule
                                    </Button>
                                }
                            />
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={onDragEnd}
                        >
                            <Table>
                                <ZoruTableHeader>
                                    <ZoruTableRow>
                                        <ZoruTableHead className="w-8" />
                                        <ZoruTableHead>Name</ZoruTableHead>
                                        <ZoruTableHead>Trigger</ZoruTableHead>
                                        <ZoruTableHead>Actions</ZoruTableHead>
                                        <ZoruTableHead>Bot</ZoruTableHead>
                                        <ZoruTableHead className="w-20">
                                            Status
                                        </ZoruTableHead>
                                        <ZoruTableHead>Fired (7d)</ZoruTableHead>
                                        <ZoruTableHead>Last fired</ZoruTableHead>
                                        <ZoruTableHead className="text-right">
                                            Actions
                                        </ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    <SortableContext
                                        items={rules.map((r) => r._id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {rules.map((r) => (
                                            <RuleTableRow
                                                key={r._id}
                                                rule={r}
                                                botName={
                                                    r.botId
                                                        ? botNameById.get(r.botId) ?? r.botId
                                                        : null
                                                }
                                                onEdit={openEdit}
                                                onDuplicate={openDuplicate}
                                                onTest={(rule) => {
                                                    setDetailRule(rule);
                                                    setDetailOpen(true);
                                                }}
                                                onDelete={(rule) => setDeleteRow(rule)}
                                                onToggle={handleToggle}
                                                onOpenDetail={(rule) => {
                                                    setDetailRule(rule);
                                                    setDetailOpen(true);
                                                }}
                                            />
                                        ))}
                                    </SortableContext>
                                </ZoruTableBody>
                            </Table>
                        </DndContext>
                    )}
                </ZoruCardContent>
            </Card>

            {/* Editor */}
            <RuleEditorDrawer
                open={editorOpen}
                onOpenChange={setEditorOpen}
                existing={editorRule}
                bots={bots}
                saving={savingEditor}
                onSave={handleSave}
            />

            {/* Detail */}
            <RuleDetailDrawer
                open={detailOpen}
                onOpenChange={setDetailOpen}
                rule={detailRule}
                projectId={projectId}
            />

            {/* Delete confirm */}
            <ZoruAlertDialog
                open={!!deleteRow}
                onOpenChange={(v) => !v && setDeleteRow(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete rule?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            “{deleteRow?.name}” will be removed. This cannot be undone.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={confirmDelete}>
                            Delete
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>

            {/* Conflicts dialog */}
            <Dialog open={conflictsOpen} onOpenChange={setConflictsOpen}>
                <ZoruDialogContent className="max-w-2xl">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>
                            Conflicts ({conflicts.length})
                        </ZoruDialogTitle>
                        <ZoruDialogDescription>
                            These rule pairs share overlapping triggers — only the
                            higher-priority rule will fire for the shared input.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="grid gap-2">
                        {conflicts.map((c, i) => (
                            <div
                                key={i}
                                className="rounded-md border bg-[var(--st-bg-secondary)]/60 p-3 text-sm"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="ghost">A</Badge>
                                    <span className="font-medium">
                                        {c.ruleAName}
                                    </span>
                                    <Badge variant="ghost">B</Badge>
                                    <span className="font-medium">
                                        {c.ruleBName}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                                    {c.reason}
                                </p>
                            </div>
                        ))}
                    </div>
                </ZoruDialogContent>
            </Dialog>
        </div>
    );
}

// ---------------------------------------------------------------------------
//  KPI card
// ---------------------------------------------------------------------------

function Kpi({
    label,
    value,
    accent,
}: {
    label: string;
    value: string;
    accent?: boolean;
}) {
    return (
        <Card>
            <TelegramProjectGate />
            <ZoruCardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                    {label}
                </p>
                <p
                    className="mt-1 text-2xl font-semibold tabular-nums"
                    style={accent ? { color: 'var(--st-warn)' } : undefined}
                >
                    {value}
                </p>
            </ZoruCardContent>
        </Card>
    );
}

