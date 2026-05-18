import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  FileQuestion } from 'lucide-react';

/**
 * Edit estimate request — server wrapper.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getEstimateRequestById } from '@/app/actions/crm-estimate-requests.actions';

import { EstimateRequestForm } from '../../_components/estimate-request-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/estimate-requests';

export default async function EditEstimateRequestPage({
    params,
}: {
    params: Promise<{ requestId: string }>;
}) {
    const { requestId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const request = await getEstimateRequestById(requestId);
    if (!request) notFound();

    const customerName =
        (request.customerName as string | undefined) || 'Estimate request';

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit · ${customerName}`}
                subtitle="Update customer info, requirements, and lifecycle status."
                icon={FileQuestion}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${requestId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <EstimateRequestForm
                initialData={request as Record<string, unknown>}
            />
        </div>
    );
}
