import { permanentRedirect } from 'next/navigation';

export default function LegacyHrPayrollRedirect() {
  permanentRedirect('/dashboard/hrm/payroll/salary-structure/new');
}
