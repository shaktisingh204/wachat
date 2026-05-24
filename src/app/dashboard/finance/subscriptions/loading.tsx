import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="Subscriptions Billing"
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
