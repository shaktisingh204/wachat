'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
  useState } from 'react';
import {
  Save,
  LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { saveCrmAutomation } from '@/app/actions/crm-automations.actions';

export const dynamic = 'force-dynamic';


export default function NewAutomationPage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get('name') as string).trim();
    const trigger = fd.get('trigger') as string;
    const description = fd.get('description') as string;

    if (!name) {
      toast({ title: 'Error', description: 'Automation name is required.', variant: 'destructive' });
      return;
    }

    setPending(true);
    try {
      const triggerNode = trigger
        ? [{ id: 'trigger-1', type: 'trigger', data: { label: trigger }, position: { x: 250, y: 50 } }]
        : [];

      const result = await saveCrmAutomation({
        name,
        nodes: triggerNode as any,
        edges: [],
      });

      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Automation created', description: result.message });
        router.push('/dashboard/crm/sales-crm/automations');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <EntityListShell
      title="New Automation"
      subtitle="Set up a trigger-based workflow to automate CRM actions."
    >

      <ZoruCard className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Automation Name */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="name">Automation Name *</ZoruLabel>
            <ZoruInput
              id="name"
              name="name"
              placeholder="e.g. Welcome new leads"
              required
            />
          </div>

          {/* Trigger */}
          <div className="space-y-1.5">
            <ZoruLabel>Trigger Event</ZoruLabel>
            <EnumFormField
              enumName="automationTrigger"
              name="trigger"
              placeholder="Select a trigger"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="description">Description</ZoruLabel>
            <ZoruTextarea
              id="description"
              name="description"
              placeholder="What does this automation do?"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <ZoruButton type="submit" disabled={pending}>
              {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Create automation
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>
    </EntityListShell>
  );
}
