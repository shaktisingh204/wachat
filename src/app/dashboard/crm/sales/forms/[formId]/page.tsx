import { permanentRedirect } from 'next/navigation';

export default async function Page({
    params,
}: {
    params: Promise<{ formId: string }>;
}) {
    const { formId } = await params;
    permanentRedirect(`/dashboard/crm/sales-crm/forms/${formId}`);
}
