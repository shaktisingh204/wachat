import { getPaginatedVoucherBooks, getPendingVouchers } from '../_actions/queries';
import { VoucherBooksListClient } from './voucher-books-list-client';

export async function VoucherBooksListServer({ searchParams }: { searchParams: any }) {
    const data = await getPaginatedVoucherBooks(searchParams);
    const pendingVouchers = await getPendingVouchers();

    const rows = data.rows.map((r: any) => ({
        ...r,
        _id: r._id.toString(),
        lastEntryDate: r.lastEntryDate ? new Date(r.lastEntryDate).toISOString() : undefined,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
    }));

    const pending = pendingVouchers.map((v: any) => ({
        ...v,
        _id: v._id.toString(),
        date: v.date ? new Date(v.date).toISOString() : undefined,
        createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : undefined,
        updatedAt: v.updatedAt ? new Date(v.updatedAt).toISOString() : undefined,
        book: v.book ? { ...v.book, _id: v.book._id.toString() } : undefined
    }));

    return (
        <VoucherBooksListClient 
            initialRows={rows} 
            totalCount={data.totalCount} 
            searchParams={searchParams}
            pendingVouchers={pending}
        />
    );
}
