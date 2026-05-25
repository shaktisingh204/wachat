import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getVoucherBookById } from '@/app/actions/crm-vouchers.actions';

export default async function VoucherBookActivityPage(props: {
    params: Promise<{ voucherBookId: string }>;
}) {
    const { voucherBookId } = await props.params;
    const book = await getVoucherBookById(voucherBookId);
    if (!book) notFound();

    return (
        <EntityDetailShell
            eyebrow="VOUCHER BOOK ACTIVITY"
            title={book.name}
            back={{ href: `/dashboard/crm/accounting/vouchers/${voucherBookId}`, label: 'Back to voucher book' }}
        >
            <EntityAuditTimeline entityKind="voucher_book" entityId={voucherBookId} />
        </EntityDetailShell>
    );
}
