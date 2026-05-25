import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Card, ZoruCardContent } from '@/components/zoruui';
import { Loader2 } from 'lucide-react';

export default function NewItemLoading() {
  return (
    <EntityDetailShell
      eyebrow="INVENTORY ITEM"
      title="Loading..."
      back={{ href: '/dashboard/crm/inventory/items', label: 'Items' }}
    >
      <Card>
        <ZoruCardContent className="p-12 flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </ZoruCardContent>
      </Card>
    </EntityDetailShell>
  );
}
