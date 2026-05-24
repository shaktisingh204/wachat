import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="Multi-Currency GL"
      subtitle="View general ledger entries."
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
