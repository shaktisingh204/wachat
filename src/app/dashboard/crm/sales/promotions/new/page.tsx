import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Tag } from 'lucide-react';

/**
 * New promotion page — server wrapper around `<PromotionForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { PromotionForm } from '../_components/promotion-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/promotions';

export default async function NewPromotionPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Sales', href: '/dashboard/crm/sales' },
                    { label: 'Promotions', href: BASE },
                    { label: 'New' },
                ]}
                title="New Promotion"
                subtitle="Create a discount campaign, BOGO offer or shipping deal."
                icon={Tag}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <PromotionForm />
        </div>
    );
}
