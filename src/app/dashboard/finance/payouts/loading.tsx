import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="Direct Payouts"
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
