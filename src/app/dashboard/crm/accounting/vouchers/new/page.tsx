import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { VoucherBookForm } from '../_components/voucher-book-form';
import { NewVoucherEntryClient } from './voucher-entry-client';
import { getSession } from '@/app/actions/user.actions';
import { getVoucherBooks } from '@/app/actions/crm-vouchers.actions';

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
        const [session, voucherBooks] = await Promise.all([
            getSession(),
            getVoucherBooks(),
        ]);
        
        return (
            <NewVoucherEntryClient 
                presetBookId={bookId} 
                initialUser={(session?.user as { businessProfile?: { name?: string } }) ?? null}
                initialVoucherBooks={voucherBooks}
            />
        );
    }

    return (
        <EntityDetailShell
            eyebrow="VOUCHER BOOK"
            title="New Voucher Book"
            back={{ href: '/dashboard/crm/accounting/vouchers', label: 'Voucher Books' }}
        >
            <VoucherBookForm />
        </EntityDetailShell>
    );
}
