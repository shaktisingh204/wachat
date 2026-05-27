/**
 * /portal/client/contracts — Contract list with "Sign" CTA for unsigned.
 */

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getClientContracts } from '@/app/actions/client-portal.actions';
import { ClientContractsClient } from './client-contracts-client';
import { Skeleton } from '@/components/zoruui/skeleton';

export default function ClientContractsPage() {
    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-2xl font-semibold text-zoru-ink">Contracts</h1>
                <p className="text-sm text-zoru-ink-muted">
                    Active agreements and pending signatures.
                </p>
            </div>

            <Suspense fallback={<ContractsSkeleton />}>
                <ContractsData />
            </Suspense>
        </div>
    );
}

async function ContractsData() {
    const contracts = await getClientContracts();
    return <ClientContractsClient contracts={contracts} />;
}

function ContractsSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex sm:justify-between items-center">
                <Skeleton className="h-10 w-full sm:max-w-sm rounded-md" />
            </div>
            <div className="rounded-xl border bg-zoru-surface text-zoru-ink shadow">
                <div className="p-0">
                    <div className="w-full relative overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-zoru-surface-2/50 data-[state=selected]:bg-zoru-surface-2">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-zoru-ink-muted w-[200px]"><Skeleton className="h-4 w-20" /></th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-zoru-ink-muted"><Skeleton className="h-4 w-16" /></th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-zoru-ink-muted"><Skeleton className="h-4 w-16" /></th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-zoru-ink-muted"><Skeleton className="h-4 w-24" /></th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-zoru-ink-muted"><Skeleton className="h-4 w-16" /></th>
                                    <th className="h-12 px-4 align-middle font-medium text-zoru-ink-muted text-right"><Skeleton className="h-4 w-12 ml-auto" /></th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b transition-colors hover:bg-zoru-surface-2/50 data-[state=selected]:bg-zoru-surface-2">
                                        <td className="p-4 align-middle"><Skeleton className="h-4 w-full max-w-[150px]" /></td>
                                        <td className="p-4 align-middle"><Skeleton className="h-4 w-16" /></td>
                                        <td className="p-4 align-middle"><Skeleton className="h-4 w-20" /></td>
                                        <td className="p-4 align-middle"><Skeleton className="h-4 w-24" /></td>
                                        <td className="p-4 align-middle"><Skeleton className="h-6 w-20 rounded-full" /></td>
                                        <td className="p-4 align-middle text-right"><Skeleton className="h-8 w-8 rounded-md ml-auto" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
