import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function WebhooksLoading() {
  return (
    <EntityListShell
      title="Webhooks & Zapier Integrations"
      subtitle="Connect SabNode to external apps using webhooks."
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
