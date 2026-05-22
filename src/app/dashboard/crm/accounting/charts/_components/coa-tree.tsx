'use client';

import { Card } from '@/components/zoruui';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * <CoaTree> — hierarchical tree view of accounts grouped by parent group.
 * Used by the "tree" view-switcher option on the CoA list page.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import type { CoaNature, CoaRow } from './types';

const NATURE_TONE: Record<CoaNature, StatusTone> = {
    Asset: 'green',
    Liability: 'red',
    Income: 'blue',
    Expense: 'amber',
    Capital: 'neutral',
};

function fmtMoney(value: number, currency = 'INR'): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `${currency} ${value.toFixed(2)}`;
    }
}

interface CoaTreeProps {
    rows: CoaRow[];
}

export function CoaTree({ rows }: CoaTreeProps) {
    // Group by accountGroupName under each nature. We do this in a single pass
    // so we don't allocate per re-render — see js-set-map-lookups.
    const tree = React.useMemo(() => {
        const byNature = new Map<string, Map<string, CoaRow[]>>();
        for (const row of rows) {
            const nature = row.accountGroupType || 'Uncategorized';
            const group = row.accountGroupName || 'Ungrouped';
            let groups = byNature.get(nature);
            if (!groups) {
                groups = new Map();
                byNature.set(nature, groups);
            }
            const list = groups.get(group);
            if (list) {
                list.push(row);
            } else {
                groups.set(group, [row]);
            }
        }
        return byNature;
    }, [rows]);

    const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

    const toggle = React.useCallback((key: string) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    if (rows.length === 0) {
        return (
            <ZoruCard className="flex min-h-[200px] items-center justify-center">
                <p className="text-[13px] text-muted-foreground">No accounts match this filter.</p>
            </ZoruCard>
        );
    }

    return (
        <ZoruCard className="p-0">
            <ul className="divide-y divide-border">
                {Array.from(tree.entries()).map(([nature, groups]) => {
                    const natureKey = `nature::${nature}`;
                    const natureOpen = !collapsed.has(natureKey);
                    const tone = (NATURE_TONE[nature as CoaNature] ?? 'neutral') as StatusTone;
                    const groupCount = groups.size;
                    const accountCount = Array.from(groups.values()).reduce((n, list) => n + list.length, 0);
                    return (
                        <li key={nature}>
                            <button
                                type="button"
                                onClick={() => toggle(natureKey)}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-secondary"
                            >
                                {natureOpen ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <StatusPill label={nature} tone={tone} />
                                <span className="ml-2 text-[12px] text-muted-foreground">
                                    {groupCount} groups · {accountCount} accounts
                                </span>
                            </button>
                            {natureOpen ? (
                                <ul className="pb-2">
                                    {Array.from(groups.entries()).map(([groupName, list]) => {
                                        const groupKey = `group::${nature}::${groupName}`;
                                        const groupOpen = !collapsed.has(groupKey);
                                        return (
                                            <li key={groupName} className="px-3">
                                                <button
                                                    type="button"
                                                    onClick={() => toggle(groupKey)}
                                                    className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-secondary"
                                                >
                                                    {groupOpen ? (
                                                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                                    )}
                                                    <span className="font-medium">{groupName}</span>
                                                    <span className="text-[11.5px] text-muted-foreground">
                                                        · {list.length} accounts
                                                    </span>
                                                </button>
                                                {groupOpen ? (
                                                    <ul className="ml-7 mb-2 border-l border-border">
                                                        {list.map((row) => (
                                                            <li key={row._id}>
                                                                <Link
                                                                    href={`/dashboard/crm/accounting/charts/${row._id}`}
                                                                    className="flex items-center justify-between gap-3 py-1.5 pl-4 pr-3 text-[12.5px] text-foreground hover:bg-secondary"
                                                                >
                                                                    <span className="truncate">
                                                                        {row.code ? (
                                                                            <span className="mr-2 font-mono text-[11px] text-muted-foreground">
                                                                                {row.code}
                                                                            </span>
                                                                        ) : null}
                                                                        {row.name}
                                                                    </span>
                                                                    <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground">
                                                                        {row.currentBalance != null
                                                                            ? `${fmtMoney(row.currentBalance, row.currency)} ${row.currentBalanceType ?? 'Dr'}`
                                                                            : fmtMoney(row.openingBalance, row.currency)}
                                                                    </span>
                                                                </Link>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        </ZoruCard>
    );
}
