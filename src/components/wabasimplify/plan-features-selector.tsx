'use client';

import * as React from 'react';
import { planFeatureMap, planFeaturesDefaults } from '@/lib/plans';
import type { PlanFeaturePermissions } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, Search, Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        keys: ['chatbot', 'email', 'sms', 'seo', 'websiteBuilder', 'urlShortener', 'qrCodeMaker'],
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
        <Card className="rounded-2xl border-white/10 bg-white/5 backdrop-blur-xl shadow-lg overflow-hidden">
            <CardHeader className="border-b border-white/10 bg-gradient-to-r from-primary/10 via-transparent to-transparent">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg">Plan Features</CardTitle>
                        <CardDescription>
                            Toggle which features appear on the billing page and sidebar for users
                            on this plan. These are the headline capabilities shown in marketing
                            copy.
                        </CardDescription>
                    </div>
                    <Badge
                        variant="outline"
                        className="rounded-full border-primary/40 bg-primary/15 text-primary font-medium"
                    >
                        {enabledCount}/{totalKeys}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-4">
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
                <div className="sticky top-0 z-10 -mx-1 px-1 py-2 backdrop-blur-xl bg-background/70 border-b border-white/10">
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search features…"
                                className="pl-9 rounded-xl bg-white/5 border-white/10 backdrop-blur"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-xl gap-1 border-white/10 bg-white/5 hover:bg-white/10"
                                onClick={() => setAll(true)}
                            >
                                <Check className="h-3.5 w-3.5" /> All on
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-xl gap-1 border-white/10 bg-white/5 hover:bg-white/10"
                                onClick={() => setAll(false)}
                            >
                                <X className="h-3.5 w-3.5" /> All off
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
                                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
                            >
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setOpenCategories((prev) => ({
                                                ...prev,
                                                [cat.label]: !isOpen,
                                            }))
                                        }
                                        className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition"
                                    >
                                        <ChevronDown
                                            className={cn(
                                                'h-4 w-4 transition-transform',
                                                !isOpen && '-rotate-90',
                                            )}
                                        />
                                        <span className="font-semibold text-sm">{cat.label}</span>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                'rounded-full text-[10px] font-normal border-white/10',
                                                allOn
                                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                    : enabled === 0
                                                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                      : 'bg-white/5',
                                            )}
                                        >
                                            {enabled}/{cat.keys.length}
                                        </Badge>
                                    </button>
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-xs hover:bg-white/10 rounded-lg"
                                            onClick={() => setCategory(cat.keys, true)}
                                        >
                                            Enable all
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-xs hover:bg-white/10 rounded-lg"
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
                                                        'flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer select-none transition',
                                                        checked
                                                            ? 'bg-primary/10 border-primary/30 hover:bg-primary/15'
                                                            : 'bg-white/5 border-white/10 hover:bg-white/10',
                                                    )}
                                                >
                                                    <div
                                                        className={cn(
                                                            'h-7 w-7 rounded-lg flex items-center justify-center border shrink-0',
                                                            checked
                                                                ? 'bg-primary/20 border-primary/40 text-primary'
                                                                : 'bg-white/5 border-white/10 text-muted-foreground',
                                                        )}
                                                    >
                                                        {Icon && <Icon className="h-3.5 w-3.5" />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-medium truncate">
                                                            {meta?.name || key}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                                                            {key}
                                                        </div>
                                                    </div>
                                                    <Switch
                                                        checked={checked}
                                                        onCheckedChange={(v) => setOne(key, !!v)}
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
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-muted-foreground">
                            No features match &ldquo;{search}&rdquo;.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
