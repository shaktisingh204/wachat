'use client';

import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
  Switch,
  EmptyState,
  cn,
} from '@/components/sabcrm/20ui';
import {
  planFeatureMap,
  planFeaturesDefaults } from '@/lib/plans';
import type { PlanFeaturePermissions } from '@/lib/definitions';

import * as React from 'react';

import { ChevronDown, Search, Check, X, Sparkles, SlidersHorizontal } from 'lucide-react';

type FeatureState = Partial<Record<keyof PlanFeaturePermissions, boolean>>;

interface PlanFeaturesSelectorProps {
    defaultFeatures?: Partial<PlanFeaturePermissions>;
}

/**
 * Feature flag editor for the plan form. Emits one hidden input per feature key
 * plus a `__featuresSubmitted=1` marker so `savePlan` knows this tab was in the
 * form (and therefore the user's intent is authoritative).
 */
const CATEGORIES: { label: string; keys: (keyof PlanFeaturePermissions)[] }[] = [
    {
        label: 'Wachat',
        keys: [
            'overview',
            'campaigns',
            'liveChat',
            'contacts',
            'templates',
            'catalog',
            'flowBuilder',
            'metaFlows',
            'whatsappAds',
            'webhooks',
            'numbers',
        ],
    },
    {
        label: 'Instagram',
        keys: ['instagramFeed', 'instagramStories', 'instagramReels', 'instagramMessages'],
    },
    {
        label: 'CRM',
        keys: [
            'crmDashboard',
            'crmSales',
            'crmPurchases',
            'crmInventory',
            'crmAccounting',
            'crmSalesCrm',
            'crmBanking',
            'crmHrPayroll',
            'crmGstReports',
            'crmIntegrations',
            'crmSettings',
        ],
    },
    { label: 'Team', keys: ['teamChat', 'teamTasks'] },
    {
        label: 'Standalone Tools',
        keys: ['chatbot', 'email', 'sabsms', 'seo', 'websiteBuilder', 'urlShortener', 'qrCodeMaker'],
    },
    {
        label: 'Settings & Account',
        keys: [
            'billing',
            'notifications',
            'apiAccess',
            'settingsBroadcast',
            'settingsAutoReply',
            'settingsMarketing',
            'settingsTemplateLibrary',
            'settingsCannedMessages',
            'settingsAgentsRoles',
            'settingsCompliance',
            'settingsUserAttributes',
        ],
    },
];

const LABEL_BY_KEY = planFeatureMap.reduce<Record<string, { name: string; Icon: any }>>(
    (acc, item) => {
        acc[item.id] = { name: item.name, Icon: item.icon };
        return acc;
    },
    {},
);

export function PlanFeaturesSelector({ defaultFeatures }: PlanFeaturesSelectorProps) {
    // Seed state: prefer saved plan value, then default (all true for brand-new).
    const [features, setFeatures] = React.useState<FeatureState>(() => {
        const next: FeatureState = {};
        for (const k of Object.keys(planFeaturesDefaults) as (keyof PlanFeaturePermissions)[]) {
            next[k] =
                defaultFeatures?.[k] ??
                (planFeaturesDefaults as PlanFeaturePermissions)[k];
        }
        return next;
    });

    const [search, setSearch] = React.useState('');
    const [openCategories, setOpenCategories] = React.useState<Record<string, boolean>>(() =>
        Object.fromEntries(CATEGORIES.map((c) => [c.label, true])),
    );

    const setOne = (key: keyof PlanFeaturePermissions, value: boolean) =>
        setFeatures((prev) => ({ ...prev, [key]: value }));

    const setCategory = (keys: (keyof PlanFeaturePermissions)[], value: boolean) => {
        setFeatures((prev) => {
            const next = { ...prev };
            keys.forEach((k) => (next[k] = value));
            return next;
        });
    };

    const setAll = (value: boolean) => {
        setFeatures((prev) => {
            const next: FeatureState = { ...prev };
            (Object.keys(planFeaturesDefaults) as (keyof PlanFeaturePermissions)[]).forEach(
                (k) => (next[k] = value),
            );
            return next;
        });
    };

    const filteredCategories = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return CATEGORIES;
        return CATEGORIES.map((cat) => ({
            ...cat,
            keys: cat.keys.filter((k) => {
                const label = LABEL_BY_KEY[k]?.name || k;
                return (
                    label.toLowerCase().includes(q) ||
                    (k as string).toLowerCase().includes(q) ||
                    cat.label.toLowerCase().includes(q)
                );
            }),
        })).filter((c) => c.keys.length > 0);
    }, [search]);

    const totalKeys = Object.keys(planFeaturesDefaults).length;
    const enabledCount = Object.values(features).filter(Boolean).length;

    return (
        <Card className="overflow-hidden">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-[var(--st-radius)] bg-[var(--st-accent)]/15 border border-[var(--st-accent)]/30 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-[var(--st-accent)]" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg">Plan Features</CardTitle>
                        <CardDescription>
                            Toggle which features appear on the billing page and sidebar for users
                            on this plan. These are the headline capabilities shown in marketing
                            copy.
                        </CardDescription>
                    </div>
                    <Badge tone="accent" kind="soft">
                        {enabledCount}/{totalKeys}
                    </Badge>
                </div>
            </CardHeader>

            <CardBody className="pt-6 space-y-4">
                {/* Hidden marker so savePlan knows this tab was submitted */}
                <input type="hidden" name="__featuresSubmitted" value="1" />
                {/* Emit a hidden input per key so FormData has the full snapshot */}
                {(Object.keys(planFeaturesDefaults) as (keyof PlanFeaturePermissions)[]).map(
                    (key) => (
                        <input
                            key={`hidden-${key}`}
                            type="hidden"
                            name={key}
                            value={features[key] ? 'on' : ''}
                        />
                    ),
                )}

                {/* Toolbar */}
                <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[var(--st-bg-secondary)] border-b border-[var(--st-border)]">
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                        <div className="flex-1">
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search features"
                                iconLeft={Search}
                                aria-label="Search features"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                iconLeft={Check}
                                onClick={() => setAll(true)}
                            >
                                All on
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                iconLeft={X}
                                onClick={() => setAll(false)}
                            >
                                All off
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Categories */}
                <div className="space-y-3">
                    {filteredCategories.map((cat) => {
                        const enabled = cat.keys.filter((k) => features[k]).length;
                        const allOn = enabled === cat.keys.length;
                        const isOpen = openCategories[cat.label] ?? true;
                        return (
                            <div
                                key={cat.label}
                                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] overflow-hidden"
                            >
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--st-border)]">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 justify-start gap-2"
                                        aria-expanded={isOpen}
                                        onClick={() =>
                                            setOpenCategories((prev) => ({
                                                ...prev,
                                                [cat.label]: !isOpen,
                                            }))
                                        }
                                    >
                                        <ChevronDown
                                            className={cn(
                                                'h-4 w-4 transition-transform',
                                                !isOpen && '-rotate-90',
                                            )}
                                            aria-hidden="true"
                                        />
                                        <span className="font-semibold text-sm">{cat.label}</span>
                                        <Badge
                                            tone={allOn ? 'accent' : 'neutral'}
                                            kind="soft"
                                            className="text-[10px] font-normal"
                                        >
                                            {enabled}/{cat.keys.length}
                                        </Badge>
                                    </Button>
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setCategory(cat.keys, true)}
                                        >
                                            Enable all
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setCategory(cat.keys, false)}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </div>

                                {isOpen && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
                                        {cat.keys.map((key) => {
                                            const meta = LABEL_BY_KEY[key];
                                            const Icon = meta?.Icon;
                                            const checked = !!features[key];
                                            return (
                                                <label
                                                    key={key}
                                                    className={cn(
                                                        'flex items-center gap-3 px-3 py-2.5 rounded-[var(--st-radius)] border cursor-pointer select-none transition',
                                                        checked
                                                            ? 'bg-[var(--st-accent)]/10 border-[var(--st-accent)]/30'
                                                            : 'bg-[var(--st-bg)] border-[var(--st-border)]',
                                                    )}
                                                >
                                                    <div
                                                        className={cn(
                                                            'h-7 w-7 rounded-[var(--st-radius)] flex items-center justify-center border shrink-0',
                                                            checked
                                                                ? 'bg-[var(--st-accent)]/20 border-[var(--st-accent)]/40 text-[var(--st-accent)]'
                                                                : 'bg-[var(--st-bg-secondary)] border-[var(--st-border)] text-[var(--st-text-secondary)]',
                                                        )}
                                                    >
                                                        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-medium truncate text-[var(--st-text)]">
                                                            {meta?.name || key}
                                                        </div>
                                                        <div className="text-[10px] text-[var(--st-text-secondary)] font-mono truncate">
                                                            {key}
                                                        </div>
                                                    </div>
                                                    <Switch
                                                        checked={checked}
                                                        onCheckedChange={(v) => setOne(key, !!v)}
                                                        aria-label={`Toggle ${meta?.name || key}`}
                                                    />
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {filteredCategories.length === 0 && (
                        <EmptyState
                            icon={SlidersHorizontal}
                            title="No features match your search"
                            description={`Nothing matched "${search}". Try a different term.`}
                        />
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
