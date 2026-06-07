/**
 * /portal/client/contracts - Contract list with "Sign" CTA for unsigned.
 */

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getClientContracts } from '@/app/actions/client-portal.actions';
import { ClientContractsClient } from './client-contracts-client';
import {
    Skeleton,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    Card,
    CardBody,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';

export default function ClientContractsPage() {
    return (
        <div className="flex flex-col gap-4">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Contracts</PageTitle>
                    <PageDescription>Active agreements and pending signatures.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>

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
            <Card padding="none">
                <CardBody className="p-0 overflow-x-auto">
                    <Table>
                        <THead>
                            <Tr>
                                <Th><Skeleton className="h-4 w-20" /></Th>
                                <Th><Skeleton className="h-4 w-16" /></Th>
                                <Th><Skeleton className="h-4 w-16" /></Th>
                                <Th><Skeleton className="h-4 w-24" /></Th>
                                <Th><Skeleton className="h-4 w-16" /></Th>
                                <Th align="right"><Skeleton className="h-4 w-12 ml-auto" /></Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Tr key={i}>
                                    <Td><Skeleton className="h-4 w-full max-w-[150px]" /></Td>
                                    <Td><Skeleton className="h-4 w-16" /></Td>
                                    <Td><Skeleton className="h-4 w-20" /></Td>
                                    <Td><Skeleton className="h-4 w-24" /></Td>
                                    <Td><Skeleton className="h-6 w-20 rounded-full" /></Td>
                                    <Td align="right"><Skeleton className="h-8 w-8 rounded-md ml-auto" /></Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                </CardBody>
            </Card>
        </div>
    );
}
