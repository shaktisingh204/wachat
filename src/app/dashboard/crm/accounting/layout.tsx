'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/zoruui-domain/feature-lock';
import { Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { useAccountingStore } from './_components/accounting-store';

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.crmAccounting ?? false;
    const { standard, fiscalYear, setStandard, setFiscalYear } = useAccountingStore();

    return (
        <div className="w-full relative min-h-screen flex flex-col">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="CRM Accounting" />
            <FeatureLock isAllowed={isAllowed}>
                <div className="sticky top-0 z-10 bg-zoru-surface/80 backdrop-blur-md border-b border-zoru-line px-6 py-2 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        Accounting Preferences
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-zoru-ink-muted">Standard:</span>
                            <Select value={standard} onValueChange={(v: any) => setStandard(v)}>
                                <ZoruSelectTrigger className="h-8 w-[100px] text-xs">
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="GAAP">GAAP</ZoruSelectItem>
                                    <ZoruSelectItem value="IFRS">IFRS</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-zoru-ink-muted">Fiscal Year:</span>
                            <Select value={fiscalYear} onValueChange={(v: any) => setFiscalYear(v)}>
                                <ZoruSelectTrigger className="h-8 w-[140px] text-xs">
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="current">Current FY</ZoruSelectItem>
                                    <ZoruSelectItem value="previous">Previous FY</ZoruSelectItem>
                                </ZoruSelectContent>
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
