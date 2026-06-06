import React from "react";
import { fmtINR } from "@/lib/utils";
/**
 * /portal/client/estimates — Estimate list.
 *
 * Each estimate has an "Accept" link to the public estimate-accept page
 * when the estimate is still waiting and has a `publicHash`.
 */

export const dynamic = 'force-dynamic';

import { getClientEstimates } from '@/app/actions/client-portal.actions';
import {
    Card,
    ZoruCardContent,
} from '@/components/sabcrm/20ui/compat';
import {
    Table,
    ZoruTableBody,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/sabcrm/20ui/compat';
import { EmptyState } from '@/components/sabcrm/20ui/compat';
import { EstimateRow } from './EstimateRow';
import { Info } from 'lucide-react';


async function ClientEstimatesPageContent() {
    const estimates = await getClientEstimates();
    
    const pendingEstimates = estimates.filter(est => ['waiting', 'sent', 'Sent', 'revision-requested'].includes(est.status));
    const pendingTotalsByCurrency = pendingEstimates.reduce((acc, est) => {
        const ccy = est.currency || 'USD';
        acc[ccy] = (acc[ccy] || 0) + est.total;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-zoru-ink">Estimates</h1>
                    <p className="text-sm text-zoru-ink-muted">
                        Review and accept estimates from your account manager.
                    </p>
                </div>
                
                {Object.keys(pendingTotalsByCurrency).length > 0 && (
                    <div className="bg-zoru-surface-2 border border-zoru-line rounded-lg p-3 text-sm flex items-center gap-3 shadow-sm">
                        <div className="bg-zoru-surface-2 p-2 rounded-full">
                            <Info className="h-4 w-4 text-zoru-ink" />
                        </div>
                        <div>
                            <div className="text-zoru-ink font-medium">Pending Estimates</div>
                            <div className="text-zoru-ink flex gap-2">
                                {Object.entries(pendingTotalsByCurrency).map(([ccy, total]) => (
                                    <span key={ccy} className="font-semibold">{fmtINR(total as number, ccy)}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {estimates.length === 0 ? (
                <EmptyState
                    title="No estimates yet"
                    description="Estimates sent to you will appear here."
                />
            ) : (
                <Card>
                    <ZoruCardContent className="p-0">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead className="w-10"></ZoruTableHead>
                                    <ZoruTableHead>Number</ZoruTableHead>
                                    <ZoruTableHead>Valid Till</ZoruTableHead>
                                    <ZoruTableHead>Total</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Action</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {estimates.map((est) => (
                                    <EstimateRow key={est._id} est={est} />
                                ))}
                            </ZoruTableBody>
                        </Table>
                    </ZoruCardContent>
                </Card>
            )}
        </div>
    );
}


export default function ClientEstimatesPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ClientEstimatesPageContent  />
    </React.Suspense>
  );
}
