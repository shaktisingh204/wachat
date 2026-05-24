import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="Social Media Posts"
      subtitle="Manage your Social Media Posts seamlessly."
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
