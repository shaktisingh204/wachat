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
    Alert,
    Badge,
    Button,
    Card,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    EmptyState,
    Field,
    Input,
    PageActions,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Skeleton,
    Switch,
    Table,
    TBody,
    Td,
    Textarea,
    THead,
    Th,
    Tr,
    type BadgeTone,
    useToast,
} from '@/components/sabcrm/20ui';
import {
    AlertTriangle,
    CheckCircle2,
    Eye,
    EyeOff,
    KeyRound,
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
        return 'phoneNumber must be E.164, e.g. +14155552671.';
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
    if (!iso) return 'Never';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

const STATUS_TONE: Record<string, BadgeTone> = {
    unverified: 'neutral',
    verified: 'info',
    login_pending: 'warning',
    login_failed: 'danger',
    active: 'success',
    revoked: 'neutral',
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
        <Button
            variant="ghost"
            size="sm"
            className="font-mono text-[11px]"
            iconRight={shown ? EyeOff : Eye}
            onClick={() => {
                setShown((s) => !s);
                if (!shown && onReveal) onReveal();
            }}
            aria-label={shown ? 'Hide masked value' : 'Reveal masked value'}
        >
            {shown ? masked : '••••••••••'}
        </Button>
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
                tone: 'danger',
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
                tone: 'success',
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
            toast({
                title: 'Verified',
                description: res.message ?? 'Soft verification passed.',
                tone: 'success',
            });
        } else {
            toast({
                title: 'Verify failed',
                description: res.error ?? 'Could not verify credentials.',
                tone: 'danger',
            });
        }
        void reload();
    }

    async function runLogout(row: CredentialRow) {
        if (!projectId) return;
        const res = await logoutTelegramApiCredentialAction(row._id, { projectId });
        if (res.success) {
            toast({
                title: 'Logged out',
                description: res.message ?? 'Session cleared.',
                tone: 'success',
            });
        } else {
            toast({
                title: 'Logout failed',
                description: res.error ?? 'Could not log out.',
                tone: 'danger',
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
                    'Preview only. No real Telegram code was sent (MTProto worker pending).',
                tone: 'info',
            });
        } else {
            toast({
                title: 'Could not start login',
                description: res.error ?? 'Failed to start login flow.',
                tone: 'danger',
            });
        }
    }

    async function loginCodeSubmit() {
        if (!projectId || !loginRow || !loginSessionId) return;
        if (!loginCode.trim()) {
            toast({
                title: 'Code required',
                description: 'Enter the (placeholder) verification code.',
                tone: 'danger',
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
                tone: 'success',
            });
        } else {
            toast({
                title: 'Code rejected',
                description: res.error ?? 'Failed to accept code.',
                tone: 'danger',
            });
        }
    }

    async function loginPasswordSubmit() {
        if (!projectId || !loginRow || !loginSessionId) return;
        if (!loginPassword) {
            toast({
                title: 'Password required',
                description: 'Enter the 2FA password (or any non-empty value to simulate).',
                tone: 'danger',
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
                tone: 'success',
            });
            void reload();
        } else {
            toast({
                title: 'Password rejected',
                description: res.error ?? 'Failed to submit password.',
                tone: 'danger',
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
            phoneNumber: '', // intentionally empty, show placeholder so user types fresh if rotating
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
            toast({ title: 'Saved', description: res.message ?? 'Updated.', tone: 'success' });
            closeDetail();
            void reload();
        } else {
            toast({
                title: 'Update failed',
                description: res.error ?? 'Failed to update.',
                tone: 'danger',
            });
        }
    }

    async function confirmRevoke() {
        if (!projectId || !revokeRow) return;
        const res = await revokeTelegramApiCredentialAction(revokeRow._id, projectId);
        setRevokeRow(null);
        if (res.success) {
            toast({
                title: 'Revoked',
                description: res.message ?? 'Credential revoked.',
                tone: 'success',
            });
            void reload();
        } else {
            toast({
                title: 'Revoke failed',
                description: res.error ?? 'Failed to revoke.',
                tone: 'danger',
            });
        }
    }

    async function confirmDelete() {
        if (!projectId || !deleteRow) return;
        const res = await deleteTelegramApiCredentialAction(deleteRow._id, projectId);
        setDeleteRow(null);
        if (res.success) {
            toast({
                title: 'Deleted',
                description: res.message ?? 'Credential removed.',
                tone: 'success',
            });
            void reload();
        } else {
            toast({
                title: 'Delete failed',
                description: res.error ?? 'Failed to delete.',
                tone: 'danger',
            });
        }
    }

    // ---------------------------------------------------------------------
    //  Render
    // ---------------------------------------------------------------------

    return (
        <div className="flex flex-col gap-6">
            <TelegramProjectGate />

            {/* Header */}
            <PageHeader>
                <div className="flex items-start gap-4">
                    <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--st-radius-lg)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                        aria-hidden="true"
                    >
                        <KeyRound className="h-6 w-6" strokeWidth={1.75} />
                    </span>
                    <PageHeaderHeading>
                        <PageTitle>Telegram API Credentials (MTProto)</PageTitle>
                        <PageDescription>
                            Store the <code className="font-mono text-[12px]">api_id</code>/
                            <code className="font-mono text-[12px]">api_hash</code> pair from{' '}
                            <a
                                href="https://my.telegram.org"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--st-accent)] underline"
                            >
                                my.telegram.org
                            </a>{' '}
                            for user-level Telegram automation. For standard bot messaging, use
                            the Bots page instead.
                        </PageDescription>
                    </PageHeaderHeading>
                </div>
                <PageActions>
                    <Button
                        variant="outline"
                        size="sm"
                        iconLeft={RefreshCw}
                        onClick={() => void reload()}
                        loading={loading}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        iconLeft={Plus}
                        onClick={() => {
                            setCreateForm(EMPTY_CREATE_FORM);
                            setCreateErr(null);
                            setCreateOpen(true);
                        }}
                        disabled={!projectId}
                    >
                        Add credentials
                    </Button>
                </PageActions>
            </PageHeader>

            {/* Preview banner */}
            <Alert tone="warning" title="MTProto login flow is in preview." icon={AlertTriangle}>
                Credentials are stored securely; live MTProto sessions are not yet running. Use
                Bot API on the Bots page for standard automation.
            </Alert>

            {/* KPI cards */}
            <div className="grid gap-3 md:grid-cols-4">
                <KpiCard label="Total credentials" value={kpis.total} />
                <KpiCard label="Verified" value={kpis.verified} />
                <KpiCard label="Active sessions" value={kpis.active} />
                <KpiCard label="Recent failures" value={kpis.failed} />
            </div>

            {/* Table */}
            <Card padding="none">
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
                            <Skeleton key={i} height={48} radius={8} />
                        ))}
                    </div>
                ) : loadError ? (
                    <div className="p-6 text-center text-[13px] text-[var(--st-danger)]">
                        {loadError}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-6">
                        <EmptyState
                            icon={KeyRound}
                            title="No credentials yet"
                            description="Add an api_id / api_hash pair from my.telegram.org to begin."
                            action={
                                <Button
                                    variant="primary"
                                    size="sm"
                                    iconLeft={Plus}
                                    onClick={() => setCreateOpen(true)}
                                    disabled={!projectId}
                                >
                                    Add credentials
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Label</Th>
                                    <Th>Phone</Th>
                                    <Th>api_id</Th>
                                    <Th>api_hash</Th>
                                    <Th>Status</Th>
                                    <Th>Mode</Th>
                                    <Th>Last verified</Th>
                                    <Th align="right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {rows.map((r) => (
                                    <Tr key={r._id}>
                                        <Td>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => void openDetail(r)}
                                            >
                                                {r.label ?? (
                                                    <span className="italic text-[var(--st-text-secondary)]">
                                                        unnamed
                                                    </span>
                                                )}
                                            </Button>
                                        </Td>
                                        <Td className="font-mono text-[12px] text-[var(--st-text-secondary)]">
                                            {r.phoneNumberMasked}
                                        </Td>
                                        <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                            {r.apiId}
                                        </Td>
                                        <Td>
                                            <MaskedCell masked={r.apiHashMasked} />
                                        </Td>
                                        <Td>
                                            <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>
                                                {STATUS_LABEL[r.status] ?? r.status}
                                            </Badge>
                                        </Td>
                                        <Td>
                                            {r.testMode ? (
                                                <Badge tone="warning">Test</Badge>
                                            ) : (
                                                <Badge tone="neutral">Live</Badge>
                                            )}
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {fmtDate(r.lastVerifiedAt)}
                                        </Td>
                                        <Td align="right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        aria-label="Credential actions"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        iconLeft={ShieldCheck}
                                                        onClick={() => void runVerify(r)}
                                                    >
                                                        Verify
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        iconLeft={LogIn}
                                                        onClick={() => void openLogin(r)}
                                                    >
                                                        Start login
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        iconLeft={LogOut}
                                                        onClick={() => void runLogout(r)}
                                                        disabled={r.sessionState === 'none'}
                                                    >
                                                        Logout
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        iconLeft={Pencil}
                                                        onClick={() => void openDetail(r)}
                                                    >
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        iconLeft={AlertTriangle}
                                                        onClick={() => setRevokeRow(r)}
                                                        disabled={r.status === 'revoked'}
                                                    >
                                                        Revoke
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        variant="danger"
                                                        iconLeft={Trash2}
                                                        onClick={() => setDeleteRow(r)}
                                                    >
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
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
                                my.telegram.org, API development tools
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
                            <Field label="api_id" help="Numeric integer.">
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
                                help="E.164, include the country code with a leading +."
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
                        <Field label="api_hash" help="32 hex characters.">
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
                                    variant="outline"
                                    size="sm"
                                    iconLeft={showHash ? EyeOff : Eye}
                                    onClick={() => setShowHash((s) => !s)}
                                >
                                    {showHash ? 'Hide' : 'Show'}
                                </Button>
                            </div>
                        </Field>
                        <Field label="Test mode" help="Route through Telegram's test DC pair.">
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
                            <Alert tone="danger">{createErr}</Alert>
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
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={submitCreate}
                                loading={creating}
                            >
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
                        <DrawerTitle>{detailRow?.label ?? 'Credential detail'}</DrawerTitle>
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
                                <Info label="Phone" value={detailRow.phoneNumberMasked} />
                                <Info
                                    label="Test mode"
                                    value={detailRow.testMode ? 'Yes' : 'No'}
                                />
                                <Info
                                    label="Last verified"
                                    value={fmtDate(detailRow.lastVerifiedAt)}
                                />
                                <Info label="Last used" value={fmtDate(detailRow.lastUsedAt)} />
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
                                        help="Leave blank to keep the existing number."
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
                                            variant="primary"
                                            size="sm"
                                            onClick={saveEdit}
                                            loading={editSaving}
                                        >
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
                                                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-mono text-[11.5px] text-[var(--st-text-secondary)]">
                                                        {s._id}
                                                    </span>
                                                    <Badge tone="neutral">{s.status}</Badge>
                                                </div>
                                                <div className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
                                                    Started {fmtDate(s.startedAt)} .
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
                                                className="rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2 text-[12px]"
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
                            MTProto login <Badge tone="warning">Preview</Badge>
                        </DialogTitle>
                        <DialogDescription>
                            This flow currently simulates each step. No MTProto handshake is
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
                                help="Any value works in preview; the real worker will validate."
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
                                help="Required if the account has cloud-password enabled. Any value works in preview."
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
                            <CheckCircle2 className="h-8 w-8 text-[var(--st-status-ok)]" aria-hidden="true" />
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
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={loginStart}
                                loading={loginBusy}
                            >
                                Open session
                            </Button>
                        ) : null}
                        {loginStep === 'code' ? (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={loginCodeSubmit}
                                loading={loginBusy}
                            >
                                Submit code
                            </Button>
                        ) : null}
                        {loginStep === 'password' ? (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={loginPasswordSubmit}
                                loading={loginBusy}
                            >
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
                            session cleared. The record is preserved for audit; use{' '}
                            <strong>Delete</strong> to remove it entirely.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRevoke}>Revoke</AlertDialogAction>
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
                        <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ---------------------------------------------------------------------------
//  Small helpers
// ---------------------------------------------------------------------------

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

function KpiCard({ label, value }: { label: string; value: number }) {
    return (
        <Card padding="md">
            <p className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                {label}
            </p>
            <p className="mt-1 text-[24px] font-medium leading-none text-[var(--st-text)]">
                {value}
            </p>
        </Card>
    );
}
