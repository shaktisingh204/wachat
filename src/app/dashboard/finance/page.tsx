import { redirect } from 'next/navigation';

export default function FinanceRootPage() {
  // Redirect to the first module by default
  redirect('/dashboard/finance/gl');
}
