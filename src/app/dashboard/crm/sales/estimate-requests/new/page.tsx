import { ZoruButton } from '@/components/zoruui';
import {
  redirect } from 'next/navigation';
import { ArrowLeft,
  FileQuestion } from 'lucide-react';

/**
 * New estimate request — server wrapper around `<EstimateRequestForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { EstimateRequestForm } from '../_components/estimate-request-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/estimate-requests';

export default async function NewEstimateRequestPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="New estimate request"
                subtitle="Capture an incoming estimate enquiry from a customer or lead."
                icon={FileQuestion}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to requests
                        </Link>
                    </ZoruButton>
                }
            />

            <EstimateRequestForm />
        </div>
    );
}
