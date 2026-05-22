'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Save, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { savePortalUser } from '@/app/actions/crm-portal.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';
import type { EntityKey } from '@/lib/lookup-registry';

function linkedEntityForPortalType(portalType: string): EntityKey {
  if (portalType === 'vendor') return 'vendor';
  if (portalType === 'employee') return 'employee';
  return 'client';
}

export const dynamic = 'force-dynamic';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {pending ? 'Saving…' : 'Save portal user'}
    </ZoruButton>
  );
}

const initialState = { message: '', error: '' };

export default function NewPortalUserPage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction] = useActionState(savePortalUser, initialState);
  const [portalType, setPortalType] = useState<string>('customer');

  useEffect(() => {
    if (state.message) {
      toast({
        title: 'Portal user created',
        description: 'Portal user created. Activation email will be sent.',
      });
      router.push('/dashboard/crm/portal');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <EntityDetailShell
      eyebrow="PORTAL"
      title="New Portal User"
      back={{ href: '/dashboard/crm/portal', label: 'Customer Portal' }}
    >

      <ZoruCard className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="name">
              Full Name <span className="text-red-500">*</span>
            </ZoruLabel>
            <ZoruInput
              id="name"
              name="name"
              type="text"
              placeholder="e.g. Rahul Sharma"
              required
              className="max-w-xs"
            />
          </div>

          {/* Email Address */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="email">
              Email Address <span className="text-red-500">*</span>
            </ZoruLabel>
            <ZoruInput
              id="email"
              name="email"
              type="email"
              placeholder="e.g. rahul@example.com"
              required
              className="max-w-xs"
            />
          </div>

          {/* Portal Type */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel>Portal Type</ZoruLabel>
            <EnumFormField
              enumName="portalType"
              name="portalType"
              initialId={portalType}
              onChange={(v) => setPortalType(v ?? 'customer')}
            />
          </div>

          {/* Linked Entity */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel>Linked {portalType === 'vendor' ? 'Vendor' : portalType === 'employee' ? 'Employee' : 'Customer'}</ZoruLabel>
            <EntityFormField
              entity={linkedEntityForPortalType(portalType)}
              name="linkedEntityId"
              placeholder={`Select ${portalType === 'vendor' ? 'vendor' : portalType === 'employee' ? 'employee' : 'customer'}…`}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Any additional details about this portal user…"
              className="max-w-lg"
            />
          </div>

          {/* Hidden capabilities */}
          <input
            type="hidden"
            name="capabilities"
            value='["view_invoices","raise_tickets","view_documents"]'
          />

          {state.error && (
            <p className="text-[13px] text-red-500">{state.error}</p>
          )}

          <div className="flex items-center gap-3">
            <SubmitButton />
            <ZoruButton variant="ghost" size="sm" asChild>
              <Link href="/dashboard/crm/portal">Cancel</Link>
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>
    </EntityDetailShell>
  );
}
