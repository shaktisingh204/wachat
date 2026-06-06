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
import { Card, CardBody } from '@/components/sabcrm/20ui';
import { Table, TBody, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { EmptyState } from '@/components/sabcrm/20ui';
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
                    <h1 className="text-2xl font-semibold text-[var(--st-text)]">Estimates</h1>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                        Review and accept estimates from your account manager.
                    </p>
                </div>
                
                {Object.keys(pendingTotalsByCurrency).length > 0 && (
                    <div className="bg-[var(--st-bg-muted)] border border-[var(--st-border)] rounded-lg p-3 text-sm flex items-center gap-3 shadow-sm">
                        <div className="bg-[var(--st-bg-muted)] p-2 rounded-full">
                            <Info className="h-4 w-4 text-[var(--st-text)]" />
                        </div>
                        <div>
                            <div className="text-[var(--st-text)] font-medium">Pending Estimates</div>
                            <div className="text-[var(--st-text)] flex gap-2">
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
                    <CardBody className="p-0">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th className="w-10"></Th>
                                    <Th>Number</Th>
                                    <Th>Valid Till</Th>
                                    <Th>Total</Th>
                                    <Th>Status</Th>
                                    <Th className="text-right">Action</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {estimates.map((est) => (
                                    <EstimateRow key={est._id} est={est} />
                                ))}
                            </TBody>
                        </Table>
                    </CardBody>
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
