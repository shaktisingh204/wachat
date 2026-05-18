'use client';

import { ZoruStatCard } from '@/components/zoruui';
import { CheckCircle2, FileText, Layers, RotateCw } from 'lucide-react';

import * as React from 'react';

export interface VoucherBooksKpi {
    activeCount: number;
    totalCount: number;
    byType: Record<string, number>;
    entriesThisMonth: number;
    pendingResets: number;
}

interface VoucherBooksKpiStripProps {
    kpi: VoucherBooksKpi;
}

export function VoucherBooksKpiStrip({ kpi }: VoucherBooksKpiStripProps) {
    const topTypes = Object.entries(kpi.byType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t, n]) => `${t}: ${n}`)
        .join(' · ');

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ZoruStatCard
                label="Active books"
                value={`${kpi.activeCount} / ${kpi.totalCount}`}
                period="active vs. total"
                icon={<CheckCircle2 />}
            />
            <ZoruStatCard
                label="By type"
                value={topTypes || '—'}
                period="top 3 books by type"
                icon={<Layers />}
            />
            <ZoruStatCard
                label="Entries this month"
                value={kpi.entriesThisMonth.toLocaleString()}
                period="posted this calendar month"
                icon={<FileText />}
            />
            <ZoruStatCard
                label="Numbering resets pending"
                value={kpi.pendingResets.toLocaleString()}
                period="based on reset frequency"
                icon={<RotateCw />}
            />
        </div>
    );
}
