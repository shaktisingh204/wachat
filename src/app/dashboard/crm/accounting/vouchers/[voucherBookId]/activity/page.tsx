import { notFound } from 'next/navigation';
import { History } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getVoucherBookById } from '@/app/actions/crm-vouchers.actions';

export default async function VoucherBookActivityPage(props: {
    params: Promise<{ voucherBookId: string }>;
}) {
    const { voucherBookId } = await props.params;
    const book = await getVoucherBookById(voucherBookId);
    if (!book) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Accounting', href: '/dashboard/crm/accounting' },
                    { label: 'Voucher Books', href: '/dashboard/crm/accounting/vouchers' },
                    {
                        label: book.name,
                        href: `/dashboard/crm/accounting/vouchers/${voucherBookId}`,
                    },
                    { label: 'Activity' },
                ]}
                title="Activity"
                subtitle={`Audit timeline for ${book.name}.`}
                icon={History}
            />
            <EntityAuditTimeline entityKind="voucher_book" entityId={voucherBookId} />
        </div>
    );
}
