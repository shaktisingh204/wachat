import { permanentRedirect } from 'next/navigation';

export default function LegacyHrPayrollRedirect() {
  permanentRedirect('/dashboard/hrm/payroll/form-16');
}
