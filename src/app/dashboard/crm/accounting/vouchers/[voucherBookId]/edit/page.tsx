import { notFound } from 'next/navigation';
import { Receipt } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getVoucherBookById } from '@/app/actions/crm-vouchers.actions';

import { VoucherBookForm } from '../../_components/voucher-book-form';

export default async function EditVoucherBookPage(props: {
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
                    { label: 'Edit' },
                ]}
                title={`Edit ${book.name}`}
                subtitle="Update the voucher book metadata."
                icon={Receipt}
            />
            <VoucherBookForm initial={book} />
        </div>
    );
}
