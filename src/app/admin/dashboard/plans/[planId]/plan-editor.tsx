'use client';

import {
    Badge,
    Button,
    Card,
    CardBody,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    Field,
    Input,
    Label,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    useToast,
} from '@/components/sabcrm/20ui';
import { useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { savePlan } from '@/app/actions/plan.actions';
import type { Plan } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import {
    ChevronLeft,
    Save,
    Sparkles,
    CreditCard,
    Gauge,
    ShieldCheck,
    DollarSign,
    Boxes,
    Crown,
    History,
} from 'lucide-react';
import { PlanPermissionSelector } from '@/components/20ui-domain/plan-permission-selector';
import { PlanFeaturesSelector } from '@/components/20ui-domain/plan-features-selector';

const initialState = { message: null, error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={pending}
            iconLeft={Save}
        >
            Save Plan
        </Button>
    );
}

function SectionCard({
    title,
    description,
    icon: Icon,
    premium,
    children,
}: {
    title: string;
    description?: string;
    icon?: React.ComponentType<{ className?: string }>;
    premium?: boolean;
    children: React.ReactNode;
}) {
    return (
        <Card className="overflow-hidden">
            <CardHeader>
                <div className="flex items-start gap-3">
                    {Icon && (
                        <div className="h-9 w-9 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-[var(--st-text)]" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base">{title}</CardTitle>
                            {premium && (
                                <Badge tone="accent" dot>
                                    <Crown className="h-2.5 w-2.5" aria-hidden="true" />
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
            <CardBody className="pt-5">{children}</CardBody>
        </Card>
    );
}

export default function PlanEditor({ planId, initialPlan, initialHistory }: { planId: string, initialPlan: WithId<Plan> | null, initialHistory: (WithId<Plan> & { versionedAt: Date | string })[] }) {

    const router = useRouter();
    const { toast } = useToast();
    const [state, setState] = useState<{ message?: string | null, error?: string | null }>(initialState);
    const [, startTransition] = useTransition();

    const plan = initialPlan;
    const [activeTab, setActiveTab] = useState<
        'overview' | 'pricing' | 'limits' | 'modules' | 'features' | 'permissions' | 'history'
    >('overview');

    const isNew = planId === 'new';

    const formAction = (formData: FormData) => {
        startTransition(async () => {
            const result = await savePlan(null, formData);
            setState(result);
        });
    };

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Plan saved', description: state.message, tone: 'success' });
            router.push('/admin/dashboard/plans');
        }
        if (state.error) {
            toast({
                title: 'Could not save plan',
                description: state.error,
                tone: 'danger',
            });
        }
    }, [state, toast, router]);

    return (
        <form action={formAction} className="space-y-6 pb-24">
            <input type="hidden" name="planId" value={plan?._id.toString() || 'new'} />

            {/* Header */}
            <PageHeader>
                <PageHeaderHeading>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        iconLeft={ChevronLeft}
                        onClick={() => router.push('/admin/dashboard/plans')}
                        className="-ml-2 mb-2 self-start"
                    >
                        Back to Plans
                    </Button>
                    <PageEyebrow>
                        <span className="inline-flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            {isNew ? 'New Plan' : 'Editing Plan'}
                        </span>
                    </PageEyebrow>
                    <PageTitle>{isNew ? 'Create a new plan' : plan?.name}</PageTitle>
                    <PageDescription>
                        Configure pricing, usage limits, and the master permission ceiling for
                        every module in the app.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            {/* Segmented tab strip */}
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                className="space-y-5"
            >
                <TabsList>
                    {(
                        [
                            { key: 'overview', icon: CreditCard, label: 'Overview' },
                            { key: 'pricing', icon: DollarSign, label: 'Pricing & Credits' },
                            { key: 'limits', icon: Gauge, label: 'Usage Limits' },
                            { key: 'modules', icon: Boxes, label: 'Module Limits' },
                            { key: 'features', icon: Sparkles, label: 'Features' },
                            { key: 'permissions', icon: ShieldCheck, label: 'Permissions' },
                            { key: 'history', icon: History, label: 'History' },
                        ] as const
                    ).map(({ key, icon: Icon, label }) => (
                        <TabsTrigger key={key} value={key}>
                            <span className="flex items-center gap-2">
                                <Icon className="h-4 w-4" aria-hidden="true" />
                                {label}
                            </span>
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* OVERVIEW */}
                <TabsContent value="overview" className="space-y-5">
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
                                />
                            </Field>
                            <Field label="Category">
                                <Select name="appCategory" defaultValue={plan?.appCategory}>
                                    <SelectTrigger aria-label="Category">
                                        <SelectValue placeholder="Select category" />
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
                                />
                            </Field>
                            <Field label="Currency">
                                <Select name="currency" defaultValue={plan?.currency || 'INR'} required>
                                    <SelectTrigger aria-label="Currency">
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

                        <div className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-[var(--st-border)]">
                            <div className="flex items-center gap-2 rounded-[var(--st-radius)] bg-[var(--st-bg)] border border-[var(--st-border)] px-4 py-2">
                                <Switch
                                    id="isPublic"
                                    name="isPublic"
                                    defaultChecked={plan?.isPublic ?? false}
                                />
                                <Label htmlFor="isPublic" className="text-sm">
                                    Publicly visible
                                </Label>
                            </div>
                            <div className="flex items-center gap-2 rounded-[var(--st-radius)] bg-[var(--st-bg)] border border-[var(--st-border)] px-4 py-2">
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
                <TabsContent value="pricing" className="space-y-5">
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
                                />
                            </Field>
                            <Field label="Broadcast">
                                <Input
                                    name="init_broadcast"
                                    type="number"
                                    defaultValue={plan?.initialCredits?.broadcast ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="SMS">
                                <Input
                                    name="init_sms"
                                    type="number"
                                    defaultValue={plan?.initialCredits?.sms ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Meta Suite">
                                <Input
                                    name="init_meta"
                                    type="number"
                                    defaultValue={plan?.initialCredits?.meta ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Email">
                                <Input
                                    name="init_email"
                                    type="number"
                                    defaultValue={plan?.initialCredits?.email ?? 0}
                                    min="0"
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
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard title="Credit rates" description="Credits deducted per unit per channel.">
                        <div className="space-y-5">
                            <div>
                                <div className="text-xs font-semibold text-[var(--st-text)] mb-3 uppercase tracking-wide">
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
                                        />
                                    </Field>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-[var(--st-border)]">
                                <div className="text-xs font-semibold text-[var(--st-text)] mb-3 uppercase tracking-wide">
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
                                        />
                                    </Field>
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </TabsContent>

                {/* USAGE LIMITS */}
                <TabsContent value="limits" className="space-y-5">
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
                                />
                            </Field>
                            <Field label="Agents / project">
                                <Input
                                    name="agentLimit"
                                    type="number"
                                    defaultValue={plan?.agentLimit ?? 10}
                                    required
                                    min="0"
                                />
                            </Field>
                            <Field label="Custom attributes">
                                <Input
                                    name="attributeLimit"
                                    type="number"
                                    defaultValue={plan?.attributeLimit ?? 20}
                                    required
                                    min="0"
                                />
                            </Field>
                            <Field label="Templates">
                                <Input
                                    name="templateLimit"
                                    type="number"
                                    defaultValue={plan?.templateLimit ?? 50}
                                    required
                                    min="0"
                                />
                            </Field>
                            <Field label="Flow builder">
                                <Input
                                    name="flowLimit"
                                    type="number"
                                    defaultValue={plan?.flowLimit ?? 10}
                                    required
                                    min="0"
                                />
                            </Field>
                            <Field label="Meta flows">
                                <Input
                                    name="metaFlowLimit"
                                    type="number"
                                    defaultValue={plan?.metaFlowLimit ?? 10}
                                    required
                                    min="0"
                                />
                            </Field>
                            <Field label="Canned messages">
                                <Input
                                    name="cannedMessageLimit"
                                    type="number"
                                    defaultValue={plan?.cannedMessageLimit ?? 25}
                                    required
                                    min="0"
                                />
                            </Field>
                            <Field label="Custom roles">
                                <Input
                                    name="customRoleLimit"
                                    type="number"
                                    defaultValue={plan?.customRoleLimit ?? 3}
                                    required
                                    min="0"
                                />
                            </Field>
                            <Field label="Team channels">
                                <Input
                                    name="teamChannelLimit"
                                    type="number"
                                    defaultValue={plan?.teamChannelLimit ?? 10}
                                    required
                                    min="0"
                                />
                            </Field>
                            <Field label="Team tasks">
                                <Input
                                    name="teamTaskLimit"
                                    type="number"
                                    defaultValue={plan?.teamTaskLimit ?? 50}
                                    required
                                    min="0"
                                />
                            </Field>
                        </div>
                    </SectionCard>
                </TabsContent>

                {/* MODULE LIMITS */}
                <TabsContent value="modules" className="space-y-5">
                    <SectionCard
                        title="WaChat"
                        description="Limits for WhatsApp Business tooling."
                        icon={Boxes}
                    >
                        <div className="grid gap-4 md:grid-cols-4">
                            <Field label="Templates">
                                <Input
                                    name="limit_wachat_templates"
                                    type="number"
                                    defaultValue={plan?.appLimits?.wachat?.templates ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Flows">
                                <Input
                                    name="limit_wachat_flows"
                                    type="number"
                                    defaultValue={plan?.appLimits?.wachat?.flows ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Meta flows">
                                <Input
                                    name="limit_wachat_metaFlows"
                                    type="number"
                                    defaultValue={plan?.appLimits?.wachat?.metaFlows ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Canned messages">
                                <Input
                                    name="limit_wachat_cannedMessages"
                                    type="number"
                                    defaultValue={plan?.appLimits?.wachat?.cannedMessages ?? 0}
                                    min="0"
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="CRM"
                        description="Resource limits for the CRM module."
                    >
                        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                            <Field label="Products">
                                <Input
                                    name="limit_crm_products"
                                    type="number"
                                    defaultValue={plan?.appLimits?.crm?.products ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Customers">
                                <Input
                                    name="limit_crm_customers"
                                    type="number"
                                    defaultValue={plan?.appLimits?.crm?.customers ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Vendors">
                                <Input
                                    name="limit_crm_vendors"
                                    type="number"
                                    defaultValue={plan?.appLimits?.crm?.vendors ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Warehouses">
                                <Input
                                    name="limit_crm_warehouses"
                                    type="number"
                                    defaultValue={plan?.appLimits?.crm?.warehouses ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Pipelines">
                                <Input
                                    name="limit_crm_pipelines"
                                    type="number"
                                    defaultValue={plan?.appLimits?.crm?.pipelines ?? 0}
                                    min="0"
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Facebook"
                        description="Facebook Pages, posts, automation rules, and shops."
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
                                />
                            </Field>
                            <Field label="Scheduled posts">
                                <Input
                                    name="limit_fb_scheduled"
                                    type="number"
                                    defaultValue={plan?.appLimits?.facebook?.scheduledPosts ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Automation rules">
                                <Input
                                    name="limit_fb_automation"
                                    type="number"
                                    defaultValue={plan?.appLimits?.facebook?.automationRules ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Shops">
                                <Input
                                    name="limit_fb_shops"
                                    type="number"
                                    defaultValue={plan?.appLimits?.facebook?.shops ?? 0}
                                    min="0"
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Instagram"
                        description="Instagram business accounts, scheduled content, and hashtag research."
                    >
                        <div className="grid gap-4 md:grid-cols-3">
                            <Field label="Connected accounts">
                                <Input
                                    name="limit_ig_accounts"
                                    type="number"
                                    defaultValue={plan?.appLimits?.instagram?.accounts ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Scheduled posts">
                                <Input
                                    name="limit_ig_scheduled"
                                    type="number"
                                    defaultValue={plan?.appLimits?.instagram?.scheduledPosts ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Hashtag tracking">
                                <Input
                                    name="limit_ig_hashtags"
                                    type="number"
                                    defaultValue={plan?.appLimits?.instagram?.hashtagTracking ?? 0}
                                    min="0"
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Ad Manager"
                        description="Meta Ads Manager. Manage ad accounts, campaigns, and audiences."
                        icon={Crown}
                        premium
                    >
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Field label="Ad accounts" help="Max Meta Ad Accounts linkable to projects.">
                                <Input
                                    name="limit_ads_accounts"
                                    type="number"
                                    defaultValue={
                                        plan?.appLimits?.adManager?.adAccounts ??
                                        plan?.appLimits?.meta?.adAccounts ??
                                        0
                                    }
                                    min="0"
                                />
                            </Field>
                            <Field label="Active campaigns">
                                <Input
                                    name="limit_ads_campaigns"
                                    type="number"
                                    defaultValue={plan?.appLimits?.adManager?.campaigns ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Custom audiences">
                                <Input
                                    name="limit_ads_audiences"
                                    type="number"
                                    defaultValue={plan?.appLimits?.adManager?.audiences ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field
                                label="Monthly ad spend cap"
                                help="0 = uncapped. Enforced before placing ads."
                            >
                                <Input
                                    name="limit_ads_spend_cap"
                                    type="number"
                                    defaultValue={plan?.appLimits?.adManager?.monthlyAdSpendCap ?? 0}
                                    min="0"
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Email"
                        description="Email channel throughput."
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Connected accounts">
                                <Input
                                    name="limit_email_connectedAccounts"
                                    type="number"
                                    defaultValue={plan?.appLimits?.email?.connectedAccounts ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Daily sending limit">
                                <Input
                                    name="limit_email_dailyLimit"
                                    type="number"
                                    defaultValue={plan?.appLimits?.email?.dailyLimit ?? 0}
                                    min="0"
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="SabChat"
                        description="Live chat widgets, visitors, and canned replies."
                    >
                        <div className="grid gap-4 md:grid-cols-3">
                            <Field label="Widgets">
                                <Input
                                    name="limit_sabchat_widgets"
                                    type="number"
                                    defaultValue={plan?.appLimits?.sabchat?.widgets ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Monthly visitors">
                                <Input
                                    name="limit_sabchat_visitors"
                                    type="number"
                                    defaultValue={plan?.appLimits?.sabchat?.monthlyVisitors ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Quick replies">
                                <Input
                                    name="limit_sabchat_replies"
                                    type="number"
                                    defaultValue={plan?.appLimits?.sabchat?.quickReplies ?? 0}
                                    min="0"
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="SEO"
                        description="SEO projects, brand radars, and tracked keywords."
                    >
                        <div className="grid gap-4 md:grid-cols-3">
                            <Field label="Projects">
                                <Input
                                    name="limit_seo_projects"
                                    type="number"
                                    defaultValue={plan?.appLimits?.seo?.projects ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Brand radars">
                                <Input
                                    name="limit_seo_radars"
                                    type="number"
                                    defaultValue={plan?.appLimits?.seo?.brandRadars ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Tracked keywords">
                                <Input
                                    name="limit_seo_keywords"
                                    type="number"
                                    defaultValue={plan?.appLimits?.seo?.trackedKeywords ?? 0}
                                    min="0"
                                />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Website Builder"
                        description="Portfolio and website builder resources."
                    >
                        <div className="grid gap-4 md:grid-cols-3">
                            <Field label="Sites">
                                <Input
                                    name="limit_site_sites"
                                    type="number"
                                    defaultValue={plan?.appLimits?.websiteBuilder?.sites ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Pages / site">
                                <Input
                                    name="limit_site_pages"
                                    type="number"
                                    defaultValue={plan?.appLimits?.websiteBuilder?.pages ?? 0}
                                    min="0"
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
                                />
                            </Field>
                            <Field label="Shortened links">
                                <Input
                                    name="limit_url_links"
                                    type="number"
                                    defaultValue={plan?.appLimits?.urlShortener?.links ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="Custom domains">
                                <Input
                                    name="limit_url_domains"
                                    type="number"
                                    defaultValue={plan?.appLimits?.urlShortener?.domains ?? 0}
                                    min="0"
                                />
                            </Field>
                            <Field label="QR codes">
                                <Input
                                    name="limit_qrcode_limit"
                                    type="number"
                                    defaultValue={plan?.appLimits?.qrCode?.limit ?? 0}
                                    min="0"
                                />
                            </Field>
                        </div>
                    </SectionCard>
                </TabsContent>

                {/* FEATURES */}
                <TabsContent value="features">
                    <PlanFeaturesSelector defaultFeatures={plan?.features} />
                </TabsContent>

                {/* PERMISSIONS */}
                <TabsContent value="permissions">
                    <PlanPermissionSelector defaultPermissions={plan?.permissions as Record<string, any>} />
                </TabsContent>

                {/* HISTORY */}
                <TabsContent value="history">
                    <SectionCard title="Plan History" description="Recent versions of this plan." icon={History}>
                        {initialHistory && initialHistory.length > 0 ? (
                            <div className="space-y-4">
                                {initialHistory.map((h, i) => (
                                    <div key={i} className="p-4 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                                        <div className="flex justify-between items-center">
                                            <div className="font-semibold text-[var(--st-text)]">{h.name} <span className="text-[var(--st-text-secondary)] text-sm font-normal">v{initialHistory.length - i}</span></div>
                                            <div className="text-xs text-[var(--st-text-secondary)]">{new Date(h.versionedAt).toLocaleString()}</div>
                                        </div>
                                        <div className="text-sm mt-2 text-[var(--st-text)]">Price: {h.price} {h.currency}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                icon={History}
                                title="No history yet"
                                description="No history available for this plan."
                            />
                        )}
                    </SectionCard>
                </TabsContent>
            </Tabs>

            {/* Sticky save bar */}
            <div className="fixed bottom-6 inset-x-0 z-20 flex justify-center pointer-events-none px-4">
                <div className="pointer-events-auto flex items-center gap-3 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] shadow-[var(--st-shadow-lg)] px-4 py-3">
                    <span className="text-xs text-[var(--st-text-secondary)] hidden sm:inline">
                        Changes take effect immediately after saving.
                    </span>
                    <SubmitButton />
                </div>
            </div>
        </form>
    );
}
