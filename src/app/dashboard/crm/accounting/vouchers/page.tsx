import { Suspense } from 'react';
import { VoucherBooksListServer } from './_components/voucher-books-list-server';

/**
 * Voucher Books — list landing page (§1D.1 bar).
 */
export default function VoucherBooksPage({ searchParams }: { searchParams: any }) {
    return (
        <Suspense fallback={<div className="p-8 text-center text-zoru-ink-muted animate-pulse">Loading voucher books...</div>}>
            <VoucherBooksListServer searchParams={searchParams} />
        </Suspense>
    );
}
