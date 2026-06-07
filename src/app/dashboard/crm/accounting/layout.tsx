'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/20ui-domain/feature-lock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
import { useAccountingStore } from './_components/accounting-store';

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.crmAccounting ?? false;
    const { standard, fiscalYear, setStandard, setFiscalYear } = useAccountingStore();

    return (
        <div className="w-full relative min-h-screen flex flex-col">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="CRM Accounting" />
            <FeatureLock isAllowed={isAllowed}>
                <div className="sticky top-0 z-10 bg-[var(--st-bg-secondary)]/80 backdrop-blur-md border-b border-[var(--st-border)] px-6 py-2 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        Accounting Preferences
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--st-text-secondary)]">Standard:</span>
                            <Select value={standard} onValueChange={(v: any) => setStandard(v)}>
                                <SelectTrigger className="h-8 w-[100px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GAAP">GAAP</SelectItem>
                                    <SelectItem value="IFRS">IFRS</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--st-text-secondary)]">Fiscal Year:</span>
                            <Select value={fiscalYear} onValueChange={(v: any) => setFiscalYear(v)}>
                                <SelectTrigger className="h-8 w-[140px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="current">Current FY</SelectItem>
                                    <SelectItem value="previous">Previous FY</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <div className="flex-1">
                    {children}
                </div>
            </FeatureLock>
        </div>
    );
}
