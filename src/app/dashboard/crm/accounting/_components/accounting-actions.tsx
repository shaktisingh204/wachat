'use client';

import { Button } from '@/components/sabcrm/20ui';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export function AccountingHubActions() {
    return (
        <div className="flex gap-2">
            <Button asChild variant="default" size="sm">
                <Link href="/dashboard/crm/accounting/vouchers/new">
                    <Plus className="mr-2 h-4 w-4" />
                    New Voucher
                </Link>
            </Button>
        </div>
    );
}
