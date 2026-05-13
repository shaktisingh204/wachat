/**
 * Edit form — `/dashboard/crm/sales/forms/[formId]/edit`.
 *
 * The canonical form builder lives at
 * `/dashboard/crm/sales-crm/forms/[formId]/edit`. This route exists so
 * URLs under `sales/forms/**` round-trip without 404ing — it loads the
 * form to confirm access, then redirects into the builder.
 */

import { notFound, redirect } from 'next/navigation';

import { getCrmFormById } from '@/app/actions/crm-forms.actions';

export const dynamic = 'force-dynamic';

export default async function SalesFormEditPage({
    params,
}: {
    params: Promise<{ formId: string }>;
}) {
    const { formId } = await params;
    const form = await getCrmFormById(formId);
    if (!form) notFound();

    redirect(`/dashboard/crm/sales-crm/forms/${formId}/edit`);
}
