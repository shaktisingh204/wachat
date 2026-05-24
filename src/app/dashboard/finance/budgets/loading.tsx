import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="Budget vs Actuals"
      subtitle="Track budgets and view actuals."
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
