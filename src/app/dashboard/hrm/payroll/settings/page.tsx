import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getPayrollSettings } from '@/app/actions/crm-payroll-settings.actions';
import { PayrollSettingsForm } from './payroll-settings-form';
import { ExportSettingsButton } from './export-settings-button';
import { CollaborativeBadge } from './collaborative-badge';

export const dynamic = 'force-dynamic';

export default async function PayrollSettingsPage() {
  const settings = await getPayrollSettings();

  return (
    <EntityListShell
      title="Payroll Settings"
      subtitle="Configure pay cycle, statutory contributions, late-marking, approvals, and payslip template."
      primaryAction={<ExportSettingsButton settings={settings} />}
      filters={<CollaborativeBadge />}
    >
      <PayrollSettingsForm settings={settings} />
    </EntityListShell>
  );
}
