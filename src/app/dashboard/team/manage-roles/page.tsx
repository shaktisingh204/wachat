'use client';

import { useActionState, useEffect, useTransition, useState, useCallback, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoaderCircle, Save, ShieldCheck, Plus, Trash2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { getSession } from '@/app/actions/user.actions';
import { saveRolePermissions, saveRole, deleteRole } from '@/app/actions/crm-roles.actions';
import type { WithId, User } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Permissions
        </Button>
    )
}

function PageSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
            <Skeleton className="h-80 w-full" />
        </div>
    )
}

// Full Module Definition mapping 1:1 with dashboard-config.ts
const permissionCategories = {
    'wachat': {
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
        ]
    },
    'crm': {
        label: 'CRM Suite',
        modules: [
            // Sales Module
            { id: 'crm_dashboard', name: 'CRM Dashboard' },
            { id: 'crm_clients', name: 'Sales: Clients & Prospects' },
            { id: 'crm_quotations', name: 'Sales: Quotations' },
            { id: 'crm_proforma', name: 'Sales: Proforma Invoices' },
            { id: 'crm_invoices', name: 'Sales: Invoices' },
            { id: 'crm_receipts', name: 'Sales: Payment Receipts' },
            { id: 'crm_orders', name: 'Sales: Sales Orders' },
            { id: 'crm_delivery', name: 'Sales: Delivery Challans' },
            { id: 'crm_credit_notes', name: 'Sales: Credit Notes' },
            // Purchases Module
            { id: 'crm_vendors', name: 'Purchases: Vendors' },
            { id: 'crm_expenses', name: 'Purchases: Expenses' },
            { id: 'crm_purchase_orders', name: 'Purchases: Orders' },
            { id: 'crm_payouts', name: 'Purchases: Payout Receipts' },
            { id: 'crm_debit_notes', name: 'Purchases: Debit Notes' },
            // Inventory Module
            { id: 'crm_items', name: 'Inventory: All Items' },
            { id: 'crm_warehouses', name: 'Inventory: Warehouses' },
            { id: 'crm_inventory_pnl', name: 'Inventory: Product P&L' },
            { id: 'crm_stock_value', name: 'Inventory: Stock Value' },
            { id: 'crm_batch_expiry', name: 'Inventory: Batch Expiry' },
            { id: 'crm_party_transactions', name: 'Inventory: Party Trans.' },
            { id: 'crm_all_transactions', name: 'Inventory: All Trans.' },
            // Accounting Module
            { id: 'crm_account_groups', name: 'Accts: Groups' },
            { id: 'crm_chart_of_accounts', name: 'Accts: Chart of Accounts' },
            { id: 'crm_vouchers', name: 'Accts: Vouchers' },
            { id: 'crm_balance_sheet', name: 'Accts: Balance Sheet' },
            { id: 'crm_trial_balance', name: 'Accts: Trial Balance' },
            { id: 'crm_pnl', name: 'Accts: Profit & Loss' },
            { id: 'crm_income_statement', name: 'Accts: Income Statement' },
            { id: 'crm_day_book', name: 'Accts: Day Book' },
            { id: 'crm_cash_flow', name: 'Accts: Cash Flow' },

            // Sales CRM (Leads)
            { id: 'crm_leads', name: 'Leads & Contacts' },
            { id: 'crm_deals', name: 'Deals Pipeline' },
            { id: 'crm_tasks', name: 'Tasks' },
            { id: 'crm_automations', name: 'Automations' },
            { id: 'crm_pipelines', name: 'Manage Pipelines' },
            { id: 'crm_forms', name: 'Forms' },
            { id: 'crm_analytics', name: 'CRM Analytics' },
            { id: 'crm_reports', name: 'Sales Reports' },

            // Banking
            { id: 'crm_banking_accounts', name: 'Banking: All Accounts' },
            { id: 'crm_banking_employee', name: 'Banking: Employee Accts' },
            { id: 'crm_banking_reconciliation', name: 'Banking: Reconciliation' },

            // HR & Payroll
            { id: 'crm_employees', name: 'HR: Employee Directory' },
            { id: 'crm_attendance', name: 'HR: Attendance' },
            { id: 'crm_payroll', name: 'HR: Payroll' },

            // Reports
            { id: 'crm_gstr1', name: 'Reports: GSTR-1' },
            { id: 'crm_gstr2b', name: 'Reports: GSTR-2B' },

            // Settings
            { id: 'crm_settings', name: 'CRM Settings' },
        ]
    },
    'meta': {
        label: 'Meta Suite',
        modules: [
            // Facebook
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

            // Instagram
            { id: 'instagram_dashboard', name: 'IG: Dashboard' },
            { id: 'instagram_feed', name: 'IG: Feed' },
            { id: 'instagram_stories', name: 'IG: Stories' },
            { id: 'instagram_reels', name: 'IG: Reels' },
            { id: 'instagram_messages', name: 'IG: Messages' },
            { id: 'instagram_discovery', name: 'IG: Discovery' },
            { id: 'instagram_hashtags', name: 'IG: Hashtags' },

            // Ad Manager
            { id: 'ad_manager_accounts', name: 'Ads: Accounts' },
            { id: 'ad_manager_campaigns', name: 'Ads: Campaigns' },
            { id: 'ad_manager_audiences', name: 'Ads: Audiences' },
        ]
    },
    'tools': {
        label: 'App Tools',
        modules: [
            // Email
            { id: 'email_dashboard', name: 'Email: Dashboard' },
            { id: 'email_inbox', name: 'Email: Inbox' },
            { id: 'email_campaigns', name: 'Email: Campaigns' },
            { id: 'email_contacts', name: 'Email: Contacts' },
            { id: 'email_templates', name: 'Email: Templates' },
            { id: 'email_analytics', name: 'Email: Analytics' },
            { id: 'email_verification', name: 'Email: Verification' },
            { id: 'email_settings', name: 'Email: Settings' },

            // SMS
            { id: 'sms_overview', name: 'SMS: Overview' },
            { id: 'sms_campaigns', name: 'SMS: Campaigns' },
            { id: 'sms_templates', name: 'SMS: Templates' },
            { id: 'sms_config', name: 'SMS: Configuration' },
            { id: 'sms_developer', name: 'SMS: API' },

            // SabChat
            { id: 'sabchat_inbox', name: 'SabChat: Inbox' },
            { id: 'sabchat_visitors', name: 'SabChat: Live Visitors' },
            { id: 'sabchat_analytics', name: 'SabChat: Analytics' },
            { id: 'sabchat_widget', name: 'SabChat: Widget Setup' },
            { id: 'sabchat_auto_reply', name: 'SabChat: Auto Reply' },
            { id: 'sabchat_quick_replies', name: 'SabChat: Quick Replies' },
            { id: 'sabchat_ai_replies', name: 'SabChat: AI Replies' },
            { id: 'sabchat_faq', name: 'SabChat: FAQ' },
            { id: 'sabchat_settings', name: 'SabChat: Settings' },

            // Utilities
            { id: 'website_builder', name: 'Website Builder' },
            { id: 'url_shortener', name: 'url_shortener' }, // Keep as ID per request or display label? Using default label mapping
            { id: 'qr_code_maker', name: 'QR Code Maker' },

            // SEO
            { id: 'seo_dashboard', name: 'SEO: Dashboard' },
            { id: 'seo_brand_radar', name: 'SEO: Brand Radar' },
            { id: 'seo_site_explorer', name: 'SEO: Site Explorer' },
        ]
    },
    'admin': {
        label: 'Admin',
        modules: [
            { id: 'team_users', name: 'Team: Manage Users' },
            { id: 'team_roles', name: 'Team: Manage Roles' },
            { id: 'team_tasks', name: 'Team: Tasks' },
            { id: 'team_chat', name: 'Team: Chat' },
            { id: 'api_keys', name: 'API Keys' },
            { id: 'api_docs', name: 'API Docs' },
        ]
    }
};

const actions = ['view', 'create', 'edit', 'delete'];

function AddRoleDialog({ onRoleAdded }: { onRoleAdded: () => void }) {
    const [open, setOpen] = useState(false);
    const [roleName, setRoleName] = useState('');
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleAddRole = async () => {
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
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Role</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Role</DialogTitle>
                    <DialogDescription>Give your new role a name. You can configure precise permissions in the next step.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="roleName">Role Name</Label>
                    <Input id="roleName" value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Marketing Manager" />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddRole} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        Create Role
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function DeleteRoleButton({ role, onRoleDeleted }: { role: any, onRoleDeleted: () => void }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    if (role.id === 'agent') return null;

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteRole(role.id);
            if (result.success) {
                toast({ title: 'Success', description: 'Role deleted.' });
                onRoleDeleted();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Role?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the "{role.name}" role.
                        Any team members assigned to this role will lose their specific permissions immediately.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function ManageRolesPage() {
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [state, formAction] = useActionState(saveRolePermissions, initialState);
    const { toast } = useToast();

    const fetchUser = useCallback(() => {
        startLoading(async () => {
            const session = await getSession();
            setUser(session?.user || null);
        });
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            fetchUser();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, fetchUser]);

    if (isLoading || !user) {
        return <PageSkeleton />;
    }

    const allRoles = [{ id: 'agent', name: 'Agent', permissions: user.crm?.permissions?.agent }, ...(user.crm?.customRoles || [])];

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <ShieldCheck className="h-8 w-8" />
                        Manage Team Roles
                    </h1>
                    <p className="text-muted-foreground">
                        Define what different roles can access and do across the entire platform.
                    </p>
                </div>
                <AddRoleDialog onRoleAdded={fetchUser} />
            </div>

            <form action={formAction} className="flex-1 flex flex-col">
                <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={allRoles[0]?.id}>
                    {allRoles.map((role: any) => {
                        const permissions = role.permissions || {};

                        return (
                            <AccordionItem key={role.id} value={role.id} className="border rounded-lg bg-card">
                                <AccordionTrigger className="p-4 font-bold text-lg hover:no-underline bg-muted/40 data-[state=open]:bg-muted/60 data-[state=open]:border-b rounded-t-lg">
                                    <div className="flex items-center gap-2">
                                        {role.name}
                                        {role.id !== 'agent' && <div onClick={e => e.stopPropagation()}><DeleteRoleButton role={role} onRoleDeleted={fetchUser} /></div>}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-0">
                                    <input type="hidden" name={`roleId`} value={role.id} />
                                    <Tabs defaultValue="wachat" className="w-full flex">
                                        <TabsList className="flex flex-col h-auto w-48 justify-start bg-muted/20 p-2 rounded-none border-r space-y-1">
                                            {Object.entries(permissionCategories).map(([key, category]) => (
                                                <TabsTrigger key={key} value={key} className="w-full justify-start">{category.label}</TabsTrigger>
                                            ))}
                                        </TabsList>
                                        <div className="flex-1 p-4">
                                            {Object.entries(permissionCategories).map(([key, category]) => (
                                                <TabsContent key={key} value={key} className="mt-0 space-y-4">
                                                    <div>
                                                        <h3 className="font-semibold text-lg mb-2">{category.label} Permissions</h3>
                                                        <div className="border rounded-md overflow-hidden">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                        <TableHead className="w-[250px]">Module</TableHead>
                                                                        {actions.map(action => <TableHead key={action} className="text-center w-24 capitalize">{action}</TableHead>)}
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {category.modules.map(module => (
                                                                        <TableRow key={module.id}>
                                                                            <TableCell className="font-medium text-sm">{module.name}</TableCell>
                                                                            {actions.map(action => (
                                                                                <TableCell key={action} className="text-center p-2">
                                                                                    <Checkbox
                                                                                        name={`${role.id}_${module.id}_${action}`}
                                                                                        defaultChecked={(permissions[module.id as keyof typeof permissions] as any)?.[action] ?? false}
                                                                                    />
                                                                                </TableCell>
                                                                            ))}
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                </TabsContent>
                                            ))}
                                        </div>
                                    </Tabs>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    })}
                </Accordion>
                <div className="sticky bottom-4 flex justify-end mt-6 p-4 bg-background/80 backdrop-blur-sm border rounded-lg shadow-sm z-10">
                    <SubmitButton />
                </div>
            </form>
        </div>
    );
}
