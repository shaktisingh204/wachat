import { Button } from '@/components/sabcrm/20ui/compat';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export function AccountingHubActions() {
    return (
        <Button asChild>
            <Link href="/dashboard/crm/accounting/vouchers/new">
                <Plus className="mr-2 h-4 w-4" />
                New Journal Entry
            </Link>
        </Button>
    );
}
