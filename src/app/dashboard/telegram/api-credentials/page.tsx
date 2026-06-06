'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, Input, Skeleton, Switch, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  } from 'lucide-react';

import * as React from 'react';

import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import {
    createTelegramApiCredentialAction,
    deleteTelegramApiCredentialAction,
    listTelegramApiCredentialAuditAction,
    listTelegramApiCredentialSessionsAction,
    listTelegramApiCredentialsAction,
    logoutTelegramApiCredentialAction,
    revokeTelegramApiCredentialAction,
    startTelegramApiLoginAction,
    submitTelegramApiLoginCodeAction,
    submitTelegramApiLoginPasswordAction,
    updateTelegramApiCredentialAction,
    verifyTelegramApiCredentialAction,
    type AuditRow,
    type CredentialRow,
    type LoginSessionRow,
} from '@/app/actions/telegram-api-credentials.actions';

const ACCENT = '#229ED9';

// ---------------------------------------------------------------------------
//  Local validation (mirrors the Rust regexes for fast feedback).
// ---------------------------------------------------------------------------

const API_HASH_RE = /^[A-Fa-f0-9]{32}$/;
const PHONE_RE = /^\+[1-9][0-9]{6,14}$/;

interface CreateForm {
    label: string;
    apiId: string;
    apiHash: string;
    phoneNumber: string;
    testMode: boolean;
    notes: string;
}
const EMPTY_CREATE_FORM: CreateForm = {
    label: '',
    apiId: '',
    apiHash: '',
    phoneNumber: '',
    testMode: false,
    notes: '',
};

function validateCreate(f: CreateForm): string | null {
    const idNum = Number(f.apiId.trim());
    if (!Number.isInteger(idNum) || idNum <= 0) {
        return 'api_id must be a positive integer.';
    }
    if (!API_HASH_RE.test(f.apiHash.trim())) {
        return 'api_hash must be exactly 32 hex characters.';
    }
    if (!PHONE_RE.test(f.phoneNumber.trim())) {
        return 'phoneNumber must be E.164 — e.g. +14155552671.';
    }
    return null;
}

interface EditForm {
    label: string;
    phoneNumber: string;
    testMode: boolean;
    notes: string;
}

function fmtDate(iso?: string): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

const STATUS_VARIANT: Record<
    string,
    'success' | 'warning' | 'ghost' | 'info' | 'secondary' | 'danger'
> = {
    unverified: 'ghost',
    verified: 'info',
    login_pending: 'warning',
    login_failed: 'danger',
    active: 'success',
    revoked: 'secondary',
};
const STATUS_LABEL: Record<string, string> = {
    unverified: 'Unverified',
    verified: 'Verified',
    login_pending: 'Login pending',
    login_failed: 'Login failed',
    active: 'Active',
    revoked: 'Revoked',
};

// ---------------------------------------------------------------------------
//  Reveal-on-hover masked secret cell
// ---------------------------------------------------------------------------

function MaskedCell({
    masked,
    onReveal,
}: {
    masked: string;
    onReveal?: () => void;
}) {
    const [shown, setShown] = React.useState(false);
    return (
        <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2 py-1 font-mono text-[11px] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
            onClick={() => {
                setShown((s) => !s);
                if (!shown && onReveal) onReveal();
            }}
            aria-label={shown ? 'Hide masked value' : 'Reveal masked value'}
        >
            {shown ? masked : '••••••••••'}
            {shown ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
    );
}

// ===========================================================================
//                              PAGE
// ===========================================================================

export default function TelegramApiCredentialsPage() {
    const { activeProject } = useProject();
    const projectId = activeProject?._id?.toString() ?? '';
    const { toast } = useToast();

    const [rows, setRows] = React.useState<CredentialRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);

    // Drawer states
    const [createOpen, setCreateOpen] = React.useState(false);
    const [createForm, setCreateForm] = React.useState<CreateForm>(EMPTY_CREATE_FORM);
    const [showHash, setShowHash] = React.useState(false);
    const [creating, setCreating] = React.useState(false);
    const [createErr, setCreateErr] = React.useState<string | null>(null);

    const [detailRow, setDetailRow] = React.useState<CredentialRow | null>(null);
    const [editForm, setEditForm] = React.useState<EditForm | null>(null);
    const [editSaving, setEditSaving] = React.useState(false);

    const [sessions, setSessions] = React.useState<LoginSessionRow[]>([]);
    const [auditItems, setAuditItems] = React.useState<AuditRow[]>([]);

    // Login modal
    const [loginRow, setLoginRow] = React.useState<CredentialRow | null>(null);
    const [loginStep, setLoginStep] = React.useState<'start' | 'code' | 'password' | 'done'>(
        'start',
    );
    const [loginSessionId, setLoginSessionId] = React.useState<string | null>(null);
    const [loginCode, setLoginCode] = React.useState('');
    const [loginPassword, setLoginPassword] = React.useState('');
    const [loginBusy, setLoginBusy] = React.useState(false);

    const [revokeRow, setRevokeRow] = React.useState<CredentialRow | null>(null);
    const [deleteRow, setDeleteRow] = React.useState<CredentialRow | null>(null);

    // ---------------------------------------------------------------------
    //  Data loading
    // ---------------------------------------------------------------------

    const reload = React.useCallback(async () => {
        if (!projectId) {
            setRows([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setLoadError(null);
        const res = await listTelegramApiCredentialsAction(projectId);
        setRows(res.credentials ?? []);
        setLoading(false);
        if (res.error) setLoadError(res.error);
    }, [projectId]);

    React.useEffect(() => {
        void reload();
    }, [reload]);

    // KPIs derived from the loaded rows.
    const kpis = React.useMemo(() => {
        const total = rows.length;
        const verified = rows.filter(
            (r) => r.status === 'verified' || r.status === 'active',
        ).length;
        const active = rows.filter(
            (r) => r.status === 'active' || r.sessionState === 'logged_in',
        ).length;
        const failed = rows.filter((r) => r.status === 'login_failed').length;
        return { total, verified, active, failed };
    }, [rows]);

    // ---------------------------------------------------------------------
    //  Mutations
    // ---------------------------------------------------------------------

    async function submitCreate() {
        if (!projectId) {
            toast({
                title: 'No project',
                description: 'Select a project before adding credentials.',
                variant: 'destructive',
            });
            return;
        }
        const msg = validateCreate(createForm);
        if (msg) {
            setCreateErr(msg);
            return;
        }
        setCreateErr(null);
        setCreating(true);
        const res = await createTelegramApiCredentialAction({
            projectId,
            label: createForm.label.trim() || undefined,
            apiId: Number(createForm.apiId.trim()),
            apiHash: createForm.apiHash.trim().toLowerCase(),
            phoneNumber: createForm.phoneNumber.trim(),
            testMode: createForm.testMode,
            notes: createForm.notes.trim() || undefined,
        });
        setCreating(false);
        if (res.success) {
            toast({
                title: 'Credentials saved',
                description: res.message ?? 'Stored. Run "Verify" to ping Telegram.',
            });
            setCreateOpen(false);
            setCreateForm(EMPTY_CREATE_FORM);
            setShowHash(false);
            void reload();
        } else {
            setCreateErr(res.error ?? 'Failed to save credentials.');
        }
    }

    async function runVerify(row: CredentialRow) {
        if (!projectId) return;
        const res = await verifyTelegramApiCredentialAction(row._id, { projectId });
        if (res.success) {
            toast({ title: 'Verified', description: res.message ?? 'Soft verification passed.' });
        } else {
            toast({
                title: 'Verify failed',
                description: res.error ?? 'Could not verify credentials.',
                variant: 'destructive',
            });
        }
        void reload();
    }

    async function runLogout(row: CredentialRow) {
        if (!projectId) return;
        const res = await logoutTelegramApiCredentialAction(row._id, { projectId });
        if (res.success) {
            toast({ title: 'Logged out', description: res.message ?? 'Session cleared.' });
        } else {
            toast({
                title: 'Logout failed',
                description: res.error ?? 'Could not log out.',
                variant: 'destructive',
            });
        }
        void reload();
    }

    async function openLogin(row: CredentialRow) {
        if (!projectId) return;
        setLoginRow(row);
        setLoginStep('start');
        setLoginSessionId(null);
        setLoginCode('');
        setLoginPassword('');
    }

    async function loginStart() {
        if (!projectId || !loginRow) return;
        setLoginBusy(true);
        const res = await startTelegramApiLoginAction(loginRow._id, { projectId });
        setLoginBusy(false);
        if (res.success && res.sessionId) {
            setLoginSessionId(res.sessionId);
            setLoginStep('code');
            toast({
                title: 'Session opened',
                description:
                    'Preview only — no real Telegram code was sent (MTProto worker pending).',
            });
        } else {
            toast({
                title: 'Could not start login',
                description: res.error ?? 'Failed to start login flow.',
                variant: 'destructive',
            });
        }
    }

    async function loginCodeSubmit() {
        if (!projectId || !loginRow || !loginSessionId) return;
        if (!loginCode.trim()) {
            toast({
                title: 'Code required',
                description: 'Enter the (placeholder) verification code.',
                variant: 'destructive',
            });
            return;
        }
        setLoginBusy(true);
        const res = await submitTelegramApiLoginCodeAction(loginRow._id, {
            projectId,
            sessionId: loginSessionId,
            code: loginCode.trim(),
        });
        setLoginBusy(false);
        if (res.success) {
            setLoginStep('password');
            toast({
                title: 'Code accepted',
                description: 'If the account has 2FA, supply the password next.',
            });
        } else {
            toast({
                title: 'Code rejected',
                description: res.error ?? 'Failed to accept code.',
                variant: 'destructive',
            });
        }
    }

    async function loginPasswordSubmit() {
        if (!projectId || !loginRow || !loginSessionId) return;
        if (!loginPassword) {
            toast({
                title: 'Password required',
                description: 'Enter the 2FA password (or any non-empty value to simulate).',
                variant: 'destructive',
            });
            return;
        }
        setLoginBusy(true);
        const res = await submitTelegramApiLoginPasswordAction(loginRow._id, {
            projectId,
            sessionId: loginSessionId,
            password: loginPassword,
        });
        setLoginBusy(false);
        if (res.success) {
            setLoginStep('done');
            toast({
                title: 'Logged in (preview)',
                description: 'Marked active. A real MTProto session is not yet established.',
            });
            void reload();
        } else {
            toast({
                title: 'Password rejected',
                description: res.error ?? 'Failed to submit password.',
                variant: 'destructive',
            });
        }
    }

    function closeLogin() {
        setLoginRow(null);
        setLoginStep('start');
        setLoginSessionId(null);
        setLoginCode('');
        setLoginPassword('');
    }

    async function openDetail(row: CredentialRow) {
        setDetailRow(row);
        setEditForm({
            label: row.label ?? '',
            phoneNumber: '', // intentionally empty — show placeholder so user types fresh if rotating
            testMode: row.testMode,
            notes: row.notes ?? '',
        });
        // Lazy-load sessions and audit in parallel.
        if (projectId) {
            const [s, a] = await Promise.all([
                listTelegramApiCredentialSessionsAction(row._id, projectId),
                listTelegramApiCredentialAuditAction({
                    projectId,
                    credentialId: row._id,
                    limit: 50,
                }),
            ]);
            setSessions(s.sessions ?? []);
            setAuditItems(a.items ?? []);
        }
    }

    function closeDetail() {
        setDetailRow(null);
        setEditForm(null);
        setSessions([]);
        setAuditItems([]);
    }

    async function saveEdit() {
        if (!projectId || !detailRow || !editForm) return;
        setEditSaving(true);
        const res = await updateTelegramApiCredentialAction(detailRow._id, {
            projectId,
            label: editForm.label,
            phoneNumber: editForm.phoneNumber.trim() || undefined,
            testMode: editForm.testMode,
            notes: editForm.notes,
        });
        setEditSaving(false);
        if (res.success) {
            toast({ title: 'Saved', description: res.message ?? 'Updated.' });
            closeDetail();
            void reload();
        } else {
            toast({
                title: 'Update failed',
                description: res.error ?? 'Failed to update.',
                variant: 'destructive',
            });
        }
    }

    async function confirmRevoke() {
        if (!projectId || !revokeRow) return;
        const res = await revokeTelegramApiCredentialAction(revokeRow._id, projectId);
        setRevokeRow(null);
        if (res.success) {
            toast({ title: 'Revoked', description: res.message ?? 'Credential revoked.' });
            void reload();
        } else {
            toast({
                title: 'Revoke failed',
                description: res.error ?? 'Failed to revoke.',
                variant: 'destructive',
            });
        }
    }

    async function confirmDelete() {
        if (!projectId || !deleteRow) return;
        const res = await deleteTelegramApiCredentialAction(deleteRow._id, projectId);
        setDeleteRow(null);
        if (res.success) {
            toast({ title: 'Deleted', description: res.message ?? 'Credential removed.' });
            void reload();
        } else {
            toast({
                title: 'Delete failed',
                description: res.error ?? 'Failed to delete.',
                variant: 'destructive',
            });
        }
    }

    // ---------------------------------------------------------------------
    //  Render
    // ---------------------------------------------------------------------

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
                    <KeyRound className="h-6 w-6 text-white" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                    <h1 className="text-[22px] leading-tight text-[var(--st-text)]">
                        Telegram API Credentials (MTProto)
                    </h1>
                    <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-[var(--st-text-secondary)]">
                        Store the <code className="font-mono text-[12px]">api_id</code>/
                        <code className="font-mono text-[12px]">api_hash</code> pair from{' '}
                        <a
                            href="https://my.telegram.org"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                            style={{ color: ACCENT }}
                        >
                            my.telegram.org
                        </a>{' '}
                        for user-level Telegram automation. For standard bot messaging, use
                        the Bots page instead.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void reload()}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => {
                            setCreateForm(EMPTY_CREATE_FORM);
                            setCreateErr(null);
                            setCreateOpen(true);
                        }}
                        disabled={!projectId}
                    >
                        <Plus className="h-3 w-3" />
                        Add credentials
                    </Button>
                </div>
            </div>

            {/* Preview banner */}
            <div
                className="flex items-start gap-3 rounded-2xl border p-4"
                style={{
                    borderColor: '#F1C40F66',
                    background: '#FEF6D7',
                }}
            >
                <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--st-text)]" />
                <div className="text-[12.5px] leading-relaxed text-[var(--st-text)]">
                    <strong>MTProto login flow is in preview.</strong> Credentials are stored
                    securely; live MTProto sessions are not yet running. Use Bot API on the
                    Bots page for standard automation.
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid gap-3 md:grid-cols-4">
                <KpiCard label="Total credentials" value={kpis.total} />
                <KpiCard label="Verified" value={kpis.verified} accent="success" />
                <KpiCard label="Active sessions" value={kpis.active} accent="info" />
                <KpiCard label="Recent failures" value={kpis.failed} accent="danger" />
            </div>

            {/* Table */}
            <Card className="p-0">
                <div className="flex items-center justify-between border-b border-[var(--st-border)] px-4 py-3">
                    <div>
                        <h2 className="text-[14px] text-[var(--st-text)]">Credentials</h2>
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
                            One credential pair per user per project.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col gap-2 p-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                ) : loadError ? (
                    <div className="p-6 text-center text-[13px] text-[var(--st-danger)]">
                        {loadError}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-6">
                        <EmptyState
                            icon={<KeyRound />}
                            title="No credentials yet"
                            description="Add an api_id / api_hash pair from my.telegram.org to begin."
                            action={
                                <Button
                                    size="sm"
                                    onClick={() => setCreateOpen(true)}
                                    disabled={!projectId}
                                >
                                    <Plus className="h-3 w-3" />
                                    Add credentials
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead className="bg-[var(--st-bg-muted)] text-[11.5px] uppercase tracking-[0.08em] text-[var(--st-text-secondary)]">
                                <tr>
                                    <th className="px-4 py-2 text-left">Label</th>
                                    <th className="px-4 py-2 text-left">Phone</th>
                                    <th className="px-4 py-2 text-left">api_id</th>
                                    <th className="px-4 py-2 text-left">api_hash</th>
                                    <th className="px-4 py-2 text-left">Status</th>
                                    <th className="px-4 py-2 text-left">Mode</th>
                                    <th className="px-4 py-2 text-left">Last verified</th>
                                    <th className="px-4 py-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr
                                        key={r._id}
                                        className="border-t border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]"
                                    >
                                        <td className="px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => void openDetail(r)}
                                                className="text-[var(--st-text)] hover:underline"
                                            >
                                                {r.label ?? <span className="italic text-[var(--st-text-secondary)]">unnamed</span>}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--st-text-secondary)]">
                                            {r.phoneNumberMasked}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--st-text)]">
                                            {r.apiId}
                                        </td>
                                        <td className="px-4 py-3">
                                            <MaskedCell masked={r.apiHashMasked} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge
                                                variant={STATUS_VARIANT[r.status] ?? 'ghost'}
                                            >
                                                {STATUS_LABEL[r.status] ?? r.status}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            {r.testMode ? (
                                                <Badge variant="warning">Test</Badge>
                                            ) : (
                                                <Badge variant="ghost">Live</Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-[var(--st-text-secondary)]">
                                            {fmtDate(r.lastVerifiedAt)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={() => void runVerify(r)}
                                                    >
                                                        <ShieldCheck className="h-3 w-3" />
                                                        Verify
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => void openLogin(r)}
                                                    >
                                                        <LogIn className="h-3 w-3" />
                                                        Start login
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => void runLogout(r)}
                                                        disabled={r.sessionState === 'none'}
                                                    >
                                                        <LogOut className="h-3 w-3" />
                                                        Logout
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => void openDetail(r)}
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => setRevokeRow(r)}
                                                        disabled={r.status === 'revoked'}
                                                    >
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Revoke
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => setDeleteRow(r)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* --------- Add credentials drawer --------- */}
            <Drawer open={createOpen} onOpenChange={setCreateOpen}>
                <DrawerContent className="max-w-xl">
                    <DrawerHeader>
                        <DrawerTitle>Add Telegram credentials</DrawerTitle>
                        <DrawerDescription>
                            Copy these from{' '}
                            <a
                                href="https://my.telegram.org"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                            >
                                my.telegram.org → API development tools
                            </a>
                            .
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="flex flex-col gap-4 px-6 pb-6">
                        <Field label="Label (optional)">
                            <Input
                                value={createForm.label}
                                placeholder="e.g. main user account"
                                onChange={(e) =>
                                    setCreateForm({ ...createForm, label: e.target.value })
                                }
                            />
                        </Field>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="api_id" hint="Numeric integer.">
                                <Input
                                    inputMode="numeric"
                                    value={createForm.apiId}
                                    placeholder="1234567"
                                    onChange={(e) =>
                                        setCreateForm({ ...createForm, apiId: e.target.value })
                                    }
                                />
                            </Field>
                            <Field
                                label="Phone number"
                                hint="E.164 — include the country code with `+`."
                            >
                                <Input
                                    value={createForm.phoneNumber}
                                    placeholder="+14155552671"
                                    onChange={(e) =>
                                        setCreateForm({
                                            ...createForm,
                                            phoneNumber: e.target.value,
                                        })
                                    }
                                />
                            </Field>
                        </div>
                        <Field label="api_hash" hint="32 hex characters.">
                            <div className="flex items-center gap-2">
                                <Input
                                    type={showHash ? 'text' : 'password'}
                                    value={createForm.apiHash}
                                    placeholder="32-character hex string"
                                    onChange={(e) =>
                                        setCreateForm({ ...createForm, apiHash: e.target.value })
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowHash((s) => !s)}
                                >
                                    {showHash ? (
                                        <EyeOff className="h-3 w-3" />
                                    ) : (
                                        <Eye className="h-3 w-3" />
                                    )}
                                    {showHash ? 'Hide' : 'Show'}
                                </Button>
                            </div>
                        </Field>
                        <Field label="Test mode" hint="Route through Telegram's test DC pair.">
                            <Switch
                                checked={createForm.testMode}
                                onCheckedChange={(v) =>
                                    setCreateForm({ ...createForm, testMode: !!v })
                                }
                            />
                        </Field>
                        <Field label="Notes (optional)">
                            <Textarea
                                rows={3}
                                value={createForm.notes}
                                placeholder="Anything to remember about this account."
                                onChange={(e) =>
                                    setCreateForm({ ...createForm, notes: e.target.value })
                                }
                            />
                        </Field>

                        {createErr ? (
                            <div className="rounded-md border border-[var(--st-danger)] bg-[var(--st-danger-soft)] px-3 py-2 text-[12.5px] text-[var(--st-danger)]">
                                {createErr}
                            </div>
                        ) : null}

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCreateOpen(false)}
                                disabled={creating}
                            >
                                Cancel
                            </Button>
                            <Button size="sm" onClick={submitCreate} disabled={creating}>
                                {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                Save credentials
                            </Button>
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>

            {/* --------- Detail drawer --------- */}
            <Drawer
                open={!!detailRow}
                onOpenChange={(v) => {
                    if (!v) closeDetail();
                }}
            >
                <DrawerContent className="max-w-2xl">
                    <DrawerHeader>
                        <DrawerTitle>
                            {detailRow?.label ?? 'Credential detail'}
                        </DrawerTitle>
                        <DrawerDescription>
                            Status, login session walk-through, and audit log.
                        </DrawerDescription>
                    </DrawerHeader>
                    {detailRow && editForm ? (
                        <div className="flex flex-col gap-6 px-6 pb-6">
                            <section className="grid gap-3 md:grid-cols-2">
                                <Info label="api_id" value={String(detailRow.apiId)} />
                                <Info
                                    label="Status"
                                    value={STATUS_LABEL[detailRow.status] ?? detailRow.status}
                                />
                                <Info
                                    label="Phone"
                                    value={detailRow.phoneNumberMasked}
                                />
                                <Info
                                    label="Test mode"
                                    value={detailRow.testMode ? 'Yes' : 'No'}
                                />
                                <Info
                                    label="Last verified"
                                    value={fmtDate(detailRow.lastVerifiedAt)}
                                />
                                <Info
                                    label="Last used"
                                    value={fmtDate(detailRow.lastUsedAt)}
                                />
                            </section>

                            <section>
                                <h3 className="mb-2 text-[12.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                                    Edit metadata
                                </h3>
                                <div className="flex flex-col gap-3">
                                    <Field label="Label">
                                        <Input
                                            value={editForm.label}
                                            onChange={(e) =>
                                                setEditForm({ ...editForm, label: e.target.value })
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label="Phone number"
                                        hint="Leave blank to keep the existing number."
                                    >
                                        <Input
                                            value={editForm.phoneNumber}
                                            placeholder={detailRow.phoneNumberMasked}
                                            onChange={(e) =>
                                                setEditForm({
                                                    ...editForm,
                                                    phoneNumber: e.target.value,
                                                })
                                            }
                                        />
                                    </Field>
                                    <Field label="Test mode">
                                        <Switch
                                            checked={editForm.testMode}
                                            onCheckedChange={(v) =>
                                                setEditForm({ ...editForm, testMode: !!v })
                                            }
                                        />
                                    </Field>
                                    <Field label="Notes">
                                        <Textarea
                                            rows={3}
                                            value={editForm.notes}
                                            onChange={(e) =>
                                                setEditForm({ ...editForm, notes: e.target.value })
                                            }
                                        />
                                    </Field>
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            size="sm"
                                            onClick={saveEdit}
                                            disabled={editSaving}
                                        >
                                            {editSaving ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : null}
                                            Save changes
                                        </Button>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="mb-2 text-[12.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                                    Login sessions
                                </h3>
                                {sessions.length === 0 ? (
                                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                                        No login sessions yet.
                                    </p>
                                ) : (
                                    <ul className="flex flex-col gap-2">
                                        {sessions.map((s) => (
                                            <li
                                                key={s._id}
                                                className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-mono text-[11.5px] text-[var(--st-text-secondary)]">
                                                        {s._id}
                                                    </span>
                                                    <Badge variant="ghost">
                                                        {s.status}
                                                    </Badge>
                                                </div>
                                                <div className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
                                                    Started {fmtDate(s.startedAt)} ·
                                                    {s.placeholder ? ' placeholder' : ' live'}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>

                            <section>
                                <h3 className="mb-2 text-[12.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                                    Audit log
                                </h3>
                                {auditItems.length === 0 ? (
                                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                                        No audit entries yet.
                                    </p>
                                ) : (
                                    <ul className="flex flex-col gap-1">
                                        {auditItems.map((a) => (
                                            <li
                                                key={a._id}
                                                className="rounded-md border border-[var(--st-border)] px-3 py-2 text-[12px]"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-mono uppercase tracking-[0.08em] text-[var(--st-text)]">
                                                        {a.action}
                                                    </span>
                                                    <span className="text-[var(--st-text-secondary)]">
                                                        {fmtDate(a.at)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-[var(--st-text-secondary)]">
                                                    {a.detail}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </div>
                    ) : null}
                </DrawerContent>
            </Drawer>

            {/* --------- Login flow modal --------- */}
            <Dialog
                open={!!loginRow}
                onOpenChange={(v) => {
                    if (!v) closeLogin();
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            MTProto login{' '}
                            <Badge variant="warning">Preview</Badge>
                        </DialogTitle>
                        <DialogDescription>
                            This flow currently simulates each step — no MTProto handshake is
                            performed yet.
                        </DialogDescription>
                    </DialogHeader>

                    {loginStep === 'start' ? (
                        <div className="flex flex-col gap-3">
                            <p className="text-[13px] text-[var(--st-text)]">
                                Click <strong>Open session</strong> to record a placeholder login
                                session for{' '}
                                <span className="font-mono">{loginRow?.phoneNumberMasked}</span>.
                            </p>
                            <p className="text-[12px] text-[var(--st-text-secondary)]">
                                A future MTProto worker will pick the session up and call
                                Telegram's <code>sendCode</code> for real.
                            </p>
                        </div>
                    ) : null}
                    {loginStep === 'code' ? (
                        <div className="flex flex-col gap-3">
                            <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                                Session id:{' '}
                                <code className="font-mono">{loginSessionId}</code>
                            </p>
                            <Field
                                label="Verification code"
                                hint="Any value works in preview; the real worker will validate."
                            >
                                <Input
                                    value={loginCode}
                                    onChange={(e) => setLoginCode(e.target.value)}
                                    placeholder="123456"
                                />
                            </Field>
                        </div>
                    ) : null}
                    {loginStep === 'password' ? (
                        <div className="flex flex-col gap-3">
                            <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                                Session id:{' '}
                                <code className="font-mono">{loginSessionId}</code>
                            </p>
                            <Field
                                label="2FA password"
                                hint="Required if the account has cloud-password enabled. Any value works in preview."
                            >
                                <Input
                                    type="password"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                />
                            </Field>
                        </div>
                    ) : null}
                    {loginStep === 'done' ? (
                        <div className="flex flex-col items-center gap-2 py-2">
                            <CheckCircle2 className="h-8 w-8 text-[var(--st-text)]" />
                            <p className="text-[13px] text-[var(--st-text)]">
                                Placeholder login complete.
                            </p>
                            <p className="text-[12px] text-[var(--st-text-secondary)]">
                                Credential marked active.
                            </p>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={closeLogin}>
                            Close
                        </Button>
                        {loginStep === 'start' ? (
                            <Button size="sm" onClick={loginStart} disabled={loginBusy}>
                                {loginBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                Open session
                            </Button>
                        ) : null}
                        {loginStep === 'code' ? (
                            <Button
                                size="sm"
                                onClick={loginCodeSubmit}
                                disabled={loginBusy}
                            >
                                {loginBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                Submit code
                            </Button>
                        ) : null}
                        {loginStep === 'password' ? (
                            <Button
                                size="sm"
                                onClick={loginPasswordSubmit}
                                disabled={loginBusy}
                            >
                                {loginBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                Submit password
                            </Button>
                        ) : null}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --------- Revoke confirm --------- */}
            <AlertDialog
                open={!!revokeRow}
                onOpenChange={(v) => {
                    if (!v) setRevokeRow(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke credential?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The credential will be marked <code>revoked</code> and any active
                            session cleared. The record is preserved for audit — use{' '}
                            <strong>Delete</strong> to remove it entirely.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRevoke}>
                            Revoke
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* --------- Delete confirm --------- */}
            <AlertDialog
                open={!!deleteRow}
                onOpenChange={(v) => {
                    if (!v) setDeleteRow(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete credential?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The credential and all login sessions will be removed. The audit log
                            entries remain so the action is traceable.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ---------------------------------------------------------------------------
//  Small helpers
// ---------------------------------------------------------------------------

function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                {label}
            </span>
            {children}
            {hint ? (
                <span className="text-[11px] text-[var(--st-text-secondary)]">{hint}</span>
            ) : null}
        </label>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                {label}
            </p>
            <p className="mt-0.5 text-[13px] text-[var(--st-text)]">{value}</p>
        </div>
    );
}

function KpiCard({
    label,
    value,
    accent,
}: {
    label: string;
    value: number;
    accent?: 'success' | 'info' | 'danger';
}) {
    const color =
        accent === 'success'
            ? 'text-[var(--st-text)]'
            : accent === 'info'
              ? 'text-[var(--st-text)]'
              : accent === 'danger'
                ? 'text-[var(--st-text)]'
                : 'text-[var(--st-text)]';
    return (
        <Card className="p-4">
            <TelegramProjectGate />
            <p className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                {label}
            </p>
            <p className={`mt-1 text-[24px] font-medium leading-none ${color}`}>{value}</p>
        </Card>
    );
}
