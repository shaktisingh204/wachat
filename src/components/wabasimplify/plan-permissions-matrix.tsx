'use client';

import * as React from 'react';
import { moduleCategories, permissionActions } from '@/lib/permission-modules';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    ChevronDown,
    Search,
    Check,
    X,
    Eye,
    PlusCircle,
    Pencil,
    Trash2,
    ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Flat structure: { [moduleKey]: { view, create, edit, delete } }
 * This is the single source of truth used by RBACGuard.
 */
export type PlanPermissionsMap = Record<string, Partial<Record<string, boolean>>>;

interface PlanPermissionsMatrixProps {
    value: PlanPermissionsMap;
    onChange: (next: PlanPermissionsMap) => void;
    /** When true, renders a compact variant (for dialog contexts). */
    compact?: boolean;
}

const ACTION_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
    view: { icon: Eye, color: 'text-sky-500' },
    create: { icon: PlusCircle, color: 'text-emerald-500' },
    edit: { icon: Pencil, color: 'text-amber-500' },
    delete: { icon: Trash2, color: 'text-rose-500' },
};

function prettyModule(key: string) {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function moduleEnabledCount(perms: PlanPermissionsMap[string] | undefined) {
    if (!perms) return 0;
    return permissionActions.reduce((n, a) => (perms[a] ? n + 1 : n), 0);
}

function categoryStats(modules: string[], value: PlanPermissionsMap) {
    let enabled = 0;
    let total = modules.length * permissionActions.length;
    modules.forEach((m) => {
        enabled += moduleEnabledCount(value[m]);
    });
    return { enabled, total };
}

export function PlanPermissionsMatrix({ value, onChange, compact = false }: PlanPermissionsMatrixProps) {
    const [search, setSearch] = React.useState('');
    const [openCategories, setOpenCategories] = React.useState<Record<string, boolean>>(() => {
        const o: Record<string, boolean> = {};
        Object.keys(moduleCategories).forEach((c) => (o[c] = true));
        return o;
    });

    // Normalize legacy nested structure (`{ agent: { ... } }`) to flat on read.
    const normalized: PlanPermissionsMap = React.useMemo(() => {
        if (!value) return {};
        // If any root key matches a known module, treat as flat.
        const flatKeys = Object.keys(value).filter((k) =>
            Object.values(moduleCategories).some((mods) => mods.includes(k)),
        );
        if (flatKeys.length > 0) return value;
        // If it's nested under `agent`, flatten.
        if ((value as any).agent && typeof (value as any).agent === 'object') {
            return { ...(value as any).agent };
        }
        return value;
    }, [value]);

    const updateModuleAction = (moduleKey: string, action: string, checked: boolean) => {
        onChange({
            ...normalized,
            [moduleKey]: {
                ...(normalized[moduleKey] || {}),
                [action]: checked,
            },
        });
    };

    const setAllOnModule = (moduleKey: string, checked: boolean) => {
        onChange({
            ...normalized,
            [moduleKey]: {
                view: checked,
                create: checked,
                edit: checked,
                delete: checked,
            },
        });
    };

    const setAllOnCategory = (category: string, checked: boolean) => {
        const modules = moduleCategories[category as keyof typeof moduleCategories];
        const next = { ...normalized };
        modules.forEach((m) => {
            next[m] = { view: checked, create: checked, edit: checked, delete: checked };
        });
        onChange(next);
    };

    const setAllGlobal = (checked: boolean) => {
        const next: PlanPermissionsMap = {};
        Object.values(moduleCategories).forEach((mods) => {
            mods.forEach((m) => {
                next[m] = { view: checked, create: checked, edit: checked, delete: checked };
            });
        });
        onChange(next);
    };

    const filteredCategories = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return moduleCategories;
        const out: Record<string, string[]> = {};
        Object.entries(moduleCategories).forEach(([cat, mods]) => {
            const matched = mods.filter(
                (m) => m.toLowerCase().includes(q) || cat.toLowerCase().includes(q),
            );
            if (matched.length > 0) out[cat] = matched;
        });
        return out;
    }, [search]);

    // Global counts
    const globalStats = React.useMemo(() => {
        let enabled = 0;
        let total = 0;
        Object.values(moduleCategories).forEach((mods) => {
            total += mods.length * permissionActions.length;
            mods.forEach((m) => (enabled += moduleEnabledCount(normalized[m])));
        });
        return { enabled, total };
    }, [normalized]);

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="sticky top-0 z-10 -mx-1 px-1 py-2 backdrop-blur-xl bg-background/70 border-b border-white/10">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search module or category…"
                            className="pl-9 rounded-xl bg-white/5 border-white/10 backdrop-blur"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className="rounded-full border-white/10 bg-white/5 font-normal"
                        >
                            <ShieldCheck className="h-3 w-3 mr-1 text-primary" />
                            {globalStats.enabled}/{globalStats.total}
                        </Badge>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl gap-1 border-white/10 bg-white/5 hover:bg-white/10"
                            onClick={() => setAllGlobal(true)}
                        >
                            <Check className="h-3.5 w-3.5" /> All
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl gap-1 border-white/10 bg-white/5 hover:bg-white/10"
                            onClick={() => setAllGlobal(false)}
                        >
                            <X className="h-3.5 w-3.5" /> None
                        </Button>
                    </div>
                </div>
            </div>

            {/* Categories */}
            <div className="space-y-3">
                {Object.entries(filteredCategories).map(([category, modules]) => {
                    const stats = categoryStats(modules, normalized);
                    const allEnabled = stats.enabled === stats.total;
                    const noneEnabled = stats.enabled === 0;
                    const isOpen = openCategories[category] ?? true;

                    return (
                        <div
                            key={category}
                            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-sm overflow-hidden"
                        >
                            {/* Category header */}
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setOpenCategories((prev) => ({
                                            ...prev,
                                            [category]: !isOpen,
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
                                    <span className="font-semibold text-sm">{category}</span>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            'rounded-full text-[10px] font-normal border-white/10',
                                            allEnabled
                                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                : noneEnabled
                                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                  : 'bg-white/5',
                                        )}
                                    >
                                        {stats.enabled}/{stats.total}
                                    </Badge>
                                </button>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs hover:bg-white/10 rounded-lg"
                                        onClick={() => setAllOnCategory(category, true)}
                                    >
                                        Enable all
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs hover:bg-white/10 rounded-lg"
                                        onClick={() => setAllOnCategory(category, false)}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </div>

                            {/* Modules */}
                            {isOpen && (
                                <div className="divide-y divide-white/5">
                                    {modules.map((moduleKey) => {
                                        const modulePerms =
                                            normalized[moduleKey] || {};
                                        const enabledCount = moduleEnabledCount(modulePerms);
                                        const allOn = enabledCount === permissionActions.length;

                                        return (
                                            <div
                                                key={moduleKey}
                                                className={cn(
                                                    'flex flex-col md:flex-row gap-3 md:items-center px-4 py-3 hover:bg-white/[0.03] transition',
                                                    compact && 'py-2',
                                                )}
                                            >
                                                {/* Left: module name + master switch */}
                                                <div className="flex items-center gap-3 md:w-64 md:shrink-0">
                                                    <Switch
                                                        checked={allOn}
                                                        onCheckedChange={(c) =>
                                                            setAllOnModule(moduleKey, !!c)
                                                        }
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium truncate">
                                                            {prettyModule(moduleKey)}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                                                            {moduleKey}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: per-action toggles */}
                                                <div className="flex flex-wrap gap-2 md:flex-1 md:justify-end">
                                                    {permissionActions.map((action) => {
                                                        const meta = ACTION_META[action];
                                                        const Icon = meta?.icon;
                                                        const checked = !!modulePerms[action];
                                                        return (
                                                            <label
                                                                key={action}
                                                                className={cn(
                                                                    'cursor-pointer select-none inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs transition',
                                                                    checked
                                                                        ? 'border-primary/40 bg-primary/15 text-foreground shadow-inner'
                                                                        : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10',
                                                                )}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only"
                                                                    checked={checked}
                                                                    onChange={(e) =>
                                                                        updateModuleAction(
                                                                            moduleKey,
                                                                            action,
                                                                            e.target.checked,
                                                                        )
                                                                    }
                                                                />
                                                                {Icon && (
                                                                    <Icon
                                                                        className={cn(
                                                                            'h-3.5 w-3.5',
                                                                            checked
                                                                                ? meta.color
                                                                                : '',
                                                                        )}
                                                                    />
                                                                )}
                                                                <span className="capitalize">
                                                                    {action}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {Object.keys(filteredCategories).length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-muted-foreground">
                        No modules match &ldquo;{search}&rdquo;.
                    </div>
                )}
            </div>

            <p className="text-xs text-muted-foreground text-center pt-2">
                Tip: disabling <span className="font-medium">View</span> on a module blocks access to
                the entire page regardless of other actions.
            </p>
        </div>
    );
}
