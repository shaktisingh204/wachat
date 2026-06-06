'use client';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  Checkbox,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Terminal,
  Trash2,
  Upload,
  } from 'lucide-react';

import * as React from 'react';

import { SabFilePickerButton } from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import {
    bulkDeleteTelegramCommandsAction,
    bulkPushTelegramCommandsAction,
    createTelegramCommandAction,
    deleteTelegramCommandAction,
    duplicateTelegramCommandAction,
    exportTelegramCommandsCsvAction,
    getTelegramCommandRunsAction,
    getTelegramCommandsAnalyticsAction,
    importTelegramCommandsAction,
    listTelegramBotsAction,
    listTelegramCommandsAction,
    pullTelegramCommandsAction,
    pushTelegramCommandsAction,
    updateTelegramCommandAction,
} from '@/app/actions/telegram-extra.actions';
import type {
    AnalyticsResp,
    BotCommandView,
    CommandHandler,
    CommandHandlerKind,
    CommandRow,
    CommandScope,
    CommandScopeKind,
    ListResp,
    PullResp,
    RunRow,
} from '@/lib/rust-client/telegram-commands';

const ACCENT = '#229ED9';
const PAGE_SIZE = 20;

const SCOPE_OPTIONS: { value: CommandScopeKind | 'all'; label: string }[] = [
    { value: 'all', label: 'All scopes' },
    { value: 'default', label: 'Default' },
    { value: 'all_private_chats', label: 'All private chats' },
    { value: 'all_group_chats', label: 'All group chats' },
    { value: 'all_chat_administrators', label: 'All chat administrators' },
    { value: 'chat', label: 'Specific chat' },
    { value: 'chat_administrators', label: 'Specific chat (admins)' },
    { value: 'chat_member', label: 'Specific chat member' },
];

const HANDLER_OPTIONS: { value: CommandHandlerKind; label: string }[] = [
    { value: 'reply_text', label: 'Reply with text' },
    { value: 'reply_media', label: 'Reply with media' },
    { value: 'run_flow', label: 'Run flow' },
    { value: 'http_call', label: 'HTTP call' },
    { value: 'noop', label: 'No-op' },
];

const LANG_UNIVERSAL = '__universal__';
const LANG_CUSTOM = '__custom__';

const LANGUAGE_OPTIONS = [
    { value: LANG_UNIVERSAL, label: 'Universal (no language)' },
    { value: 'en', label: 'English (en)' },
    { value: 'es', label: 'Spanish (es)' },
    { value: 'pt', label: 'Portuguese (pt)' },
    { value: 'fr', label: 'French (fr)' },
    { value: 'de', label: 'German (de)' },
    { value: 'ru', label: 'Russian (ru)' },
    { value: 'hi', label: 'Hindi (hi)' },
    { value: 'ar', label: 'Arabic (ar)' },
    { value: 'zh', label: 'Chinese (zh)' },
    { value: 'ja', label: 'Japanese (ja)' },
    { value: LANG_CUSTOM, label: 'Custom…' },
];

const PARSE_PLAIN = '__plain__';
const PARSE_MODE_OPTIONS = [
    { value: PARSE_PLAIN, label: 'Plain' },
    { value: 'HTML', label: 'HTML' },
    { value: 'MarkdownV2', label: 'MarkdownV2' },
    { value: 'Markdown', label: 'Markdown (legacy)' },
];

const MEDIA_KIND_OPTIONS = [
    { value: 'photo', label: 'Photo' },
    { value: 'video', label: 'Video' },
    { value: 'document', label: 'Document' },
    { value: 'audio', label: 'Audio' },
    { value: 'animation', label: 'Animation' },
] as const;

const HTTP_METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

interface BotOption {
    id: string;
    label: string;
}

interface FormState {
    id?: string;
    command: string;
    description: string;
    botId: string; // '' = project-wide, 'NONE' alias
    languageMode: 'universal' | 'preset' | 'custom';
    language: string;
    scopeKind: CommandScopeKind;
    scopeChatId: string;
    scopeUserId: string;
    handlerKind: CommandHandlerKind;
    replyText: string;
    parseMode: string;
    disablePreview: boolean;
    mediaUrl: string;
    mediaKind: string;
    mediaCaption: string;
    flowId: string;
    httpMethod: string;
    httpUrl: string;
    httpHeaders: string;
    httpBody: string;
    hidden: boolean;
}

const EMPTY_FORM: FormState = {
    command: '',
    description: '',
    botId: '',
    languageMode: 'universal',
    language: '',
    scopeKind: 'default',
    scopeChatId: '',
    scopeUserId: '',
    handlerKind: 'reply_text',
    replyText: '',
    parseMode: '',
    disablePreview: false,
    mediaUrl: '',
    mediaKind: 'photo',
    mediaCaption: '',
    flowId: '',
    httpMethod: 'POST',
    httpUrl: '',
    httpHeaders: '',
    httpBody: '',
    hidden: false,
};

function buildHandler(form: FormState): CommandHandler {
    switch (form.handlerKind) {
        case 'reply_text':
            return {
                kind: 'reply_text',
                payload: {
                    text: form.replyText,
                    parseMode: form.parseMode || undefined,
                    disableWebPagePreview: form.disablePreview,
                },
            };
        case 'reply_media':
            return {
                kind: 'reply_media',
                payload: {
                    url: form.mediaUrl,
                    mediaKind: form.mediaKind,
                    caption: form.mediaCaption || undefined,
                },
            };
        case 'run_flow':
            return {
                kind: 'run_flow',
                payload: { flowId: form.flowId },
            };
        case 'http_call': {
            let headers: unknown = undefined;
            if (form.httpHeaders.trim()) {
                try {
                    headers = JSON.parse(form.httpHeaders);
                } catch {
                    headers = undefined;
                }
            }
            return {
                kind: 'http_call',
                payload: {
                    method: form.httpMethod,
                    url: form.httpUrl,
                    headers,
                    body: form.httpBody || undefined,
                },
            };
        }
        case 'noop':
        default:
            return { kind: 'noop' };
    }
}

function buildScope(form: FormState): CommandScope {
    const out: CommandScope = { kind: form.scopeKind };
    if (
        form.scopeKind === 'chat' ||
        form.scopeKind === 'chat_administrators' ||
        form.scopeKind === 'chat_member'
    ) {
        out.chatId = form.scopeChatId.trim();
    }
    if (form.scopeKind === 'chat_member') {
        out.userId = form.scopeUserId.trim();
    }
    return out;
}

function rowToForm(row: CommandRow): FormState {
    const langPreset = LANGUAGE_OPTIONS.some(
        (o) =>
            o.value === row.languageCode &&
            o.value !== LANG_UNIVERSAL &&
            o.value !== LANG_CUSTOM,
    );
    return {
        id: row._id,
        command: row.command,
        description: row.description,
        botId: row.botId ?? '',
        languageMode: !row.languageCode
            ? 'universal'
            : langPreset
              ? 'preset'
              : 'custom',
        language: row.languageCode ?? '',
        scopeKind: row.scope.kind,
        scopeChatId: row.scope.chatId ?? '',
        scopeUserId: row.scope.userId ?? '',
        handlerKind: row.handler.kind,
        replyText:
            (row.handler.payload?.text as string | undefined) ?? '',
        parseMode:
            (row.handler.payload?.parseMode as string | undefined) ?? '',
        disablePreview:
            (row.handler.payload?.disableWebPagePreview as boolean | undefined) ??
            false,
        mediaUrl: (row.handler.payload?.url as string | undefined) ?? '',
        mediaKind:
            (row.handler.payload?.mediaKind as string | undefined) ?? 'photo',
        mediaCaption:
            (row.handler.payload?.caption as string | undefined) ?? '',
        flowId: (row.handler.payload?.flowId as string | undefined) ?? '',
        httpMethod:
            (row.handler.payload?.method as string | undefined) ?? 'POST',
        httpUrl: (row.handler.payload?.url as string | undefined) ?? '',
        httpHeaders: row.handler.payload?.headers
            ? JSON.stringify(row.handler.payload.headers, null, 2)
            : '',
        httpBody: (row.handler.payload?.body as string | undefined) ?? '',
        hidden: row.hidden,
    };
}

function validateForm(form: FormState): string | null {
    const cmd = form.command.trim().replace(/^\/+/, '').toLowerCase();
    if (!cmd) return 'Command is required.';
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(cmd)) {
        return 'Command must start with a letter and contain only a-z, 0-9, _ (max 32).';
    }
    if (form.description.length > 256) {
        return 'Description must be 256 characters or fewer.';
    }
    if (
        (form.scopeKind === 'chat' ||
            form.scopeKind === 'chat_administrators' ||
            form.scopeKind === 'chat_member') &&
        !form.scopeChatId.trim()
    ) {
        return 'Chat ID is required for this scope.';
    }
    if (form.scopeKind === 'chat_member' && !form.scopeUserId.trim()) {
        return 'User ID is required for chat_member scope.';
    }
    if (form.handlerKind === 'reply_text' && !form.replyText.trim()) {
        return 'Reply text is required.';
    }
    if (form.handlerKind === 'reply_media' && !form.mediaUrl.trim()) {
        return 'Pick a SabFiles media first.';
    }
    if (form.handlerKind === 'run_flow' && !form.flowId.trim()) {
        return 'Flow ID is required.';
    }
    if (form.handlerKind === 'http_call' && !form.httpUrl.trim()) {
        return 'HTTP URL is required.';
    }
    if (form.handlerKind === 'http_call' && form.httpHeaders.trim()) {
        try {
            JSON.parse(form.httpHeaders);
        } catch {
            return 'Headers must be valid JSON.';
        }
    }
    return null;
}

function fmtDate(iso?: string): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function scopeLabel(scope: CommandScope): string {
    const base = SCOPE_OPTIONS.find((o) => o.value === scope.kind)?.label ?? scope.kind;
    if (scope.chatId && scope.userId) {
        return `${base} · chat ${scope.chatId} · user ${scope.userId}`;
    }
    if (scope.chatId) return `${base} · chat ${scope.chatId}`;
    return base;
}

export default function TelegramCommandsPage() {
    const { activeProject } = useProject();
    const projectId = activeProject?._id?.toString() ?? '';
    const { toast } = useZoruToast();

    const [data, setData] = React.useState<ListResp | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [bots, setBots] = React.useState<BotOption[]>([]);
    const [analytics, setAnalytics] = React.useState<AnalyticsResp | null>(null);

    const [search, setSearch] = React.useState('');
    const [searchDebounced, setSearchDebounced] = React.useState('');
    const [botFilter, setBotFilter] = React.useState<string>('all');
    const [scopeFilter, setScopeFilter] = React.useState<string>('all');
    const [languageFilter, setLanguageFilter] = React.useState<string>('');
    const [page, setPage] = React.useState(1);
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    const [editorOpen, setEditorOpen] = React.useState(false);
    const [editorForm, setEditorForm] = React.useState<FormState>(EMPTY_FORM);
    const [editorError, setEditorError] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);

    const [deleteRow, setDeleteRow] = React.useState<CommandRow | null>(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    const [pushOpen, setPushOpen] = React.useState(false);
    const [pushRow, setPushRow] = React.useState<CommandRow | null>(null);
    const [pushBot, setPushBot] = React.useState<string>('');
    const [pushScope, setPushScope] = React.useState<CommandScopeKind>('default');
    const [pushChatId, setPushChatId] = React.useState<string>('');
    const [pushUserId, setPushUserId] = React.useState<string>('');
    const [pushLanguage, setPushLanguage] = React.useState<string>('');
    const [pushBusy, setPushBusy] = React.useState(false);
    const [pushBulkOpen, setPushBulkOpen] = React.useState(false);

    const [diffOpen, setDiffOpen] = React.useState(false);
    const [diff, setDiff] = React.useState<PullResp | null>(null);
    const [diffBusy, setDiffBusy] = React.useState(false);
    const [diffBot, setDiffBot] = React.useState<string>('');
    const [diffScope, setDiffScope] = React.useState<CommandScopeKind>('default');
    const [diffLanguage, setDiffLanguage] = React.useState<string>('');

    const [importOpen, setImportOpen] = React.useState(false);
    const [importJson, setImportJson] = React.useState('');
    const [importing, setImporting] = React.useState(false);

    const [detailRow, setDetailRow] = React.useState<CommandRow | null>(null);
    const [detailTab, setDetailTab] = React.useState<'overview' | 'runs' | 'diff'>('overview');
    const [detailRuns, setDetailRuns] = React.useState<RunRow[]>([]);
    const [detailRunsLoading, setDetailRunsLoading] = React.useState(false);
    const [detailDiff, setDetailDiff] = React.useState<PullResp | null>(null);
    const [detailDiffLoading, setDetailDiffLoading] = React.useState(false);

    React.useEffect(() => {
        const id = setTimeout(() => setSearchDebounced(search.trim()), 300);
        return () => clearTimeout(id);
    }, [search]);

    React.useEffect(() => {
        setPage(1);
    }, [searchDebounced, botFilter, scopeFilter, languageFilter, projectId]);

    const loadBots = React.useCallback(async () => {
        if (!projectId) {
            setBots([]);
            return;
        }
        const res = await listTelegramBotsAction({ projectId, pageSize: 200 });
        setBots(
            (res.bots ?? []).map((b) => ({
                id: b._id,
                label: b.username ? `@${b.username}` : b.name || b._id,
            })),
        );
    }, [projectId]);

    const reload = React.useCallback(async () => {
        if (!projectId) {
            setData(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        const res = await listTelegramCommandsAction({
            projectId,
            page,
            pageSize: PAGE_SIZE,
            botId: botFilter === 'all' ? undefined : botFilter,
            scope: scopeFilter === 'all' ? undefined : scopeFilter,
            languageCode: languageFilter || undefined,
            search: searchDebounced || undefined,
        });
        setData(res);
        setLoading(false);
    }, [projectId, page, botFilter, scopeFilter, languageFilter, searchDebounced]);

    const reloadAnalytics = React.useCallback(async () => {
        if (!projectId) {
            setAnalytics(null);
            return;
        }
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 6);
        from.setHours(0, 0, 0, 0);
        const res = await getTelegramCommandsAnalyticsAction({
            projectId,
            from: from.toISOString(),
            to: to.toISOString(),
        });
        setAnalytics(res);
    }, [projectId]);

    React.useEffect(() => {
        void loadBots();
    }, [loadBots]);
    React.useEffect(() => {
        void reload();
    }, [reload]);
    React.useEffect(() => {
        void reloadAnalytics();
    }, [reloadAnalytics]);

    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
    const rows = data?.commands ?? [];

    function openCreate() {
        setEditorForm(EMPTY_FORM);
        setEditorError(null);
        setEditorOpen(true);
    }
    function openEdit(row: CommandRow) {
        setEditorForm(rowToForm(row));
        setEditorError(null);
        setEditorOpen(true);
    }

    async function saveEditor() {
        if (!projectId) return;
        const v = validateForm(editorForm);
        if (v) {
            setEditorError(v);
            return;
        }
        const command = editorForm.command.trim().replace(/^\/+/, '').toLowerCase();
        const language =
            editorForm.languageMode === 'universal'
                ? undefined
                : editorForm.language.trim() || undefined;
        const handler = buildHandler(editorForm);
        const scope = buildScope(editorForm);

        setSaving(true);
        const res = editorForm.id
            ? await updateTelegramCommandAction(editorForm.id, {
                  projectId,
                  command,
                  description: editorForm.description,
                  scope,
                  handler,
                  hidden: editorForm.hidden,
                  botId: editorForm.botId || null,
                  clearBot: !editorForm.botId,
                  languageCode: language,
                  clearLanguageCode: !language,
              })
            : await createTelegramCommandAction({
                  projectId,
                  command,
                  description: editorForm.description,
                  scope,
                  handler,
                  hidden: editorForm.hidden,
                  botId: editorForm.botId || null,
                  languageCode: language,
              });
        setSaving(false);
        if (res.success) {
            toast({
                title: editorForm.id ? 'Updated' : 'Created',
                description: res.message ?? 'Command saved.',
            });
            setEditorOpen(false);
            void reload();
        } else {
            setEditorError(res.error ?? 'Failed to save.');
            toast({
                title: 'Error',
                description: res.error ?? 'Failed to save.',
                variant: 'destructive',
            });
        }
    }

    async function confirmDelete() {
        if (!deleteRow || !projectId) return;
        const res = await deleteTelegramCommandAction(deleteRow._id, projectId);
        if (res.success) {
            toast({ title: 'Deleted', description: 'Command removed.' });
            setDeleteRow(null);
            setSelected((s) => {
                const n = new Set(s);
                n.delete(deleteRow._id);
                return n;
            });
            void reload();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Delete failed.',
                variant: 'destructive',
            });
        }
    }

    async function confirmBulkDelete() {
        if (!projectId || selected.size === 0) return;
        const res = await bulkDeleteTelegramCommandsAction({
            projectId,
            ids: Array.from(selected),
        });
        if (res.success) {
            toast({
                title: 'Deleted',
                description: `${res.deleted} command${res.deleted === 1 ? '' : 's'} removed.`,
            });
        } else {
            toast({
                title: 'Partial',
                description: `${res.deleted} removed. ${res.error ?? ''}`,
                variant: 'destructive',
            });
        }
        setSelected(new Set());
        setBulkDeleteOpen(false);
        void reload();
    }

    async function duplicateRow(row: CommandRow) {
        if (!projectId) return;
        const res = await duplicateTelegramCommandAction(row._id, projectId);
        if (res.success) {
            toast({ title: 'Duplicated', description: res.message ?? 'Done.' });
            void reload();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Duplicate failed.',
                variant: 'destructive',
            });
        }
    }

    function openPush(row?: CommandRow) {
        if (row) {
            setPushRow(row);
            setPushBot(row.botId ?? '');
            setPushScope(row.scope.kind);
            setPushChatId(row.scope.chatId ?? '');
            setPushUserId(row.scope.userId ?? '');
            setPushLanguage(row.languageCode ?? '');
        } else {
            setPushRow(null);
            setPushBot(bots[0]?.id ?? '');
            setPushScope('default');
            setPushChatId('');
            setPushUserId('');
            setPushLanguage('');
        }
        setPushOpen(true);
    }

    async function runPush() {
        if (!projectId || !pushBot) return;
        setPushBusy(true);
        const res = await pushTelegramCommandsAction({
            projectId,
            botId: pushBot,
            scope: {
                kind: pushScope,
                chatId: pushChatId || undefined,
                userId: pushUserId || undefined,
            },
            languageCode: pushLanguage || undefined,
        });
        setPushBusy(false);
        if (res.success) {
            toast({
                title: 'Pushed',
                description: res.message ?? `Pushed ${res.pushed}.`,
            });
            setPushOpen(false);
        } else {
            toast({
                title: 'Push failed',
                description: res.error ?? 'Telegram rejected the request.',
                variant: 'destructive',
            });
        }
    }

    async function runBulkPush() {
        if (!projectId || selected.size === 0) return;
        const botIds = bots.map((b) => b.id);
        if (botIds.length === 0) {
            toast({ title: 'No bots', description: 'Connect a bot first.', variant: 'destructive' });
            return;
        }
        const res = await bulkPushTelegramCommandsAction({
            projectId,
            botIds,
            scope: { kind: 'default' },
        });
        if (res.success) {
            toast({
                title: 'Pushed',
                description: `Pushed ${res.pushed} command(s) across ${botIds.length} bot(s).`,
            });
        } else {
            toast({
                title: 'Partial',
                description: `${res.pushed} pushed, ${res.failed} failed. ${res.error ?? ''}`,
                variant: 'destructive',
            });
        }
        setPushBulkOpen(false);
    }

    function openDiff() {
        setDiffBot(bots[0]?.id ?? '');
        setDiffScope('default');
        setDiffLanguage('');
        setDiff(null);
        setDiffOpen(true);
    }

    async function runDiff() {
        if (!projectId || !diffBot) return;
        setDiffBusy(true);
        const res = await pullTelegramCommandsAction({
            projectId,
            botId: diffBot,
            scope: { kind: diffScope },
            languageCode: diffLanguage || undefined,
        });
        setDiffBusy(false);
        if (res.success) setDiff(res);
        else {
            toast({
                title: 'Pull failed',
                description: res.error ?? 'Could not query Telegram.',
                variant: 'destructive',
            });
        }
    }

    async function runReplaceLocalWithLive() {
        if (!projectId || !diffBot) return;
        if (!diff?.live?.length) {
            toast({
                title: 'Nothing to import',
                description:
                    'Pull first — Telegram returned no live commands for this scope.',
            });
            return;
        }
        if (
            !window.confirm(
                `Import ${diff.live.length} command(s) from Telegram into this project? Duplicates with the same name, scope, and language are skipped.`,
            )
        ) {
            return;
        }
        setDiffBusy(true);
        const res = await importTelegramCommandsAction({
            projectId,
            commands: diff.live.map((c) => ({
                projectId,
                botId: diffBot,
                command: c.command,
                description: c.description,
                scope: { kind: diffScope },
                languageCode: diffLanguage || undefined,
            })),
        });
        setDiffBusy(false);
        if (res.success) {
            toast({
                title: 'Imported',
                description: `Inserted ${res.inserted} · skipped ${res.skipped}.`,
            });
            setDiffOpen(false);
            await reload();
        } else {
            toast({
                title: 'Import failed',
                description: res.error ?? (res.errors ?? []).join(' • '),
                variant: 'destructive',
            });
        }
    }

    async function runPushLocalOverLive() {
        if (!projectId || !diffBot) return;
        setDiffBusy(true);
        const res = await pushTelegramCommandsAction({
            projectId,
            botId: diffBot,
            scope: { kind: diffScope },
            languageCode: diffLanguage || undefined,
        });
        setDiffBusy(false);
        if (res.success) {
            toast({ title: 'Pushed', description: res.message ?? 'Done.' });
            setDiffOpen(false);
        } else {
            toast({
                title: 'Push failed',
                description: res.error ?? '',
                variant: 'destructive',
            });
        }
    }

    async function runImport() {
        if (!projectId) return;
        let parsed: unknown;
        try {
            parsed = JSON.parse(importJson);
        } catch {
            toast({
                title: 'Invalid JSON',
                description: 'Could not parse import payload.',
                variant: 'destructive',
            });
            return;
        }
        const list = Array.isArray(parsed)
            ? parsed
            : (parsed as { commands?: unknown[] })?.commands;
        if (!Array.isArray(list)) {
            toast({
                title: 'Invalid payload',
                description: 'Expected an array of commands.',
                variant: 'destructive',
            });
            return;
        }
        setImporting(true);
        const res = await importTelegramCommandsAction({
            projectId,
            commands: list as never,
        });
        setImporting(false);
        if (res.success || res.inserted > 0) {
            toast({
                title: 'Imported',
                description: `Inserted ${res.inserted}, skipped ${res.skipped}.`,
            });
            setImportOpen(false);
            setImportJson('');
            void reload();
        } else {
            toast({
                title: 'Import failed',
                description: res.error ?? res.errors.join('; '),
                variant: 'destructive',
            });
        }
    }

    async function runExport() {
        if (!projectId) return;
        const csv = await exportTelegramCommandsCsvAction(projectId);
        if (!csv) {
            toast({
                title: 'Export failed',
                description: 'Could not generate CSV.',
                variant: 'destructive',
            });
            return;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `telegram-commands-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast({ title: 'Exported', description: 'CSV downloaded.' });
    }

    async function toggleHidden(row: CommandRow, hidden: boolean) {
        if (!projectId) return;
        const res = await updateTelegramCommandAction(row._id, {
            projectId,
            hidden,
        });
        if (res.success) {
            toast({
                title: hidden ? 'Hidden' : 'Visible',
                description: `/${row.command} ${hidden ? 'hidden' : 'visible'} on push.`,
            });
            void reload();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Failed to update.',
                variant: 'destructive',
            });
        }
    }

    function openDetail(row: CommandRow) {
        setDetailRow(row);
        setDetailTab('overview');
        setDetailRuns([]);
        setDetailDiff(null);
    }

    React.useEffect(() => {
        if (!detailRow || !projectId) return;
        if (detailTab === 'runs') {
            setDetailRunsLoading(true);
            getTelegramCommandRunsAction(detailRow._id, projectId, { limit: 50 })
                .then((r) => setDetailRuns(r.runs ?? []))
                .finally(() => setDetailRunsLoading(false));
        }
        if (detailTab === 'diff' && detailRow.botId) {
            setDetailDiffLoading(true);
            pullTelegramCommandsAction({
                projectId,
                botId: detailRow.botId,
                scope: { kind: detailRow.scope.kind, chatId: detailRow.scope.chatId, userId: detailRow.scope.userId },
                languageCode: detailRow.languageCode,
            })
                .then((d) => setDetailDiff(d))
                .finally(() => setDetailDiffLoading(false));
        }
    }, [detailRow, detailTab, projectId]);

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
                    <Terminal className="h-6 w-6 text-white" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--st-text-tertiary)]">
                        Telegram
                    </p>
                    <h1 className="mt-0.5 text-[22px] leading-tight text-[var(--st-text)]">
                        Telegram Commands
                    </h1>
                    <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-[var(--st-text-secondary)]">
                        Define a project-wide command registry with scope, language, and handler
                        payload. Push to one or many bots — pull live snapshots to diff against
                        Telegram.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                        <Upload className="h-3.5 w-3.5" />
                        Import
                    </Button>
                    <Button variant="outline" size="sm" onClick={runExport}>
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={openDiff}>
                        <Eye className="h-3.5 w-3.5" />
                        Pull from Telegram
                    </Button>
                    <Button size="sm" onClick={openCreate} disabled={!projectId}>
                        <Plus className="h-3.5 w-3.5" />
                        New command
                    </Button>
                </div>
            </div>

            {!projectId ? (
                <Card className="p-6">
                    <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">Select a project to view commands.</span>
                    </div>
                </Card>
            ) : null}

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                    label="Total commands"
                    value={data ? data.total.toLocaleString() : '—'}
                    loading={loading}
                />
                <KpiCard
                    label="Active scopes"
                    value={
                        data
                            ? new Set(rows.map((r) => r.scope.kind)).size.toString()
                            : '—'
                    }
                    loading={loading}
                />
                <KpiCard
                    label="Invocations (7d)"
                    value={analytics ? analytics.totalRuns.toLocaleString() : '—'}
                    loading={!analytics}
                />
                <KpiCard
                    label="Success rate"
                    value={
                        analytics && analytics.totalRuns > 0
                            ? `${analytics.successRate.toFixed(1)}%`
                            : '—'
                    }
                    loading={!analytics}
                />
            </div>

            {/* Filter bar */}
            <Card className="p-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--st-text-tertiary)]" />
                        <Input
                            placeholder="Search command or description"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <div className="min-w-[180px]">
                        <Select value={botFilter} onValueChange={setBotFilter}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All bots</ZoruSelectItem>
                                <ZoruSelectItem value="none">Project-wide only</ZoruSelectItem>
                                {bots.map((b) => (
                                    <ZoruSelectItem key={b.id} value={b.id}>
                                        {b.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="min-w-[200px]">
                        <Select value={scopeFilter} onValueChange={setScopeFilter}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {SCOPE_OPTIONS.map((s) => (
                                    <ZoruSelectItem key={s.value} value={s.value}>
                                        {s.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="min-w-[160px]">
                        <Input
                            placeholder="Language (e.g. en)"
                            value={languageFilter}
                            onChange={(e) => setLanguageFilter(e.target.value.toLowerCase())}
                        />
                    </div>
                    {selected.size > 0 ? (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setBulkDeleteOpen(true)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete {selected.size}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPushBulkOpen(true)}
                            >
                                <Send className="h-3.5 w-3.5" />
                                Push to all bots
                            </Button>
                        </>
                    ) : null}
                </div>
            </Card>

            {/* Table */}
            <Card className="overflow-hidden">
                {loading ? (
                    <div className="flex flex-col gap-2 p-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-9 w-full" />
                        ))}
                    </div>
                ) : data?.error ? (
                    <div className="flex items-center gap-2 p-6 text-sm text-[var(--st-danger)]">
                        <AlertCircle className="h-4 w-4" />
                        {data.error}
                    </div>
                ) : rows.length === 0 ? (
                    <EmptyState
                        title="No commands yet"
                        description="Define a command, attach a handler, then push to one or more bots."
                        icon={<Terminal className="h-5 w-5" />}
                        action={
                            <Button size="sm" onClick={openCreate} disabled={!projectId}>
                                <Plus className="h-3.5 w-3.5" />
                                New command
                            </Button>
                        }
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] text-left text-[12px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                                <tr>
                                    <th className="w-10 p-3">
                                        <Checkbox
                                            checked={
                                                allSelected
                                                    ? true
                                                    : someSelected
                                                      ? 'indeterminate'
                                                      : false
                                            }
                                            onCheckedChange={(v) => toggleAll(!!v)}
                                        />
                                    </th>
                                    <th className="p-3 font-medium">Command</th>
                                    <th className="p-3 font-medium">Description</th>
                                    <th className="p-3 font-medium">Bot</th>
                                    <th className="p-3 font-medium">Scope</th>
                                    <th className="p-3 font-medium">Lang</th>
                                    <th className="p-3 font-medium">Handler</th>
                                    <th className="p-3 font-medium">Hidden</th>
                                    <th className="p-3 font-medium text-right">Runs</th>
                                    <th className="p-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => {
                                    const checked = selected.has(row._id);
                                    const botLabel = row.botId
                                        ? bots.find((b) => b.id === row.botId)?.label ?? row.botId
                                        : 'All bots';
                                    return (
                                        <tr
                                            key={row._id}
                                            className="group border-b border-[var(--st-border)]/60 last:border-b-0 hover:bg-[var(--st-bg-muted)]/40"
                                        >
                                            <td className="p-3">
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
                                                <button
                                                    className="font-mono text-[13px] text-[var(--st-text)] hover:underline"
                                                    onClick={() => openDetail(row)}
                                                >
                                                    /{row.command}
                                                </button>
                                            </td>
                                            <td className="p-3 max-w-[260px] truncate text-[var(--st-text-secondary)]">
                                                {row.description || '—'}
                                            </td>
                                            <td className="p-3 text-[12.5px] text-[var(--st-text-secondary)]">
                                                {botLabel}
                                            </td>
                                            <td className="p-3 text-[12.5px] text-[var(--st-text-secondary)]">
                                                {scopeLabel(row.scope)}
                                            </td>
                                            <td className="p-3 text-[12.5px] text-[var(--st-text-secondary)]">
                                                {row.languageCode ?? '—'}
                                            </td>
                                            <td className="p-3">
                                                <Badge variant="secondary">
                                                    {HANDLER_OPTIONS.find(
                                                        (h) => h.value === row.handler.kind,
                                                    )?.label ?? row.handler.kind}
                                                </Badge>
                                            </td>
                                            <td className="p-3">
                                                <Switch
                                                    checked={row.hidden}
                                                    onCheckedChange={(v) => toggleHidden(row, v)}
                                                />
                                            </td>
                                            <td className="p-3 text-right">
                                                {row.runCount.toLocaleString()}
                                            </td>
                                            <td className="p-3">
                                                <DropdownMenu>
                                                    <ZoruDropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm">
                                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </ZoruDropdownMenuTrigger>
                                                    <ZoruDropdownMenuContent align="end">
                                                        <ZoruDropdownMenuItem
                                                            onSelect={() => openEdit(row)}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                            Edit
                                                        </ZoruDropdownMenuItem>
                                                        <ZoruDropdownMenuItem
                                                            onSelect={() => duplicateRow(row)}
                                                        >
                                                            <Copy className="h-3.5 w-3.5" />
                                                            Duplicate
                                                        </ZoruDropdownMenuItem>
                                                        <ZoruDropdownMenuItem
                                                            onSelect={() => {
                                                                openDetail(row);
                                                                setDetailTab('runs');
                                                            }}
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                            View runs
                                                        </ZoruDropdownMenuItem>
                                                        <ZoruDropdownMenuItem
                                                            onSelect={() => openPush(row)}
                                                        >
                                                            <Send className="h-3.5 w-3.5" />
                                                            Push to Telegram
                                                        </ZoruDropdownMenuItem>
                                                        <ZoruDropdownMenuSeparator />
                                                        <ZoruDropdownMenuItem
                                                            onSelect={() => setDeleteRow(row)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                            Delete
                                                        </ZoruDropdownMenuItem>
                                                    </ZoruDropdownMenuContent>
                                                </DropdownMenu>
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

            {/* Editor drawer */}
            <ZoruDrawer open={editorOpen} onOpenChange={setEditorOpen}>
                <ZoruDrawerContent>
                    <ZoruDrawerHeader>
                        <ZoruDrawerTitle>
                            {editorForm.id ? 'Edit command' : 'New command'}
                        </ZoruDrawerTitle>
                        <ZoruDrawerDescription>
                            Define the command, its scope and the handler payload.
                        </ZoruDrawerDescription>
                    </ZoruDrawerHeader>
                    <div className="grid gap-3 px-6 pb-4 sm:grid-cols-2">
                        <Field label="Command">
                            <Input
                                value={editorForm.command}
                                onChange={(e) =>
                                    setEditorForm((f) => ({
                                        ...f,
                                        command: e.target.value
                                            .replace(/^\/+/, '')
                                            .toLowerCase(),
                                    }))
                                }
                                placeholder="start"
                            />
                        </Field>
                        <Field label="Bot scope">
                            <Select
                                value={editorForm.botId || '__none__'}
                                onValueChange={(v) =>
                                    setEditorForm((f) => ({
                                        ...f,
                                        botId: v === '__none__' ? '' : v,
                                    }))
                                }
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="__none__">All bots</ZoruSelectItem>
                                    {bots.map((b) => (
                                        <ZoruSelectItem key={b.id} value={b.id}>
                                            {b.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Description (max 256)">
                                <Input
                                    value={editorForm.description}
                                    onChange={(e) =>
                                        setEditorForm((f) => ({
                                            ...f,
                                            description: e.target.value,
                                        }))
                                    }
                                    placeholder="What does this command do?"
                                />
                            </Field>
                        </div>
                        <Field label="Language">
                            <Select
                                value={
                                    editorForm.languageMode === 'universal'
                                        ? LANG_UNIVERSAL
                                        : editorForm.languageMode === 'custom'
                                          ? LANG_CUSTOM
                                          : editorForm.language
                                }
                                onValueChange={(v) => {
                                    if (v === LANG_CUSTOM) {
                                        setEditorForm((f) => ({
                                            ...f,
                                            languageMode: 'custom',
                                            language: '',
                                        }));
                                    } else if (v === LANG_UNIVERSAL) {
                                        setEditorForm((f) => ({
                                            ...f,
                                            languageMode: 'universal',
                                            language: '',
                                        }));
                                    } else {
                                        setEditorForm((f) => ({
                                            ...f,
                                            languageMode: 'preset',
                                            language: v,
                                        }));
                                    }
                                }}
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {LANGUAGE_OPTIONS.map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </Field>
                        {editorForm.languageMode === 'custom' ? (
                            <Field label="Custom language code">
                                <Input
                                    value={editorForm.language}
                                    onChange={(e) =>
                                        setEditorForm((f) => ({
                                            ...f,
                                            language: e.target.value.toLowerCase(),
                                        }))
                                    }
                                    placeholder="e.g. fa, sw, ur"
                                />
                            </Field>
                        ) : (
                            <div />
                        )}
                        <Field label="Scope">
                            <Select
                                value={editorForm.scopeKind}
                                onValueChange={(v) =>
                                    setEditorForm((f) => ({
                                        ...f,
                                        scopeKind: v as CommandScopeKind,
                                    }))
                                }
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {SCOPE_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </Field>
                        <Field label="Hidden on push">
                            <div className="flex items-center gap-2 pt-1.5">
                                <Switch
                                    checked={editorForm.hidden}
                                    onCheckedChange={(v) =>
                                        setEditorForm((f) => ({ ...f, hidden: v }))
                                    }
                                />
                                <span className="text-[12.5px] text-[var(--st-text-secondary)]">
                                    {editorForm.hidden ? 'Excluded from setMyCommands' : 'Included'}
                                </span>
                            </div>
                        </Field>
                        {(editorForm.scopeKind === 'chat' ||
                            editorForm.scopeKind === 'chat_administrators' ||
                            editorForm.scopeKind === 'chat_member') && (
                            <Field label="Chat ID">
                                <Input
                                    value={editorForm.scopeChatId}
                                    onChange={(e) =>
                                        setEditorForm((f) => ({
                                            ...f,
                                            scopeChatId: e.target.value,
                                        }))
                                    }
                                    placeholder="-1001234567890"
                                />
                            </Field>
                        )}
                        {editorForm.scopeKind === 'chat_member' && (
                            <Field label="User ID">
                                <Input
                                    value={editorForm.scopeUserId}
                                    onChange={(e) =>
                                        setEditorForm((f) => ({
                                            ...f,
                                            scopeUserId: e.target.value,
                                        }))
                                    }
                                    placeholder="1234567890"
                                />
                            </Field>
                        )}
                        <div className="sm:col-span-2">
                            <Field label="Handler">
                                <Select
                                    value={editorForm.handlerKind}
                                    onValueChange={(v) =>
                                        setEditorForm((f) => ({
                                            ...f,
                                            handlerKind: v as CommandHandlerKind,
                                        }))
                                    }
                                >
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {HANDLER_OPTIONS.map((h) => (
                                            <ZoruSelectItem key={h.value} value={h.value}>
                                                {h.label}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </Select>
                            </Field>
                        </div>
                        {editorForm.handlerKind === 'reply_text' && (
                            <>
                                <div className="sm:col-span-2">
                                    <Field label="Reply text">
                                        <Textarea
                                            rows={4}
                                            value={editorForm.replyText}
                                            onChange={(e) =>
                                                setEditorForm((f) => ({
                                                    ...f,
                                                    replyText: e.target.value,
                                                }))
                                            }
                                            placeholder="Hi {{name}} — welcome!"
                                        />
                                    </Field>
                                </div>
                                <Field label="Parse mode">
                                    <Select
                                        value={editorForm.parseMode || PARSE_PLAIN}
                                        onValueChange={(v) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                parseMode: v === PARSE_PLAIN ? '' : v,
                                            }))
                                        }
                                    >
                                        <ZoruSelectTrigger>
                                            <ZoruSelectValue />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            {PARSE_MODE_OPTIONS.map((o) => (
                                                <ZoruSelectItem key={o.value} value={o.value}>
                                                    {o.label}
                                                </ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </Select>
                                </Field>
                                <Field label="Disable preview">
                                    <div className="flex items-center gap-2 pt-1.5">
                                        <Switch
                                            checked={editorForm.disablePreview}
                                            onCheckedChange={(v) =>
                                                setEditorForm((f) => ({
                                                    ...f,
                                                    disablePreview: v,
                                                }))
                                            }
                                        />
                                    </div>
                                </Field>
                            </>
                        )}
                        {editorForm.handlerKind === 'reply_media' && (
                            <>
                                <Field label="Media kind">
                                    <Select
                                        value={editorForm.mediaKind}
                                        onValueChange={(v) =>
                                            setEditorForm((f) => ({ ...f, mediaKind: v }))
                                        }
                                    >
                                        <ZoruSelectTrigger>
                                            <ZoruSelectValue />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            {MEDIA_KIND_OPTIONS.map((o) => (
                                                <ZoruSelectItem key={o.value} value={o.value}>
                                                    {o.label}
                                                </ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </Select>
                                </Field>
                                <Field label="File">
                                    <div className="flex flex-col gap-2">
                                        {editorForm.mediaUrl ? (
                                            <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2 text-[12.5px]">
                                                <span className="truncate text-[var(--st-text-secondary)]">
                                                    {editorForm.mediaUrl.split('/').pop() ??
                                                        editorForm.mediaUrl}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        setEditorForm((f) => ({
                                                            ...f,
                                                            mediaUrl: '',
                                                        }))
                                                    }
                                                >
                                                    Clear
                                                </Button>
                                            </div>
                                        ) : null}
                                        <SabFilePickerButton
                                            variant="outline"
                                            accept={
                                                editorForm.mediaKind === 'photo'
                                                    ? 'image'
                                                    : editorForm.mediaKind === 'video'
                                                      ? 'video'
                                                      : editorForm.mediaKind === 'audio'
                                                        ? 'audio'
                                                        : 'all'
                                            }
                                            onPick={(p) =>
                                                setEditorForm((f) => ({
                                                    ...f,
                                                    mediaUrl: p.url,
                                                }))
                                            }
                                        >
                                            {editorForm.mediaUrl
                                                ? 'Replace from SabFiles'
                                                : 'Pick from SabFiles'}
                                        </SabFilePickerButton>
                                    </div>
                                </Field>
                                <div className="sm:col-span-2">
                                    <Field label="Caption (optional)">
                                        <Textarea
                                            rows={2}
                                            value={editorForm.mediaCaption}
                                            onChange={(e) =>
                                                setEditorForm((f) => ({
                                                    ...f,
                                                    mediaCaption: e.target.value,
                                                }))
                                            }
                                        />
                                    </Field>
                                </div>
                            </>
                        )}
                        {editorForm.handlerKind === 'run_flow' && (
                            <div className="sm:col-span-2">
                                <Field label="Flow ID">
                                    <Input
                                        value={editorForm.flowId}
                                        onChange={(e) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                flowId: e.target.value,
                                            }))
                                        }
                                        placeholder="65f3…"
                                    />
                                </Field>
                            </div>
                        )}
                        {editorForm.handlerKind === 'http_call' && (
                            <>
                                <Field label="Method">
                                    <Select
                                        value={editorForm.httpMethod}
                                        onValueChange={(v) =>
                                            setEditorForm((f) => ({ ...f, httpMethod: v }))
                                        }
                                    >
                                        <ZoruSelectTrigger>
                                            <ZoruSelectValue />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            {HTTP_METHOD_OPTIONS.map((m) => (
                                                <ZoruSelectItem key={m} value={m}>
                                                    {m}
                                                </ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </Select>
                                </Field>
                                <Field label="URL">
                                    <Input
                                        type="url"
                                        value={editorForm.httpUrl}
                                        onChange={(e) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                httpUrl: e.target.value,
                                            }))
                                        }
                                        placeholder="https://api.example.com/hook"
                                    />
                                </Field>
                                <div className="sm:col-span-2">
                                    <Field label="Headers (JSON)">
                                        <Textarea
                                            rows={3}
                                            className="font-mono text-[12px]"
                                            value={editorForm.httpHeaders}
                                            onChange={(e) =>
                                                setEditorForm((f) => ({
                                                    ...f,
                                                    httpHeaders: e.target.value,
                                                }))
                                            }
                                            placeholder='{ "Authorization": "Bearer …" }'
                                        />
                                    </Field>
                                </div>
                                <div className="sm:col-span-2">
                                    <Field label="Body (raw)">
                                        <Textarea
                                            rows={3}
                                            className="font-mono text-[12px]"
                                            value={editorForm.httpBody}
                                            onChange={(e) =>
                                                setEditorForm((f) => ({
                                                    ...f,
                                                    httpBody: e.target.value,
                                                }))
                                            }
                                        />
                                    </Field>
                                </div>
                            </>
                        )}
                        {editorError ? (
                            <p className="sm:col-span-2 text-[12.5px] text-[var(--st-danger)]">
                                {editorError}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex justify-end gap-2 px-6 pb-6">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditorOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button size="sm" onClick={saveEditor} disabled={saving}>
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Save
                        </Button>
                    </div>
                </ZoruDrawerContent>
            </ZoruDrawer>

            {/* Push dialog */}
            <Dialog open={pushOpen} onOpenChange={setPushOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Push commands to Telegram</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Replaces the bot&apos;s command list for the selected scope and
                            language. Hidden commands are excluded.
                            {pushRow ? ` Hint pulled from /${pushRow.command}.` : ''}
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="grid gap-3">
                        <Field label="Bot">
                            <Select value={pushBot} onValueChange={setPushBot}>
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue placeholder="Pick a bot" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {bots.map((b) => (
                                        <ZoruSelectItem key={b.id} value={b.id}>
                                            {b.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </Field>
                        <Field label="Scope">
                            <Select
                                value={pushScope}
                                onValueChange={(v) =>
                                    setPushScope(v as CommandScopeKind)
                                }
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {SCOPE_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </Field>
                        {(pushScope === 'chat' ||
                            pushScope === 'chat_administrators' ||
                            pushScope === 'chat_member') && (
                            <Field label="Chat ID">
                                <Input
                                    value={pushChatId}
                                    onChange={(e) => setPushChatId(e.target.value)}
                                    placeholder="-1001234567890"
                                />
                            </Field>
                        )}
                        {pushScope === 'chat_member' && (
                            <Field label="User ID">
                                <Input
                                    value={pushUserId}
                                    onChange={(e) => setPushUserId(e.target.value)}
                                />
                            </Field>
                        )}
                        <Field label="Language code (optional)">
                            <Input
                                value={pushLanguage}
                                onChange={(e) => setPushLanguage(e.target.value.toLowerCase())}
                                placeholder="en"
                            />
                        </Field>
                    </div>
                    <ZoruDialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setPushOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={runPush} disabled={pushBusy || !pushBot}>
                            {pushBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Push
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {/* Pull/diff dialog */}
            <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Pull live commands</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Calls Telegram&apos;s getMyCommands. Compare live vs defined and choose
                            which side wins.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="grid gap-3">
                        <Field label="Bot">
                            <Select value={diffBot} onValueChange={setDiffBot}>
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue placeholder="Pick a bot" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {bots.map((b) => (
                                        <ZoruSelectItem key={b.id} value={b.id}>
                                            {b.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </Field>
                        <Field label="Scope">
                            <Select
                                value={diffScope}
                                onValueChange={(v) =>
                                    setDiffScope(v as CommandScopeKind)
                                }
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {SCOPE_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </Field>
                        <Field label="Language">
                            <Input
                                value={diffLanguage}
                                onChange={(e) => setDiffLanguage(e.target.value.toLowerCase())}
                                placeholder="e.g. en"
                            />
                        </Field>
                        <Button size="sm" onClick={runDiff} disabled={diffBusy || !diffBot}>
                            {diffBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Fetch
                        </Button>
                        {diff ? <DiffView diff={diff} /> : null}
                    </div>
                    <ZoruDialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setDiffOpen(false)}>
                            Close
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={runReplaceLocalWithLive}
                            disabled={!diff}
                        >
                            Replace local with live
                        </Button>
                        <Button
                            size="sm"
                            onClick={runPushLocalOverLive}
                            disabled={!diff || diffBusy}
                        >
                            Push local over live
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {/* Import dialog */}
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Import commands</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Paste an array of command definitions or an object with a{' '}
                            <code>commands</code> array.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <Textarea
                        value={importJson}
                        onChange={(e) => setImportJson(e.target.value)}
                        rows={12}
                        placeholder='[{ "command": "start", "description": "Begin", "handler": { "kind": "reply_text", "payload": { "text": "Hi!" } } }]'
                        className="font-mono text-[12px]"
                    />
                    <ZoruDialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setImportOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={runImport} disabled={importing}>
                            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Import
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {/* Single delete */}
            <Dialog open={!!deleteRow} onOpenChange={(v) => !v && setDeleteRow(null)}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Delete command?</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            {deleteRow ? `/${deleteRow.command} will be permanently removed.` : ''}
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruDialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setDeleteRow(null)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={confirmDelete}>
                            Delete
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {/* Bulk delete */}
            <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Delete {selected.size} commands?</ZoruDialogTitle>
                        <ZoruDialogDescription>This cannot be undone.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruDialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setBulkDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={confirmBulkDelete}>
                            Delete
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {/* Bulk push */}
            <Dialog open={pushBulkOpen} onOpenChange={setPushBulkOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>
                            Push to all bots in this project?
                        </ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Will push the default-scope command set to {bots.length} bot(s). Per-bot
                            and scoped pushes still need the per-row Push to Telegram action.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruDialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setPushBulkOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={runBulkPush}>
                            Push
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {/* Detail drawer */}
            <ZoruDrawer open={!!detailRow} onOpenChange={(v) => !v && setDetailRow(null)}>
                <ZoruDrawerContent>
                    {detailRow ? (
                        <>
                            <ZoruDrawerHeader>
                                <ZoruDrawerTitle>/{detailRow.command}</ZoruDrawerTitle>
                                <ZoruDrawerDescription>
                                    {detailRow.description || 'No description'}
                                </ZoruDrawerDescription>
                            </ZoruDrawerHeader>
                            <div className="flex gap-2 px-6 pb-2">
                                {(['overview', 'runs', 'diff'] as const).map((t) => (
                                    <Button
                                        key={t}
                                        size="sm"
                                        variant={detailTab === t ? 'default' : 'outline'}
                                        onClick={() => setDetailTab(t)}
                                    >
                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </Button>
                                ))}
                            </div>
                            <div className="px-6 pb-6">
                                {detailTab === 'overview' ? (
                                    <DetailOverview row={detailRow} bots={bots} />
                                ) : detailTab === 'runs' ? (
                                    <DetailRuns
                                        runs={detailRuns}
                                        loading={detailRunsLoading}
                                    />
                                ) : (
                                    <DetailDiff
                                        diff={detailDiff}
                                        loading={detailDiffLoading}
                                        botBound={!!detailRow.botId}
                                    />
                                )}
                            </div>
                        </>
                    ) : null}
                </ZoruDrawerContent>
            </ZoruDrawer>
        </div>
    );
}

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
            <ZoruCardContent className="flex flex-col gap-1 pt-5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    {label}
                </p>
                {loading ? (
                    <Skeleton className="h-7 w-24" />
                ) : (
                    <p className="text-2xl font-semibold tracking-tight text-[var(--st-text)]">{value}</p>
                )}
            </ZoruCardContent>
        </Card>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                {label}
            </span>
            {children}
        </label>
    );
}

function DiffView({ diff }: { diff: PullResp }) {
    const localMap = new Map<string, BotCommandView>();
    for (const c of diff.local) localMap.set(c.command, c);
    const liveMap = new Map<string, BotCommandView>();
    for (const c of diff.live) liveMap.set(c.command, c);
    const all = Array.from(new Set([...localMap.keys(), ...liveMap.keys()])).sort();
    return (
        <div className="rounded-md border border-[var(--st-border)]">
            <table className="w-full text-[12.5px]">
                <thead className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] text-left text-[var(--st-text-tertiary)]">
                    <tr>
                        <th className="p-2">Command</th>
                        <th className="p-2">Local</th>
                        <th className="p-2">Live</th>
                    </tr>
                </thead>
                <tbody>
                    {all.length === 0 ? (
                        <tr>
                            <td className="p-2 text-[var(--st-text-secondary)]" colSpan={3}>
                                No commands either side.
                            </td>
                        </tr>
                    ) : (
                        all.map((cmd) => {
                            const l = localMap.get(cmd);
                            const r = liveMap.get(cmd);
                            const same = l && r && l.description === r.description;
                            return (
                                <tr key={cmd} className="border-b border-[var(--st-border)]/60 last:border-b-0">
                                    <td className="p-2 font-mono">/{cmd}</td>
                                    <td className="p-2">
                                        {l ? (
                                            <span className={same ? '' : 'text-[var(--st-warn)]'}>
                                                {l.description}
                                            </span>
                                        ) : (
                                            <span className="text-[var(--st-danger)]">—</span>
                                        )}
                                    </td>
                                    <td className="p-2">
                                        {r ? (
                                            <span className={same ? '' : 'text-[var(--st-warn)]'}>
                                                {r.description}
                                            </span>
                                        ) : (
                                            <span className="text-[var(--st-danger)]">—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}

function DetailOverview({ row, bots }: { row: CommandRow; bots: BotOption[] }) {
    return (
        <div className="grid gap-2 text-[13px]">
            <Row label="Bot">
                {row.botId
                    ? bots.find((b) => b.id === row.botId)?.label ?? row.botId
                    : 'All bots in project'}
            </Row>
            <Row label="Scope">{scopeLabel(row.scope)}</Row>
            <Row label="Language">{row.languageCode ?? 'Universal'}</Row>
            <Row label="Handler">
                <Badge variant="secondary">
                    {HANDLER_OPTIONS.find((h) => h.value === row.handler.kind)?.label ??
                        row.handler.kind}
                </Badge>
            </Row>
            <Row label="Hidden">
                {row.hidden ? (
                    <span className="text-[var(--st-warn)] inline-flex items-center gap-1">
                        <EyeOff className="h-3.5 w-3.5" />
                        Hidden on push
                    </span>
                ) : (
                    'Visible'
                )}
            </Row>
            <Row label="Runs">{row.runCount.toLocaleString()}</Row>
            <Row label="Last run">{fmtDate(row.lastRunAt)}</Row>
            <Row label="Created">{fmtDate(row.createdAt)}</Row>
            <Row label="Updated">{fmtDate(row.updatedAt)}</Row>
            {row.handler.payload ? (
                <div>
                    <p className="mb-1 text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                        Payload
                    </p>
                    <pre className="overflow-x-auto rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2 text-[11.5px]">
                        {JSON.stringify(row.handler.payload, null, 2)}
                    </pre>
                </div>
            ) : null}
        </div>
    );
}

function DetailRuns({ runs, loading }: { runs: RunRow[]; loading: boolean }) {
    if (loading) {
        return (
            <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                ))}
            </div>
        );
    }
    if (runs.length === 0) {
        return (
            <p className="text-[13px] text-[var(--st-text-secondary)]">No invocations recorded yet.</p>
        );
    }
    return (
        <div className="rounded-md border border-[var(--st-border)]">
            <table className="w-full text-[12.5px]">
                <thead className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] text-left text-[var(--st-text-tertiary)]">
                    <tr>
                        <th className="p-2">When</th>
                        <th className="p-2">Chat</th>
                        <th className="p-2">User</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Error</th>
                    </tr>
                </thead>
                <tbody>
                    {runs.map((r) => (
                        <tr key={r._id} className="border-b border-[var(--st-border)]/60 last:border-b-0">
                            <td className="p-2">{fmtDate(r.createdAt)}</td>
                            <td className="p-2 font-mono">{r.chatId ?? '—'}</td>
                            <td className="p-2 font-mono">{r.userId ?? '—'}</td>
                            <td className="p-2">
                                {r.success ? (
                                    <Badge variant="success">ok</Badge>
                                ) : (
                                    <Badge variant="warning">failed</Badge>
                                )}
                            </td>
                            <td className="p-2 text-[var(--st-danger)]">{r.errorMessage ?? '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function DetailDiff({
    diff,
    loading,
    botBound,
}: {
    diff: PullResp | null;
    loading: boolean;
    botBound: boolean;
}) {
    if (!botBound) {
        return (
            <p className="text-[13px] text-[var(--st-text-secondary)]">
                Diff is only available when the command is bound to a specific bot.
            </p>
        );
    }
    if (loading || !diff) {
        return <Skeleton className="h-24 w-full" />;
    }
    return <DiffView diff={diff} />;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--st-border)]/60 py-1.5 last:border-b-0">
            <TelegramProjectGate />
            <span className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                {label}
            </span>
            <span className="text-right text-[var(--st-text)]">{children}</span>
        </div>
    );
}
