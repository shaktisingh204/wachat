import { SlidersHorizontal } from 'lucide-react';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getPayrollSettings } from '@/app/actions/crm-payroll-settings.actions';
import { PayrollSettingsForm } from './payroll-settings-form';

export const dynamic = 'force-dynamic';

export default async function PayrollSettingsPage() {
  const settings = await getPayrollSettings();

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Payroll Settings"
        subtitle="Configure pay cycle, statutory contributions, late-marking, approvals, and payslip template."
        icon={SlidersHorizontal}
      />
      <PayrollSettingsForm settings={settings} />
    </div>
  );
}
