'use client';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCheckbox,
  ZoruCollapsible,
  ZoruCollapsibleContent,
  ZoruCollapsibleTrigger,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  ZoruInput,
  ZoruLabel,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruRadioGroup,
  ZoruRadioGroupItem,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSeparator,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetTrigger,
  ZoruSwitch,
  ZoruTextarea,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
    ArrowLeft,
  Megaphone,
  Layers,
  Image as ImageIcon,
  Check,
  LoaderCircle,
  Send,
  AlertCircle,
  Info,
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
  Upload,
  Eye,
  AlertTriangle,
  } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';

import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import {
    createCampaign, createAdSet, createCreative, createAd,
    getFacebookPagesForAdCreation, uploadAdImage, getReachEstimate,
    searchTargeting, listPixels, getCustomAudiences,
    listAdImages, getInstagramAccountsForPage,
} from '@/app/actions/ad-manager.actions';
import type { FacebookPage, CustomAudience } from '@/lib/definitions';
import {
    OBJECTIVES, BID_STRATEGIES, COUNTRIES, CALL_TO_ACTIONS,
    SPECIAL_AD_CATEGORIES, FACEBOOK_POSITIONS, INSTAGRAM_POSITIONS,
    formatMoney, formatNumber,
} from '@/components/wabasimplify/ad-manager/constants';
import {
    initialFormState, validateStep1, validateStep2, validateStep3,
    type CreateFormState, type ValidationIssue,
} from '@/components/wabasimplify/ad-manager/create-wizard/form-state';
import { AdPreviewSwitcher } from '@/components/wabasimplify/ad-manager/create-wizard/ad-previews';

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
    const router = useRouter();
    const { toast } = useToast();
    const { activeAccount } = useAdManager();

    const [step, setStep] = React.useState<Step>(1);
    const [maxStep, setMaxStep] = React.useState<Step>(1);
    const [state, setState] = React.useState<CreateFormState>(initialFormState);
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
            toast({ title: 'Fix the errors before continuing', variant: 'destructive' });
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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeAccount) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('adAccountId', activeAccount.account_id);
        const res = await uploadAdImage(fd);
        setUploading(false);
        if (res.error) {
            toast({ title: 'Upload failed', description: res.error, variant: 'destructive' });
            return;
        }
        setField('imageHash', res.imageHash || '');
        setField('imageUrl', res.imageUrl || '');
        toast({ title: 'Image uploaded' });
    };

    const submit = async () => {
        if (!activeAccount) return;
        const all = [...validateStep1(state), ...validateStep2(state), ...validateStep3(state)];
        setIssues(all);
        if (all.length > 0) {
            toast({ title: 'Fix the errors before publishing', variant: 'destructive' });
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
            });
            router.push('/dashboard/ad-manager/campaigns');
        } catch (e: any) {
            toast({ title: 'Create failed', description: e?.message, variant: 'destructive' });
        } finally {
            setSubmitting(false);
        }
    };

    if (!activeAccount) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Create" parent={{ label: 'Campaigns', href: '/dashboard/ad-manager/campaigns' }} />
                <ZoruAlert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>No ad account</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account before creating a campaign.</ZoruAlertDescription>
                </ZoruAlert>
                <ZoruButton asChild>
                    <Link href="/dashboard/ad-manager/ad-accounts">Go to Ad accounts</Link>
                </ZoruButton>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Create" parent={{ label: 'Campaigns', href: '/dashboard/ad-manager/campaigns' }} />
            <AmHeader
                title="Create new campaign"
                description={`${state.buyingType} • ${activeAccount.name}`}
            />

            <div className="flex gap-4 min-h-[600px]">
                {/* Form card — always full width except at 2xl+ where preview joins in */}
                <div className="flex flex-col min-w-0 flex-1 border rounded-xl bg-background overflow-hidden">
                    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
                        <ZoruButton variant="ghost" size="icon-sm" asChild>
                            <Link href="/dashboard/ad-manager/campaigns">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </ZoruButton>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">Create new campaign</div>
                            <div className="text-xs text-muted-foreground truncate">
                                {state.buyingType} • {activeAccount.name}
                            </div>
                        </div>
                        <StepHeader current={step} setCurrent={setStep} max={maxStep} />
                    </div>

                    <div className="flex-1 overflow-visible">
                        <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
                            {issues.length > 0 && (
                                <ZoruAlert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <ZoruAlertTitle>{issues.length} issue{issues.length > 1 ? 's' : ''} to fix</ZoruAlertTitle>
                                    <ZoruAlertDescription>
                                        <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                                            {issues.map((i, idx) => (
                                                <li key={idx}>{i.message}</li>
                                            ))}
                                        </ul>
                                    </ZoruAlertDescription>
                                </ZoruAlert>
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
                                    onUpload={handleImageUpload}
                                    issues={stepIssues}
                                    mediaTab={mediaTab}
                                    setMediaTab={setMediaTab}
                                />
                            )}
                        </div>
                    </div>

                    <div className="border-t px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-background">
                        <ZoruButton variant="ghost" size="sm" onClick={goPrev} disabled={step === 1}>
                            Previous
                        </ZoruButton>
                        <div className="flex items-center gap-2 order-last sm:order-none w-full sm:w-auto justify-center">
                            <span className="text-xs text-muted-foreground">Step {step} of 3</span>
                            <ZoruSheet>
                                <ZoruSheetTrigger asChild>
                                    <ZoruButton
                                        variant="outline"
                                        size="sm"
                                        className="2xl:hidden bg-[#1877F2]/5 border-[#1877F2]/30 text-[#1877F2] hover:bg-[#1877F2]/10"
                                    >
                                        <Eye className="h-4 w-4 mr-1" /> Preview
                                    </ZoruButton>
                                </ZoruSheetTrigger>
                                <ZoruSheetContent side="right" className="w-full sm:max-w-[500px] overflow-auto">
                                    <ZoruSheetHeader>
                                        <ZoruSheetTitle className="flex items-center gap-2">
                                            <Eye className="h-4 w-4" /> Ad preview
                                        </ZoruSheetTitle>
                                    </ZoruSheetHeader>
                                    <div className="py-4 space-y-4">
                                        <AdPreviewSwitcher state={state} pages={pages} igAccounts={igAccounts} />
                                        {reach && (
                                            <ZoruCard>
                                                <ZoruCardContent className="p-4 space-y-2">
                                                    <div className="text-xs text-muted-foreground">Estimated audience</div>
                                                    <div className="text-lg font-semibold tabular-nums">
                                                        {formatNumber(reach.lower)} – {formatNumber(reach.upper)}
                                                    </div>
                                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                                        <div className="h-full w-3/5 bg-gradient-to-r from-amber-400 to-green-500" />
                                                    </div>
                                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                                        <span>Specific</span><span>Broad</span>
                                                    </div>
                                                </ZoruCardContent>
                                            </ZoruCard>
                                        )}
                                    </div>
                                </ZoruSheetContent>
                            </ZoruSheet>
                        </div>
                        {step < 3 ? (
                            <ZoruButton size="sm" className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={goNext}>
                                Next
                            </ZoruButton>
                        ) : (
                            <ZoruButton
                                size="sm"
                                className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                                onClick={submit}
                                disabled={submitting}
                            >
                                {submitting && <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />}
                                <Send className="h-4 w-4 mr-2" /> Publish
                            </ZoruButton>
                        )}
                    </div>
                </div>

                {/* Inline preview — only at 2xl (1536px+) where there's guaranteed room */}
                <aside className="hidden 2xl:flex flex-col w-[420px] shrink-0 bg-background border rounded-xl overflow-hidden">
                    <div className="px-3 py-2 border-b text-sm font-medium flex items-center gap-2 shrink-0">
                        <Eye className="h-4 w-4" /> Ad preview
                    </div>
                    <div className="flex-1 overflow-auto p-3 space-y-3">
                        <AdPreviewSwitcher state={state} pages={pages} igAccounts={igAccounts} />
                        {reach && (
                            <ZoruCard>
                                <ZoruCardContent className="p-3 space-y-1.5">
                                    <div className="text-[10px] text-muted-foreground">Estimated audience</div>
                                    <div className="text-base font-semibold tabular-nums">
                                        {formatNumber(reach.lower)} – {formatNumber(reach.upper)}
                                    </div>
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full w-3/5 bg-gradient-to-r from-amber-400 to-green-500" />
                                    </div>
                                    <div className="flex justify-between text-[9px] text-muted-foreground">
                                        <span>Specific</span><span>Broad</span>
                                    </div>
                                </ZoruCardContent>
                            </ZoruCard>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}

// =================================================================
//  Step header — Zoru numbered stepper (no tab primitive in zoruui)
// =================================================================

function StepHeader({ current, setCurrent, max }: { current: Step; setCurrent: (s: Step) => void; max: Step }) {
    return (
        <div className="flex items-center gap-1 bg-background border rounded-xl p-1.5">
            {STEPS.map((s, i) => {
                const active = current === s.id;
                const done = current > s.id;
                const Icon = s.icon;
                return (
                    <React.Fragment key={s.id}>
                        <button
                            type="button"
                            disabled={s.id > max}
                            onClick={() => setCurrent(s.id)}
                            className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                                active && 'bg-[#1877F2] text-white font-medium',
                                !active && done && 'bg-muted hover:bg-muted/80',
                                !active && !done && 'text-muted-foreground hover:bg-muted/60',
                                s.id > max && 'opacity-50 cursor-not-allowed',
                            )}
                        >
                            <ZoruBadge
                                variant="secondary"
                                className={cn(
                                    'h-5 w-5 p-0 rounded-full flex items-center justify-center text-[11px] font-semibold',
                                    active && 'bg-white/20 text-white border-transparent',
                                    !active && done && 'bg-green-500 text-white border-transparent',
                                    !active && !done && 'bg-muted-foreground/20 border-transparent',
                                )}
                            >
                                {done ? <Check className="h-3 w-3" /> : s.id}
                            </ZoruBadge>
                            <Icon className="h-4 w-4" />
                            <span className="hidden sm:inline">{s.label}</span>
                        </button>
                        {i < STEPS.length - 1 && <ZoruSeparator orientation="vertical" className="h-4 w-px" />}
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
        <ZoruCollapsible defaultOpen={defaultOpen}>
            <div className="rounded-xl border bg-background">
                <ZoruCollapsibleTrigger className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 rounded-t-xl data-[state=closed]:rounded-b-xl">
                    <Icon className="h-4 w-4 text-[#1877F2]" />
                    <div className="flex-1">
                        <div className="text-sm font-semibold">{title}</div>
                        {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
                    </div>
                </ZoruCollapsibleTrigger>
                <ZoruCollapsibleContent>
                    <div className="px-4 pb-4 pt-1 space-y-4">{children}</div>
                </ZoruCollapsibleContent>
            </div>
        </ZoruCollapsible>
    );
}

function FieldError({ issue }: { issue?: ValidationIssue }) {
    if (!issue) return null;
    return (
        <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" /> {issue.message}
        </p>
    );
}

// =================================================================
//  Step 1 — Campaign
// =================================================================

function Step1Campaign({
    state, setField, issues,
}: {
    state: CreateFormState;
    setField: <K extends keyof CreateFormState>(k: K, v: CreateFormState[K]) => void;
    issues: ValidationIssue[];
}) {
    const err = (f: string) => issues.find((i) => i.field === f);
    return (
        <>
            <div>
                <h2 className="text-xl font-semibold">Choose a campaign objective</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Tell Meta what result you want so it can optimize delivery for you.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OBJECTIVES.map((obj) => (
                    <button
                        key={obj.id}
                        type="button"
                        onClick={() => setField('objective', obj.id)}
                        className={cn(
                            'text-left p-4 rounded-xl border-2 transition-all bg-background',
                            state.objective === obj.id
                                ? 'border-[#1877F2] ring-2 ring-[#1877F2]/20 shadow-sm'
                                : 'border-border hover:border-[#1877F2]/40',
                        )}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="h-4 w-4 text-[#1877F2]" />
                            <span className="font-medium">{obj.label}</span>
                            {state.objective === obj.id && <Check className="ml-auto h-4 w-4 text-[#1877F2]" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{obj.description}</p>
                    </button>
                ))}
            </div>

            <Section title="Campaign details" icon={Settings2}>
                <div className="space-y-2">
                    <ZoruLabel>Campaign name</ZoruLabel>
                    <ZoruInput
                        value={state.campaignName}
                        onChange={(e) => setField('campaignName', e.target.value)}
                    />
                    <FieldError issue={err('campaignName')} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <ZoruLabel>Special ad category</ZoruLabel>
                        <ZoruSelect value={state.specialAdCategory} onValueChange={(v) => setField('specialAdCategory', v)}>
                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {SPECIAL_AD_CATEGORIES.map((c) => (
                                    <ZoruSelectItem key={c.id} value={c.id}>{c.label}</ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Buying type</ZoruLabel>
                        <ZoruSelect value={state.buyingType} onValueChange={(v) => setField('buyingType', v as any)}>
                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="AUCTION">Auction</ZoruSelectItem>
                                <ZoruSelectItem value="RESERVED">Reach and frequency</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>
            </Section>

            <Section title="Campaign budget optimization" icon={Zap}>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="text-sm font-medium">Advantage+ campaign budget</div>
                        <div className="text-xs text-muted-foreground">
                            Distribute your budget across ad sets for best results.
                        </div>
                    </div>
                    <ZoruSwitch
                        checked={state.cbo}
                        onCheckedChange={(v) => setField('cbo', v)}
                        className="data-[state=checked]:bg-[#1877F2]"
                    />
                </div>

                {state.cbo && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Budget type</ZoruLabel>
                                <ZoruSelect
                                    value={state.campaignBudgetType}
                                    onValueChange={(v) => setField('campaignBudgetType', v as any)}
                                >
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="DAILY">Daily budget</ZoruSelectItem>
                                        <ZoruSelectItem value="LIFETIME">Lifetime budget</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Budget amount</ZoruLabel>
                                <ZoruInput
                                    type="number"
                                    value={state.campaignBudget}
                                    onChange={(e) => setField('campaignBudget', e.target.value)}
                                />
                                <FieldError issue={err('campaignBudget')} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Bid strategy</ZoruLabel>
                                <ZoruSelect value={state.bidStrategy} onValueChange={(v) => setField('bidStrategy', v)}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {BID_STRATEGIES.map((b) => (
                                            <ZoruSelectItem key={b.id} value={b.id}>{b.label}</ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Account spending limit (optional)</ZoruLabel>
                                <ZoruInput
                                    type="number"
                                    value={state.campaignSpendCap}
                                    onChange={(e) => setField('campaignSpendCap', e.target.value)}
                                    placeholder="e.g. 10000"
                                />
                            </div>
                        </div>
                    </>
                )}
            </Section>

            <Section title="Schedule (optional)" icon={Calendar} defaultOpen={false}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <ZoruLabel>Start date</ZoruLabel>
                        <ZoruInput
                            type="datetime-local"
                            value={state.campaignStartDate}
                            onChange={(e) => setField('campaignStartDate', e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>End date</ZoruLabel>
                        <ZoruInput
                            type="datetime-local"
                            value={state.campaignEndDate}
                            onChange={(e) => setField('campaignEndDate', e.target.value)}
                        />
                        <FieldError issue={err('campaignEndDate')} />
                    </div>
                </div>
            </Section>
        </>
    );
}

// =================================================================
//  Step 2 — Ad Set
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
    const err = (f: string) => issues.find((i) => i.field === f);

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
            <div className="space-y-2">
                <ZoruLabel>Ad set name</ZoruLabel>
                <ZoruInput value={state.adSetName} onChange={(e) => setField('adSetName', e.target.value)} />
                <FieldError issue={err('adSetName')} />
            </div>

            <Section title="Conversion" icon={Target}>
                <div className="space-y-2">
                    <ZoruLabel>Conversion location</ZoruLabel>
                    <ZoruRadioGroup
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
                                className={cn(
                                    'flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer',
                                    state.conversionLocation === c.id ? 'border-[#1877F2]' : 'border-border',
                                )}
                            >
                                <ZoruRadioGroupItem value={c.id} />
                                <span className="text-sm">{c.label}</span>
                            </label>
                        ))}
                    </ZoruRadioGroup>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <ZoruLabel>Performance goal</ZoruLabel>
                        <ZoruSelect value={state.performanceGoal} onValueChange={(v) => setField('performanceGoal', v)}>
                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {[
                                    'LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'REACH', 'IMPRESSIONS',
                                    'POST_ENGAGEMENT', 'CONVERSATIONS', 'OFFSITE_CONVERSIONS', 'VALUE',
                                    'LEAD_GENERATION', 'QUALITY_LEAD', 'THRUPLAY', 'APP_INSTALLS',
                                ].map((g) => (
                                    <ZoruSelectItem key={g} value={g}>{g.replace(/_/g, ' ')}</ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Pixel (optional)</ZoruLabel>
                        <ZoruSelect value={state.pixelId || '__none__'} onValueChange={(v) => setField('pixelId', v === '__none__' ? '' : v)}>
                            <ZoruSelectTrigger><ZoruSelectValue placeholder="Pick a pixel" /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="__none__">None</ZoruSelectItem>
                                {pixels.map((p) => (
                                    <ZoruSelectItem key={p.id} value={p.id}>{p.name}</ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>

                {state.pixelId && (
                    <div className="space-y-2">
                        <ZoruLabel>Conversion event</ZoruLabel>
                        <ZoruSelect value={state.conversionEvent} onValueChange={(v) => setField('conversionEvent', v)}>
                            <ZoruSelectTrigger><ZoruSelectValue placeholder="Pick an event" /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {[
                                    'PURCHASE', 'ADD_TO_CART', 'INITIATE_CHECKOUT', 'ADD_PAYMENT_INFO',
                                    'VIEW_CONTENT', 'LEAD', 'COMPLETE_REGISTRATION', 'SEARCH',
                                    'ADD_TO_WISHLIST', 'SUBSCRIBE', 'START_TRIAL', 'CONTACT', 'OTHER',
                                ].map((e) => (
                                    <ZoruSelectItem key={e} value={e}>{e.replace(/_/g, ' ')}</ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                )}
            </Section>

            <Section title="Budget & schedule" icon={DollarSign}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <ZoruLabel>Budget type</ZoruLabel>
                        <ZoruSelect
                            value={state.adSetBudgetType}
                            onValueChange={(v) => setField('adSetBudgetType', v as any)}
                            disabled={state.cbo}
                        >
                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="DAILY">Daily budget</ZoruSelectItem>
                                <ZoruSelectItem value="LIFETIME">Lifetime budget</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Budget</ZoruLabel>
                        <ZoruInput
                            type="number"
                            value={state.adSetBudget}
                            onChange={(e) => setField('adSetBudget', e.target.value)}
                            disabled={state.cbo}
                        />
                        <FieldError issue={err('adSetBudget')} />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Start date</ZoruLabel>
                        <ZoruInput
                            type="datetime-local"
                            value={state.startDate}
                            onChange={(e) => setField('startDate', e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>End date</ZoruLabel>
                        <ZoruInput
                            type="datetime-local"
                            value={state.endDate}
                            onChange={(e) => setField('endDate', e.target.value)}
                        />
                        <FieldError issue={err('endDate')} />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Attribution window</ZoruLabel>
                        <ZoruSelect
                            value={state.attributionClickWindow}
                            onValueChange={(v) => setField('attributionClickWindow', v as any)}
                        >
                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="7_day_click">7-day click</ZoruSelectItem>
                                <ZoruSelectItem value="1_day_click">1-day click</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Pacing</ZoruLabel>
                        <ZoruSelect value={state.pacing} onValueChange={(v) => setField('pacing', v as any)}>
                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="standard">Standard (even)</ZoruSelectItem>
                                <ZoruSelectItem value="accelerated">Accelerated</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Frequency cap (impressions)</ZoruLabel>
                        <ZoruInput
                            type="number"
                            value={state.frequencyCapImpressions}
                            onChange={(e) => setField('frequencyCapImpressions', e.target.value)}
                            placeholder="e.g. 3"
                        />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Per (days)</ZoruLabel>
                        <ZoruInput
                            type="number"
                            value={state.frequencyCapDays}
                            onChange={(e) => setField('frequencyCapDays', e.target.value)}
                            placeholder="e.g. 7"
                        />
                    </div>
                </div>
            </Section>

            <Section title="Audience" icon={Users}>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="text-sm font-medium">Advantage+ audience</div>
                        <div className="text-xs text-muted-foreground">
                            Let Meta find your audience automatically. Recommended for most campaigns.
                        </div>
                    </div>
                    <ZoruSwitch
                        checked={state.advantageAudience}
                        onCheckedChange={(v) => setField('advantageAudience', v)}
                        className="data-[state=checked]:bg-[#1877F2]"
                    />
                </div>

                {!state.advantageAudience && (
                    <>
                        <div className="space-y-2">
                            <ZoruLabel>Custom audiences</ZoruLabel>
                            <ZoruPopover>
                                <ZoruPopoverTrigger asChild>
                                    <ZoruButton variant="outline" className="w-full justify-start">
                                        {state.customAudiences.length > 0
                                            ? `${state.customAudiences.length} selected`
                                            : 'Pick custom audiences…'}
                                    </ZoruButton>
                                </ZoruPopoverTrigger>
                                <ZoruPopoverContent className="p-0 w-[380px]">
                                    <ZoruCommand>
                                        <ZoruCommandInput placeholder="Search audiences…" />
                                        <ZoruCommandList>
                                            <ZoruCommandEmpty>No audiences.</ZoruCommandEmpty>
                                            <ZoruCommandGroup>
                                                {audiences.map((a) => {
                                                    const sel = state.customAudiences.some((x) => x.id === a.id);
                                                    return (
                                                        <ZoruCommandItem
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
                                                        </ZoruCommandItem>
                                                    );
                                                })}
                                            </ZoruCommandGroup>
                                        </ZoruCommandList>
                                    </ZoruCommand>
                                </ZoruPopoverContent>
                            </ZoruPopover>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {state.customAudiences.map((a) => (
                                    <ZoruBadge key={a.id} variant="secondary" className="text-xs">
                                        {a.name}
                                        <button
                                            type="button"
                                            className="ml-1"
                                            onClick={() =>
                                                setField(
                                                    'customAudiences',
                                                    state.customAudiences.filter((x) => x.id !== a.id),
                                                )
                                            }
                                        >
                                            ×
                                        </button>
                                    </ZoruBadge>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel className="flex items-center gap-1">
                                <Globe className="h-3 w-3" /> Locations
                            </ZoruLabel>
                            <div className="flex flex-wrap gap-1.5">
                                {COUNTRIES.map((c) => {
                                    const selected = state.countries.includes(c.code);
                                    return (
                                        <button
                                            key={c.code}
                                            type="button"
                                            onClick={() => toggleCountry(c.code)}
                                            className={cn(
                                                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                                                selected
                                                    ? 'bg-[#1877F2] text-white border-[#1877F2]'
                                                    : 'bg-background hover:bg-muted',
                                            )}
                                        >
                                            {c.name}
                                        </button>
                                    );
                                })}
                            </div>
                            <FieldError issue={err('countries')} />
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                Include:
                                {['home', 'recent', 'travel_in'].map((lt) => (
                                    <label key={lt} className="flex items-center gap-1">
                                        <ZoruCheckbox
                                            checked={state.locationTypes.includes(lt)}
                                            onCheckedChange={(v) =>
                                                setField(
                                                    'locationTypes',
                                                    v ? [...state.locationTypes, lt] : state.locationTypes.filter((x) => x !== lt),
                                                )
                                            }
                                        />
                                        {lt.replace('_', ' ')}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Age range</ZoruLabel>
                                <div className="flex items-center gap-2">
                                    <ZoruInput
                                        type="number"
                                        value={state.minAge}
                                        min={13}
                                        max={65}
                                        onChange={(e) => setField('minAge', Number(e.target.value))}
                                        className="w-20"
                                    />
                                    <span className="text-muted-foreground">to</span>
                                    <ZoruInput
                                        type="number"
                                        value={state.maxAge}
                                        min={13}
                                        max={65}
                                        onChange={(e) => setField('maxAge', Number(e.target.value))}
                                        className="w-20"
                                    />
                                </div>
                                <FieldError issue={err('minAge')} />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Gender</ZoruLabel>
                                <ZoruSelect value={state.gender} onValueChange={(v) => setField('gender', v as any)}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="all">All</ZoruSelectItem>
                                        <ZoruSelectItem value="male">Men</ZoruSelectItem>
                                        <ZoruSelectItem value="female">Women</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
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

                        <div className="space-y-2">
                            <ZoruLabel>Languages</ZoruLabel>
                            <div className="flex flex-wrap gap-1.5">
                                {LANGUAGES.map((l) => {
                                    const sel = state.languages.includes(l.id);
                                    return (
                                        <button
                                            key={l.id}
                                            type="button"
                                            onClick={() =>
                                                setField(
                                                    'languages',
                                                    sel ? state.languages.filter((x) => x !== l.id) : [...state.languages, l.id],
                                                )
                                            }
                                            className={cn(
                                                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                                                sel ? 'bg-[#1877F2] text-white border-[#1877F2]' : 'bg-background hover:bg-muted',
                                            )}
                                        >
                                            {l.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </Section>

            <Section title="Placements" icon={Smartphone}>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="text-sm font-medium">Advantage+ placements</div>
                        <div className="text-xs text-muted-foreground">
                            Show your ads where they're likely to perform best. Recommended.
                        </div>
                    </div>
                    <ZoruSwitch
                        checked={state.advantagePlacements}
                        onCheckedChange={(v) => setField('advantagePlacements', v)}
                        className="data-[state=checked]:bg-[#1877F2]"
                    />
                </div>

                {!state.advantagePlacements && (
                    <>
                        <div className="space-y-2">
                            <ZoruLabel>Devices</ZoruLabel>
                            <div className="flex gap-2">
                                {['mobile', 'desktop'].map((d) => (
                                    <label key={d} className={cn(
                                        'flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer flex-1',
                                        state.devices.includes(d) ? 'border-[#1877F2]' : 'border-border',
                                    )}>
                                        <ZoruCheckbox
                                            checked={state.devices.includes(d)}
                                            onCheckedChange={() => toggleDevice(d)}
                                        />
                                        <span className="text-sm capitalize">{d}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel>Platforms</ZoruLabel>
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
                                            className={cn(
                                                'flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer',
                                                state.platforms.includes(p.id) ? 'border-[#1877F2]' : 'border-border',
                                            )}
                                        >
                                            <ZoruCheckbox
                                                checked={state.platforms.includes(p.id)}
                                                onCheckedChange={() => togglePlacement(p.id)}
                                            />
                                            <Icon className="h-4 w-4" />
                                            <span className="text-sm">{p.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            <FieldError issue={err('platforms')} />
                        </div>

                        {state.platforms.includes('facebook') && (
                            <div className="space-y-2">
                                <ZoruLabel>Facebook positions</ZoruLabel>
                                <div className="flex flex-wrap gap-1.5">
                                    {FACEBOOK_POSITIONS.map((p) => {
                                        const sel = state.facebookPositions.includes(p);
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() =>
                                                    setField(
                                                        'facebookPositions',
                                                        sel
                                                            ? state.facebookPositions.filter((x) => x !== p)
                                                            : [...state.facebookPositions, p],
                                                    )
                                                }
                                                className={cn(
                                                    'text-xs px-2.5 py-1 rounded-full border',
                                                    sel ? 'bg-[#1877F2] text-white border-[#1877F2]' : 'bg-background hover:bg-muted',
                                                )}
                                            >
                                                {p.replace(/_/g, ' ')}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {state.platforms.includes('instagram') && (
                            <div className="space-y-2">
                                <ZoruLabel>Instagram positions</ZoruLabel>
                                <div className="flex flex-wrap gap-1.5">
                                    {INSTAGRAM_POSITIONS.map((p) => {
                                        const sel = state.instagramPositions.includes(p);
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() =>
                                                    setField(
                                                        'instagramPositions',
                                                        sel
                                                            ? state.instagramPositions.filter((x) => x !== p)
                                                            : [...state.instagramPositions, p],
                                                    )
                                                }
                                                className={cn(
                                                    'text-xs px-2.5 py-1 rounded-full border',
                                                    sel ? 'bg-[#1877F2] text-white border-[#1877F2]' : 'bg-background hover:bg-muted',
                                                )}
                                            >
                                                {p.replace(/_/g, ' ')}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Mobile OS</ZoruLabel>
                                <ZoruSelect value={state.mobileOS} onValueChange={(v) => setField('mobileOS', v as any)}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="all">All</ZoruSelectItem>
                                        <ZoruSelectItem value="ios">iOS only</ZoruSelectItem>
                                        <ZoruSelectItem value="android">Android only</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Brand safety</ZoruLabel>
                                <ZoruSelect
                                    value={state.brandSafetyInventoryFilter}
                                    onValueChange={(v) => setField('brandSafetyInventoryFilter', v as any)}
                                >
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="FULL_INVENTORY">Full inventory</ZoruSelectItem>
                                        <ZoruSelectItem value="STANDARD_INVENTORY">Standard inventory</ZoruSelectItem>
                                        <ZoruSelectItem value="LIMITED_INVENTORY">Limited inventory</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm">
                            <ZoruCheckbox
                                checked={state.onlyWifi}
                                onCheckedChange={(v) => setField('onlyWifi', !!v)}
                            />
                            Only when connected to Wi-Fi
                        </label>
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
        <div className="space-y-2">
            <ZoruLabel>{label}</ZoruLabel>
            <ZoruPopover open={open} onOpenChange={setOpen}>
                <ZoruPopoverTrigger asChild>
                    <ZoruButton variant="outline" className="w-full justify-start text-muted-foreground font-normal">
                        Search interests, behaviors, demographics…
                    </ZoruButton>
                </ZoruPopoverTrigger>
                <ZoruPopoverContent className="p-0 w-[400px]">
                    <ZoruCommand shouldFilter={false}>
                        <ZoruCommandInput value={query} onValueChange={setQuery} placeholder="e.g. yoga, luxury cars…" />
                        <ZoruCommandList>
                            {results.length === 0 && <ZoruCommandEmpty>Start typing to search.</ZoruCommandEmpty>}
                            <ZoruCommandGroup>
                                {results.map((r) => {
                                    const sel = selected.some((s) => s.id === r.id);
                                    return (
                                        <ZoruCommandItem
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
                                            <span className="text-[10px] text-muted-foreground ml-2">
                                                {r.audience_size_lower_bound ? formatNumber(r.audience_size_lower_bound) : ''}
                                            </span>
                                        </ZoruCommandItem>
                                    );
                                })}
                            </ZoruCommandGroup>
                        </ZoruCommandList>
                    </ZoruCommand>
                </ZoruPopoverContent>
            </ZoruPopover>
            <div className="flex flex-wrap gap-1">
                {selected.map((s) => (
                    <ZoruBadge key={s.id} variant="secondary" className="text-xs">
                        {s.name}
                        <button
                            type="button"
                            className="ml-1"
                            onClick={() => onChange(selected.filter((x) => x.id !== s.id))}
                        >
                            ×
                        </button>
                    </ZoruBadge>
                ))}
            </div>
        </div>
    );
}

// =================================================================
//  Step 3 — Ad
// =================================================================

function Step3Ad({
    state, setField, pages, igAccounts, savedImages, uploading, onUpload, issues,
    mediaTab, setMediaTab,
}: {
    state: CreateFormState;
    setField: <K extends keyof CreateFormState>(k: K, v: CreateFormState[K]) => void;
    pages: FacebookPage[];
    igAccounts: any[];
    savedImages: any[];
    uploading: boolean;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    issues: ValidationIssue[];
    mediaTab: 'upload' | 'library';
    setMediaTab: (v: 'upload' | 'library') => void;
}) {
    const err = (f: string) => issues.find((i) => i.field === f || i.field.startsWith(`${f}.`));
    const addPrimaryText = () => setField('primaryTexts', [...state.primaryTexts, '']);
    const addHeadline = () => setField('headlines', [...state.headlines, '']);
    const addDescription = () => setField('descriptions', [...state.descriptions, '']);

    return (
        <>
            <div className="space-y-2">
                <ZoruLabel>Ad name</ZoruLabel>
                <ZoruInput value={state.adName} onChange={(e) => setField('adName', e.target.value)} />
                <FieldError issue={err('adName')} />
            </div>

            <Section title="Identity" icon={Facebook}>
                <div className="space-y-2">
                    <ZoruLabel>Facebook page</ZoruLabel>
                    <ZoruSelect value={state.facebookPageId} onValueChange={(v) => setField('facebookPageId', v)}>
                        <ZoruSelectTrigger><ZoruSelectValue placeholder="Pick a page" /></ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {pages.map((p) => (
                                <ZoruSelectItem key={p.id} value={p.id}>{p.name}</ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                    <FieldError issue={err('facebookPageId')} />
                </div>

                {igAccounts.length > 0 && (
                    <div className="space-y-2">
                        <ZoruLabel>Instagram account</ZoruLabel>
                        <ZoruSelect value={state.instagramActorId} onValueChange={(v) => setField('instagramActorId', v)}>
                            <ZoruSelectTrigger><ZoruSelectValue placeholder="Pick IG account" /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {igAccounts.map((ig) => (
                                    <ZoruSelectItem key={ig.id} value={ig.id}>@{ig.username || ig.id}</ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                )}

                <div className="space-y-2">
                    <ZoruLabel>Branded content sponsor (optional)</ZoruLabel>
                    <ZoruInput
                        value={state.brandedContentSponsorId}
                        onChange={(e) => setField('brandedContentSponsorId', e.target.value)}
                        placeholder="Sponsor page ID"
                    />
                </div>
            </Section>

            <Section title="Ad setup" icon={Settings2}>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="text-sm font-medium">Use an existing post</div>
                        <div className="text-xs text-muted-foreground">Promote a post you already published.</div>
                    </div>
                    <ZoruSwitch
                        checked={state.useExistingPost}
                        onCheckedChange={(v) => setField('useExistingPost', v)}
                        className="data-[state=checked]:bg-[#1877F2]"
                    />
                </div>

                {state.useExistingPost ? (
                    <div className="space-y-2">
                        <ZoruLabel>Post ID</ZoruLabel>
                        <ZoruInput
                            value={state.existingPostId}
                            onChange={(e) => setField('existingPostId', e.target.value)}
                            placeholder="e.g. 123456789012345_987654321"
                        />
                        <FieldError issue={err('existingPostId')} />
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            <ZoruLabel>Ad format</ZoruLabel>
                            <ZoruRadioGroup
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
                                        className={cn(
                                            'flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer',
                                            state.adFormat === f.id ? 'border-[#1877F2]' : 'border-border',
                                        )}
                                    >
                                        <ZoruRadioGroupItem value={f.id} />
                                        <span className="text-xs">{f.label}</span>
                                    </label>
                                ))}
                            </ZoruRadioGroup>
                        </div>
                    </>
                )}
            </Section>

            {!state.useExistingPost && (
                <>
                    <Section title="Media" icon={ImageIcon}>
                        {state.adFormat === 'SINGLE_IMAGE' && (
                            <div>
                                {/* Zoru has no tab primitive — use a segmented ZoruButton group */}
                                <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
                                    <ZoruButton
                                        type="button"
                                        size="sm"
                                        variant={mediaTab === 'upload' ? 'default' : 'ghost'}
                                        onClick={() => setMediaTab('upload')}
                                    >
                                        Upload new
                                    </ZoruButton>
                                    <ZoruButton
                                        type="button"
                                        size="sm"
                                        variant={mediaTab === 'library' ? 'default' : 'ghost'}
                                        onClick={() => setMediaTab('library')}
                                    >
                                        From library
                                    </ZoruButton>
                                </div>

                                {mediaTab === 'upload' && (
                                    <div className="pt-3">
                                        <div className="border-2 border-dashed rounded-xl p-8 text-center">
                                            {state.imageUrl ? (
                                                <div className="space-y-3">
                                                    <img
                                                        src={state.imageUrl}
                                                        alt=""
                                                        className="max-h-48 mx-auto rounded-lg border"
                                                    />
                                                    <ZoruButton variant="outline" size="sm" onClick={() => { setField('imageUrl', ''); setField('imageHash', ''); }}>
                                                        Replace image
                                                    </ZoruButton>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                                                    <p className="text-sm font-medium">Drag & drop or click to upload</p>
                                                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 30MB</p>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={onUpload}
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                        disabled={uploading}
                                                    />
                                                    {uploading && (
                                                        <div className="mt-2 flex items-center justify-center gap-2 text-sm">
                                                            <LoaderCircle className="h-4 w-4 animate-spin" /> Uploading…
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <FieldError issue={err('imageUrl')} />
                                    </div>
                                )}

                                {mediaTab === 'library' && (
                                    <div className="pt-3">
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-auto">
                                            {savedImages.map((img) => (
                                                <button
                                                    key={img.hash}
                                                    type="button"
                                                    onClick={() => {
                                                        setField('imageHash', img.hash);
                                                        setField('imageUrl', img.url);
                                                    }}
                                                    className={cn(
                                                        'aspect-square rounded-lg overflow-hidden border-2',
                                                        state.imageHash === img.hash ? 'border-[#1877F2]' : 'border-border',
                                                    )}
                                                >
                                                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {state.adFormat === 'CAROUSEL' && (
                            <div className="space-y-2">
                                <ZoruLabel>Carousel cards (min 2, max 10)</ZoruLabel>
                                {state.carouselCards.map((card, idx) => (
                                    <ZoruCard key={idx}>
                                        <ZoruCardContent className="p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium">Card {idx + 1}</span>
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() =>
                                                        setField(
                                                            'carouselCards',
                                                            state.carouselCards.filter((_, i) => i !== idx),
                                                        )
                                                    }
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </ZoruButton>
                                            </div>
                                            <ZoruInput
                                                placeholder="Headline"
                                                value={card.name}
                                                onChange={(e) => {
                                                    const next = [...state.carouselCards];
                                                    next[idx] = { ...card, name: e.target.value };
                                                    setField('carouselCards', next);
                                                }}
                                            />
                                            <ZoruInput
                                                placeholder="Description"
                                                value={card.description || ''}
                                                onChange={(e) => {
                                                    const next = [...state.carouselCards];
                                                    next[idx] = { ...card, description: e.target.value };
                                                    setField('carouselCards', next);
                                                }}
                                            />
                                            <ZoruInput
                                                placeholder="Destination URL"
                                                value={card.link || ''}
                                                onChange={(e) => {
                                                    const next = [...state.carouselCards];
                                                    next[idx] = { ...card, link: e.target.value };
                                                    setField('carouselCards', next);
                                                }}
                                            />
                                        </ZoruCardContent>
                                    </ZoruCard>
                                ))}
                                <ZoruButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setField('carouselCards', [...state.carouselCards, { name: '', description: '', link: '' }])
                                    }
                                    disabled={state.carouselCards.length >= 10}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Add card
                                </ZoruButton>
                                <FieldError issue={err('carouselCards')} />
                            </div>
                        )}
                    </Section>

                    <Section title="Primary text, headline & description" icon={Sparkles}>
                        <div className="space-y-2">
                            <ZoruLabel className="flex items-center justify-between">
                                Primary text
                                <ZoruButton variant="ghost" size="sm" onClick={addPrimaryText}>
                                    <Plus className="h-3 w-3 mr-1" /> Add variant
                                </ZoruButton>
                            </ZoruLabel>
                            {state.primaryTexts.map((t, i) => (
                                <ZoruTextarea
                                    key={i}
                                    value={t}
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
                            <FieldError issue={err('primaryTexts')} />
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel className="flex items-center justify-between">
                                Headline
                                <ZoruButton variant="ghost" size="sm" onClick={addHeadline}>
                                    <Plus className="h-3 w-3 mr-1" /> Add variant
                                </ZoruButton>
                            </ZoruLabel>
                            {state.headlines.map((h, i) => (
                                <ZoruInput
                                    key={i}
                                    value={h}
                                    maxLength={40}
                                    onChange={(e) => {
                                        const next = [...state.headlines];
                                        next[i] = e.target.value;
                                        setField('headlines', next);
                                    }}
                                    placeholder="Max 40 characters"
                                />
                            ))}
                            <FieldError issue={err('headlines')} />
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel className="flex items-center justify-between">
                                Description
                                <ZoruButton variant="ghost" size="sm" onClick={addDescription}>
                                    <Plus className="h-3 w-3 mr-1" /> Add variant
                                </ZoruButton>
                            </ZoruLabel>
                            {state.descriptions.map((d, i) => (
                                <ZoruInput
                                    key={i}
                                    value={d}
                                    maxLength={30}
                                    onChange={(e) => {
                                        const next = [...state.descriptions];
                                        next[i] = e.target.value;
                                        setField('descriptions', next);
                                    }}
                                    placeholder="Max 30 characters"
                                />
                            ))}
                            <FieldError issue={err('descriptions')} />
                        </div>
                    </Section>

                    <Section title="Destination" icon={Target}>
                        <div className="space-y-2">
                            <ZoruLabel>Destination URL</ZoruLabel>
                            <ZoruInput
                                type="url"
                                value={state.destinationUrl}
                                onChange={(e) => setField('destinationUrl', e.target.value)}
                                placeholder="https://"
                            />
                            <FieldError issue={err('destinationUrl')} />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>Display link (optional)</ZoruLabel>
                            <ZoruInput
                                value={state.displayLink}
                                onChange={(e) => setField('displayLink', e.target.value)}
                                placeholder="example.com/offer"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Call to action</ZoruLabel>
                                <ZoruSelect value={state.callToAction} onValueChange={(v) => setField('callToAction', v)}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {CALL_TO_ACTIONS.map((c) => (
                                            <ZoruSelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>URL parameters (UTM)</ZoruLabel>
                                <ZoruInput
                                    value={state.urlParameters}
                                    onChange={(e) => setField('urlParameters', e.target.value)}
                                    placeholder="utm_source=facebook&utm_medium=paid"
                                />
                            </div>
                        </div>
                    </Section>
                </>
            )}
        </>
    );
}
