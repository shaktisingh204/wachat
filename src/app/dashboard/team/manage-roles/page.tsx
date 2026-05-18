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
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruInput,
  ZoruLabel,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
  } from 'react';
import { useFormStatus } from 'react-dom';
import {
    ShieldCheck,
  Plus,
  Save,
  Trash2,
  LoaderCircle,
  ChevronDown,
  Check,
  } from 'lucide-react';

import { getSession } from '@/app/actions/user.actions';
import {
    saveRolePermissions,
    saveRole,
    deleteRole,
} from '@/app/actions/crm-roles.actions';
import type { WithId, User } from '@/lib/definitions';

const initialState = { message: undefined, error: undefined } as {
    message?: string;
    error?: string;
};

const actions = ['view', 'create', 'edit', 'delete'] as const;

// Full module list mirrors dashboard-config.ts so each role can be
// scoped with view/create/edit/delete across every feature area.
const permissionCategories: Record<string, { label: string; modules: Array<{ id: string; name: string }> }> = {
    wachat: {
        label: 'WaChat Core',
        modules: [
            { id: 'wachat_overview', name: 'Overview' },
            { id: 'wachat_chat', name: 'Live Chat' },
            { id: 'wachat_contacts', name: 'Contacts' },
            { id: 'wachat_campaigns', name: 'Campaigns' },
            { id: 'wachat_templates', name: 'Templates' },
            { id: 'wachat_catalog', name: 'Ecomm + Catalog' },
            { id: 'wachat_calls', name: 'Calls' },
            { id: 'wachat_flow_builder', name: 'Flow Builder' },
            { id: 'wachat_flows', name: 'Meta Flows (Beta)' },
            { id: 'wachat_integrations', name: 'Integrations' },
            { id: 'wachat_whatsapp_pay', name: 'WhatsApp Pay' },
            { id: 'wachat_numbers', name: 'Numbers' },
            { id: 'wachat_webhooks', name: 'Webhooks' },
            { id: 'wachat_settings', name: 'Project Settings' },
        ],
    },
    crm: {
        label: 'CRM Suite',
        modules: [
            { id: 'crm_dashboard', name: 'CRM Dashboard' },
            { id: 'crm_clients', name: 'Sales: Clients & Prospects' },
            { id: 'crm_quotations', name: 'Sales: Quotations' },
            { id: 'crm_proforma', name: 'Sales: Proforma Invoices' },
            { id: 'crm_invoices', name: 'Sales: Invoices' },
            { id: 'crm_receipts', name: 'Sales: Payment Receipts' },
            { id: 'crm_orders', name: 'Sales: Sales Orders' },
            { id: 'crm_delivery', name: 'Sales: Delivery Challans' },
            { id: 'crm_credit_notes', name: 'Sales: Credit Notes' },
            { id: 'crm_vendors', name: 'Purchases: Vendors' },
            { id: 'crm_expenses', name: 'Purchases: Expenses' },
            { id: 'crm_purchase_orders', name: 'Purchases: Orders' },
            { id: 'crm_payouts', name: 'Purchases: Payout Receipts' },
            { id: 'crm_debit_notes', name: 'Purchases: Debit Notes' },
            { id: 'crm_items', name: 'Inventory: All Items' },
            { id: 'crm_warehouses', name: 'Inventory: Warehouses' },
            { id: 'crm_inventory_pnl', name: 'Inventory: Product P&L' },
            { id: 'crm_stock_value', name: 'Inventory: Stock Value' },
            { id: 'crm_batch_expiry', name: 'Inventory: Batch Expiry' },
            { id: 'crm_party_transactions', name: 'Inventory: Party Trans.' },
            { id: 'crm_all_transactions', name: 'Inventory: All Trans.' },
            { id: 'crm_account_groups', name: 'Accts: Groups' },
            { id: 'crm_chart_of_accounts', name: 'Accts: Chart of Accounts' },
            { id: 'crm_vouchers', name: 'Accts: Vouchers' },
            { id: 'crm_balance_sheet', name: 'Accts: Balance Sheet' },
            { id: 'crm_trial_balance', name: 'Accts: Trial Balance' },
            { id: 'crm_pnl', name: 'Accts: Profit & Loss' },
            { id: 'crm_income_statement', name: 'Accts: Income Statement' },
            { id: 'crm_day_book', name: 'Accts: Day Book' },
            { id: 'crm_cash_flow', name: 'Accts: Cash Flow' },
            { id: 'crm_leads', name: 'Leads & Contacts' },
            { id: 'crm_deals', name: 'Deals Pipeline' },
            { id: 'crm_tasks', name: 'Tasks' },
            { id: 'crm_automations', name: 'Automations' },
            { id: 'crm_pipelines', name: 'Manage Pipelines' },
            { id: 'crm_forms', name: 'Forms' },
            { id: 'crm_analytics', name: 'CRM Analytics' },
            { id: 'crm_reports', name: 'Sales Reports' },
            { id: 'crm_banking_accounts', name: 'Banking: All Accounts' },
            { id: 'crm_banking_employee', name: 'Banking: Employee Accts' },
            { id: 'crm_banking_reconciliation', name: 'Banking: Reconciliation' },
            { id: 'crm_employees', name: 'HR: Employee Directory' },
            { id: 'crm_attendance', name: 'HR: Attendance' },
            { id: 'crm_payroll', name: 'HR: Payroll' },
            { id: 'crm_gstr1', name: 'Reports: GSTR-1' },
            { id: 'crm_gstr2b', name: 'Reports: GSTR-2B' },
            { id: 'crm_settings', name: 'CRM Settings' },
        ],
    },
    meta: {
        label: 'Meta Suite',
        modules: [
            { id: 'facebook_dashboard', name: 'FB: Dashboard' },
            { id: 'facebook_posts', name: 'FB: Posts' },
            { id: 'facebook_scheduled', name: 'FB: Scheduled' },
            { id: 'facebook_live', name: 'FB: Live Studio' },
            { id: 'facebook_randomizer', name: 'FB: Post Randomizer' },
            { id: 'facebook_messages', name: 'FB: Messages' },
            { id: 'facebook_kanban', name: 'FB: Kanban' },
            { id: 'facebook_automation', name: 'FB: Auto-Reply' },
            { id: 'facebook_shops', name: 'FB: Shops Dashboard' },
            { id: 'facebook_products', name: 'FB: Products' },
            { id: 'facebook_shop_setup', name: 'FB: Shop Setup' },
            { id: 'facebook_orders', name: 'FB: Orders' },
            { id: 'instagram_dashboard', name: 'IG: Dashboard' },
            { id: 'instagram_feed', name: 'IG: Feed' },
            { id: 'instagram_stories', name: 'IG: Stories' },
            { id: 'instagram_reels', name: 'IG: Reels' },
            { id: 'instagram_messages', name: 'IG: Messages' },
            { id: 'instagram_discovery', name: 'IG: Discovery' },
            { id: 'instagram_hashtags', name: 'IG: Hashtags' },
            { id: 'ad_manager_accounts', name: 'Ads: Accounts' },
            { id: 'ad_manager_campaigns', name: 'Ads: Campaigns' },
            { id: 'ad_manager_audiences', name: 'Ads: Audiences' },
        ],
    },
    telegram: {
        label: 'Telegram',
        modules: [
            { id: 'telegram_dashboard', name: 'Dashboard' },
            { id: 'telegram_bots', name: 'Bots' },
            { id: 'telegram_chat', name: 'Live Chat' },
            { id: 'telegram_contacts', name: 'Contacts' },
            { id: 'telegram_broadcasts', name: 'Broadcasts' },
            { id: 'telegram_channels', name: 'Channels' },
            { id: 'telegram_commands', name: 'Commands' },
            { id: 'telegram_auto_reply', name: 'Auto Reply' },
            { id: 'telegram_payments', name: 'Payments' },
            { id: 'telegram_stickers', name: 'Stickers' },
            { id: 'telegram_mini_apps', name: 'Mini Apps' },
            { id: 'telegram_settings', name: 'Settings' },
        ],
    },
    tools: {
        label: 'App Tools',
        modules: [
            { id: 'email_dashboard', name: 'Email: Dashboard' },
            { id: 'email_inbox', name: 'Email: Inbox' },
            { id: 'email_campaigns', name: 'Email: Campaigns' },
            { id: 'email_contacts', name: 'Email: Contacts' },
            { id: 'email_templates', name: 'Email: Templates' },
            { id: 'email_analytics', name: 'Email: Analytics' },
            { id: 'email_verification', name: 'Email: Verification' },
            { id: 'email_settings', name: 'Email: Settings' },
            { id: 'sms_overview', name: 'SMS: Overview' },
            { id: 'sms_campaigns', name: 'SMS: Campaigns' },
            { id: 'sms_templates', name: 'SMS: Templates' },
            { id: 'sms_config', name: 'SMS: Configuration' },
            { id: 'sms_developer', name: 'SMS: API' },
            { id: 'sabchat_inbox', name: 'SabChat: Inbox' },
            { id: 'sabchat_visitors', name: 'SabChat: Live Visitors' },
            { id: 'sabchat_analytics', name: 'SabChat: Analytics' },
            { id: 'sabchat_widget', name: 'SabChat: Widget Setup' },
            { id: 'sabchat_auto_reply', name: 'SabChat: Auto Reply' },
            { id: 'sabchat_quick_replies', name: 'SabChat: Quick Replies' },
            { id: 'sabchat_ai_replies', name: 'SabChat: AI Replies' },
            { id: 'sabchat_faq', name: 'SabChat: FAQ' },
            { id: 'sabchat_settings', name: 'SabChat: Settings' },
            { id: 'website_builder', name: 'Website Builder' },
            { id: 'url_shortener', name: 'URL Shortener' },
            { id: 'qr_code_maker', name: 'QR Code Maker' },
            { id: 'seo_dashboard', name: 'SEO: Dashboard' },
            { id: 'seo_brand_radar', name: 'SEO: Brand Radar' },
            { id: 'seo_site_explorer', name: 'SEO: Site Explorer' },
        ],
    },
    admin: {
        label: 'Admin',
        modules: [
            { id: 'team_users', name: 'Team: Manage Users' },
            { id: 'team_roles', name: 'Team: Manage Roles' },
            { id: 'team_tasks', name: 'Team: Tasks' },
            { id: 'team_chat', name: 'Team: Chat' },
            { id: 'api_keys', name: 'API Keys' },
            { id: 'api_docs', name: 'API Docs' },
        ],
    },
};

/* ── Sticky save bar ─────────────────────────────────────────────── */

function SaveBar() {
    const { pending } = useFormStatus();
    return (
        <div className="sticky bottom-4 z-20 mt-6 flex items-center justify-between rounded-2xl border border-zoru-line bg-zoru-bg/95 p-3 shadow-md backdrop-blur">
            <p className="pl-2 text-[12.5px] text-zoru-ink-muted">
                Toggle permissions for every role, then save to sync all members.
            </p>
            <ZoruButton type="submit" size="md" disabled={pending}>
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {pending ? 'Saving…' : 'Save permissions'}
            </ZoruButton>
        </div>
    );
}

/* ── Skeleton ────────────────────────────────────────────────────── */

function PageSkeleton() {
    return (
        <div className="flex min-h-full flex-col gap-6">
            <ZoruSkeleton className="h-5 w-60" />
            <ZoruSkeleton className="h-10 w-80" />
            <ZoruSkeleton className="h-[420px] w-full rounded-2xl" />
        </div>
    );
}

/* ── Add role dialog ─────────────────────────────────────────────── */

function AddRoleDialog({ onRoleAdded }: { onRoleAdded: () => void }) {
    const [open, setOpen] = useState(false);
    const [roleName, setRoleName] = useState('');
    const [isPending, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const handleAddRole = () => {
        if (!roleName.trim()) {
            toast({ title: 'Error', description: 'Role name cannot be empty.', variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            const result = await saveRole({ id: '', name: roleName, permissions: {} });
            if (result.success) {
                toast({ title: 'Success', description: 'New role created.' });
                onRoleAdded();
                setOpen(false);
                setRoleName('');
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <ZoruDialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <ZoruButton size="sm">
                    <Plus className="h-4 w-4" />
                    New role
                </ZoruButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Create a new role</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        Give the role a name. You can configure permissions once it appears in the list.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <div className="py-2">
                    <ZoruLabel htmlFor="roleName" className="mb-1.5 block text-[12.5px] text-zoru-ink">
                        Role name
                    </ZoruLabel>
                    <ZoruInput
                        id="roleName"
                        value={roleName}
                        onChange={(e) => setRoleName(e.target.value)}
                        placeholder="e.g. Marketing Manager"
                    />
                </div>
                <ZoruDialogFooter>
                    <ZoruButton variant="ghost" size="sm" onClick={() => setOpen(false)}>
                        Cancel
                    </ZoruButton>
                    <ZoruButton size="sm" onClick={handleAddRole} disabled={isPending}>
                        {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        Create role
                    </ZoruButton>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

/* ── Delete role button ──────────────────────────────────────────── */

function DeleteRoleButton({ role, onRoleDeleted }: { role: { id: string; name: string }; onRoleDeleted: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useZoruToast();

    if (role.id === 'agent') return null;

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteRole(role.id);
            if (result.success) {
                toast({ title: 'Role deleted' });
                onRoleDeleted();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <ZoruAlertDialog>
            <ZoruAlertDialogTrigger asChild>
                <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zoru-line bg-zoru-bg text-zoru-ink-muted transition-colors hover:border-zoru-danger hover:text-zoru-danger-ink"
                    aria-label={`Delete ${role.name}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </ZoruAlertDialogTrigger>
            <ZoruAlertDialogContent>
                <ZoruAlertDialogHeader>
                    <ZoruAlertDialogTitle>Delete role?</ZoruAlertDialogTitle>
                    <ZoruAlertDialogDescription>
                        This permanently removes the &ldquo;{role.name}&rdquo; role. Members assigned to it will
                        lose these permissions immediately.
                    </ZoruAlertDialogDescription>
                </ZoruAlertDialogHeader>
                <ZoruAlertDialogFooter>
                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                    <ZoruAlertDialogAction
                        onClick={handleDelete}
                        disabled={isPending}
                        className="bg-zoru-danger text-zoru-danger-foreground hover:bg-zoru-danger/90"
                    >
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Delete
                    </ZoruAlertDialogAction>
                </ZoruAlertDialogFooter>
            </ZoruAlertDialogContent>
        </ZoruAlertDialog>
    );
}

/* ── Role card (accordion-style) ─────────────────────────────────── */

type RolePerms = Record<string, Partial<Record<(typeof actions)[number], boolean>>>;
type RoleRow = { id: string; name: string; permissions: RolePerms };

function RoleCard({
    role,
    defaultOpen,
    onRoleDeleted,
}: {
    role: RoleRow;
    defaultOpen: boolean;
    onRoleDeleted: () => void;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const [activeCategory, setActiveCategory] = useState<string>(Object.keys(permissionCategories)[0]);

    const permissions = role.permissions || {};

    const enabledCount = useMemo(() => {
        let n = 0;
        for (const mod of Object.values(permissions)) {
            if (!mod) continue;
            for (const a of actions) if (mod[a]) n += 1;
        }
        return n;
    }, [permissions]);

    return (
        <ZoruCard className="overflow-hidden p-0">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors',
                    open ? 'bg-zoru-surface-2/50' : 'hover:bg-zoru-surface-2/40',
                )}
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                        <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-[14px] text-zoru-ink">{role.name}</p>
                        <p className="text-[12px] text-zoru-ink-muted">
                            {enabledCount} permission{enabledCount === 1 ? '' : 's'} granted
                        </p>
                    </div>
                    {role.id === 'agent' && <ZoruBadge variant="ghost">System</ZoruBadge>}
                </div>
                <div className="flex items-center gap-2">
                    <DeleteRoleButton role={role} onRoleDeleted={onRoleDeleted} />
                    <ChevronDown
                        className={cn('h-5 w-5 text-zoru-ink-muted transition-transform', open && 'rotate-180')}
                    />
                </div>
            </button>

            {open && (
                <div className="border-t border-zoru-line bg-zoru-bg">
                    <input type="hidden" name="roleId" value={role.id} />
                    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr]">
                        <aside className="border-b border-zoru-line bg-zoru-surface-2/50 p-2 md:border-b-0 md:border-r">
                            <div className="flex gap-2 overflow-x-auto md:flex-col">
                                {Object.entries(permissionCategories).map(([key, cat]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setActiveCategory(key)}
                                        className={cn(
                                            'shrink-0 rounded-lg px-3 py-2 text-left text-[12.5px] transition-colors md:w-full',
                                            activeCategory === key
                                                ? 'bg-zoru-ink text-zoru-bg'
                                                : 'text-zoru-ink-muted hover:bg-zoru-bg hover:text-zoru-ink',
                                        )}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </aside>
                        <div className="p-5">
                            {Object.entries(permissionCategories).map(([key, cat]) => {
                                if (key !== activeCategory) return null;
                                return (
                                    <div key={key} className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[13.5px] text-zoru-ink">
                                                {cat.label} permissions
                                            </h3>
                                            <ZoruBadge variant="ghost">
                                                {cat.modules.length} modules
                                            </ZoruBadge>
                                        </div>
                                        <div className="overflow-hidden rounded-xl border border-zoru-line">
                                            <div className="grid grid-cols-[minmax(180px,2fr)_repeat(4,80px)] gap-0 bg-zoru-surface-2/50 px-4 py-2.5 text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                                                <span>Module</span>
                                                {actions.map((a) => (
                                                    <span key={a} className="text-center capitalize">
                                                        {a}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="divide-y divide-zoru-line">
                                                {cat.modules.map((mod) => (
                                                    <div
                                                        key={mod.id}
                                                        className="grid grid-cols-[minmax(180px,2fr)_repeat(4,80px)] items-center px-4 py-2.5 text-[13px] text-zoru-ink hover:bg-zoru-surface-2/40"
                                                    >
                                                        <span>{mod.name}</span>
                                                        {actions.map((action) => (
                                                            <div key={action} className="flex justify-center">
                                                                <ZoruCheckbox
                                                                    name={`${role.id}_${mod.id}_${action}`}
                                                                    defaultChecked={
                                                                        permissions[mod.id]?.[action] ?? false
                                                                    }
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </ZoruCard>
    );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function ManageRolesPage() {
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [state, formAction] = useActionState(saveRolePermissions, initialState);
    const { toast } = useZoruToast();

    const fetchUser = () => {
        startLoading(async () => {
            const session = await getSession();
            setUser(session?.user || null);
        });
    };

    useEffect(() => {
        fetchUser();
        // run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Saved', description: state.message });
            fetchUser();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    if (isLoading || !user) {
        return <PageSkeleton />;
    }

    const allRoles: RoleRow[] = [
        { id: 'agent', name: 'Agent', permissions: (user.crm?.permissions as any)?.agent ?? {} },
        ...(((user.crm?.customRoles ?? []) as any[]).map((r) => ({
            id: r.id,
            name: r.name,
            permissions: r.permissions ?? {},
        }))),
    ];

    const totalGranted = allRoles.reduce((sum, r) => {
        let n = 0;
        for (const mod of Object.values(r.permissions || {})) {
            for (const a of actions) if ((mod as any)?.[a]) n += 1;
        }
        return sum + n;
    }, 0);

    return (
        <div className="flex min-h-full flex-col gap-6">
            <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/team">Team</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Roles & permissions</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <ZoruPageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>Roles & permissions</ZoruPageTitle>
                    <ZoruPageDescription>
                        Define what each role can access and do across every module of the platform.
                    </ZoruPageDescription>
                </ZoruPageHeading>
                <AddRoleDialog onRoleAdded={fetchUser} />
            </ZoruPageHeader>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ZoruCard variant="soft" className="p-6">
                    <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">Roles</p>
                    <p className="mt-1 text-[22px] text-zoru-ink">{allRoles.length}</p>
                </ZoruCard>
                <ZoruCard variant="soft" className="p-6">
                    <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                        Permissions granted
                    </p>
                    <p className="mt-1 text-[22px] text-zoru-ink">{totalGranted}</p>
                </ZoruCard>
                <ZoruCard variant="soft" className="p-6">
                    <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                        Modules covered
                    </p>
                    <p className="mt-1 text-[22px] text-zoru-ink">
                        {Object.values(permissionCategories).reduce((n, c) => n + c.modules.length, 0)}
                    </p>
                </ZoruCard>
            </div>

            <form action={formAction} className="flex flex-1 flex-col">
                <div className="flex flex-1 flex-col gap-3">
                    {allRoles.map((role, idx) => (
                        <RoleCard
                            key={role.id}
                            role={role}
                            defaultOpen={idx === 0}
                            onRoleDeleted={fetchUser}
                        />
                    ))}
                </div>
                <SaveBar />
            </form>

            <ZoruCard variant="soft" className="flex items-start gap-3 p-6">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zoru-ink text-zoru-bg">
                    <Check className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-[13px] text-zoru-ink">How permissions apply</p>
                    <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                        Changes take effect immediately. Members with a role pick up the updated module
                        access on their next navigation. System roles (e.g. Agent) cannot be deleted,
                        but their permissions can still be tuned per module.
                    </p>
                </div>
            </ZoruCard>
        </div>
    );
}
