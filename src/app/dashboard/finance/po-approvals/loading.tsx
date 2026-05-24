import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="PO Approvals"
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
