import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="Multi-Warehouse Inventory"
      subtitle="Manage inventory items."
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
