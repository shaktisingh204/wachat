import { Receipt } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { VoucherBookForm } from '../_components/voucher-book-form';
import { NewVoucherEntryClient } from './voucher-entry-client';

/**
 * /new for the Voucher Books module is dual-purpose:
 *
 *  - default: "New Voucher Book" (matches §1D contract for list/new pairing)
 *  - ?mode=entry: "New Voucher Entry" (the previous default — preserved for
 *    any existing links / shortcuts)
 *
 * If you arrive with `?bookId=<id>` the entry form pre-selects that book.
 */
export default async function NewVoucherRoute(props: {
    searchParams: Promise<{ mode?: string; bookId?: string }>;
}) {
    const { mode, bookId } = await props.searchParams;

    if (mode === 'entry') {
        return <NewVoucherEntryClient presetBookId={bookId} />;
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Accounting', href: '/dashboard/crm/accounting' },
                    { label: 'Voucher Books', href: '/dashboard/crm/accounting/vouchers' },
                    { label: 'New' },
                ]}
                title="New Voucher Book"
                subtitle="Create a new voucher book for a transaction type."
                icon={Receipt}
            />
            <VoucherBookForm />
        </div>
    );
}
