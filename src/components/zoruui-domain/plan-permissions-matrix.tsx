'use client';

import {
    Input,
    Button,
    Switch,
    Badge,
    Checkbox,
    Card,
    EmptyState,
} from '@/components/sabcrm/20ui';
import {
  moduleCategories,
  permissionActions } from '@/lib/permission-modules';

import * as React from 'react';

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
    SearchX,
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
    view: { icon: Eye, color: 'text-[var(--st-text)]' },
    create: { icon: PlusCircle, color: 'text-[var(--st-text)]' },
    edit: { icon: Pencil, color: 'text-[var(--st-text)]' },
    delete: { icon: Trash2, color: 'text-[var(--st-text)]' },
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
            <div className="sticky top-0 z-10 -mx-1 px-1 py-2 backdrop-blur-xl bg-[var(--st-bg-secondary)]/70 border-b border-[var(--st-border)]">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <div className="flex-1">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search module or category"
                            iconLeft={Search}
                            aria-label="Search module or category"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge tone="neutral" kind="outline" className="font-normal">
                            <ShieldCheck className="h-3 w-3 mr-1 text-[var(--st-text)]" aria-hidden="true" />
                            {globalStats.enabled}/{globalStats.total}
                        </Badge>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            iconLeft={Check}
                            onClick={() => setAllGlobal(true)}
                        >
                            All
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            iconLeft={X}
                            onClick={() => setAllGlobal(false)}
                        >
                            None
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
                        <Card
                            key={category}
                            variant="outlined"
                            padding="none"
                            className="overflow-hidden"
                        >
                            {/* Category header */}
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        setOpenCategories((prev) => ({
                                            ...prev,
                                            [category]: !isOpen,
                                        }))
                                    }
                                    aria-expanded={isOpen}
                                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${category}`}
                                    className="flex-1 justify-start gap-2 text-left"
                                >
                                    <ChevronDown
                                        className={cn(
                                            'h-4 w-4 transition-transform',
                                            !isOpen && '-rotate-90',
                                        )}
                                        aria-hidden="true"
                                    />
                                    <span className="font-semibold text-sm text-[var(--st-text)]">{category}</span>
                                    <Badge
                                        tone={allEnabled ? 'accent' : 'neutral'}
                                        kind={noneEnabled ? 'outline' : 'soft'}
                                        className="text-[10px] font-normal"
                                    >
                                        {stats.enabled}/{stats.total}
                                    </Badge>
                                </Button>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setAllOnCategory(category, true)}
                                    >
                                        Enable all
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setAllOnCategory(category, false)}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </div>

                            {/* Modules */}
                            {isOpen && (
                                <div className="divide-y divide-[var(--st-border)]">
                                    {modules.map((moduleKey) => {
                                        const modulePerms =
                                            normalized[moduleKey] || {};
                                        const enabledCount = moduleEnabledCount(modulePerms);
                                        const allOn = enabledCount === permissionActions.length;

                                        return (
                                            <div
                                                key={moduleKey}
                                                className={cn(
                                                    'flex flex-col md:flex-row gap-3 md:items-center px-4 py-3 transition hover:bg-[var(--st-bg-secondary)]',
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
                                                        aria-label={`Toggle all permissions for ${prettyModule(moduleKey)}`}
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium truncate text-[var(--st-text)]">
                                                            {prettyModule(moduleKey)}
                                                        </div>
                                                        <div className="text-[10px] text-[var(--st-text-secondary)] font-mono truncate">
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
                                                                    'cursor-pointer select-none inline-flex items-center gap-1.5 px-3 h-8 rounded-[var(--st-radius)] border text-xs transition',
                                                                    checked
                                                                        ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]'
                                                                        : 'border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)]',
                                                                )}
                                                            >
                                                                <Checkbox
                                                                    size="sm"
                                                                    className="sr-only"
                                                                    checked={checked}
                                                                    onChange={(e) =>
                                                                        updateModuleAction(
                                                                            moduleKey,
                                                                            action,
                                                                            e.target.checked,
                                                                        )
                                                                    }
                                                                    aria-label={`${action} permission for ${prettyModule(moduleKey)}`}
                                                                />
                                                                {Icon && (
                                                                    <Icon
                                                                        className={cn(
                                                                            'h-3.5 w-3.5',
                                                                            checked
                                                                                ? meta.color
                                                                                : '',
                                                                        )}
                                                                        aria-hidden="true"
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
                        </Card>
                    );
                })}

                {Object.keys(filteredCategories).length === 0 && (
                    <EmptyState
                        icon={SearchX}
                        title="No modules found"
                        description={`No modules match "${search}".`}
                    />
                )}
            </div>

            <p className="text-xs text-[var(--st-text-secondary)] text-center pt-2">
                Tip: disabling <span className="font-medium text-[var(--st-text)]">View</span> on a module blocks access to
                the entire page regardless of other actions.
            </p>
        </div>
    );
}
