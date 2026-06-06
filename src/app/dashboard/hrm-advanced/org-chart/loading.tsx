import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="Dynamic Org Chart"
      subtitle="View and manage the organization structure"
      loading={true}
    >
      <div className="h-96 flex items-center justify-center">
        <p className="text-[var(--st-text-secondary)]">Loading chart...</p>
      </div>
    </EntityListShell>
  );
}
