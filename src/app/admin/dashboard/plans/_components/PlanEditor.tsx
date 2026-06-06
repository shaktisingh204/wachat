'use client';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Switch,
  cn,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter,
  useParams } from 'next/navigation';
import { getPlanById, savePlan, getPlans } from '@/app/actions/plan.actions';
import type { Plan } from '@/lib/definitions';
import type { WithId } from 'mongodb';

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
import { PlanPermissionSelector } from '@/components/zoruui-domain/plan-permission-selector';
import { PlanFeaturesSelector } from '@/components/zoruui-domain/plan-features-selector';


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
            tile: 'bg-[var(--st-text)]/10 border-primary/30',
            icon: 'text-[var(--st-text)]',
            glow: 'from-primary/10',
        },
        amber: {
            tile: 'bg-[var(--st-bg-muted)] border-[var(--st-border)]',
            icon: 'text-[var(--st-text)]',
            glow: 'from-[var(--st-text)]/10',
        },
        violet: {
            tile: 'bg-[var(--st-bg-muted)] border-[var(--st-border)]',
            icon: 'text-[var(--st-text)]',
            glow: 'from-[var(--st-text)]/10',
        },
        emerald: {
            tile: 'bg-[var(--st-bg-muted)] border-[var(--st-border)]',
            icon: 'text-[var(--st-text)]',
            glow: 'from-[var(--st-text)]/10',
        },
        sky: {
            tile: 'bg-[var(--st-bg-muted)] border-[var(--st-border)]',
            icon: 'text-[var(--st-text)]',
            glow: 'from-[var(--st-text)]/10',
        },
        rose: {
            tile: 'bg-[var(--st-bg-muted)] border-[var(--st-border)]',
            icon: 'text-[var(--st-text)]',
            glow: 'from-[var(--st-text)]/10',
        },
    };
    const styles = accentMap[accent || 'primary'];
    return (
        <Card
            className={cn(
                'rounded-2xl border-[var(--st-border)] bg-[var(--st-bg)] backdrop-blur-xl shadow-sm overflow-hidden',
                premium && 'ring-1 ring-[var(--st-border)]/40 shadow-[var(--st-border)]/10',
            )}
        >
            <ZoruCardHeader
                className={cn(
                    'border-b border-[var(--st-border)] bg-gradient-to-r to-transparent',
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
                            <ZoruCardTitle className="text-base">{title}</ZoruCardTitle>
                            {premium && (
                                <Badge className="rounded-full text-[9px] h-5 px-2 gap-1 bg-gradient-to-r from-[var(--st-text)]/80 to-[var(--st-bg-muted)]/80 text-[var(--st-text)] border-0 font-bold uppercase tracking-wider">
                                    <Crown className="h-2.5 w-2.5" />
                                    Premium
                                </Badge>
                            )}
                        </div>
                        {description && (
                            <ZoruCardDescription className="text-xs mt-0.5">
                                {description}
                            </ZoruCardDescription>
                        )}
                    </div>
                </div>
            </ZoruCardHeader>
            <ZoruCardContent className="pt-5">{children}</ZoruCardContent>
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
            <Label className="text-xs font-medium text-[var(--st-text-secondary)]">{label}</Label>
            {children}
            {hint && <p className="text-[10px] text-[var(--st-text-secondary)]/70">{hint}</p>}
        </div>
    );
}

const inputClass = 'rounded-xl bg-[var(--st-bg)] border-[var(--st-border)] backdrop-blur focus-visible:ring-primary/40';

export function PlanEditor({ planId }: { planId: string }) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, setState] = useState<any>(initialState);
    const [, startTransition] = useTransition();

    const [plan, setPlan] = useState<WithId<Plan> | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<
        'overview' | 'pricing' | 'limits' | 'modules' | 'features' | 'permissions'
    >('overview');

    const [allPlans, setAllPlans] = useState<WithId<Plan>[]>([]);
    const [cloneSourceId, setCloneSourceId] = useState<string>('');

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
            getPlans().then((data) => {
                setAllPlans(data);
                setLoading(false);
            }).catch(() => setLoading(false));
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
            <input type="hidden" name="planId" value={plan?._id?.toString() || 'new'} />

            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl border border-[var(--st-border)] bg-gradient-to-br from-primary/5 via-[var(--st-bg)] to-[var(--st-bg-muted)] p-6">
                <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[var(--st-text)]/20 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[var(--st-bg-muted)] blur-3xl pointer-events-none" />
                <div className="relative">
                    <Button
                        type="button"
                        variant="ghost"
                        asChild
                        size="sm"
                        className="-ml-2 mb-2 hover:bg-[var(--st-bg-secondary)] rounded-lg"
                    >
                        <Link href="/admin/dashboard/plans">
                            <ChevronLeft className="mr-1 h-4 w-4" />
                            Back to Plans
                        </Link>
                    </Button>
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--st-text)] mb-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        {isNew ? 'New Plan' : 'Editing Plan'}
                    </div>
                    <h1 className="text-2xl md:text-3xl text-[var(--st-text)]">
                        {isNew ? 'Create a new plan' : plan?.name}
                    </h1>
                    <p className="text-sm text-[var(--st-text-secondary)] mt-1 max-w-2xl">
                        Configure pricing, usage limits, and the master permission ceiling for
                        every module in the app.
                    </p>

                    {isNew && allPlans.length > 0 && (
                        <div className="mt-6 flex items-center gap-3">
                            <Label htmlFor="clonePlan" className="text-sm font-medium text-[var(--st-text)] whitespace-nowrap">
                                Clone from:
                            </Label>
                            <Select
                                value={cloneSourceId}
                                onValueChange={(val) => {
                                    setCloneSourceId(val);
                                    if (val === 'blank') {
                                        setPlan(null);
                                    } else {
                                        const source = allPlans.find((p) => p._id.toString() === val);
                                        if (source) {
                                            // Make a copy without the _id
                                            const { _id, ...rest } = source;
                                            setPlan({ ...rest, name: `${rest.name} (Copy)`, isPublic: false, isDefault: false } as any);
                                        }
                                    }
                                }}
                            >
                                <ZoruSelectTrigger id="clonePlan" className="w-[280px] bg-[var(--st-bg)]">
                                    <ZoruSelectValue placeholder="Start from blank plan" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="blank">Start from blank plan</ZoruSelectItem>
                                    {allPlans.map((p) => (
                                        <ZoruSelectItem key={p._id.toString()} value={p._id.toString()}>
                                            {p.name}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </div>

            {/* We use a key on the segmented tab strip / form content so that changing the cloned plan re-mounts the uncontrolled inputs */}
            <div key={plan ? plan.name + cloneSourceId : 'blank'} className="space-y-5">
                <div className="flex w-full flex-wrap justify-start gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1">
                    {(
                        [
                            { key: 'overview', icon: CreditCard, label: 'Overview' },
                            { key: 'pricing', icon: DollarSign, label: 'Pricing & Credits' },
                            { key: 'limits', icon: Gauge, label: 'Usage Limits' },
                            { key: 'modules', icon: Boxes, label: 'Module Limits' },
                            { key: 'features', icon: Sparkles, label: 'Features' },
                            { key: 'permissions', icon: ShieldCheck, label: 'Permissions' },
                        ] as const
                    ).map(({ key, icon: Icon, label }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setActiveTab(key)}
                            className={cn(
                                'flex items-center gap-2 rounded-[var(--st-radius-sm)] px-3 py-1.5 text-sm transition-colors',
                                activeTab === key
                                    ? 'bg-[var(--st-text)] text-[var(--st-bg)]'
                                    : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]',
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* OVERVIEW */}
                <div className={cn('space-y-5', activeTab !== 'overview' && 'hidden')}>
                    <SectionCard
                        title="Basic details"
                        description="Name, category, and visibility flags for this plan."
                        icon={CreditCard}
                    >
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Field label="Plan name">
                                <Input
                                    name="name"
                                    defaultValue={plan?.name || ''}
                                    required
                                    placeholder="e.g. Pro Tier"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Category">
                                <Select name="appCategory" defaultValue={plan?.appCategory}>
                                    <ZoruSelectTrigger className={inputClass}>
                                        <ZoruSelectValue placeholder="Select category…" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="All-In-One">All-In-One</ZoruSelectItem>
                                        <ZoruSelectItem value="Wachat">Wachat</ZoruSelectItem>
                                        <ZoruSelectItem value="CRM">CRM</ZoruSelectItem>
                                        <ZoruSelectItem value="Meta">Meta Suite</ZoruSelectItem>
                                        <ZoruSelectItem value="Facebook">Facebook</ZoruSelectItem>
                                        <ZoruSelectItem value="Instagram">Instagram</ZoruSelectItem>
                                        <ZoruSelectItem value="Ad Manager">
                                            Ad Manager (Premium)
                                        </ZoruSelectItem>
                                        <ZoruSelectItem value="Email">Email</ZoruSelectItem>
                                        <ZoruSelectItem value="SMS">SMS</ZoruSelectItem>
                                        <ZoruSelectItem value="SabChat">SabChat</ZoruSelectItem>
                                        <ZoruSelectItem value="SEO">SEO</ZoruSelectItem>
                                        <ZoruSelectItem value="Website Builder">
                                            Website Builder
                                        </ZoruSelectItem>
                                        <ZoruSelectItem value="URL Shortener">URL Shortener</ZoruSelectItem>
                                        <ZoruSelectItem value="QR Code Generator">
                                            QR Code Generator
                                        </ZoruSelectItem>
                                    </ZoruSelectContent>
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
                                    <ZoruSelectTrigger className={inputClass}>
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="INR">INR</ZoruSelectItem>
                                        <ZoruSelectItem value="USD">USD</ZoruSelectItem>
                                        <ZoruSelectItem value="EUR">EUR</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </Select>
                            </Field>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-[var(--st-border)]">
                            <div className="flex items-center gap-2 rounded-xl bg-[var(--st-bg)] border border-[var(--st-border)] px-4 py-2">
                                <Switch
                                    id="isPublic"
                                    name="isPublic"
                                    defaultChecked={plan?.isPublic ?? false}
                                />
                                <Label htmlFor="isPublic" className="text-sm">
                                    Publicly visible
                                </Label>
                            </div>
                            <div className="flex items-center gap-2 rounded-xl bg-[var(--st-bg)] border border-[var(--st-border)] px-4 py-2">
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
                </div>

                {/* PRICING & CREDITS */}
                <div className={cn('space-y-5', activeTab !== 'pricing' && 'hidden')}>
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
                </div>

                {/* USAGE LIMITS */}
                <div className={cn('space-y-5', activeTab !== 'limits' && 'hidden')}>
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
                </div>

                {/* MODULE LIMITS */}
                <div className={cn('space-y-5', activeTab !== 'modules' && 'hidden')}>
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
                </div>

                {/* FEATURES */}
                <div className={cn(activeTab !== 'features' && 'hidden')}>
                    <PlanFeaturesSelector defaultFeatures={plan?.features} />
                </div>

                {/* PERMISSIONS */}
                <div className={cn(activeTab !== 'permissions' && 'hidden')}>
                    <PlanPermissionSelector defaultPermissions={plan?.permissions as any} />
                </div>
            </div>

            {/* Sticky save bar */}
            <div
                className={cn(
                    'fixed bottom-6 inset-x-0 z-20 flex justify-center pointer-events-none px-4',
                )}
            >
                <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)]/90 backdrop-blur-xl shadow-2xl shadow-[var(--st-text)]/10 px-4 py-3">
                    <span className="text-xs text-[var(--st-text-secondary)] hidden sm:inline">
                        Changes take effect immediately after saving.
                    </span>
                    <SubmitButton />
                </div>
            </div>
        </form>
    );
}
