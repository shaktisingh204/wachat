'use client';

import { Avatar, AvatarFallback, Badge, Button, Card, CardBody, Checkbox, DateRangePicker, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Switch, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Contact as ContactIcon,
  Download,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldOff,
  ShieldCheck,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
  } from 'lucide-react';

import * as React from 'react';

import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import {
    bulkAssignTelegramContactsAction,
    bulkDeleteTelegramContactsAction,
    bulkTagTelegramContactsAction,
    createTelegramContactSegmentAction,
    deleteTelegramContactAction,
    deleteTelegramContactSegmentAction,
    exportTelegramContactsCsvAction,
    importTelegramContactsCsvAction,
    listProjectBotsForContactsAction,
    listTelegramContactsAction,
    listTelegramContactSegmentsAction,
    syncTelegramContactsFromChatsAction,
    telegramContactsAnalyticsAction,
    updateTelegramContactAction,
    upsertTelegramContactAction,
    type BotOption,
} from '@/app/actions/telegram-contacts.actions';
import type {
    AnalyticsResp,
    ContactRow,
    ListResp,
    SegmentRow,
} from '@/lib/rust-client/telegram-contacts';

const ACCENT = '#229ED9';
const PAGE_SIZE = 25;

// -- helpers ---------------------------------------------------------------

function fmtDate(iso?: string): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString();
    } catch {
        return iso;
    }
}
function fmtRelative(iso?: string): string {
    if (!iso) return 'Never';
    try {
        const then = new Date(iso).getTime();
        const diff = Date.now() - then;
        const day = 86_400_000;
        if (diff < 60_000) return 'just now';
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
        if (diff < day) return `${Math.floor(diff / 3_600_000)}h ago`;
        if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
        return new Date(iso).toLocaleDateString();
    } catch {
        return iso;
    }
}
function initials(c: ContactRow): string {
    const a = (c.firstName || '').trim();
    const b = (c.lastName || '').trim();
    const x = a ? a[0] : '';
    const y = b ? b[0] : '';
    const combined = `${x}${y}`.toUpperCase();
    if (combined) return combined;
    if (c.username) return c.username.slice(0, 2).toUpperCase();
    if (c.phoneNumber) return c.phoneNumber.slice(-2);
    return '??';
}
function displayName(c: ContactRow): string {
    const n = `${c.firstName || ''} ${c.lastName || ''}`.trim();
    if (n) return n;
    if (c.username) return `@${c.username}`;
    if (c.phoneNumber) return c.phoneNumber;
    return `Contact ${c._id.slice(-6)}`;
}
function isoStart(d: Date): string {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c.toISOString();
}
function isoEnd(d: Date): string {
    const c = new Date(d);
    c.setHours(23, 59, 59, 999);
    return c.toISOString();
}
function truncate(s: string, n: number): string {
    return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// -- form state ------------------------------------------------------------

interface EditorForm {
    contactId?: string;
    firstName: string;
    lastName: string;
    username: string;
    phoneNumber: string;
    chatId: string;
    languageCode: string;
    notes: string;
    blocked: boolean;
    isPremium: boolean;
    isVerified: boolean;
    tagsInput: string;
    tags: string[];
    customFields: Array<{ key: string; value: string }>;
    assignedAgentId: string;
}

const EMPTY_EDITOR: EditorForm = {
    firstName: '',
    lastName: '',
    username: '',
    phoneNumber: '',
    chatId: '',
    languageCode: '',
    notes: '',
    blocked: false,
    isPremium: false,
    isVerified: false,
    tagsInput: '',
    tags: [],
    customFields: [],
    assignedAgentId: '',
};

function rowToForm(c: ContactRow): EditorForm {
    return {
        contactId: c._id,
        firstName: c.firstName ?? '',
        lastName: c.lastName ?? '',
        username: c.username ?? '',
        phoneNumber: c.phoneNumber ?? '',
        chatId: c.chatId ? String(c.chatId) : '',
        languageCode: c.languageCode ?? '',
        notes: c.notes ?? '',
        blocked: c.blocked,
        isPremium: c.isPremium,
        isVerified: c.isVerified,
        tagsInput: '',
        tags: c.tags ?? [],
        customFields: Object.entries(c.customFields ?? {}).map(([k, v]) => ({ key: k, value: v })),
        assignedAgentId: c.assignedAgentId ?? '',
    };
}

function validateEditor(f: EditorForm): string | null {
    if (!f.contactId) {
        // Create mode requires at least one identifier
        if (!f.chatId && !f.phoneNumber && !f.username) {
            return 'Provide a chatId, phone, or username.';
        }
    }
    if (f.chatId && Number.isNaN(Number(f.chatId))) {
        return 'chatId must be a number.';
    }
    if (f.phoneNumber && !/^[+0-9()\-\s]+$/.test(f.phoneNumber.trim())) {
        return 'Phone number contains invalid characters.';
    }
    return null;
}

// -- page ------------------------------------------------------------------

export default function TelegramContactsPage() {
    const { activeProject } = useProject();
    const projectId = activeProject?._id?.toString() ?? '';
    const { toast } = useToast();

    // Data
    const [data, setData] = React.useState<ListResp | null>(null);
    const [analytics, setAnalytics] = React.useState<AnalyticsResp | null>(null);
    const [bots, setBots] = React.useState<BotOption[]>([]);
    const [segments, setSegments] = React.useState<SegmentRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [analyticsLoading, setAnalyticsLoading] = React.useState(true);
    const [segmentsLoading, setSegmentsLoading] = React.useState(true);

    // Filters
    const [search, setSearch] = React.useState('');
    const [searchDebounced, setSearchDebounced] = React.useState('');
    const [botId, setBotId] = React.useState<string>('all');
    const [language, setLanguage] = React.useState<string>('all');
    const [tag, setTag] = React.useState<string>('all');
    const [hasPhone, setHasPhone] = React.useState<boolean>(false);
    const [blockedFilter, setBlockedFilter] = React.useState<boolean>(false);
    const [range, setRange] = React.useState<{ from?: Date; to?: Date }>(() => {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 29);
        return { from, to };
    });
    const [page, setPage] = React.useState(1);

    // Selection
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    // Editor drawer
    const [editorOpen, setEditorOpen] = React.useState(false);
    const [editorForm, setEditorForm] = React.useState<EditorForm>(EMPTY_EDITOR);
    const [editorTab, setEditorTab] = React.useState<'overview' | 'tags' | 'fields' | 'notes' | 'activity'>('overview');
    const [editorErr, setEditorErr] = React.useState<string | null>(null);
    const [editorSaving, setEditorSaving] = React.useState(false);

    // Detail drawer state — we re-use the editor drawer with `viewMode`
    const [viewMode, setViewMode] = React.useState<'create' | 'edit' | 'view'>('create');
    // Backing row for the activity tab, when opened from an existing contact.
    const [activeRow, setActiveRow] = React.useState<ContactRow | null>(null);

    // Import / sync / bulk
    const [importOpen, setImportOpen] = React.useState(false);
    const [importCsv, setImportCsv] = React.useState('');
    const [importMode, setImportMode] = React.useState<'append' | 'replace'>('append');
    const [importing, setImporting] = React.useState(false);

    const [syncOpen, setSyncOpen] = React.useState(false);
    const [syncing, setSyncing] = React.useState(false);

    const [deleteRow, setDeleteRow] = React.useState<ContactRow | null>(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    const [bulkTagOpen, setBulkTagOpen] = React.useState(false);
    const [bulkTagInput, setBulkTagInput] = React.useState('');
    const [bulkTagMode, setBulkTagMode] = React.useState<'add' | 'remove'>('add');
    const [bulkTagBusy, setBulkTagBusy] = React.useState(false);

    const [bulkAssignOpen, setBulkAssignOpen] = React.useState(false);
    const [bulkAssignAgent, setBulkAssignAgent] = React.useState('');
    const [bulkAssignBusy, setBulkAssignBusy] = React.useState(false);

    // Segment dialog
    const [segmentOpen, setSegmentOpen] = React.useState(false);
    const [segmentName, setSegmentName] = React.useState('');
    const [segmentDesc, setSegmentDesc] = React.useState('');
    const [segmentBusy, setSegmentBusy] = React.useState(false);

    // Debounce search
    React.useEffect(() => {
        const id = setTimeout(() => setSearchDebounced(search.trim()), 280);
        return () => clearTimeout(id);
    }, [search]);

    React.useEffect(() => {
        setPage(1);
    }, [
        searchDebounced,
        botId,
        language,
        tag,
        hasPhone,
        blockedFilter,
        range.from,
        range.to,
        projectId,
    ]);

    // Build current filter object (also used when saving a segment).
    const currentFilter = React.useMemo(() => {
        const f: Record<string, unknown> = {};
        if (botId !== 'all') f.botId = botId;
        if (searchDebounced) f.search = searchDebounced;
        if (tag !== 'all') f.tag = tag;
        if (language !== 'all') f.languageCode = language;
        if (hasPhone) f.hasPhone = true;
        if (blockedFilter) f.blocked = true;
        if (range.from) f.lastInteractionAfter = isoStart(range.from);
        if (range.to) f.lastInteractionBefore = isoEnd(range.to);
        return f;
    }, [searchDebounced, botId, language, tag, hasPhone, blockedFilter, range.from, range.to]);

    // Loaders
    const reload = React.useCallback(async () => {
        if (!projectId) {
            setData(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        const res = await listTelegramContactsAction({
            projectId,
            page,
            pageSize: PAGE_SIZE,
            search: searchDebounced || undefined,
            botId: botId !== 'all' ? botId : undefined,
            languageCode: language !== 'all' ? language : undefined,
            tag: tag !== 'all' ? tag : undefined,
            hasPhone: hasPhone || undefined,
            blocked: blockedFilter || undefined,
            lastInteractionAfter: range.from ? isoStart(range.from) : undefined,
            lastInteractionBefore: range.to ? isoEnd(range.to) : undefined,
        });
        setData(res);
        setLoading(false);
    }, [
        projectId,
        page,
        searchDebounced,
        botId,
        language,
        tag,
        hasPhone,
        blockedFilter,
        range.from,
        range.to,
    ]);

    const reloadAnalytics = React.useCallback(async () => {
        if (!projectId) {
            setAnalytics(null);
            setAnalyticsLoading(false);
            return;
        }
        setAnalyticsLoading(true);
        const res = await telegramContactsAnalyticsAction({
            projectId,
            from: range.from ? isoStart(range.from) : undefined,
            to: range.to ? isoEnd(range.to) : undefined,
            botId: botId !== 'all' ? botId : undefined,
        });
        setAnalytics(res);
        setAnalyticsLoading(false);
    }, [projectId, range.from, range.to, botId]);

    const reloadSegments = React.useCallback(async () => {
        if (!projectId) {
            setSegments([]);
            setSegmentsLoading(false);
            return;
        }
        setSegmentsLoading(true);
        const res = await listTelegramContactSegmentsAction(projectId);
        setSegments(res.segments ?? []);
        setSegmentsLoading(false);
    }, [projectId]);

    React.useEffect(() => {
        void reload();
    }, [reload]);
    React.useEffect(() => {
        void reloadAnalytics();
    }, [reloadAnalytics]);
    React.useEffect(() => {
        void reloadSegments();
    }, [reloadSegments]);

    React.useEffect(() => {
        if (!projectId) {
            setBots([]);
            return;
        }
        void listProjectBotsForContactsAction(projectId).then(setBots);
    }, [projectId]);

    const rows = data?.contacts ?? [];
    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

    const allSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));
    const someSelected = rows.some((r) => selected.has(r._id));

    function toggleAll(v: boolean) {
        setSelected((prev) => {
            const next = new Set(prev);
            for (const r of rows) {
                if (v) next.add(r._id);
                else next.delete(r._id);
            }
            return next;
        });
    }

    // -- Editor ----------------------------------------------------------

    function openCreate() {
        setEditorForm(EMPTY_EDITOR);
        setActiveRow(null);
        setEditorTab('overview');
        setEditorErr(null);
        setViewMode('create');
        setEditorOpen(true);
    }
    function openEdit(row: ContactRow) {
        setEditorForm(rowToForm(row));
        setActiveRow(row);
        setEditorTab('overview');
        setEditorErr(null);
        setViewMode('edit');
        setEditorOpen(true);
    }
    function openView(row: ContactRow) {
        setEditorForm(rowToForm(row));
        setActiveRow(row);
        setEditorTab('overview');
        setEditorErr(null);
        setViewMode('view');
        setEditorOpen(true);
    }

    function addTagToEditor() {
        const v = editorForm.tagsInput.trim().toLowerCase();
        if (!v) return;
        setEditorForm((f) => ({
            ...f,
            tagsInput: '',
            tags: f.tags.includes(v) ? f.tags : [...f.tags, v],
        }));
    }
    function removeTagFromEditor(t: string) {
        setEditorForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }));
    }
    function addCustomFieldRow() {
        setEditorForm((f) => ({
            ...f,
            customFields: [...f.customFields, { key: '', value: '' }],
        }));
    }
    function removeCustomFieldRow(i: number) {
        setEditorForm((f) => ({
            ...f,
            customFields: f.customFields.filter((_, idx) => idx !== i),
        }));
    }
    function setCustomFieldRow(i: number, key: 'key' | 'value', value: string) {
        setEditorForm((f) => ({
            ...f,
            customFields: f.customFields.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)),
        }));
    }

    async function saveEditor() {
        if (!projectId) return;
        const v = validateEditor(editorForm);
        if (v) {
            setEditorErr(v);
            return;
        }
        setEditorSaving(true);
        const customFields: Record<string, string> = {};
        for (const { key, value } of editorForm.customFields) {
            const k = key.trim();
            if (k) customFields[k] = value;
        }
        const body = {
            projectId,
            contactId: editorForm.contactId,
            firstName: editorForm.firstName.trim(),
            lastName: editorForm.lastName.trim() || undefined,
            username: editorForm.username.trim().replace(/^@/, '') || undefined,
            phoneNumber: editorForm.phoneNumber.trim() || undefined,
            chatId: editorForm.chatId ? Number(editorForm.chatId) : undefined,
            languageCode: editorForm.languageCode.trim() || undefined,
            notes: editorForm.notes,
            tags: editorForm.tags,
            customFields,
            blocked: editorForm.blocked,
            isPremium: editorForm.isPremium,
            isVerified: editorForm.isVerified,
            assignedAgentId: editorForm.assignedAgentId.trim() || null,
            source: editorForm.contactId ? undefined : 'manual',
        };
        const res = editorForm.contactId
            ? await updateTelegramContactAction(editorForm.contactId, body)
            : await upsertTelegramContactAction(body);
        setEditorSaving(false);
        if (res.success) {
            toast({ title: 'Saved', description: res.message ?? 'Contact saved.' });
            setEditorOpen(false);
            void reload();
            void reloadAnalytics();
        } else {
            setEditorErr(res.error ?? 'Failed to save.');
            toast({
                title: 'Error',
                description: res.error ?? 'Failed to save contact.',
                variant: 'destructive',
            });
        }
    }

    async function quickToggleBlocked(row: ContactRow, blocked: boolean) {
        const res = await updateTelegramContactAction(row._id, {
            projectId,
            blocked,
        });
        if (res.success) {
            toast({ title: blocked ? 'Blocked' : 'Unblocked', description: displayName(row) });
            void reload();
        } else {
            toast({ title: 'Error', description: res.error ?? 'Failed.', variant: 'destructive' });
        }
    }

    async function quickAddTag(row: ContactRow) {
        const t = window.prompt('Add tag (one):', '');
        if (!t) return;
        const res = await bulkTagTelegramContactsAction({
            projectId,
            ids: [row._id],
            add: [t],
        });
        if (res.success) {
            toast({ title: 'Tagged', description: `+${t}` });
            void reload();
            void reloadAnalytics();
        } else {
            toast({ title: 'Error', description: res.error ?? 'Failed.', variant: 'destructive' });
        }
    }
    async function quickRemoveTag(row: ContactRow) {
        if (!row.tags?.length) {
            toast({ title: 'No tags' });
            return;
        }
        const t = window.prompt(`Remove tag (one of ${row.tags.join(', ')}):`, '');
        if (!t) return;
        const res = await bulkTagTelegramContactsAction({
            projectId,
            ids: [row._id],
            remove: [t],
        });
        if (res.success) {
            toast({ title: 'Tag removed', description: `-${t}` });
            void reload();
            void reloadAnalytics();
        } else {
            toast({ title: 'Error', description: res.error ?? 'Failed.', variant: 'destructive' });
        }
    }
    async function quickAssign(row: ContactRow) {
        const t = window.prompt('Assign to user id (blank to clear):', row.assignedAgentId ?? '');
        if (t === null) return;
        const res = await bulkAssignTelegramContactsAction({
            projectId,
            ids: [row._id],
            assignedAgentId: t.trim() || null,
        });
        if (res.success) {
            toast({ title: 'Assigned' });
            void reload();
        } else {
            toast({ title: 'Error', description: res.error ?? 'Failed.', variant: 'destructive' });
        }
    }

    async function confirmDelete() {
        if (!deleteRow || !projectId) return;
        const res = await deleteTelegramContactAction(deleteRow._id, projectId);
        if (res.success) {
            toast({ title: 'Deleted', description: 'Contact removed.' });
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(deleteRow._id);
                return next;
            });
            setDeleteRow(null);
            void reload();
            void reloadAnalytics();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Failed to delete.',
                variant: 'destructive',
            });
        }
    }

    async function confirmBulkDelete() {
        if (!projectId || selected.size === 0) return;
        const res = await bulkDeleteTelegramContactsAction({
            projectId,
            ids: Array.from(selected),
        });
        if (res.success) {
            toast({
                title: 'Deleted',
                description: `${res.affected} contact${res.affected === 1 ? '' : 's'} removed.`,
            });
            setSelected(new Set());
            setBulkDeleteOpen(false);
            void reload();
            void reloadAnalytics();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Bulk delete failed.',
                variant: 'destructive',
            });
        }
    }

    async function runBulkTag() {
        const tags = bulkTagInput
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
        if (!tags.length) {
            toast({ title: 'No tags', variant: 'destructive' });
            return;
        }
        setBulkTagBusy(true);
        const res = await bulkTagTelegramContactsAction({
            projectId,
            ids: Array.from(selected),
            add: bulkTagMode === 'add' ? tags : undefined,
            remove: bulkTagMode === 'remove' ? tags : undefined,
        });
        setBulkTagBusy(false);
        if (res.success) {
            toast({ title: 'Tags updated', description: `${res.affected} contact(s).` });
            setBulkTagOpen(false);
            setBulkTagInput('');
            void reload();
            void reloadAnalytics();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Bulk tag failed.',
                variant: 'destructive',
            });
        }
    }

    async function runBulkAssign() {
        setBulkAssignBusy(true);
        const res = await bulkAssignTelegramContactsAction({
            projectId,
            ids: Array.from(selected),
            assignedAgentId: bulkAssignAgent.trim() || null,
        });
        setBulkAssignBusy(false);
        if (res.success) {
            toast({ title: 'Assigned', description: `${res.affected} contact(s).` });
            setBulkAssignOpen(false);
            setBulkAssignAgent('');
            void reload();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Bulk assign failed.',
                variant: 'destructive',
            });
        }
    }

    async function runImport() {
        if (!projectId) return;
        if (!importCsv.trim()) {
            toast({ title: 'Empty CSV', variant: 'destructive' });
            return;
        }
        setImporting(true);
        const res = await importTelegramContactsCsvAction({
            projectId,
            csv: importCsv,
            mode: importMode,
            botId: botId !== 'all' ? botId : undefined,
        });
        setImporting(false);
        if (res.success) {
            toast({ title: 'Imported', description: res.message ?? 'Done.' });
            setImportOpen(false);
            setImportCsv('');
            void reload();
            void reloadAnalytics();
        } else {
            toast({
                title: 'Import failed',
                description: res.error ?? 'Could not parse CSV.',
                variant: 'destructive',
            });
        }
    }

    async function runExport() {
        if (!projectId) return;
        const csv = await exportTelegramContactsCsvAction(projectId, {
            tag: tag !== 'all' ? tag : undefined,
            search: searchDebounced || undefined,
            botId: botId !== 'all' ? botId : undefined,
        });
        if (!csv) {
            toast({
                title: 'Export failed',
                variant: 'destructive',
            });
            return;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `telegram-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast({ title: 'Exported', description: 'CSV downloaded.' });
    }

    async function runSync() {
        if (!projectId) return;
        setSyncing(true);
        const res = await syncTelegramContactsFromChatsAction({
            projectId,
            botId: botId !== 'all' ? botId : undefined,
        });
        setSyncing(false);
        if (res.success) {
            toast({ title: 'Synced', description: res.message ?? 'Done.' });
            setSyncOpen(false);
            void reload();
            void reloadAnalytics();
        } else {
            toast({
                title: 'Sync failed',
                description: res.error ?? 'Failed.',
                variant: 'destructive',
            });
        }
    }

    async function saveSegment() {
        if (!projectId) return;
        if (!segmentName.trim()) {
            toast({ title: 'Name required', variant: 'destructive' });
            return;
        }
        setSegmentBusy(true);
        const res = await createTelegramContactSegmentAction({
            projectId,
            name: segmentName.trim(),
            description: segmentDesc.trim() || undefined,
            filter: currentFilter,
        });
        setSegmentBusy(false);
        if (res.success) {
            toast({ title: 'Segment saved', description: segmentName });
            setSegmentOpen(false);
            setSegmentName('');
            setSegmentDesc('');
            void reloadSegments();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Could not save segment.',
                variant: 'destructive',
            });
        }
    }

    async function deleteSegment(seg: SegmentRow) {
        if (!projectId) return;
        if (!window.confirm(`Delete segment "${seg.name}"?`)) return;
        const res = await deleteTelegramContactSegmentAction(seg._id, projectId);
        if (res.success) {
            toast({ title: 'Segment deleted' });
            void reloadSegments();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Failed.',
                variant: 'destructive',
            });
        }
    }

    function applySegment(seg: SegmentRow) {
        const f = (seg.filter ?? {}) as Record<string, unknown>;
        setSearch(typeof f.search === 'string' ? f.search : '');
        setBotId(typeof f.botId === 'string' ? f.botId : 'all');
        setLanguage(typeof f.languageCode === 'string' ? f.languageCode : 'all');
        setTag(typeof f.tag === 'string' ? f.tag : 'all');
        setHasPhone(f.hasPhone === true);
        setBlockedFilter(f.blocked === true);
        toast({ title: 'Segment applied', description: seg.name });
    }

    // -- render ----------------------------------------------------------

    const topLanguageCode = analytics?.languages?.[0]?.code ?? '';
    const topTag = analytics?.topTags?.[0]?.tag ?? '';

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start gap-4">
                <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                        background: `linear-gradient(135deg, ${ACCENT} 0%, #007DBB 100%)`,
                        boxShadow: '0 10px 28px rgba(0, 125, 187, 0.25)',
                    }}
                >
                    <Users className="h-6 w-6 text-white" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--st-text-tertiary)]">
                        Telegram
                    </p>
                    <h1 className="mt-0.5 text-[22px] leading-tight text-[var(--st-text)]">
                        Telegram Contacts
                    </h1>
                    <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-[var(--st-text-secondary)]">
                        A unified directory of every Telegram user across your bots — enrich with tags, custom
                        fields, assignees, and segment them for targeted broadcasts.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSyncOpen(true)} disabled={!projectId}>
                        <ContactIcon className="h-3.5 w-3.5" />
                        Sync from chats
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} disabled={!projectId}>
                        <Upload className="h-3.5 w-3.5" />
                        Import CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={runExport} disabled={!projectId}>
                        <Download className="h-3.5 w-3.5" />
                        Export
                    </Button>
                    <Button size="sm" onClick={openCreate} disabled={!projectId}>
                        <Plus className="h-3.5 w-3.5" />
                        New contact
                    </Button>
                </div>
            </div>

            {!projectId ? (
                <Card className="p-6">
                    <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">Select a project to view Telegram contacts.</span>
                    </div>
                </Card>
            ) : null}

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                    label="Total contacts"
                    value={analytics ? analytics.total.toLocaleString() : '—'}
                    loading={analyticsLoading}
                />
                <KpiCard
                    label="New in range"
                    value={analytics ? analytics.newInRange.toLocaleString() : '—'}
                    loading={analyticsLoading}
                />
                <KpiCard
                    label="Languages"
                    value={analytics ? `${analytics.languages.length}${topLanguageCode ? ` · ${topLanguageCode}` : ''}` : '—'}
                    loading={analyticsLoading}
                />
                <KpiCard
                    label="Top tag"
                    value={topTag ? `#${topTag}` : '—'}
                    loading={analyticsLoading}
                />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
                <div className="flex min-w-0 flex-col gap-4">
                    {/* Filter bar */}
                    <Card className="p-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative min-w-[220px] flex-1">
                                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--st-text-tertiary)]" />
                                <Input
                                    placeholder="Search name, username, phone, notes"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            <div className="min-w-[160px]">
                                <Select value={botId} onValueChange={setBotId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All bots" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All bots</SelectItem>
                                        {bots.map((b) => (
                                            <SelectItem key={b.id} value={b.id}>
                                                @{b.username}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="min-w-[140px]">
                                <Select value={language} onValueChange={setLanguage}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All languages" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All languages</SelectItem>
                                        {(analytics?.languages ?? []).map((l) => (
                                            <SelectItem key={l.code} value={l.code}>
                                                {l.code} ({l.count})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="min-w-[140px]">
                                <Select value={tag} onValueChange={setTag}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All tags" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All tags</SelectItem>
                                        {(analytics?.topTags ?? []).map((t) => (
                                            <SelectItem key={t.tag} value={t.tag}>
                                                #{t.tag} ({t.count})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="min-w-[260px]">
                                <DateRangePicker
                                    value={range.from ? { from: range.from, to: range.to } : undefined}
                                    onChange={(r) => setRange({ from: r?.from, to: r?.to })}
                                />
                            </div>
                            <label className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                                <Switch checked={hasPhone} onCheckedChange={setHasPhone} />
                                Has phone
                            </label>
                            <label className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                                <Switch checked={blockedFilter} onCheckedChange={setBlockedFilter} />
                                Blocked only
                            </label>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSegmentOpen(true)}
                                disabled={!projectId}
                            >
                                <Filter className="h-3.5 w-3.5" />
                                Save as segment
                            </Button>
                            {selected.size > 0 ? (
                                <>
                                    <Button size="sm" variant="outline" onClick={() => setBulkTagOpen(true)}>
                                        <Tag className="h-3.5 w-3.5" />
                                        Tag {selected.size}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setBulkAssignOpen(true)}
                                    >
                                        <UserPlus className="h-3.5 w-3.5" />
                                        Assign {selected.size}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setBulkDeleteOpen(true)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete {selected.size}
                                    </Button>
                                </>
                            ) : null}
                        </div>
                    </Card>

                    {/* Table */}
                    <Card className="overflow-hidden">
                        {loading ? (
                            <div className="flex flex-col gap-2 p-4">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Skeleton key={i} className="h-10 w-full" />
                                ))}
                            </div>
                        ) : data?.error ? (
                            <div className="flex items-center gap-2 p-6 text-sm text-[var(--st-danger)]">
                                <AlertCircle className="h-4 w-4" />
                                {data.error}
                            </div>
                        ) : rows.length === 0 ? (
                            <EmptyState
                                title="No contacts yet"
                                description="Sync from your existing private chats, import a CSV, or create one manually."
                                icon={<Users className="h-5 w-5" />}
                                action={
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => setSyncOpen(true)}>
                                            <ContactIcon className="h-3.5 w-3.5" />
                                            Sync from chats
                                        </Button>
                                        <Button size="sm" onClick={openCreate}>
                                            <Plus className="h-3.5 w-3.5" />
                                            New contact
                                        </Button>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] text-left text-[12px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                                        <tr>
                                            <th className="w-10 p-3">
                                                <Checkbox
                                                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                                    onCheckedChange={(v) => toggleAll(!!v)}
                                                />
                                            </th>
                                            <th className="p-3 font-medium">Name</th>
                                            <th className="p-3 font-medium">Username</th>
                                            <th className="p-3 font-medium">Phone</th>
                                            <th className="p-3 font-medium">Tags</th>
                                            <th className="p-3 font-medium">Lang</th>
                                            <th className="p-3 font-medium">Last seen</th>
                                            <th className="p-3 font-medium">Assigned</th>
                                            <th className="p-3" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => {
                                            const checked = selected.has(row._id);
                                            return (
                                                <tr
                                                    key={row._id}
                                                    className="group border-b border-[var(--st-border)]/60 last:border-b-0 hover:bg-[var(--st-bg-muted)]/40 cursor-pointer"
                                                    onClick={(e) => {
                                                        if ((e.target as HTMLElement).closest('[data-stop]')) return;
                                                        openView(row);
                                                    }}
                                                >
                                                    <td className="p-3" data-stop>
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={(v) =>
                                                                setSelected((prev) => {
                                                                    const next = new Set(prev);
                                                                    if (v) next.add(row._id);
                                                                    else next.delete(row._id);
                                                                    return next;
                                                                })
                                                            }
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarFallback>{initials(row)}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <div className="truncate text-[var(--st-text)]">
                                                                    {displayName(row)}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--st-text-tertiary)]">
                                                                    {row.blocked ? (
                                                                        <Badge variant="warning">Blocked</Badge>
                                                                    ) : null}
                                                                    {row.isPremium ? (
                                                                        <Badge variant="info">Premium</Badge>
                                                                    ) : null}
                                                                    {row.isBot ? (
                                                                        <Badge variant="secondary">Bot</Badge>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3" data-stop>
                                                        {row.username ? (
                                                            <a
                                                                href={`https://t.me/${row.username}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-[13px] text-[var(--st-text)] hover:underline"
                                                            >
                                                                @{row.username}
                                                            </a>
                                                        ) : (
                                                            <span className="text-[var(--st-text-tertiary)]">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 font-mono text-[12px] text-[var(--st-text-secondary)]">
                                                        {row.phoneNumber ? truncate(row.phoneNumber, 16) : '—'}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex flex-wrap gap-1">
                                                            {(row.tags ?? []).slice(0, 3).map((t) => (
                                                                <Badge key={t} variant="secondary">
                                                                    #{t}
                                                                </Badge>
                                                            ))}
                                                            {row.tags && row.tags.length > 3 ? (
                                                                <span className="text-[11px] text-[var(--st-text-tertiary)]">
                                                                    +{row.tags.length - 3}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-[12px] text-[var(--st-text-secondary)]">
                                                        {row.languageCode ?? '—'}
                                                    </td>
                                                    <td className="p-3 text-[12px] text-[var(--st-text-secondary)]">
                                                        {fmtRelative(row.lastInteractionAt)}
                                                    </td>
                                                    <td className="p-3 text-[12px] text-[var(--st-text-secondary)]">
                                                        {row.assignedAgentId
                                                            ? truncate(row.assignedAgentId, 10)
                                                            : '—'}
                                                    </td>
                                                    <td className="p-3" data-stop>
                                                        <div className="flex justify-end">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button size="sm" variant="ghost">
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onSelect={() => openView(row)}>
                                                                        Open
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onSelect={() => openEdit(row)}>
                                                                        Edit
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onSelect={() => quickAddTag(row)}>
                                                                        Add tag
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onSelect={() => quickRemoveTag(row)}>
                                                                        Remove tag
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onSelect={() => quickAssign(row)}>
                                                                        Assign
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    {row.blocked ? (
                                                                        <DropdownMenuItem
                                                                            onSelect={() => quickToggleBlocked(row, false)}
                                                                        >
                                                                            <ShieldCheck className="h-3.5 w-3.5" />
                                                                            Unblock
                                                                        </DropdownMenuItem>
                                                                    ) : (
                                                                        <DropdownMenuItem
                                                                            onSelect={() => quickToggleBlocked(row, true)}
                                                                        >
                                                                            <ShieldOff className="h-3.5 w-3.5" />
                                                                            Block
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem onSelect={() => setDeleteRow(row)}>
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                        Delete
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {data && rows.length > 0 ? (
                            <div className="flex items-center justify-between border-t border-[var(--st-border)] p-3 text-[12px] text-[var(--st-text-secondary)]">
                                <span>
                                    {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + rows.length} of{' '}
                                    {data.total}
                                </span>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                        Prev
                                    </Button>
                                    <span className="px-2">
                                        Page {page} / {totalPages}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={!data.hasMore}
                                        onClick={() => setPage((p) => p + 1)}
                                    >
                                        Next
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </Card>
                </div>

                {/* Segments panel */}
                <Card className="p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-[13.5px] font-medium text-[var(--st-text)]">Segments</h3>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSegmentOpen(true)}
                            disabled={!projectId}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New
                        </Button>
                    </div>
                    {segmentsLoading ? (
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : segments.length === 0 ? (
                        <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                            Save the current filter as a segment to reuse later.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {segments.map((seg) => (
                                <li
                                    key={seg._id}
                                    className="group flex items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]/60"
                                >
                                    <button
                                        type="button"
                                        onClick={() => applySegment(seg)}
                                        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
                                    >
                                        <span className="truncate text-[13px] text-[var(--st-text)]">{seg.name}</span>
                                        <span className="text-[11px] text-[var(--st-text-tertiary)]">
                                            {seg.memberCount.toLocaleString()} member
                                            {seg.memberCount === 1 ? '' : 's'}
                                        </span>
                                    </button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => deleteSegment(seg)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            {/* Editor drawer */}
            <Drawer open={editorOpen} onOpenChange={setEditorOpen}>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle>
                            {viewMode === 'create'
                                ? 'New contact'
                                : viewMode === 'view'
                                    ? 'Contact details'
                                    : 'Edit contact'}
                        </DrawerTitle>
                        <DrawerDescription>
                            {viewMode === 'create'
                                ? 'Provide chatId, phone, or username — extras are optional.'
                                : 'Edit profile, tags, custom fields, and notes.'}
                        </DrawerDescription>
                    </DrawerHeader>

                    {/* Segmented tabs */}
                    <div className="px-6 pb-2">
                        <div className="flex flex-wrap gap-1 rounded-md border border-[var(--st-border)] p-1">
                            {(
                                [
                                    { v: 'overview', label: 'Overview' },
                                    { v: 'tags', label: 'Tags' },
                                    { v: 'fields', label: 'Custom fields' },
                                    { v: 'notes', label: 'Notes' },
                                    { v: 'activity', label: 'Activity' },
                                ] as const
                            ).map((t) => (
                                <button
                                    key={t.v}
                                    type="button"
                                    onClick={() => setEditorTab(t.v)}
                                    className={`flex-1 rounded-sm px-3 py-1.5 text-[12px] transition-colors ${editorTab === t.v
                                        ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                                        : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]'
                                        }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-3 px-6 pb-4">
                        {editorTab === 'overview' ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="First name">
                                    <Input
                                        value={editorForm.firstName}
                                        readOnly={viewMode === 'view'}
                                        onChange={(e) =>
                                            setEditorForm((f) => ({ ...f, firstName: e.target.value }))
                                        }
                                    />
                                </Field>
                                <Field label="Last name">
                                    <Input
                                        value={editorForm.lastName}
                                        readOnly={viewMode === 'view'}
                                        onChange={(e) =>
                                            setEditorForm((f) => ({ ...f, lastName: e.target.value }))
                                        }
                                    />
                                </Field>
                                <Field label="Username">
                                    <Input
                                        value={editorForm.username}
                                        readOnly={viewMode === 'view'}
                                        onChange={(e) =>
                                            setEditorForm((f) => ({ ...f, username: e.target.value }))
                                        }
                                        placeholder="without @"
                                    />
                                </Field>
                                <Field label="Phone">
                                    <Input
                                        value={editorForm.phoneNumber}
                                        readOnly={viewMode === 'view'}
                                        onChange={(e) =>
                                            setEditorForm((f) => ({ ...f, phoneNumber: e.target.value }))
                                        }
                                        placeholder="+1 555 555 0123"
                                    />
                                </Field>
                                <Field label="Chat ID">
                                    <Input
                                        inputMode="numeric"
                                        value={editorForm.chatId}
                                        readOnly={viewMode === 'view' || !!editorForm.contactId}
                                        onChange={(e) =>
                                            setEditorForm((f) => ({ ...f, chatId: e.target.value }))
                                        }
                                    />
                                </Field>
                                <Field label="Language code">
                                    <Input
                                        value={editorForm.languageCode}
                                        readOnly={viewMode === 'view'}
                                        onChange={(e) =>
                                            setEditorForm((f) => ({ ...f, languageCode: e.target.value }))
                                        }
                                        placeholder="en, es, fr…"
                                    />
                                </Field>
                                <Field label="Assigned to (user id)">
                                    <Input
                                        value={editorForm.assignedAgentId}
                                        readOnly={viewMode === 'view'}
                                        onChange={(e) =>
                                            setEditorForm((f) => ({ ...f, assignedAgentId: e.target.value }))
                                        }
                                        placeholder="Mongo user id"
                                    />
                                </Field>
                                <div className="sm:col-span-2 flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                                        <Switch
                                            checked={editorForm.blocked}
                                            onCheckedChange={(v) =>
                                                setEditorForm((f) => ({ ...f, blocked: v }))
                                            }
                                            disabled={viewMode === 'view'}
                                        />
                                        Blocked
                                    </label>
                                    <label className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                                        <Switch
                                            checked={editorForm.isPremium}
                                            onCheckedChange={(v) =>
                                                setEditorForm((f) => ({ ...f, isPremium: v }))
                                            }
                                            disabled={viewMode === 'view'}
                                        />
                                        Premium
                                    </label>
                                    <label className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                                        <Switch
                                            checked={editorForm.isVerified}
                                            onCheckedChange={(v) =>
                                                setEditorForm((f) => ({ ...f, isVerified: v }))
                                            }
                                            disabled={viewMode === 'view'}
                                        />
                                        Verified
                                    </label>
                                </div>
                            </div>
                        ) : null}

                        {editorTab === 'tags' ? (
                            <div className="grid gap-2">
                                <div className="flex flex-wrap gap-1">
                                    {editorForm.tags.length === 0 ? (
                                        <span className="text-[12px] text-[var(--st-text-secondary)]">No tags yet.</span>
                                    ) : null}
                                    {editorForm.tags.map((t) => (
                                        <Badge key={t} variant="secondary" className="gap-1">
                                            #{t}
                                            {viewMode !== 'view' ? (
                                                <button
                                                    type="button"
                                                    onClick={() => removeTagFromEditor(t)}
                                                    className="ml-1 text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                                                    aria-label={`Remove ${t}`}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            ) : null}
                                        </Badge>
                                    ))}
                                </div>
                                {viewMode !== 'view' ? (
                                    <div className="flex gap-2">
                                        <Input
                                            value={editorForm.tagsInput}
                                            placeholder="Add tag and press Enter"
                                            onChange={(e) =>
                                                setEditorForm((f) => ({ ...f, tagsInput: e.target.value }))
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addTagToEditor();
                                                }
                                            }}
                                        />
                                        <Button size="sm" variant="outline" onClick={addTagToEditor}>
                                            Add
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        {editorTab === 'fields' ? (
                            <div className="grid gap-2">
                                {editorForm.customFields.length === 0 ? (
                                    <p className="text-[12px] text-[var(--st-text-secondary)]">No custom fields yet.</p>
                                ) : null}
                                {editorForm.customFields.map((cf, i) => (
                                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                        <Input
                                            placeholder="key"
                                            value={cf.key}
                                            readOnly={viewMode === 'view'}
                                            onChange={(e) => setCustomFieldRow(i, 'key', e.target.value)}
                                        />
                                        <Input
                                            placeholder="value"
                                            value={cf.value}
                                            readOnly={viewMode === 'view'}
                                            onChange={(e) => setCustomFieldRow(i, 'value', e.target.value)}
                                        />
                                        {viewMode !== 'view' ? (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => removeCustomFieldRow(i)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        ) : null}
                                    </div>
                                ))}
                                {viewMode !== 'view' ? (
                                    <Button size="sm" variant="outline" onClick={addCustomFieldRow}>
                                        <Plus className="h-3.5 w-3.5" />
                                        Add field
                                    </Button>
                                ) : null}
                            </div>
                        ) : null}

                        {editorTab === 'notes' ? (
                            <Field label="Notes">
                                <Textarea
                                    rows={8}
                                    value={editorForm.notes}
                                    readOnly={viewMode === 'view'}
                                    onChange={(e) =>
                                        setEditorForm((f) => ({ ...f, notes: e.target.value }))
                                    }
                                    placeholder="Background, preferences, internal context…"
                                />
                            </Field>
                        ) : null}

                        {editorTab === 'activity' ? (
                            <div className="grid gap-2 text-[13px] text-[var(--st-text-secondary)]">
                                <p>
                                    Last interaction:{' '}
                                    <span className="text-[var(--st-text)]">
                                        {fmtRelative(activeRow?.lastInteractionAt)}
                                    </span>
                                </p>
                                <p>
                                    Created:{' '}
                                    <span className="text-[var(--st-text)]">
                                        {activeRow ? fmtDate(activeRow.createdAt) : '—'}
                                    </span>
                                </p>
                                <p>
                                    Source:{' '}
                                    <span className="text-[var(--st-text)]">
                                        {activeRow?.source ?? '—'}
                                    </span>
                                </p>
                                <p>
                                    Bot:{' '}
                                    <span className="text-[var(--st-text)]">
                                        {activeRow?.botId
                                            ? bots.find((b) => b.id === activeRow.botId)?.username ??
                                              activeRow.botId
                                            : 'workspace-level'}
                                    </span>
                                </p>
                                <p className="text-[12px]">
                                    Note: a richer activity timeline (messages, broadcasts, payments)
                                    will appear here once the per-bot event index is online.
                                </p>
                            </div>
                        ) : null}

                        {editorErr ? (
                            <p className="text-[12.5px] text-[var(--st-danger)]">{editorErr}</p>
                        ) : null}
                    </div>

                    <div className="flex justify-end gap-2 px-6 pb-6">
                        <Button variant="outline" size="sm" onClick={() => setEditorOpen(false)}>
                            {viewMode === 'view' ? 'Close' : 'Cancel'}
                        </Button>
                        {viewMode !== 'view' ? (
                            <Button size="sm" onClick={saveEditor} disabled={editorSaving}>
                                {editorSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                Save
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={() => {
                                    setViewMode('edit');
                                }}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                            </Button>
                        )}
                    </div>
                </DrawerContent>
            </Drawer>

            {/* Import dialog */}
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import contacts from CSV</DialogTitle>
                        <DialogDescription>
                            Headers (any subset): <code>chatId</code>, <code>firstName</code>, <code>lastName</code>,{' '}
                            <code>username</code>, <code>phoneNumber</code>, <code>languageCode</code>,{' '}
                            <code>tags</code> (semicolon-separated), <code>notes</code>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <div className="text-[12px] text-[var(--st-text-secondary)]">
                            Sample:
                            <pre className="mt-1 overflow-x-auto rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2 font-mono text-[11.5px]">
{`chatId,firstName,lastName,username,phoneNumber,languageCode,tags,notes
123456,Ada,Lovelace,ada,+15555550100,en,vip;newsletter,Met at conf 2026`}
                            </pre>
                        </div>
                        <Select
                            value={importMode}
                            onValueChange={(v) => setImportMode(v as 'append' | 'replace')}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="append">Append (merge tags)</SelectItem>
                                <SelectItem value="replace">Replace (wipe scope first)</SelectItem>
                            </SelectContent>
                        </Select>
                        <Textarea
                            value={importCsv}
                            onChange={(e) => setImportCsv(e.target.value)}
                            rows={10}
                            placeholder="Paste CSV here…"
                            className="font-mono text-[12px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setImportOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={runImport} disabled={importing}>
                            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Import
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Sync confirm */}
            <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sync contacts from chats?</DialogTitle>
                        <DialogDescription>
                            Scans <code>telegram_chats</code> for <code>type = private</code> in this project
                            {botId !== 'all' ? ' and the selected bot' : ''} and upserts a contact for each one.
                            Existing contacts will have their names / username / language / last interaction
                            refreshed without losing tags or notes.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setSyncOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={runSync} disabled={syncing}>
                            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Sync now
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Single-row delete confirm */}
            <Dialog open={!!deleteRow} onOpenChange={(v) => !v && setDeleteRow(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete contact?</DialogTitle>
                        <DialogDescription>
                            {deleteRow ? `"${displayName(deleteRow)}" will be removed.` : ''} You can re-sync
                            from chats later to restore.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setDeleteRow(null)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={confirmDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk delete */}
            <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete {selected.size} contacts?</DialogTitle>
                        <DialogDescription>This cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBulkDeleteOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button size="sm" onClick={confirmBulkDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk tag */}
            <Dialog open={bulkTagOpen} onOpenChange={setBulkTagOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tag {selected.size} contacts</DialogTitle>
                        <DialogDescription>
                            Comma-separated. Tags are normalised to lowercase.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <Select
                            value={bulkTagMode}
                            onValueChange={(v) => setBulkTagMode(v as 'add' | 'remove')}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="add">Add tags</SelectItem>
                                <SelectItem value="remove">Remove tags</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            value={bulkTagInput}
                            onChange={(e) => setBulkTagInput(e.target.value)}
                            placeholder="vip, newsletter, demo-2026"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setBulkTagOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={runBulkTag} disabled={bulkTagBusy}>
                            {bulkTagBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Apply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk assign */}
            <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign {selected.size} contacts</DialogTitle>
                        <DialogDescription>
                            Paste a user id, or leave blank to unassign.
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={bulkAssignAgent}
                        onChange={(e) => setBulkAssignAgent(e.target.value)}
                        placeholder="Mongo user id"
                    />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setBulkAssignOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={runBulkAssign} disabled={bulkAssignBusy}>
                            {bulkAssignBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Apply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Save segment */}
            <Dialog open={segmentOpen} onOpenChange={setSegmentOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save current filter as segment</DialogTitle>
                        <DialogDescription>
                            We persist the active filter shape so you can re-apply it later. Member counts
                            update live.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <Field label="Name">
                            <Input
                                value={segmentName}
                                onChange={(e) => setSegmentName(e.target.value)}
                                placeholder="VIPs without phone"
                            />
                        </Field>
                        <Field label="Description (optional)">
                            <Textarea
                                value={segmentDesc}
                                onChange={(e) => setSegmentDesc(e.target.value)}
                                rows={3}
                            />
                        </Field>
                        <details className="text-[12px] text-[var(--st-text-secondary)]">
                            <summary className="cursor-pointer select-none">Preview filter</summary>
                            <pre className="mt-1 overflow-x-auto rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2 font-mono text-[11.5px]">
                                {JSON.stringify(currentFilter, null, 2)}
                            </pre>
                        </details>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setSegmentOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={saveSegment} disabled={segmentBusy}>
                            {segmentBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Save segment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// -- small components ------------------------------------------------------

function KpiCard({
    label,
    value,
    loading,
}: {
    label: string;
    value: string;
    loading: boolean;
}) {
    return (
        <Card>
            <CardBody className="flex flex-col gap-1 pt-5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    {label}
                </p>
                {loading ? (
                    <Skeleton className="h-7 w-24" />
                ) : (
                    <p className="text-2xl font-semibold tracking-tight text-[var(--st-text)]">{value}</p>
                )}
            </CardBody>
        </Card>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1.5">
            <TelegramProjectGate />
            <span className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                {label}
            </span>
            {children}
        </label>
    );
}
