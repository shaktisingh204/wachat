import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="Bank Reconciliation"
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
