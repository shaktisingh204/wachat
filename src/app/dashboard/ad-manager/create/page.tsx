'use client';

import {
    Alert,
    AlertDescription,
    AlertTitle,
    Badge,
    Button,
    Card,
    CardBody,
    Checkbox,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    EmptyState,
    Field,
    IconButton,
    Input,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Popover,
    PopoverContent,
    PopoverTrigger,
    RadioGroup,
    RadioGroupItem,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    Spinner,
    Switch,
    Tag,
    Textarea,
    useToast,
} from '@/components/sabcrm/20ui';
import {
  useRouter,
  useSearchParams,
} from 'next/navigation';
import {
    ArrowLeft,
    Megaphone,
    Layers,
    Image as ImageIcon,
    Check,
    Send,
    AlertCircle,
    Sparkles,
    Target,
    Users,
    Globe,
    DollarSign,
    Calendar,
    Smartphone,
    Settings2,
    Facebook,
    Instagram,
    MessageSquare,
    Zap,
    Plus,
    Trash2,
    Eye,
    AlertTriangle,
} from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { AmBreadcrumb } from '@/app/dashboard/ad-manager/_components/am-page-shell';

import { cn } from '@/lib/utils';
import { useAdManager } from '@/context/ad-manager-context';
import {
    createCampaign, createAdSet, createCreative, createAd,
    getFacebookPagesForAdCreation, uploadAdImage, getReachEstimate,
    searchTargeting, listPixels, getCustomAudiences,
    listAdImages, getInstagramAccountsForPage,
} from '@/app/actions/ad-manager.actions';
import { SabFileToFileButton } from '@/components/sabfiles';
import type { FacebookPage, CustomAudience } from '@/lib/definitions';
import {
    OBJECTIVES, BID_STRATEGIES, COUNTRIES, CALL_TO_ACTIONS,
    SPECIAL_AD_CATEGORIES, FACEBOOK_POSITIONS, INSTAGRAM_POSITIONS,
    formatNumber,
} from '@/components/zoruui-domain/ad-manager/constants';
import {
    initialFormState, validateStep1, validateStep2, validateStep3,
    type CreateFormState, type ValidationIssue,
} from '@/components/zoruui-domain/ad-manager/create-wizard/form-state';
import { AdPreviewSwitcher } from '@/components/zoruui-domain/ad-manager/create-wizard/ad-previews';

type Step = 1 | 2 | 3;

const STEPS = [
    { id: 1 as const, label: 'Campaign', icon: Megaphone, sub: 'Objective & budget' },
    { id: 2 as const, label: 'Ad set', icon: Layers, sub: 'Audience, placements & schedule' },
    { id: 3 as const, label: 'Ad', icon: ImageIcon, sub: 'Creative, copy & destination' },
];

const LANGUAGES = [
    { id: 6, name: 'English' }, { id: 1001, name: 'English (US)' }, { id: 1002, name: 'English (UK)' },
    { id: 7, name: 'Spanish' }, { id: 5, name: 'Hindi' }, { id: 46, name: 'Portuguese' },
    { id: 8, name: 'French' }, { id: 9, name: 'German' }, { id: 17, name: 'Arabic' },
    { id: 19, name: 'Chinese' }, { id: 25, name: 'Italian' }, { id: 28, name: 'Japanese' },
];

// =================================================================
//  Main page
// =================================================================

export default function CreateAdPage() {
    return (
        <React.Suspense
            fallback={
                <div className="flex items-center justify-center min-h-[400px]">
                    <Spinner size="lg" label="Loading" />
                </div>
            }
        >
            <CreateAdForm />
        </React.Suspense>
    );
}

function CreateAdForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { activeAccount, isLoading: accountLoading } = useAdManager();

    const [step, setStep] = React.useState<Step>(1);
    const [maxStep, setMaxStep] = React.useState<Step>(1);
    const [state, setState] = React.useState<CreateFormState>(initialFormState);

    // Hydrate form state from URL parameters
    React.useEffect(() => {
        const dest = searchParams?.get('destination');
        const obj = searchParams?.get('objective');

        if (dest || obj) {
            setState((s) => ({
                ...s,
                ...(dest === 'WHATSAPP' ? { conversionLocation: 'whatsapp' } : {}),
                ...(obj ? { objective: obj } : {}),
            }));
        }
    }, [searchParams]);
    const [pages, setPages] = React.useState<FacebookPage[]>([]);
    const [pixels, setPixels] = React.useState<any[]>([]);
    const [audiences, setAudiences] = React.useState<CustomAudience[]>([]);
    const [savedImages, setSavedImages] = React.useState<any[]>([]);
    const [submitting, setSubmitting] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [reach, setReach] = React.useState<{ lower: number; upper: number } | null>(null);
    const [issues, setIssues] = React.useState<ValidationIssue[]>([]);
    const [igAccounts, setIgAccounts] = React.useState<any[]>([]);
    const [mediaTab, setMediaTab] = React.useState<'upload' | 'library'>('upload');

    const setField = <K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) => {
        setState((s) => ({ ...s, [key]: value }));
    };

    // Initial data
    React.useEffect(() => {
        (async () => {
            const [p, a, pi, im] = await Promise.all([
                getFacebookPagesForAdCreation(),
                activeAccount ? getCustomAudiences(activeAccount.account_id) : Promise.resolve({ audiences: [] }),
                activeAccount ? listPixels(activeAccount.account_id) : Promise.resolve({ data: [] }),
                activeAccount ? listAdImages(activeAccount.account_id) : Promise.resolve({ data: [] }),
            ]);
            if (p.pages?.length) {
                setPages(p.pages);
                setField('facebookPageId', p.pages[0].id);
            }
            setAudiences(a.audiences || []);
            setPixels(pi.data || []);
            setSavedImages(im.data || []);
        })();
    }, [activeAccount]);

    // Load IG account when page changes
    React.useEffect(() => {
        if (!state.facebookPageId) return;
        (async () => {
            const res = await getInstagramAccountsForPage(state.facebookPageId);
            setIgAccounts(res.data || []);
            if (res.data?.[0]?.id) setField('instagramActorId', res.data[0].id);
        })();
    }, [state.facebookPageId]);

    // Live reach estimate
    React.useEffect(() => {
        if (!activeAccount || step < 2) return;
        const handle = setTimeout(async () => {
            const res = await getReachEstimate(activeAccount.account_id, {
                geo_locations: {
                    countries: state.countries,
                    location_types: state.locationTypes,
                },
                age_min: state.minAge,
                age_max: state.maxAge,
                ...(state.gender !== 'all' ? { genders: [state.gender === 'male' ? 1 : 2] } : {}),
                publisher_platforms: state.advantagePlacements ? undefined : state.platforms,
                interests: state.detailedTargeting.length ? state.detailedTargeting.map((i) => ({ id: i.id, name: i.name })) : undefined,
                custom_audiences: state.customAudiences.length ? state.customAudiences : undefined,
            });
            const est = (res.data as any)?.data?.[0];
            if (est) setReach({ lower: est.users_lower_bound, upper: est.users_upper_bound });
        }, 600);
        return () => clearTimeout(handle);
    }, [
        activeAccount, step,
        state.countries, state.locationTypes, state.minAge, state.maxAge, state.gender,
        state.platforms, state.advantagePlacements,
        state.detailedTargeting, state.customAudiences,
    ]);

    const stepIssues = React.useMemo(() => {
        if (step === 1) return validateStep1(state);
        if (step === 2) return validateStep2(state);
        if (step === 3) return validateStep3(state);
        return [];
    }, [step, state]);

    const goNext = () => {
        const v = step === 1 ? validateStep1(state) : step === 2 ? validateStep2(state) : [];
        setIssues(v);
        if (v.length > 0) {
            toast({ title: 'Fix the errors before continuing', tone: 'danger' });
            return;
        }
        const next = Math.min(step + 1, 3) as Step;
        setStep(next);
        setMaxStep((m) => (next > m ? next : m));
    };
    const goPrev = () => {
        setIssues([]);
        setStep(Math.max(step - 1, 1) as Step);
    };

    const handleFilePicked = async (file: File) => {
        if (!activeAccount) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('adAccountId', activeAccount.account_id);
        const res = await uploadAdImage(fd);
        setUploading(false);
        if (res.error) {
            toast({ title: 'Upload failed', description: res.error, tone: 'danger' });
            return;
        }
        setField('imageHash', res.imageHash || '');
        setField('imageUrl', res.imageUrl || '');
        toast.success('Image uploaded');
    };

    const submit = async () => {
        if (!activeAccount) return;
        const all = [...validateStep1(state), ...validateStep2(state), ...validateStep3(state)];
        setIssues(all);
        if (all.length > 0) {
            toast({ title: 'Fix the errors before publishing', tone: 'danger' });
            return;
        }
        setSubmitting(true);
        try {
            // 1. Campaign
            const campaignRes = await createCampaign(activeAccount.account_id, {
                name: state.campaignName,
                objective: state.objective,
                status: 'PAUSED',
                special_ad_categories:
                    state.specialAdCategory === 'NONE' ? [] : [state.specialAdCategory],
                buying_type: state.buyingType,
                bid_strategy: state.cbo ? state.bidStrategy : undefined,
                daily_budget: state.cbo && state.campaignBudgetType === 'DAILY'
                    ? Math.round(Number(state.campaignBudget) * 100)
                    : undefined,
                lifetime_budget: state.cbo && state.campaignBudgetType === 'LIFETIME'
                    ? Math.round(Number(state.campaignBudget) * 100)
                    : undefined,
                spend_cap: state.campaignSpendCap ? Math.round(Number(state.campaignSpendCap) * 100) : undefined,
                start_time: state.campaignStartDate || undefined,
                stop_time: state.campaignEndDate || undefined,
            });
            if (campaignRes.error || !campaignRes.data?.id) throw new Error(campaignRes.error);

            // 2. Ad set
            const targeting: Record<string, any> = {
                geo_locations: {
                    countries: state.countries,
                    location_types: state.locationTypes,
                },
                age_min: state.minAge,
                age_max: state.maxAge,
            };
            if (state.excludedCountries.length > 0) {
                targeting.excluded_geo_locations = { countries: state.excludedCountries };
            }
            if (state.gender !== 'all') targeting.genders = [state.gender === 'male' ? 1 : 2];
            if (state.languages.length > 0) targeting.locales = state.languages;
            if (state.detailedTargeting.length > 0) targeting.interests = state.detailedTargeting;
            if (state.detailedExclusions.length > 0) {
                targeting.exclusions = { interests: state.detailedExclusions };
            }
            if (state.customAudiences.length > 0) targeting.custom_audiences = state.customAudiences;
            if (state.excludedCustomAudiences.length > 0) {
                targeting.excluded_custom_audiences = state.excludedCustomAudiences;
            }
            if (!state.advantagePlacements) {
                targeting.publisher_platforms = state.platforms;
                if (state.facebookPositions.length) targeting.facebook_positions = state.facebookPositions;
                if (state.instagramPositions.length) targeting.instagram_positions = state.instagramPositions;
                targeting.device_platforms = state.devices;
            } else {
                targeting.targeting_optimization = 'expansion_all';
            }
            if (state.mobileOS !== 'all') targeting.user_os = [state.mobileOS === 'ios' ? 'iOS' : 'Android'];
            if (state.onlyWifi) targeting.wireless_carrier = ['Wifi'];

            const adSetRes = await createAdSet(activeAccount.account_id, {
                name: state.adSetName,
                campaign_id: campaignRes.data.id,
                status: 'PAUSED',
                daily_budget: !state.cbo && state.adSetBudgetType === 'DAILY'
                    ? Math.round(Number(state.adSetBudget) * 100)
                    : undefined,
                lifetime_budget: !state.cbo && state.adSetBudgetType === 'LIFETIME'
                    ? Math.round(Number(state.adSetBudget) * 100)
                    : undefined,
                billing_event: 'IMPRESSIONS',
                optimization_goal: state.performanceGoal,
                targeting,
                start_time: state.startDate || undefined,
                end_time: state.endDate || undefined,
                pacing_type: state.pacing === 'accelerated' ? ['no_pacing'] : ['standard'],
                promoted_object:
                    state.pixelId || state.conversionEvent
                        ? {
                              pixel_id: state.pixelId || undefined,
                              custom_event_type: state.conversionEvent || undefined,
                          }
                        : undefined,
                attribution_spec: state.attributionClickWindow
                    ? [
                          {
                              event_type: 'CLICK_THROUGH',
                              window_days: state.attributionClickWindow === '7_day_click' ? 7 : 1,
                          },
                      ]
                    : undefined,
            });
            if (adSetRes.error || !adSetRes.data?.id) throw new Error(adSetRes.error);

            // 3. Creative
            const creativeObjectStorySpec: any = {
                page_id: state.facebookPageId,
                instagram_actor_id: state.instagramActorId || undefined,
            };

            if (state.adFormat === 'CAROUSEL' && state.carouselCards.length > 0) {
                creativeObjectStorySpec.link_data = {
                    message: state.primaryTexts[0],
                    link: state.destinationUrl,
                    child_attachments: state.carouselCards.map((c) => ({
                        name: c.name,
                        description: c.description,
                        link: c.link || state.destinationUrl,
                        image_hash: c.image_hash,
                        image_url: c.image_url,
                        call_to_action: { type: state.callToAction, value: { link: c.link || state.destinationUrl } },
                    })),
                    multi_share_optimized: true,
                };
            } else if (state.adFormat === 'VIDEO' && state.videoId) {
                creativeObjectStorySpec.video_data = {
                    video_id: state.videoId,
                    title: state.headlines[0],
                    message: state.primaryTexts[0],
                    call_to_action: {
                        type: state.callToAction,
                        value: { link: state.destinationUrl },
                    },
                };
            } else {
                creativeObjectStorySpec.link_data = {
                    message: state.primaryTexts[0],
                    name: state.headlines[0],
                    description: state.descriptions[0],
                    link: state.destinationUrl,
                    ...(state.imageHash
                        ? { image_hash: state.imageHash }
                        : { image_url: 'https://placehold.co/1200x628.png' }),
                    call_to_action: {
                        type: state.callToAction,
                        value: { link: state.destinationUrl },
                    },
                };
            }

            const creativeRes = await createCreative(activeAccount.account_id, {
                name: `${state.adName} creative`,
                object_story_spec: creativeObjectStorySpec,
                url_tags: state.urlParameters || undefined,
            });
            if (creativeRes.error || !creativeRes.data?.id) throw new Error(creativeRes.error);

            // 4. Ad
            const adRes = await createAd(activeAccount.account_id, {
                name: state.adName,
                adset_id: adSetRes.data.id,
                creative_id: creativeRes.data.id,
                status: 'PAUSED',
                tracking_specs: state.pixelEventsTracking.length
                    ? state.pixelEventsTracking.map((e) => ({
                          action: { type: [e] },
                          fb_pixel: [state.pixelId],
                      }))
                    : undefined,
            });
            if (adRes.error) throw new Error(adRes.error);

            toast({
                title: 'Campaign created',
                description: `${state.campaignName} is paused. Activate it from the campaigns page.`,
                tone: 'success',
            });
            router.push('/dashboard/ad-manager/campaigns');
        } catch (e: any) {
            toast({ title: 'Create failed', description: e?.message, tone: 'danger' });
        } finally {
            setSubmitting(false);
        }
    };

    if (accountLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Spinner size="lg" label="Loading account" />
            </div>
        );
    }

    if (!activeAccount) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Create" parent={{ label: 'Campaigns', href: '/dashboard/ad-manager/campaigns' }} />
                <EmptyState
                    icon={AlertCircle}
                    tone="warning"
                    title="No ad account"
                    description="Pick an ad account before creating a campaign."
                    action={
                        <Button variant="primary" onClick={() => router.push('/dashboard/ad-manager/ad-accounts')}>
                            Go to Ad accounts
                        </Button>
                    }
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Create" parent={{ label: 'Campaigns', href: '/dashboard/ad-manager/campaigns' }} />
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Create new campaign</PageTitle>
                    <PageDescription>{state.buyingType}, {activeAccount.name}</PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <div className="flex gap-4 min-h-[600px]">
                {/* Form card. Full width except at 2xl+ where the preview joins in. */}
                <div className="flex flex-col min-w-0 flex-1 border border-[var(--st-border)] rounded-[var(--st-radius-lg)] bg-[var(--st-bg-secondary)] overflow-hidden">
                    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--st-border)] px-4 py-3">
                        <IconButton
                            label="Back to campaigns"
                            icon={ArrowLeft}
                            onClick={() => router.push('/dashboard/ad-manager/campaigns')}
                        />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate text-[var(--st-text)]">Create new campaign</div>
                            <div className="text-xs text-[var(--st-text-secondary)] truncate">
                                {state.buyingType}, {activeAccount.name}
                            </div>
                        </div>
                        <StepHeader current={step} setCurrent={setStep} max={maxStep} />
                    </div>

                    <div className="flex-1 overflow-visible">
                        <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
                            {issues.length > 0 && (
                                <Alert tone="danger">
                                    <AlertTitle>{issues.length} issue{issues.length > 1 ? 's' : ''} to fix</AlertTitle>
                                    <AlertDescription>
                                        <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                                            {issues.map((i, idx) => (
                                                <li key={idx}>{i.message}</li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {step === 1 && <Step1Campaign state={state} setField={setField} issues={stepIssues} />}
                            {step === 2 && (
                                <Step2AdSet
                                    state={state}
                                    setField={setField}
                                    audiences={audiences}
                                    pixels={pixels}
                                    issues={stepIssues}
                                    activeAccountId={activeAccount.account_id}
                                />
                            )}
                            {step === 3 && (
                                <Step3Ad
                                    state={state}
                                    setField={setField}
                                    pages={pages}
                                    igAccounts={igAccounts}
                                    savedImages={savedImages}
                                    uploading={uploading}
                                    onPickFile={handleFilePicked}
                                    issues={stepIssues}
                                    mediaTab={mediaTab}
                                    setMediaTab={setMediaTab}
                                />
                            )}
                        </div>
                    </div>

                    <div className="border-t border-[var(--st-border)] px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-[var(--st-bg-secondary)]">
                        <Button variant="ghost" size="sm" onClick={goPrev} disabled={step === 1}>
                            Previous
                        </Button>
                        <div className="flex items-center gap-2 order-last sm:order-none w-full sm:w-auto justify-center">
                            <span className="text-xs text-[var(--st-text-secondary)]">Step {step} of 3</span>
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="outline" size="sm" iconLeft={Eye} className="2xl:hidden">
                                        Preview
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="right" className="w-full sm:max-w-[500px] overflow-auto">
                                    <SheetHeader>
                                        <SheetTitle className="flex items-center gap-2">
                                            <Eye className="h-4 w-4" /> Ad preview
                                        </SheetTitle>
                                    </SheetHeader>
                                    <div className="py-4 space-y-4">
                                        <AdPreviewSwitcher state={state} pages={pages} igAccounts={igAccounts} />
                                        {reach && <ReachCard reach={reach} />}
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                        {step < 3 ? (
                            <Button variant="primary" size="sm" onClick={goNext}>
                                Next
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                size="sm"
                                iconLeft={Send}
                                onClick={submit}
                                loading={submitting}
                            >
                                Publish
                            </Button>
                        )}
                    </div>
                </div>

                {/* Inline preview, only at 2xl (1536px+) where there's guaranteed room */}
                <aside className="hidden 2xl:flex flex-col w-[420px] shrink-0 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius-lg)] overflow-hidden">
                    <div className="px-3 py-2 border-b border-[var(--st-border)] text-sm font-medium flex items-center gap-2 shrink-0 text-[var(--st-text)]">
                        <Eye className="h-4 w-4" /> Ad preview
                    </div>
                    <div className="flex-1 overflow-auto p-3 space-y-3">
                        <AdPreviewSwitcher state={state} pages={pages} igAccounts={igAccounts} />
                        {reach && <ReachCard reach={reach} compact />}
                    </div>
                </aside>
            </div>
        </div>
    );
}

// =================================================================
//  Reach estimate card
// =================================================================

function ReachCard({ reach, compact = false }: { reach: { lower: number; upper: number }; compact?: boolean }) {
    return (
        <Card padding="none">
            <CardBody className={compact ? 'p-3 space-y-1.5' : 'p-4 space-y-2'}>
                <div className={cn('text-[var(--st-text-secondary)]', compact ? 'text-[10px]' : 'text-xs')}>
                    Estimated audience
                </div>
                <div className={cn('font-semibold tabular-nums text-[var(--st-text)]', compact ? 'text-base' : 'text-lg')}>
                    {formatNumber(reach.lower)} to {formatNumber(reach.upper)}
                </div>
                <div className="h-1.5 rounded-full bg-[var(--st-bg-muted)] overflow-hidden">
                    <div className="h-full w-3/5 bg-[var(--st-text)]" />
                </div>
                <div className={cn('flex justify-between text-[var(--st-text-secondary)]', compact ? 'text-[9px]' : 'text-[10px]')}>
                    <span>Specific</span><span>Broad</span>
                </div>
            </CardBody>
        </Card>
    );
}

// =================================================================
//  Step header. Numbered stepper.
// =================================================================

function StepHeader({ current, setCurrent, max }: { current: Step; setCurrent: (s: Step) => void; max: Step }) {
    return (
        <div className="flex items-center gap-1 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius-lg)] p-1.5">
            {STEPS.map((s, i) => {
                const active = current === s.id;
                const done = current > s.id;
                const Icon = s.icon;
                const locked = s.id > max;
                return (
                    <React.Fragment key={s.id}>
                        <Button
                            type="button"
                            variant={active ? 'primary' : 'ghost'}
                            size="sm"
                            disabled={locked}
                            onClick={() => setCurrent(s.id)}
                            aria-current={active ? 'step' : undefined}
                        >
                            <Badge
                                tone={active || done ? 'accent' : 'neutral'}
                                kind={active || done ? 'solid' : 'soft'}
                                className="h-5 w-5 p-0 rounded-full flex items-center justify-center text-[11px] font-semibold"
                            >
                                {done ? <Check className="h-3 w-3" /> : s.id}
                            </Badge>
                            <Icon className="h-4 w-4" />
                            <span className="hidden sm:inline">{s.label}</span>
                        </Button>
                        {i < STEPS.length - 1 && <Separator orientation="vertical" className="h-4 w-px" />}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// =================================================================
//  Section wrapper
// =================================================================

function Section({
    title, icon: Icon, description, children, defaultOpen = true,
}: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    description?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    return (
        <Collapsible defaultOpen={defaultOpen}>
            <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <CollapsibleTrigger className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <Icon className="h-4 w-4 text-[var(--st-text)]" />
                    <div className="flex-1">
                        <div className="text-sm font-semibold text-[var(--st-text)]">{title}</div>
                        {description && <div className="text-xs text-[var(--st-text-secondary)] mt-0.5">{description}</div>}
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="px-4 pb-4 pt-1 space-y-4">{children}</div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}

function fieldError(issues: ValidationIssue[], field: string): string | undefined {
    return issues.find((i) => i.field === field || i.field.startsWith(`${field}.`))?.message;
}

// =================================================================
//  Step 1, Campaign
// =================================================================

function Step1Campaign({
    state, setField, issues,
}: {
    state: CreateFormState;
    setField: <K extends keyof CreateFormState>(k: K, v: CreateFormState[K]) => void;
    issues: ValidationIssue[];
}) {
    return (
        <>
            <div>
                <h2 className="text-xl font-semibold text-[var(--st-text)]">Choose a campaign objective</h2>
                <p className="text-sm text-[var(--st-text-secondary)] mt-1">
                    Tell Meta what result you want so it can optimize delivery for you.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OBJECTIVES.map((obj) => {
                    const selected = state.objective === obj.id;
                    return (
                        <Button
                            key={obj.id}
                            type="button"
                            variant={selected ? 'primary' : 'outline'}
                            onClick={() => setField('objective', obj.id)}
                            aria-pressed={selected}
                            className="!h-auto !justify-start text-left p-4 rounded-[var(--st-radius-lg)]"
                        >
                            <span className="flex flex-col items-start gap-1 w-full">
                                <span className="flex items-center gap-2 w-full">
                                    <Sparkles className="h-4 w-4" />
                                    <span className="font-medium">{obj.label}</span>
                                    {selected && <Check className="ml-auto h-4 w-4" />}
                                </span>
                                <span className="text-xs opacity-80">{obj.description}</span>
                            </span>
                        </Button>
                    );
                })}
            </div>

            <Section title="Campaign details" icon={Settings2}>
                <Field label="Campaign name" error={fieldError(issues, 'campaignName')}>
                    <Input
                        value={state.campaignName}
                        onChange={(e) => setField('campaignName', e.target.value)}
                    />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Special ad category">
                        <Select value={state.specialAdCategory} onValueChange={(v) => setField('specialAdCategory', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {SPECIAL_AD_CATEGORIES.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Buying type">
                        <Select value={state.buyingType} onValueChange={(v) => setField('buyingType', v as any)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AUCTION">Auction</SelectItem>
                                <SelectItem value="RESERVED">Reach and frequency</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                </div>
            </Section>

            <Section title="Campaign budget optimization" icon={Zap}>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--st-text)]">Advantage+ campaign budget</div>
                        <div className="text-xs text-[var(--st-text-secondary)]">
                            Distribute your budget across ad sets for best results.
                        </div>
                    </div>
                    <Switch
                        checked={state.cbo}
                        onCheckedChange={(v) => setField('cbo', v)}
                        aria-label="Advantage+ campaign budget"
                    />
                </div>

                {state.cbo && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Budget type">
                                <Select
                                    value={state.campaignBudgetType}
                                    onValueChange={(v) => setField('campaignBudgetType', v as any)}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DAILY">Daily budget</SelectItem>
                                        <SelectItem value="LIFETIME">Lifetime budget</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Budget amount" error={fieldError(issues, 'campaignBudget')}>
                                <Input
                                    type="number"
                                    value={state.campaignBudget}
                                    onChange={(e) => setField('campaignBudget', e.target.value)}
                                />
                            </Field>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Bid strategy">
                                <Select value={state.bidStrategy} onValueChange={(v) => setField('bidStrategy', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {BID_STRATEGIES.map((b) => (
                                            <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Account spending limit (optional)">
                                <Input
                                    type="number"
                                    value={state.campaignSpendCap}
                                    onChange={(e) => setField('campaignSpendCap', e.target.value)}
                                    placeholder="e.g. 10000"
                                />
                            </Field>
                        </div>
                    </>
                )}
            </Section>

            <Section title="Schedule (optional)" icon={Calendar} defaultOpen={false}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Start date">
                        <Input
                            type="datetime-local"
                            value={state.campaignStartDate}
                            onChange={(e) => setField('campaignStartDate', e.target.value)}
                        />
                    </Field>
                    <Field label="End date" error={fieldError(issues, 'campaignEndDate')}>
                        <Input
                            type="datetime-local"
                            value={state.campaignEndDate}
                            onChange={(e) => setField('campaignEndDate', e.target.value)}
                        />
                    </Field>
                </div>
            </Section>
        </>
    );
}

// =================================================================
//  Step 2, Ad Set
// =================================================================

function Step2AdSet({
    state, setField, audiences, pixels, issues, activeAccountId,
}: {
    state: CreateFormState;
    setField: <K extends keyof CreateFormState>(k: K, v: CreateFormState[K]) => void;
    audiences: CustomAudience[];
    pixels: any[];
    issues: ValidationIssue[];
    activeAccountId: string;
}) {
    const togglePlacement = (id: string) => {
        setField('platforms', state.platforms.includes(id) ? state.platforms.filter((p) => p !== id) : [...state.platforms, id]);
    };
    const toggleCountry = (code: string) => {
        setField('countries', state.countries.includes(code) ? state.countries.filter((c) => c !== code) : [...state.countries, code]);
    };
    const toggleDevice = (d: string) => {
        setField('devices', state.devices.includes(d) ? state.devices.filter((x) => x !== d) : [...state.devices, d]);
    };

    return (
        <>
            <Field label="Ad set name" error={fieldError(issues, 'adSetName')}>
                <Input value={state.adSetName} onChange={(e) => setField('adSetName', e.target.value)} />
            </Field>

            <Section title="Conversion" icon={Target}>
                <Field label="Conversion location">
                    <RadioGroup
                        value={state.conversionLocation}
                        onValueChange={(v) => setField('conversionLocation', v as any)}
                        className="grid grid-cols-2 gap-2"
                    >
                        {[
                            { id: 'website', label: 'Website' },
                            { id: 'app', label: 'App' },
                            { id: 'messenger', label: 'Messenger' },
                            { id: 'whatsapp', label: 'WhatsApp' },
                            { id: 'calls', label: 'Calls' },
                            { id: 'facebook_page', label: 'Facebook Page' },
                        ].map((c) => (
                            <label
                                key={c.id}
                                className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3 cursor-pointer"
                            >
                                <RadioGroupItem value={c.id} label={c.label} />
                            </label>
                        ))}
                    </RadioGroup>
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Performance goal">
                        <Select value={state.performanceGoal} onValueChange={(v) => setField('performanceGoal', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {[
                                    'LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'REACH', 'IMPRESSIONS',
                                    'POST_ENGAGEMENT', 'CONVERSATIONS', 'OFFSITE_CONVERSIONS', 'VALUE',
                                    'LEAD_GENERATION', 'QUALITY_LEAD', 'THRUPLAY', 'APP_INSTALLS',
                                ].map((g) => (
                                    <SelectItem key={g} value={g}>{g.replace(/_/g, ' ')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Pixel (optional)">
                        <Select value={state.pixelId || '__none__'} onValueChange={(v) => setField('pixelId', v === '__none__' ? '' : v)}>
                            <SelectTrigger><SelectValue placeholder="Pick a pixel" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {pixels.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                </div>

                {state.pixelId && (
                    <Field label="Conversion event">
                        <Select value={state.conversionEvent} onValueChange={(v) => setField('conversionEvent', v)}>
                            <SelectTrigger><SelectValue placeholder="Pick an event" /></SelectTrigger>
                            <SelectContent>
                                {[
                                    'PURCHASE', 'ADD_TO_CART', 'INITIATE_CHECKOUT', 'ADD_PAYMENT_INFO',
                                    'VIEW_CONTENT', 'LEAD', 'COMPLETE_REGISTRATION', 'SEARCH',
                                    'ADD_TO_WISHLIST', 'SUBSCRIBE', 'START_TRIAL', 'CONTACT', 'OTHER',
                                ].map((e) => (
                                    <SelectItem key={e} value={e}>{e.replace(/_/g, ' ')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                )}
            </Section>

            <Section title="Budget & schedule" icon={DollarSign}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Budget type">
                        <Select
                            value={state.adSetBudgetType}
                            onValueChange={(v) => setField('adSetBudgetType', v as any)}
                            disabled={state.cbo}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DAILY">Daily budget</SelectItem>
                                <SelectItem value="LIFETIME">Lifetime budget</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Budget" error={fieldError(issues, 'adSetBudget')}>
                        <Input
                            type="number"
                            value={state.adSetBudget}
                            onChange={(e) => setField('adSetBudget', e.target.value)}
                            disabled={state.cbo}
                        />
                    </Field>
                    <Field label="Start date">
                        <Input
                            type="datetime-local"
                            value={state.startDate}
                            onChange={(e) => setField('startDate', e.target.value)}
                        />
                    </Field>
                    <Field label="End date" error={fieldError(issues, 'endDate')}>
                        <Input
                            type="datetime-local"
                            value={state.endDate}
                            onChange={(e) => setField('endDate', e.target.value)}
                        />
                    </Field>
                    <Field label="Attribution window">
                        <Select
                            value={state.attributionClickWindow}
                            onValueChange={(v) => setField('attributionClickWindow', v as any)}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7_day_click">7-day click</SelectItem>
                                <SelectItem value="1_day_click">1-day click</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Pacing">
                        <Select value={state.pacing} onValueChange={(v) => setField('pacing', v as any)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="standard">Standard (even)</SelectItem>
                                <SelectItem value="accelerated">Accelerated</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Frequency cap (impressions)">
                        <Input
                            type="number"
                            value={state.frequencyCapImpressions}
                            onChange={(e) => setField('frequencyCapImpressions', e.target.value)}
                            placeholder="e.g. 3"
                        />
                    </Field>
                    <Field label="Per (days)">
                        <Input
                            type="number"
                            value={state.frequencyCapDays}
                            onChange={(e) => setField('frequencyCapDays', e.target.value)}
                            placeholder="e.g. 7"
                        />
                    </Field>
                </div>
            </Section>

            <Section title="Audience" icon={Users}>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--st-text)]">Advantage+ audience</div>
                        <div className="text-xs text-[var(--st-text-secondary)]">
                            Let Meta find your audience automatically. Recommended for most campaigns.
                        </div>
                    </div>
                    <Switch
                        checked={state.advantageAudience}
                        onCheckedChange={(v) => setField('advantageAudience', v)}
                        aria-label="Advantage+ audience"
                    />
                </div>

                {!state.advantageAudience && (
                    <>
                        <Field label="Custom audiences">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start">
                                        {state.customAudiences.length > 0
                                            ? `${state.customAudiences.length} selected`
                                            : 'Pick custom audiences...'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[380px]">
                                    <Command>
                                        <CommandInput placeholder="Search audiences..." />
                                        <CommandList>
                                            <CommandEmpty>No audiences.</CommandEmpty>
                                            <CommandGroup>
                                                {audiences.map((a) => {
                                                    const sel = state.customAudiences.some((x) => x.id === a.id);
                                                    return (
                                                        <CommandItem
                                                            key={a.id}
                                                            onSelect={() => {
                                                                setField(
                                                                    'customAudiences',
                                                                    sel
                                                                        ? state.customAudiences.filter((x) => x.id !== a.id)
                                                                        : [...state.customAudiences, { id: a.id, name: a.name }],
                                                                );
                                                            }}
                                                        >
                                                            <Check className={cn('h-4 w-4 mr-2', sel ? 'opacity-100' : 'opacity-0')} />
                                                            {a.name}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {state.customAudiences.map((a) => (
                                    <Tag
                                        key={a.id}
                                        onRemove={() =>
                                            setField(
                                                'customAudiences',
                                                state.customAudiences.filter((x) => x.id !== a.id),
                                            )
                                        }
                                        removeLabel={`Remove ${a.name}`}
                                    >
                                        {a.name}
                                    </Tag>
                                ))}
                            </div>
                        </Field>

                        <Field label="Locations" error={fieldError(issues, 'countries')}>
                            <div className="flex flex-wrap gap-1.5">
                                {COUNTRIES.map((c) => {
                                    const selected = state.countries.includes(c.code);
                                    return (
                                        <Button
                                            key={c.code}
                                            type="button"
                                            size="sm"
                                            variant={selected ? 'primary' : 'outline'}
                                            onClick={() => toggleCountry(c.code)}
                                            aria-pressed={selected}
                                            className="rounded-full"
                                        >
                                            {c.name}
                                        </Button>
                                    );
                                })}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[var(--st-text-secondary)] mt-2">
                                <span>Include:</span>
                                {['home', 'recent', 'travel_in'].map((lt) => (
                                    <Checkbox
                                        key={lt}
                                        size="sm"
                                        label={lt.replace('_', ' ')}
                                        checked={state.locationTypes.includes(lt)}
                                        onChange={(e) =>
                                            setField(
                                                'locationTypes',
                                                e.target.checked
                                                    ? [...state.locationTypes, lt]
                                                    : state.locationTypes.filter((x) => x !== lt),
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Age range" error={fieldError(issues, 'minAge')}>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        value={state.minAge}
                                        min={13}
                                        max={65}
                                        onChange={(e) => setField('minAge', Number(e.target.value))}
                                        aria-label="Minimum age"
                                        className="w-20"
                                    />
                                    <span className="text-[var(--st-text-secondary)]">to</span>
                                    <Input
                                        type="number"
                                        value={state.maxAge}
                                        min={13}
                                        max={65}
                                        onChange={(e) => setField('maxAge', Number(e.target.value))}
                                        aria-label="Maximum age"
                                        className="w-20"
                                    />
                                </div>
                            </Field>
                            <Field label="Gender">
                                <Select value={state.gender} onValueChange={(v) => setField('gender', v as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="male">Men</SelectItem>
                                        <SelectItem value="female">Women</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>

                        <DetailedTargetingPicker
                            label="Detailed targeting (interests, behaviors, demographics)"
                            activeAccountId={activeAccountId}
                            selected={state.detailedTargeting}
                            onChange={(v) => setField('detailedTargeting', v)}
                        />
                        <DetailedTargetingPicker
                            label="Exclude people who match"
                            activeAccountId={activeAccountId}
                            selected={state.detailedExclusions}
                            onChange={(v) => setField('detailedExclusions', v)}
                        />

                        <Field label="Languages">
                            <div className="flex flex-wrap gap-1.5">
                                {LANGUAGES.map((l) => {
                                    const sel = state.languages.includes(l.id);
                                    return (
                                        <Button
                                            key={l.id}
                                            type="button"
                                            size="sm"
                                            variant={sel ? 'primary' : 'outline'}
                                            aria-pressed={sel}
                                            onClick={() =>
                                                setField(
                                                    'languages',
                                                    sel ? state.languages.filter((x) => x !== l.id) : [...state.languages, l.id],
                                                )
                                            }
                                            className="rounded-full"
                                        >
                                            {l.name}
                                        </Button>
                                    );
                                })}
                            </div>
                        </Field>
                    </>
                )}
            </Section>

            <Section title="Placements" icon={Smartphone}>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--st-text)]">Advantage+ placements</div>
                        <div className="text-xs text-[var(--st-text-secondary)]">
                            Show your ads where they're likely to perform best. Recommended.
                        </div>
                    </div>
                    <Switch
                        checked={state.advantagePlacements}
                        onCheckedChange={(v) => setField('advantagePlacements', v)}
                        aria-label="Advantage+ placements"
                    />
                </div>

                {!state.advantagePlacements && (
                    <>
                        <Field label="Devices">
                            <div className="flex gap-2">
                                {['mobile', 'desktop'].map((d) => (
                                    <label
                                        key={d}
                                        className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3 cursor-pointer flex-1"
                                    >
                                        <Checkbox
                                            checked={state.devices.includes(d)}
                                            onChange={() => toggleDevice(d)}
                                            label={<span className="capitalize">{d}</span>}
                                        />
                                    </label>
                                ))}
                            </div>
                        </Field>

                        <Field label="Platforms" error={fieldError(issues, 'platforms')}>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'facebook', label: 'Facebook', icon: Facebook },
                                    { id: 'instagram', label: 'Instagram', icon: Instagram },
                                    { id: 'messenger', label: 'Messenger', icon: MessageSquare },
                                    { id: 'audience_network', label: 'Audience Network', icon: Globe },
                                ].map((p) => {
                                    const Icon = p.icon;
                                    return (
                                        <label
                                            key={p.id}
                                            className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3 cursor-pointer"
                                        >
                                            <Checkbox
                                                checked={state.platforms.includes(p.id)}
                                                onChange={() => togglePlacement(p.id)}
                                                label={
                                                    <span className="flex items-center gap-2">
                                                        <Icon className="h-4 w-4" />
                                                        {p.label}
                                                    </span>
                                                }
                                            />
                                        </label>
                                    );
                                })}
                            </div>
                        </Field>

                        {state.platforms.includes('facebook') && (
                            <Field label="Facebook positions">
                                <div className="flex flex-wrap gap-1.5">
                                    {FACEBOOK_POSITIONS.map((p) => {
                                        const sel = state.facebookPositions.includes(p);
                                        return (
                                            <Button
                                                key={p}
                                                type="button"
                                                size="sm"
                                                variant={sel ? 'primary' : 'outline'}
                                                aria-pressed={sel}
                                                onClick={() =>
                                                    setField(
                                                        'facebookPositions',
                                                        sel
                                                            ? state.facebookPositions.filter((x) => x !== p)
                                                            : [...state.facebookPositions, p],
                                                    )
                                                }
                                                className="rounded-full"
                                            >
                                                {p.replace(/_/g, ' ')}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </Field>
                        )}

                        {state.platforms.includes('instagram') && (
                            <Field label="Instagram positions">
                                <div className="flex flex-wrap gap-1.5">
                                    {INSTAGRAM_POSITIONS.map((p) => {
                                        const sel = state.instagramPositions.includes(p);
                                        return (
                                            <Button
                                                key={p}
                                                type="button"
                                                size="sm"
                                                variant={sel ? 'primary' : 'outline'}
                                                aria-pressed={sel}
                                                onClick={() =>
                                                    setField(
                                                        'instagramPositions',
                                                        sel
                                                            ? state.instagramPositions.filter((x) => x !== p)
                                                            : [...state.instagramPositions, p],
                                                    )
                                                }
                                                className="rounded-full"
                                            >
                                                {p.replace(/_/g, ' ')}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </Field>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Mobile OS">
                                <Select value={state.mobileOS} onValueChange={(v) => setField('mobileOS', v as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="ios">iOS only</SelectItem>
                                        <SelectItem value="android">Android only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Brand safety">
                                <Select
                                    value={state.brandSafetyInventoryFilter}
                                    onValueChange={(v) => setField('brandSafetyInventoryFilter', v as any)}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="FULL_INVENTORY">Full inventory</SelectItem>
                                        <SelectItem value="STANDARD_INVENTORY">Standard inventory</SelectItem>
                                        <SelectItem value="LIMITED_INVENTORY">Limited inventory</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>

                        <Checkbox
                            checked={state.onlyWifi}
                            onChange={(e) => setField('onlyWifi', e.target.checked)}
                            label="Only when connected to Wi-Fi"
                        />
                    </>
                )}
            </Section>
        </>
    );
}

function DetailedTargetingPicker({
    label, activeAccountId, selected, onChange,
}: {
    label: string;
    activeAccountId: string;
    selected: Array<{ id: string; name: string; type?: string }>;
    onChange: (v: Array<{ id: string; name: string; type?: string }>) => void;
}) {
    const [query, setQuery] = React.useState('');
    const [results, setResults] = React.useState<any[]>([]);
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        if (!query || query.length < 2) { setResults([]); return; }
        const handle = setTimeout(async () => {
            const res = await searchTargeting(query, 'adinterest');
            setResults(res.data || []);
        }, 300);
        return () => clearTimeout(handle);
    }, [query]);

    return (
        <Field label={label}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-[var(--st-text-secondary)] font-normal">
                        Search interests, behaviors, demographics...
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[400px]">
                    <Command shouldFilter={false}>
                        <CommandInput value={query} onValueChange={setQuery} placeholder="e.g. yoga, luxury cars..." />
                        <CommandList>
                            {results.length === 0 && <CommandEmpty>Start typing to search.</CommandEmpty>}
                            <CommandGroup>
                                {results.map((r) => {
                                    const sel = selected.some((s) => s.id === r.id);
                                    return (
                                        <CommandItem
                                            key={r.id}
                                            onSelect={() => {
                                                onChange(
                                                    sel
                                                        ? selected.filter((s) => s.id !== r.id)
                                                        : [...selected, { id: r.id, name: r.name, type: r.type }],
                                                );
                                            }}
                                        >
                                            <Check className={cn('h-4 w-4 mr-2', sel ? 'opacity-100' : 'opacity-0')} />
                                            <span className="flex-1">{r.name}</span>
                                            <span className="text-[10px] text-[var(--st-text-secondary)] ml-2">
                                                {r.audience_size_lower_bound ? formatNumber(r.audience_size_lower_bound) : ''}
                                            </span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <div className="flex flex-wrap gap-1">
                {selected.map((s) => (
                    <Tag
                        key={s.id}
                        onRemove={() => onChange(selected.filter((x) => x.id !== s.id))}
                        removeLabel={`Remove ${s.name}`}
                    >
                        {s.name}
                    </Tag>
                ))}
            </div>
        </Field>
    );
}

// =================================================================
//  Step 3, Ad
// =================================================================

function Step3Ad({
    state, setField, pages, igAccounts, savedImages, uploading, onPickFile, issues,
    mediaTab, setMediaTab,
}: {
    state: CreateFormState;
    setField: <K extends keyof CreateFormState>(k: K, v: CreateFormState[K]) => void;
    pages: FacebookPage[];
    igAccounts: any[];
    savedImages: any[];
    uploading: boolean;
    onPickFile: (file: File) => void | Promise<void>;
    issues: ValidationIssue[];
    mediaTab: 'upload' | 'library';
    setMediaTab: (v: 'upload' | 'library') => void;
}) {
    const addPrimaryText = () => setField('primaryTexts', [...state.primaryTexts, '']);
    const addHeadline = () => setField('headlines', [...state.headlines, '']);
    const addDescription = () => setField('descriptions', [...state.descriptions, '']);

    return (
        <>
            <Field label="Ad name" error={fieldError(issues, 'adName')}>
                <Input value={state.adName} onChange={(e) => setField('adName', e.target.value)} />
            </Field>

            <Section title="Identity" icon={Facebook}>
                <Field label="Facebook page" error={fieldError(issues, 'facebookPageId')}>
                    <Select value={state.facebookPageId} onValueChange={(v) => setField('facebookPageId', v)}>
                        <SelectTrigger><SelectValue placeholder="Pick a page" /></SelectTrigger>
                        <SelectContent>
                            {pages.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                {igAccounts.length > 0 && (
                    <Field label="Instagram account">
                        <Select value={state.instagramActorId} onValueChange={(v) => setField('instagramActorId', v)}>
                            <SelectTrigger><SelectValue placeholder="Pick IG account" /></SelectTrigger>
                            <SelectContent>
                                {igAccounts.map((ig) => (
                                    <SelectItem key={ig.id} value={ig.id}>@{ig.username || ig.id}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                )}

                <Field label="Branded content sponsor (optional)">
                    <Input
                        value={state.brandedContentSponsorId}
                        onChange={(e) => setField('brandedContentSponsorId', e.target.value)}
                        placeholder="Sponsor page ID"
                    />
                </Field>
            </Section>

            <Section title="Ad setup" icon={Settings2}>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--st-text)]">Use an existing post</div>
                        <div className="text-xs text-[var(--st-text-secondary)]">Promote a post you already published.</div>
                    </div>
                    <Switch
                        checked={state.useExistingPost}
                        onCheckedChange={(v) => setField('useExistingPost', v)}
                        aria-label="Use an existing post"
                    />
                </div>

                {state.useExistingPost ? (
                    <Field label="Post ID" error={fieldError(issues, 'existingPostId')}>
                        <Input
                            value={state.existingPostId}
                            onChange={(e) => setField('existingPostId', e.target.value)}
                            placeholder="e.g. 123456789012345_987654321"
                        />
                    </Field>
                ) : (
                    <Field label="Ad format">
                        <RadioGroup
                            value={state.adFormat}
                            onValueChange={(v) => setField('adFormat', v as any)}
                            className="grid grid-cols-2 sm:grid-cols-3 gap-2"
                        >
                            {[
                                { id: 'SINGLE_IMAGE', label: 'Single image or video' },
                                { id: 'CAROUSEL', label: 'Carousel' },
                                { id: 'COLLECTION', label: 'Collection' },
                            ].map((f) => (
                                <label
                                    key={f.id}
                                    className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3 cursor-pointer"
                                >
                                    <RadioGroupItem value={f.id} label={f.label} />
                                </label>
                            ))}
                        </RadioGroup>
                    </Field>
                )}
            </Section>

            {!state.useExistingPost && (
                <>
                    <Section title="Media" icon={ImageIcon}>
                        {state.adFormat === 'SINGLE_IMAGE' && (
                            <div>
                                <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)]">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={mediaTab === 'upload' ? 'primary' : 'ghost'}
                                        onClick={() => setMediaTab('upload')}
                                    >
                                        Upload new
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={mediaTab === 'library' ? 'primary' : 'ghost'}
                                        onClick={() => setMediaTab('library')}
                                    >
                                        From library
                                    </Button>
                                </div>

                                {mediaTab === 'upload' && (
                                    <div className="pt-3">
                                        <div className="border-2 border-dashed border-[var(--st-border)] rounded-[var(--st-radius-lg)] p-8 text-center">
                                            {state.imageUrl ? (
                                                <div className="space-y-3">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={state.imageUrl}
                                                        alt="Selected ad creative"
                                                        className="max-h-48 mx-auto rounded-[var(--st-radius)] border border-[var(--st-border)]"
                                                    />
                                                    <Button variant="outline" size="sm" onClick={() => { setField('imageUrl', ''); setField('imageHash', ''); }}>
                                                        Replace image
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <ImageIcon className="h-10 w-10 mx-auto text-[var(--st-text-secondary)]" />
                                                    <p className="text-sm font-medium text-[var(--st-text)]">Choose an image from SabFiles</p>
                                                    <p className="text-xs text-[var(--st-text-secondary)]">PNG, JPG up to 30MB</p>
                                                    <SabFileToFileButton
                                                        accept="image"
                                                        variant="outline"
                                                        onPickFile={(file) => onPickFile(file)}
                                                    >
                                                        {uploading ? 'Uploading...' : 'Choose image'}
                                                    </SabFileToFileButton>
                                                </div>
                                            )}
                                        </div>
                                        {fieldError(issues, 'imageUrl') && (
                                            <p className="flex items-center gap-1 text-xs text-[var(--st-danger)] mt-1">
                                                <AlertTriangle className="h-3 w-3" /> {fieldError(issues, 'imageUrl')}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {mediaTab === 'library' && (
                                    <div className="pt-3">
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-auto">
                                            {savedImages.map((img) => {
                                                const selected = state.imageHash === img.hash;
                                                return (
                                                    <Button
                                                        key={img.hash}
                                                        type="button"
                                                        variant={selected ? 'primary' : 'outline'}
                                                        aria-pressed={selected}
                                                        onClick={() => {
                                                            setField('imageHash', img.hash);
                                                            setField('imageUrl', img.url);
                                                        }}
                                                        className="!p-0 aspect-square overflow-hidden rounded-[var(--st-radius)]"
                                                    >
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={img.url} alt="Saved ad creative" className="w-full h-full object-cover" />
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {state.adFormat === 'CAROUSEL' && (
                            <Field label="Carousel cards (min 2, max 10)" error={fieldError(issues, 'carouselCards')}>
                                {state.carouselCards.map((card, idx) => (
                                    <Card key={idx} padding="none">
                                        <CardBody className="p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium text-[var(--st-text)]">Card {idx + 1}</span>
                                                <IconButton
                                                    label={`Remove card ${idx + 1}`}
                                                    icon={Trash2}
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        setField(
                                                            'carouselCards',
                                                            state.carouselCards.filter((_, i) => i !== idx),
                                                        )
                                                    }
                                                />
                                            </div>
                                            <Input
                                                placeholder="Headline"
                                                aria-label={`Card ${idx + 1} headline`}
                                                value={card.name}
                                                onChange={(e) => {
                                                    const next = [...state.carouselCards];
                                                    next[idx] = { ...card, name: e.target.value };
                                                    setField('carouselCards', next);
                                                }}
                                            />
                                            <Input
                                                placeholder="Description"
                                                aria-label={`Card ${idx + 1} description`}
                                                value={card.description || ''}
                                                onChange={(e) => {
                                                    const next = [...state.carouselCards];
                                                    next[idx] = { ...card, description: e.target.value };
                                                    setField('carouselCards', next);
                                                }}
                                            />
                                            <Input
                                                placeholder="Destination URL"
                                                aria-label={`Card ${idx + 1} destination URL`}
                                                value={card.link || ''}
                                                onChange={(e) => {
                                                    const next = [...state.carouselCards];
                                                    next[idx] = { ...card, link: e.target.value };
                                                    setField('carouselCards', next);
                                                }}
                                            />
                                        </CardBody>
                                    </Card>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    iconLeft={Plus}
                                    onClick={() =>
                                        setField('carouselCards', [...state.carouselCards, { name: '', description: '', link: '' }])
                                    }
                                    disabled={state.carouselCards.length >= 10}
                                >
                                    Add card
                                </Button>
                            </Field>
                        )}
                    </Section>

                    <Section title="Primary text, headline & description" icon={Sparkles}>
                        <Field
                            label={
                                <span className="flex items-center justify-between w-full">
                                    Primary text
                                    <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addPrimaryText}>
                                        Add variant
                                    </Button>
                                </span>
                            }
                            error={fieldError(issues, 'primaryTexts')}
                        >
                            <div className="space-y-2">
                                {state.primaryTexts.map((t, i) => (
                                    <Textarea
                                        key={i}
                                        value={t}
                                        aria-label={`Primary text ${i + 1}`}
                                        onChange={(e) => {
                                            const next = [...state.primaryTexts];
                                            next[i] = e.target.value;
                                            setField('primaryTexts', next);
                                        }}
                                        placeholder={`Primary text ${i + 1}`}
                                        maxLength={2200}
                                        className="min-h-20"
                                    />
                                ))}
                            </div>
                        </Field>

                        <Field
                            label={
                                <span className="flex items-center justify-between w-full">
                                    Headline
                                    <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addHeadline}>
                                        Add variant
                                    </Button>
                                </span>
                            }
                            error={fieldError(issues, 'headlines')}
                        >
                            <div className="space-y-2">
                                {state.headlines.map((h, i) => (
                                    <Input
                                        key={i}
                                        value={h}
                                        maxLength={40}
                                        aria-label={`Headline ${i + 1}`}
                                        onChange={(e) => {
                                            const next = [...state.headlines];
                                            next[i] = e.target.value;
                                            setField('headlines', next);
                                        }}
                                        placeholder="Max 40 characters"
                                    />
                                ))}
                            </div>
                        </Field>

                        <Field
                            label={
                                <span className="flex items-center justify-between w-full">
                                    Description
                                    <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addDescription}>
                                        Add variant
                                    </Button>
                                </span>
                            }
                            error={fieldError(issues, 'descriptions')}
                        >
                            <div className="space-y-2">
                                {state.descriptions.map((d, i) => (
                                    <Input
                                        key={i}
                                        value={d}
                                        maxLength={30}
                                        aria-label={`Description ${i + 1}`}
                                        onChange={(e) => {
                                            const next = [...state.descriptions];
                                            next[i] = e.target.value;
                                            setField('descriptions', next);
                                        }}
                                        placeholder="Max 30 characters"
                                    />
                                ))}
                            </div>
                        </Field>
                    </Section>

                    <Section title="Destination" icon={Target}>
                        <Field label="Destination URL" error={fieldError(issues, 'destinationUrl')}>
                            <Input
                                type="url"
                                value={state.destinationUrl}
                                onChange={(e) => setField('destinationUrl', e.target.value)}
                                placeholder="https://"
                            />
                        </Field>
                        <Field label="Display link (optional)">
                            <Input
                                value={state.displayLink}
                                onChange={(e) => setField('displayLink', e.target.value)}
                                placeholder="example.com/offer"
                            />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Call to action">
                                <Select value={state.callToAction} onValueChange={(v) => setField('callToAction', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CALL_TO_ACTIONS.map((c) => (
                                            <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="URL parameters (UTM)">
                                <Input
                                    value={state.urlParameters}
                                    onChange={(e) => setField('urlParameters', e.target.value)}
                                    placeholder="utm_source=facebook&utm_medium=paid"
                                />
                            </Field>
                        </div>
                    </Section>
                </>
            )}
        </>
    );
}
