'use client';

import { Card, Sheet, ZoruSheetContent, ZoruSheetHeader, ZoruSheetTitle, ZoruSheetDescription, Badge } from '@/components/sabcrm/20ui/compat';
import { ChevronDown, ChevronRight, Loader2, ArrowRight } from 'lucide-react';

/**
 * <CoaTree> — hierarchical tree view of accounts grouped by parent group.
 * Used by the "tree" view-switcher option on the CoA list page.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getVoucherEntriesForAccount } from '@/app/actions/crm-accounting.actions';

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
    const [selectedAccount, setSelectedAccount] = React.useState<CoaRow | null>(null);
    const [voucherEntries, setVoucherEntries] = React.useState<any[]>([]);
    const [isLoadingEntries, setIsLoadingEntries] = React.useState(false);

    const toggle = React.useCallback((key: string) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const handleAccountClick = React.useCallback(async (row: CoaRow, e: React.MouseEvent) => {
        e.preventDefault();
        setSelectedAccount(row);
        setIsLoadingEntries(true);
        try {
            const entries = await getVoucherEntriesForAccount(row._id);
            setVoucherEntries(entries);
        } catch (err) {
            console.error('[CoaTree] failed to load voucher entries:', err);
        } finally {
            setIsLoadingEntries(false);
        }
    }, []);

    if (rows.length === 0) {
        return (
            <Card className="flex min-h-[200px] items-center justify-center">
                <p className="text-[13px] text-zoru-ink-muted">No accounts match this filter.</p>
            </Card>
        );
    }

    return (
        <>
            <Card className="p-0">
                <ul className="divide-y divide-zoru-line">
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
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-zoru-surface-2"
                                >
                                    {natureOpen ? (
                                        <ChevronDown className="h-4 w-4 text-zoru-ink-muted" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-zoru-ink-muted" />
                                    )}
                                    <StatusPill label={nature} tone={tone} />
                                    <span className="ml-2 text-[12px] text-zoru-ink-muted">
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
                                                        className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[13px] text-zoru-ink hover:bg-zoru-surface-2"
                                                    >
                                                        {groupOpen ? (
                                                            <ChevronDown className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                                        ) : (
                                                            <ChevronRight className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                                        )}
                                                        <span className="font-medium">{groupName}</span>
                                                        <span className="text-[11.5px] text-zoru-ink-muted">
                                                            · {list.length} accounts
                                                        </span>
                                                    </button>
                                                    {groupOpen ? (
                                                        <ul className="ml-7 mb-2 border-l border-zoru-line">
                                                            {list.map((row) => (
                                                                <li key={row._id}>
                                                                    <Link
                                                                        href={`/dashboard/crm/accounting/charts/${row._id}`}
                                                                        onClick={(e) => handleAccountClick(row, e)}
                                                                        className="flex items-center justify-between gap-3 py-1.5 pl-4 pr-3 text-[12.5px] text-zoru-ink hover:bg-zoru-surface-2 rounded-[var(--zoru-radius-sm)] transition-colors"
                                                                    >
                                                                        <span className="truncate">
                                                                            {row.code ? (
                                                                                <span className="mr-2 font-mono text-[11px] text-zoru-ink-muted">
                                                                                    {row.code}
                                                                                </span>
                                                                            ) : null}
                                                                            {row.name}
                                                                        </span>
                                                                        <span className="shrink-0 font-mono text-[11.5px] text-zoru-ink-muted">
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
            </Card>

            {/* General Ledger Sliding Drawer */}
            <Sheet open={!!selectedAccount} onOpenChange={(open) => { if (!open) setSelectedAccount(null); }}>
                <ZoruSheetContent side="right" className="sm:max-w-md md:max-w-lg w-full flex flex-col h-full bg-zoru-bg border-l border-zoru-line p-0">
                    <div className="p-6 border-b border-zoru-line">
                        <ZoruSheetHeader className="pr-8">
                            <ZoruSheetTitle className="text-[16px] font-bold text-zoru-ink flex flex-wrap items-center gap-2">
                                <span>{selectedAccount?.name}</span>
                                {selectedAccount?.code && (
                                    <span className="font-mono text-[11px] bg-zoru-surface border border-zoru-line px-1.5 py-0.5 rounded text-zoru-ink-muted">
                                        {selectedAccount.code}
                                    </span>
                                )}
                            </ZoruSheetTitle>
                            <ZoruSheetDescription className="text-[12.5px] text-zoru-ink-muted mt-1">
                                General Ledger Vouchers &amp; Transaction Entries
                            </ZoruSheetDescription>
                        </ZoruSheetHeader>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Account Overview Card */}
                        {selectedAccount && (
                            <div className="bg-zoru-surface-2 p-4 rounded-lg border border-zoru-line flex justify-between items-center">
                                <div>
                                    <div className="text-[10px] font-bold text-zoru-ink-muted uppercase tracking-wider">Current Balance</div>
                                    <div className="text-[18px] font-mono font-bold text-zoru-ink mt-0.5">
                                        {selectedAccount.currentBalance != null
                                            ? `${fmtMoney(selectedAccount.currentBalance, selectedAccount.currency)} ${selectedAccount.currentBalanceType ?? 'Dr'}`
                                            : fmtMoney(selectedAccount.openingBalance, selectedAccount.currency)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-zoru-ink-muted uppercase tracking-wider">Nature &amp; Group</div>
                                    <div className="text-[12.5px] text-zoru-ink font-semibold mt-0.5">
                                        {selectedAccount.accountGroupType} · {selectedAccount.accountGroupName || 'Ungrouped'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Transaction List */}
                        <div className="space-y-4">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zoru-ink-muted flex items-center justify-between">
                                <span>Voucher Entries Feed</span>
                                {!isLoadingEntries && (
                                    <Badge variant="ghost">
                                        {voucherEntries.length} {voucherEntries.length === 1 ? 'entry' : 'entries'}
                                    </Badge>
                                )}
                            </h4>

                            {isLoadingEntries ? (
                                <div className="py-20 flex flex-col items-center justify-center gap-2">
                                    <Loader2 className="animate-spin h-6 w-6 text-zoru-ink-muted" />
                                    <span className="text-[12px] text-zoru-ink-muted font-medium">Fetching general ledger...</span>
                                </div>
                            ) : voucherEntries.length === 0 ? (
                                <div className="py-16 text-center border border-dashed border-zoru-line rounded-lg flex flex-col items-center justify-center gap-2">
                                    <span className="text-[13px] text-zoru-ink-muted font-medium">No ledger postings</span>
                                    <span className="text-[11px] text-zoru-ink-muted">There are no voucher entries logged against this account.</span>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {voucherEntries.map((entry) => {
                                        const entryDate = entry.date ? new Date(entry.date) : null;
                                        const matchingDebits = (entry.debitEntries || []).filter((d: any) => String(d.accountId) === String(selectedAccount?._id));
                                        const matchingCredits = (entry.creditEntries || []).filter((c: any) => String(c.accountId) === String(selectedAccount?._id));
                                        
                                        const isDebit = matchingDebits.length > 0;
                                        const amount = isDebit 
                                            ? matchingDebits.reduce((acc: number, cur: any) => acc + (cur.amount || 0), 0)
                                            : matchingCredits.reduce((acc: number, cur: any) => acc + (cur.amount || 0), 0);

                                        return (
                                            <div 
                                                key={entry._id} 
                                                className="p-3 bg-zoru-bg border border-zoru-line rounded-lg hover:border-zoru-line-strong transition-colors space-y-2.5 shadow-[var(--zoru-shadow-sm)]"
                                            >
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="space-y-0.5">
                                                        <span className="text-[12.5px] font-semibold text-zoru-ink">
                                                            {entry.voucherNumber || 'Voucher'}
                                                        </span>
                                                        <div className="text-[11px] text-zoru-ink-muted">
                                                            {entryDate ? entryDate.toLocaleDateString([], { dateStyle: 'medium' }) : '—'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right space-y-0.5">
                                                        <span className={`font-mono text-[13px] font-bold ${isDebit ? 'text-zoru-success-ink' : 'text-zoru-warning-ink'}`}>
                                                            {isDebit ? '+' : '-'}{fmtMoney(amount, selectedAccount?.currency)}
                                                        </span>
                                                        <div className="text-[10px] text-zoru-ink-muted uppercase font-semibold">
                                                            {isDebit ? 'Debit (Dr)' : 'Credit (Cr)'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {entry.note && (
                                                    <p className="text-[11.5px] text-zoru-ink-muted bg-zoru-surface-2 px-2.5 py-1.5 rounded border-l-2 border-zoru-line-strong italic">
                                                        {entry.note}
                                                    </p>
                                                )}

                                                {/* Details flow counterparties */}
                                                <div className="text-[10.5px] text-zoru-ink-muted space-y-1">
                                                    <div className="font-semibold text-zoru-ink-muted/80">Counterparty Postings:</div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {isDebit ? (
                                                            (entry.creditEntries || []).map((c: any, idx: number) => (
                                                                <span key={idx} className="bg-zoru-surface border border-zoru-line px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                    <span>CR</span>
                                                                    <ArrowRight className="h-2.5 w-2.5" />
                                                                    <span className="font-mono">{fmtMoney(c.amount)}</span>
                                                                </span>
                                                            ))
                                                        ) : (
                                                            (entry.debitEntries || []).map((d: any, idx: number) => (
                                                                <span key={idx} className="bg-zoru-surface border border-zoru-line px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                    <span>DR</span>
                                                                    <ArrowRight className="h-2.5 w-2.5" />
                                                                    <span className="font-mono">{fmtMoney(d.amount)}</span>
                                                                </span>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </ZoruSheetContent>
            </Sheet>
        </>
    );
}
