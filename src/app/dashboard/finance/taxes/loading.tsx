import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="Tax Filing"
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
