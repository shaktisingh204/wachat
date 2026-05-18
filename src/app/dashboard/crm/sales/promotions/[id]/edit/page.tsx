import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Tag } from 'lucide-react';

/**
 * Edit promotion page — loads the document via `getPromotionById` and
 * passes it as `initialData` to `<PromotionForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getPromotionById } from '@/app/actions/crm-promotions.actions';

import { PromotionForm } from '../../_components/promotion-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/promotions';

export default async function EditPromotionPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const promotion = await getPromotionById(id);
    if (!promotion) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Sales', href: '/dashboard/crm/sales' },
                    { label: 'Promotions', href: BASE },
                    { label: promotion.name, href: `${BASE}/${id}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${promotion.name}`}
                subtitle="Update promotion terms, validity, and applicability."
                icon={Tag}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <PromotionForm initialData={promotion} />
        </div>
    );
}
