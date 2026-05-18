import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getPayrollSettings } from '@/app/actions/crm-payroll-settings.actions';
import { PayrollSettingsForm } from './payroll-settings-form';

export const dynamic = 'force-dynamic';

export default async function PayrollSettingsPage() {
  const settings = await getPayrollSettings();

  return (
    <EntityListShell
      title="Payroll Settings"
      subtitle="Configure pay cycle, statutory contributions, late-marking, approvals, and payslip template."
    >
      <PayrollSettingsForm settings={settings} />
    </EntityListShell>
  );
}
