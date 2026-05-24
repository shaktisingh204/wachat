import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="Vendor Portal"
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
