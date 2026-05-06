import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

import { redirect } from 'next/navigation';

export default function PurchaseOrdersPage() {
    redirect('/dashboard/crm/purchases/orders');
}
