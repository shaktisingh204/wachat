'use client';

import { StatCard } from '@/components/zoruui';
import { Banknote, Coins, FileMinus, Network, TrendingUp } from 'lucide-react';

/**
 * <CoaKpiStrip> — KPI strip for the Chart of Accounts list (§1D.1 bar).
 *
 * 5 cards: Total accounts · Assets total · Liabilities total · Income YTD · Expense YTD.
 * Cards are clickable so users can pivot the list filter from the KPI itself.
 */

import * as React from 'react';

export type CoaNatureFilter = 'all' | 'Asset' | 'Liability' | 'Income' | 'Expense' | 'Capital';

export interface CoaKpiSnapshot {
    totalAccounts: number;
    assetsTotal: number;
    liabilitiesTotal: number;
    incomeYtd: number;
    expenseYtd: number;
}

export interface CoaKpiStripProps {
    kpi: CoaKpiSnapshot;
    currency: string;
    active: CoaNatureFilter;
    onSelect: (next: CoaNatureFilter) => void;
}

function fmtMoney(value: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${currency} ${value.toLocaleString('en-IN')}`;
    }
}

export function CoaKpiStrip({ kpi, currency, active, onSelect }: CoaKpiStripProps) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <KpiButton active={active === 'all'} onClick={() => onSelect('all')} ariaLabel="Show all accounts">
                <ZoruStatCard
                    label="Total accounts"
                    value={kpi.totalAccounts.toLocaleString()}
                    period="across all natures"
                    icon={<Network />}
                />
            </KpiButton>
            <KpiButton active={active === 'Asset'} onClick={() => onSelect('Asset')} ariaLabel="Show asset accounts">
                <ZoruStatCard
                    label="Assets"
                    value={fmtMoney(kpi.assetsTotal, currency)}
                    period="current balance"
                    icon={<Coins />}
                />
            </KpiButton>
            <KpiButton active={active === 'Liability'} onClick={() => onSelect('Liability')} ariaLabel="Show liability accounts">
                <ZoruStatCard
                    label="Liabilities"
                    value={fmtMoney(kpi.liabilitiesTotal, currency)}
                    period="current balance"
                    icon={<FileMinus />}
                />
            </KpiButton>
            <KpiButton active={active === 'Income'} onClick={() => onSelect('Income')} ariaLabel="Show income accounts">
                <ZoruStatCard
                    label="Income YTD"
                    value={fmtMoney(kpi.incomeYtd, currency)}
                    period="this fiscal year"
                    icon={<TrendingUp />}
                />
            </KpiButton>
            <KpiButton active={active === 'Expense'} onClick={() => onSelect('Expense')} ariaLabel="Show expense accounts">
                <ZoruStatCard
                    label="Expense YTD"
                    value={fmtMoney(kpi.expenseYtd, currency)}
                    period="this fiscal year"
                    icon={<Banknote />}
                />
            </KpiButton>
        </div>
    );
}

interface KpiButtonProps {
    children: React.ReactNode;
    active: boolean;
    onClick: () => void;
    ariaLabel: string;
}

function KpiButton({ children, active, onClick, ariaLabel }: KpiButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
            aria-pressed={active}
            className={[
                'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary',
                active ? 'rounded-[var(--zoru-radius-lg)] ring-1 ring-zoru-primary' : '',
            ].join(' ')}
        >
            {children}
        </button>
    );
}
