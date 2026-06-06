'use client';

import { StatCard } from '@/components/sabcrm/20ui';
import { Banknote, CheckCircle2, Layers, RotateCw } from 'lucide-react';

import * as React from 'react';

export interface BankingKpi {
    totalAccounts: number;
    activeAccounts: number;
    totalBalance: number;
    currency: string;
    lastReconciledLabel: string;
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

export function BankingKpiStrip({ kpi }: { kpi: BankingKpi }) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
                label="Total accounts"
                value={kpi.totalAccounts.toLocaleString()}
                period="all payment accounts"
                icon={<Layers />}
            />
            <StatCard
                label="Active"
                value={kpi.activeAccounts.toLocaleString()}
                period="status = active"
                icon={<CheckCircle2 />}
            />
            <StatCard
                label="Total balance"
                value={fmtMoney(kpi.totalBalance, kpi.currency)}
                period="sum across accounts"
                icon={<Banknote />}
            />
            <StatCard
                label="Last reconciled"
                value={kpi.lastReconciledLabel}
                period="latest reconcile run"
                icon={<RotateCw />}
            />
        </div>
    );
}
