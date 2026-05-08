import { redirect } from 'next/navigation';

export default function NewCrmProductPage() {
  redirect('/dashboard/crm/inventory/items/new');
}
