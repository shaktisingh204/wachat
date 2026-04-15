import { redirect } from 'next/navigation';

export default function PayrollIndexPage() {
    redirect('/dashboard/hrm/payroll/employees');
}
