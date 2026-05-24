import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function PayrollSettingsLoading() {
  return (
    <EntityListShell
      title="Payroll Settings"
      subtitle="Configure pay cycle, statutory contributions, late-marking, approvals, and payslip template."
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
