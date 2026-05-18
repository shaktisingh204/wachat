import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit promotion page — loads the document via `getPromotionById` and
 * passes it as `initialData` to `<PromotionForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
        <EntityDetailShell
            eyebrow="PROMOTION"
            title={`Edit · ${promotion.name}`}
            back={{ href: `${BASE}/${id}`, label: 'Promotion detail' }}
        >
            <PromotionForm initialData={promotion} />
        </EntityDetailShell>
    );
}
