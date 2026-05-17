import { redirect } from 'next/navigation';

export default function Page(): never {
  redirect('/dashboard/hrm/payroll/salary-structure/new');
}
