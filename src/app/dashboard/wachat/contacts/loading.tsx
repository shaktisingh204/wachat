import { FeatureShell } from '@/components/dashboard/feature-shell';
import { Card } from '@/components/sabcrm/20ui';
import { Loader2 } from 'lucide-react';

export default function ContactsLoading() {
  return (
    <FeatureShell
      title="Contacts"
      description="Manage your customer contact list."
      breadcrumbs={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/dashboard/wachat' },
        { label: 'Contacts' },
      ]}
    >
      <Card className="flex h-[400px] flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--st-accent)]" />
        <p className="mt-4 text-sm text-[var(--st-text-secondary)]">Loading contacts...</p>
      </Card>
    </FeatureShell>
  );
}
