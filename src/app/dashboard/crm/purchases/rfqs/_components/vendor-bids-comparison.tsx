'use client';

import * as React from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/sabcrm/20ui/compat';
import type { CrmVendorBidDoc } from '@/lib/rust-client/crm-vendor-bids';

interface VendorBidsComparisonProps {
    bids: CrmVendorBidDoc[];
}

export function VendorBidsComparison({ bids }: VendorBidsComparisonProps) {
    if (bids.length < 2) return null;

    // Collect all unique item IDs
    const allItemIds = new Set<string>();
    bids.forEach((bid) => {
        bid.items?.forEach((item) => {
            if (item.itemId) allItemIds.add(item.itemId);
        });
    });
    
    const itemsList = Array.from(allItemIds);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="ml-2">
                    Compare Bids
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Vendor Bid Comparison</DialogTitle>
                </DialogHeader>
                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr>
                                <th className="border p-2 text-left bg-[var(--st-bg-muted)]">Item / Vendor</th>
                                {bids.map((b) => (
                                    <th key={b._id} className="border p-2 text-right bg-[var(--st-bg-muted)]">
                                        {b.vendorName || b.vendorId || 'Unknown'}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {itemsList.map((itemId) => (
                                <tr key={itemId}>
                                    <td className="border p-2 font-medium">Item {itemId}</td>
                                    {bids.map((b) => {
                                        const item = b.items?.find((i) => i.itemId === itemId);
                                        return (
                                            <td key={b._id} className="border p-2 text-right">
                                                {item ? `${b.currency || 'INR'} ${item.rate}` : '—'}
                                                <div className="text-xs text-[var(--st-text-secondary)]">
                                                    Qty: {item?.qty || 0}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            <tr className="bg-[var(--st-bg-muted)]/50 font-bold">
                                <td className="border p-2">Total</td>
                                {bids.map((b) => (
                                    <td key={b._id} className="border p-2 text-right">
                                        {b.currency || 'INR'} {b.totals?.total || 0}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
