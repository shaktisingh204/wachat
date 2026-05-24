import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="Asset Depreciation"
      subtitle="Track assets and their depreciation over time."
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
