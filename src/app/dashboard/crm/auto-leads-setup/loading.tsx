import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card, StatCard, Progress } from '@/components/sabcrm/20ui';

export default function AutoLeadsSetupLoading() {
  return (
    <EntityListShell
      title="Auto-Leads Setup"
      subtitle="Automatically create leads from incoming messages and form submissions."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Active rules" value="..." />
        <StatCard label="Sources covered" value="..." />
        <StatCard label="Current step" value="..." />
      </div>

      <Card className="p-4">
        <Progress value={0} />
        <div className="mt-3 flex h-6 animate-pulse bg-[var(--st-bg-muted)] rounded-full w-1/2" />
      </Card>

      <Card className="p-6">
        <div className="h-40 animate-pulse bg-[var(--st-bg-muted)] rounded-xl" />
      </Card>
    </EntityListShell>
  );
}
