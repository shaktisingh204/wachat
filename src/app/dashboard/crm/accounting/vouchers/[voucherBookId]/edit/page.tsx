import { notFound } from 'next/navigation';
import { Metadata } from 'next';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getVoucherBookById } from '@/app/actions/crm-vouchers.actions';

import { VoucherBookForm } from '../../_components/voucher-book-form';

export async function generateMetadata(props: {
    params: Promise<{ voucherBookId: string }>;
}): Promise<Metadata> {
    const { voucherBookId } = await props.params;
    const book = await getVoucherBookById(voucherBookId);
    
    if (!book) {
        return {
            title: 'Voucher Book Not Found',
        };
    }

    return {
        title: `Edit ${book.name} | SabNode`,
        description: `Edit settings and details for voucher book ${book.name}`,
    };
}

export default async function EditVoucherBookPage(props: {
    params: Promise<{ voucherBookId: string }>;
}) {
    const { voucherBookId } = await props.params;
    const book = await getVoucherBookById(voucherBookId);
    if (!book) notFound();

    return (
        <EntityDetailShell
            eyebrow="VOUCHER BOOK"
            title={`Edit ${book.name}`}
            back={{ href: `/dashboard/crm/accounting/vouchers/${voucherBookId}`, label: 'Back to voucher book' }}
        >
            <VoucherBookForm initial={book} />
        </EntityDetailShell>
    );
}
