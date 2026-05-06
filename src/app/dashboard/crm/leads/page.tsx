import { redirect } from 'next/navigation';

export default function Page(): never {
  redirect("/dashboard/crm/sales-crm/leads");
}
