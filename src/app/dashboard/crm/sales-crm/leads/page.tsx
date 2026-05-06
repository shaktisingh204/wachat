import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

import { redirect } from 'next/navigation';

export default function SalesCrmLeadsLegacyPage() {
  redirect('/dashboard/crm/sales-crm/all-leads');
}
