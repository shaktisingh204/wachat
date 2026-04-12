'use client';

import { useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { getPlanById, savePlan } from '@/app/actions/plan.actions';
import type { Plan } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ChevronLeft,
    LoaderCircle,
    Save,
    Sparkles,
    CreditCard,
    Gauge,
    ShieldCheck,
    DollarSign,
    Boxes,
    Crown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlanPermissionSelector } from '@/components/wabasimplify/plan-permission-selector';
import { PlanFeaturesSelector } from '@/components/wabasimplify/plan-features-selector';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const initialState = { message: null, error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button
            type="submit"
            disabled={pending}
            size="lg"
            className="rounded-xl gap-2 shadow-lg shadow-primary/20"
        >
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            Save Plan
        </Button>
    );
}

function SectionCard({
    title,
    description,
    icon: Icon,
    premium,
    accent,
    children,
}: {
    title: string;
    description?: string;
    icon?: React.ComponentType<{ className?: string }>;
    premium?: boolean;
    accent?: 'primary' | 'amber' | 'violet' | 'emerald' | 'sky' | 'rose';
    children: React.ReactNode;
}) {
    const accentMap: Record<string, { tile: string; icon: string; glow: string }> = {
        primary: {
            tile: 'bg-primary/10 border-primary/30',
            icon: 'text-primary',
            glow: 'from-primary/10',
        },
        amber: {
            tile: 'bg-amber-100 border-amber-200',
            icon: 'text-amber-600',
            glow: 'from-amber-500/10',
        },
        violet: {
            tile: 'bg-violet-100 border-violet-200',
            icon: 'text-violet-600',
            glow: 'from-violet-500/10',
        },
        emerald: {
            tile: 'bg-emerald-100 border-emerald-200',
            icon: 'text-emerald-600',
            glow: 'from-emerald-500/10',
        },
        sky: {
            tile: 'bg-sky-100 border-sky-200',
            icon: 'text-sky-600',
            glow: 'from-sky-500/10',
        },
        rose: {
            tile: 'bg-rose-100 border-rose-200',
            icon: 'text-rose-600',
            glow: 'from-rose-500/10',
        },
    };
    const styles = accentMap[accent || 'primary'];
    return (
        <Card
            className={cn(
                'rounded-2xl border-slate-200 bg-white backdrop-blur-xl shadow-sm overflow-hidden',
                premium && 'ring-1 ring-amber-500/40 shadow-amber-500/10',
            )}
        >
            <CardHeader
                className={cn(
                    'border-b border-slate-200 bg-gradient-to-r to-transparent',
                    styles.glow,
                )}
            >
                <div className="flex items-start gap-3">
                    {Icon && (
                        <div
                            className={cn(
                                'h-9 w-9 rounded-xl border flex items-center justify-center shrink-0',
                                styles.tile,
                            )}
                        >
                            <Icon className={cn('h-4 w-4', styles.icon)} />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base">{title}</CardTitle>
                            {premium && (
                                <Badge className="rounded-full text-[9px] h-5 px-2 gap-1 bg-gradient-to-r from-amber-500/80 to-amber-400/80 text-zinc-950 border-0 font-bold uppercase tracking-wider">
                                    <Crown className="h-2.5 w-2.5" />
                                    Premium
                                </Badge>
                            )}
                        </div>
                        {description && (
                            <CardDescription className="text-xs mt-0.5">
                                {description}
                            </CardDescription>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-5">{children}</CardContent>
        </Card>
    );
}

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
        <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
            {children}
            {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
        </div>
    );
}

const inputClass = 'rounded-xl bg-white border-slate-200 backdrop-blur focus-visible:ring-primary/40';

export default function PlanEditorPage() {
    const params = useParams();
    const planId = params.planId as string;
    const router = useRouter();
    const { toast } = useToast();
    const [state, setState] = useState<any>(initialState);
    const [, startTransition] = useTransition();

    const [plan, setPlan] = useState<WithId<Plan> | null>(null);
    const [loading, setLoading] = useState(true);

    const isNew = planId === 'new';

    const formAction = (formData: FormData) => {
        startTransition(async () => {
            const result = await savePlan(null, formData);
            setState(result);
        });
    };

    useEffect(() => {
        if (!isNew) {
            getPlanById(planId)
                .then((data) => {
                    setPlan(data);
                    setLoading(false);
                })
                .catch((error) => {
                    console.error('Failed to load plan data:', error);
                    toast({
                        title: 'Error',
                        description: 'Could not load plan details.',
                        variant: 'destructive',
                    });
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [planId, isNew, toast]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            router.push('/admin/dashboard/plans');
        }
        if (state.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
        );
    }

    return (
        <form action={formAction} className="space-y-6 pb-24">
            <input type="hidden" name="planId" value={plan?._id.toString() || 'new'} />

            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-primary/5 via-white to-violet-50 p-6">
                <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-violet-100 blur-3xl pointer-events-none" />
                <div className="relative">
                    <Button
                        type="button"
                        variant="ghost"
                        asChild
                        size="sm"
                        className="-ml-2 mb-2 hover:bg-slate-50 rounded-lg"
                    >
                        <Link href="/admin/dashboard/plans">
                            <ChevronLeft className="mr-1 h-4 w-4" />
                            Back to Plans
                        </Link>
                    </Button>
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-primary mb-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        {isNew ? 'New Plan' : 'Editing Plan'}
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold font-headline tracking-tight">
                        {isNew ? 'Create a new plan' : plan?.name}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                        Configure pricing, usage limits, and the master permission ceiling for
                        every module in the app.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-5">
                <TabsList className="h-auto p-1 rounded-2xl bg-white border border-slate-200 backdrop-blur-xl flex-wrap w-full justify-start gap-1">
                    <TabsTrigger value="overview" className="rounded-xl gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <CreditCard className="h-4 w-4" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="pricing" className="rounded-xl gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <DollarSign className="h-4 w-4" />
                        Pricing & Credits
                    </TabsTrigger>
                    <TabsTrigger value="limits" className="rounded-xl gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Gauge className="h-4 w-4" />
                        Usage Limits
                    </TabsTrigger>
                    <TabsTrigger value="modules" className="rounded-xl gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Boxes className="h-4 w-4" />
                        Module Limits
                    </TabsTrigger>
                    <TabsTrigger value="features" className="rounded-xl gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Sparkles className="h-4 w-4" />
                        Features
                    </TabsTrigger>
                    <TabsTrigger value="permissions" className="rounded-xl gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <ShieldCheck className="h-4 w-4" />
                        Permissions
                    </TabsTrigger>
                </TabsList>

                {/* OVERVIEW */}
                <TabsContent
                    value="overview"
                    forceMount
                    className="space-y-5 mt-0 data-[state=inactive]:hidden"
                >
                    <SectionCard
                        title="Basic details"
                        description="Name, category, and visibility flags for this plan."
                        icon={CreditCard}
                    >
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Field label="Plan name">
                                <Input
                                    name="name"
                                    defaultValue={plan?.name}
                                    required
                                    placeholder="e.g. Pro Tier"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Category">
                                <Select name="appCategory" defaultValue={plan?.appCategory}>
                                    <SelectTrigger className={inputClass}>
                                        <SelectValue placeholder="Select category…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All-In-One">All-In-One</SelectItem>
                                        <SelectItem value="Wachat">Wachat</SelectItem>
                                        <SelectItem value="CRM">CRM</SelectItem>
                                        <SelectItem value="Meta">Meta Suite</SelectItem>
                                        <SelectItem value="Facebook">Facebook</SelectItem>
                                        <SelectItem value="Instagram">Instagram</SelectItem>
                                        <SelectItem value="Ad Manager">
                                            Ad Manager (Premium)
                                        </SelectItem>
                                        <SelectItem value="Email">Email</SelectItem>
                                        <SelectItem value="SMS">SMS</SelectItem>
                                        <SelectItem value="SabChat">SabChat</SelectItem>
                                        <SelectItem value="SEO">SEO</SelectItem>
                                        <SelectItem value="Website Builder">
                                            Website Builder
                                        </SelectItem>
                                        <SelectItem value="URL Shortener">URL Shortener</SelectItem>
                                        <SelectItem value="QR Code Generator">
                                            QR Code Generator
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Price / month">
                                <Input
                                    name="price"
                                    type="number"
                                    defaultValue={plan?.price ?? 49}
                                    required
                                    min="0"
                                    step="1"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Currency">
                                <Select name="currency" defaultValue={plan?.currency || 'INR'} required>
                                    <SelectTrigger className={inputClass}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INR">INR</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                        <SelectItem value="EUR">EUR</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2">
                                <Switch
                                    id="isPublic"
                                    name="isPublic"
                                    defaultChecked={plan?.isPublic ?? false}
                                />
                                <Label htmlFor="isPublic" className="text-sm">
                                    Publicly visible
                                </Label>
                            </div>
                            <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2">
                                <Switch
                                    id="isDefault"
                                    name="isDefault"
                                    defaultChecked={plan?.isDefault ?? false}
                                />
                                <Label htmlFor="isDefault" className="text-sm">
                                    Default for new signups
                                </Label>
                            </div>
                        </div>
                    </SectionCard>
                </TabsContent>

                {/* PRICING & CREDITS */}
                <TabsContent
                    value="pricing"
                    forceMount
                    className="space-y-5 mt-0 data-[state=inactive]:hidden"
                >
                    <SectionCard
                        title="Signup & initial credits"
                        description="One-time credits granted to users when they land on this plan."
                        icon={DollarSign}
                    >
                        <div className="grid gap-4 md:grid-cols-5">
                            <Field label="Signup credits (legacy)">
                                <Input
                                    name="signupCredits"
                                    type="number"
                                    defaultValue={plan?.signupCredits ?? 0}
                                    required
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Broadcast">
                                <Input
                                    name="init_broadcast"
                                    type="number"
                                    defaultValue={plan?.initialCredits?.broadcast ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="SMS">
                                <Input
                                    name="init_sms"
                                    type="number"
                                    defaultValue={plan?.initialCredits?.sms ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Meta Suite">
                                <Input
                                    name="init_meta"
                                    type="number"
                                    defaultValue={plan?.initialCredits?.meta ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Email">
                                <Input
                                    name="init_email"
                                    type="number"
                                    defaultValue={plan?.initialCredits?.email ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Per-message costs"
                        description="Raw cost deducted per WhatsApp message category."
                    >
                        <div className="grid gap-4 md:grid-cols-3">
                            <Field label="Marketing">
                                <Input
                                    name="cost_marketing"
                                    type="number"
                                    defaultValue={plan?.messageCosts?.marketing ?? 0.05}
                                    required
                                    min="0"
                                    step="0.001"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Utility">
                                <Input
                                    name="cost_utility"
                                    type="number"
                                    defaultValue={plan?.messageCosts?.utility ?? 0.02}
                                    required
                                    min="0"
                                    step="0.001"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Authentication">
                                <Input
                                    name="cost_authentication"
                                    type="number"
                                    defaultValue={plan?.messageCosts?.authentication ?? 0.02}
                                    required
                                    min="0"
                                    step="0.001"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard title="Credit rates" description="Credits deducted per unit per channel.">
                        <div className="space-y-5">
                            <div>
                                <div className="text-xs font-semibold text-emerald-600 mb-3 uppercase tracking-wide">
                                    WhatsApp
                                </div>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <Field label="Marketing rate">
                                        <Input
                                            name="rate_whatsapp_marketing"
                                            type="number"
                                            defaultValue={plan?.rates?.whatsapp_marketing ?? 1}
                                            required
                                            min="0"
                                            step="0.1"
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Utility rate">
                                        <Input
                                            name="rate_whatsapp_utility"
                                            type="number"
                                            defaultValue={plan?.rates?.whatsapp_utility ?? 1}
                                            required
                                            min="0"
                                            step="0.1"
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Authentication rate">
                                        <Input
                                            name="rate_whatsapp_authentication"
                                            type="number"
                                            defaultValue={plan?.rates?.whatsapp_authentication ?? 1}
                                            required
                                            min="0"
                                            step="0.1"
                                            className={inputClass}
                                        />
                                    </Field>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-200">
                                <div className="text-xs font-semibold text-sky-600 mb-3 uppercase tracking-wide">
                                    Other channels
                                </div>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <Field label="SMS rate">
                                        <Input
                                            name="rate_sms"
                                            type="number"
                                            defaultValue={plan?.rates?.sms ?? 1}
                                            required
                                            min="0"
                                            step="0.1"
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Meta rate">
                                        <Input
                                            name="rate_meta"
                                            type="number"
                                            defaultValue={plan?.rates?.meta ?? 1}
                                            required
                                            min="0"
                                            step="0.1"
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Email rate">
                                        <Input
                                            name="rate_email"
                                            type="number"
                                            defaultValue={plan?.rates?.email ?? 1}
                                            required
                                            min="0"
                                            step="0.1"
                                            className={inputClass}
                                        />
                                    </Field>
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </TabsContent>

                {/* USAGE LIMITS */}
                <TabsContent
                    value="limits"
                    forceMount
                    className="space-y-5 mt-0 data-[state=inactive]:hidden"
                >
                    <SectionCard
                        title="General limits"
                        description="Set to 0 for unlimited."
                        icon={Gauge}
                    >
                        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                            <Field label="Projects">
                                <Input
                                    name="projectLimit"
                                    type="number"
                                    defaultValue={plan?.projectLimit ?? 5}
                                    required
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Agents / project">
                                <Input
                                    name="agentLimit"
                                    type="number"
                                    defaultValue={plan?.agentLimit ?? 10}
                                    required
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Custom attributes">
                                <Input
                                    name="attributeLimit"
                                    type="number"
                                    defaultValue={plan?.attributeLimit ?? 20}
                                    required
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Templates">
                                <Input
                                    name="templateLimit"
                                    type="number"
                                    defaultValue={plan?.templateLimit ?? 50}
                                    required
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Flow builder">
                                <Input
                                    name="flowLimit"
                                    type="number"
                                    defaultValue={plan?.flowLimit ?? 10}
                                    required
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Meta flows">
                                <Input
                                    name="metaFlowLimit"
                                    type="number"
                                    defaultValue={plan?.metaFlowLimit ?? 10}
                                    required
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Canned messages">
                                <Input
                                    name="cannedMessageLimit"
                                    type="number"
                                    defaultValue={plan?.cannedMessageLimit ?? 25}
                                    required
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Custom roles">
                                <Input
                                    name="customRoleLimit"
                                    type="number"
                                    defaultValue={plan?.customRoleLimit ?? 3}
                                    required
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Team channels">
                                <Input
                                    name="teamChannelLimit"
                                    type="number"
                                    defaultValue={plan?.teamChannelLimit ?? 10}
                                    required
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Team tasks">
                                <Input
                                    name="teamTaskLimit"
                                    type="number"
                                    defaultValue={plan?.teamTaskLimit ?? 50}
                                    required
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </SectionCard>
                </TabsContent>

                {/* MODULE LIMITS */}
                <TabsContent
                    value="modules"
                    forceMount
                    className="space-y-5 mt-0 data-[state=inactive]:hidden"
                >
                    <SectionCard
                        title="WaChat"
                        description="Limits for WhatsApp Business tooling."
                        icon={Boxes}
                        accent="emerald"
                    >
                        <div className="grid gap-4 md:grid-cols-4">
                            <Field label="Templates">
                                <Input
                                    name="limit_wachat_templates"
                                    type="number"
                                    defaultValue={plan?.appLimits?.wachat?.templates ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Flows">
                                <Input
                                    name="limit_wachat_flows"
                                    type="number"
                                    defaultValue={plan?.appLimits?.wachat?.flows ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Meta flows">
                                <Input
                                    name="limit_wachat_metaFlows"
                                    type="number"
                                    defaultValue={plan?.appLimits?.wachat?.metaFlows ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Canned messages">
                                <Input
                                    name="limit_wachat_cannedMessages"
                                    type="number"
                                    defaultValue={plan?.appLimits?.wachat?.cannedMessages ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="CRM"
                        description="Resource limits for the CRM module."
                        accent="sky"
                    >
                        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                            <Field label="Products">
                                <Input
                                    name="limit_crm_products"
                                    type="number"
                                    defaultValue={plan?.appLimits?.crm?.products ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Customers">
                                <Input
                                    name="limit_crm_customers"
                                    type="number"
                                    defaultValue={plan?.appLimits?.crm?.customers ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Vendors">
                                <Input
                                    name="limit_crm_vendors"
                                    type="number"
                                    defaultValue={plan?.appLimits?.crm?.vendors ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Warehouses">
                                <Input
                                    name="limit_crm_warehouses"
                                    type="number"
                                    defaultValue={plan?.appLimits?.crm?.warehouses ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Pipelines">
                                <Input
                                    name="limit_crm_pipelines"
                                    type="number"
                                    defaultValue={plan?.appLimits?.crm?.pipelines ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Facebook"
                        description="Facebook Pages, posts, automation rules, and shops."
                        accent="sky"
                    >
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Field label="Pages">
                                <Input
                                    name="limit_fb_pages"
                                    type="number"
                                    defaultValue={
                                        plan?.appLimits?.facebook?.pages ??
                                        plan?.appLimits?.meta?.pages ??
                                        0
                                    }
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Scheduled posts">
                                <Input
                                    name="limit_fb_scheduled"
                                    type="number"
                                    defaultValue={plan?.appLimits?.facebook?.scheduledPosts ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Automation rules">
                                <Input
                                    name="limit_fb_automation"
                                    type="number"
                                    defaultValue={plan?.appLimits?.facebook?.automationRules ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Shops">
                                <Input
                                    name="limit_fb_shops"
                                    type="number"
                                    defaultValue={plan?.appLimits?.facebook?.shops ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Instagram"
                        description="Instagram business accounts, scheduled content, and hashtag research."
                        accent="rose"
                    >
                        <div className="grid gap-4 md:grid-cols-3">
                            <Field label="Connected accounts">
                                <Input
                                    name="limit_ig_accounts"
                                    type="number"
                                    defaultValue={plan?.appLimits?.instagram?.accounts ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Scheduled posts">
                                <Input
                                    name="limit_ig_scheduled"
                                    type="number"
                                    defaultValue={plan?.appLimits?.instagram?.scheduledPosts ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Hashtag tracking">
                                <Input
                                    name="limit_ig_hashtags"
                                    type="number"
                                    defaultValue={plan?.appLimits?.instagram?.hashtagTracking ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Ad Manager"
                        description="Meta Ads Manager — manage ad accounts, campaigns, and audiences."
                        icon={Crown}
                        premium
                        accent="amber"
                    >
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Field
                                label="Ad accounts"
                                hint="Max Meta Ad Accounts linkable to projects."
                            >
                                <Input
                                    name="limit_ads_accounts"
                                    type="number"
                                    defaultValue={
                                        plan?.appLimits?.adManager?.adAccounts ??
                                        plan?.appLimits?.meta?.adAccounts ??
                                        0
                                    }
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Active campaigns">
                                <Input
                                    name="limit_ads_campaigns"
                                    type="number"
                                    defaultValue={plan?.appLimits?.adManager?.campaigns ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Custom audiences">
                                <Input
                                    name="limit_ads_audiences"
                                    type="number"
                                    defaultValue={plan?.appLimits?.adManager?.audiences ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field
                                label="Monthly ad spend cap"
                                hint="0 = uncapped. Enforced before placing ads."
                            >
                                <Input
                                    name="limit_ads_spend_cap"
                                    type="number"
                                    defaultValue={plan?.appLimits?.adManager?.monthlyAdSpendCap ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Email"
                        description="Email channel throughput."
                        accent="violet"
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Connected accounts">
                                <Input
                                    name="limit_email_connectedAccounts"
                                    type="number"
                                    defaultValue={plan?.appLimits?.email?.connectedAccounts ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Daily sending limit">
                                <Input
                                    name="limit_email_dailyLimit"
                                    type="number"
                                    defaultValue={plan?.appLimits?.email?.dailyLimit ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="SabChat"
                        description="Live chat widgets, visitors, and canned replies."
                        accent="emerald"
                    >
                        <div className="grid gap-4 md:grid-cols-3">
                            <Field label="Widgets">
                                <Input
                                    name="limit_sabchat_widgets"
                                    type="number"
                                    defaultValue={plan?.appLimits?.sabchat?.widgets ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Monthly visitors">
                                <Input
                                    name="limit_sabchat_visitors"
                                    type="number"
                                    defaultValue={plan?.appLimits?.sabchat?.monthlyVisitors ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Quick replies">
                                <Input
                                    name="limit_sabchat_replies"
                                    type="number"
                                    defaultValue={plan?.appLimits?.sabchat?.quickReplies ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="SEO"
                        description="SEO projects, brand radars, and tracked keywords."
                        accent="sky"
                    >
                        <div className="grid gap-4 md:grid-cols-3">
                            <Field label="Projects">
                                <Input
                                    name="limit_seo_projects"
                                    type="number"
                                    defaultValue={plan?.appLimits?.seo?.projects ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Brand radars">
                                <Input
                                    name="limit_seo_radars"
                                    type="number"
                                    defaultValue={plan?.appLimits?.seo?.brandRadars ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Tracked keywords">
                                <Input
                                    name="limit_seo_keywords"
                                    type="number"
                                    defaultValue={plan?.appLimits?.seo?.trackedKeywords ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Website Builder"
                        description="Portfolio and website builder resources."
                        accent="violet"
                    >
                        <div className="grid gap-4 md:grid-cols-3">
                            <Field label="Sites">
                                <Input
                                    name="limit_site_sites"
                                    type="number"
                                    defaultValue={plan?.appLimits?.websiteBuilder?.sites ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Pages / site">
                                <Input
                                    name="limit_site_pages"
                                    type="number"
                                    defaultValue={plan?.appLimits?.websiteBuilder?.pages ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Custom domains">
                                <Input
                                    name="limit_site_domains"
                                    type="number"
                                    defaultValue={
                                        plan?.appLimits?.websiteBuilder?.customDomains ?? 0
                                    }
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard title="Other tools" description="SMS, URL shortener, QR code.">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Field label="SMS daily limit">
                                <Input
                                    name="limit_sms_dailyLimit"
                                    type="number"
                                    defaultValue={plan?.appLimits?.sms?.dailyLimit ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Shortened links">
                                <Input
                                    name="limit_url_links"
                                    type="number"
                                    defaultValue={plan?.appLimits?.urlShortener?.links ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Custom domains">
                                <Input
                                    name="limit_url_domains"
                                    type="number"
                                    defaultValue={plan?.appLimits?.urlShortener?.domains ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="QR codes">
                                <Input
                                    name="limit_qrcode_limit"
                                    type="number"
                                    defaultValue={plan?.appLimits?.qrCode?.limit ?? 0}
                                    min="0"
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </SectionCard>
                </TabsContent>

                {/* FEATURES */}
                <TabsContent
                    value="features"
                    forceMount
                    className="mt-0 data-[state=inactive]:hidden"
                >
                    <PlanFeaturesSelector defaultFeatures={plan?.features} />
                </TabsContent>

                {/* PERMISSIONS */}
                <TabsContent
                    value="permissions"
                    forceMount
                    className="mt-0 data-[state=inactive]:hidden"
                >
                    <PlanPermissionSelector defaultPermissions={plan?.permissions as any} />
                </TabsContent>
            </Tabs>

            {/* Sticky save bar */}
            <div
                className={cn(
                    'fixed bottom-6 inset-x-0 z-20 flex justify-center pointer-events-none px-4',
                )}
            >
                <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-xl shadow-2xl shadow-slate-400/20 px-4 py-3">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                        Changes take effect immediately after saving.
                    </span>
                    <SubmitButton />
                </div>
            </div>
        </form>
    );
}
