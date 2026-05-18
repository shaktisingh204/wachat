'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Save,
  LoaderCircle,
  } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { saveContract } from '@/app/actions/crm-contracts.actions';

export const dynamic = 'force-dynamic';

const initialState: { message?: string; error?: string; id?: string } = {
  message: '',
  error: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Save contract
    </ZoruButton>
  );
}

export default function NewContractPage() {
  const [state, formAction] = useActionState(saveContract, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();
  const [autoRenew, setAutoRenew] = useState(false);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Created', description: state.message });
      router.push('/dashboard/crm/sales/contracts');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <EntityDetailShell
      eyebrow="CONTRACT"
      title="New Contract"
      back={{ href: '/dashboard/crm/sales/contracts', label: 'Contracts' }}
    >

      <ZoruCard className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Row 1: Contract Title + Contract Type */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="title">Contract Title</ZoruLabel>
              <ZoruInput
                id="title"
                name="title"
                placeholder="e.g. Software Services Agreement"
                required
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel>Contract Type</ZoruLabel>
              <EnumFormField
                enumName="contractTypeExtended"
                name="type"
                initialId="nda"
                placeholder="Select type"
              />
            </div>
          </div>

          {/* Row 2: Counter-party (client picker, dual-writes partyName) + Email */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel>Counter-party</ZoruLabel>
              <EntityFormField
                entity="client"
                name="clientId"
                dualWriteName="partyName"
                required
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="partyEmail">Counter-party Email</ZoruLabel>
              <ZoruInput
                id="partyEmail"
                name="partyEmail"
                type="email"
                placeholder="optional@example.com"
              />
            </div>
          </div>

          {/* Row 3: Effective Date + Expiry Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="effectiveDate">Effective Date</ZoruLabel>
              <ZoruInput id="effectiveDate" name="effectiveDate" type="date" />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="expiryDate">Expiry Date</ZoruLabel>
              <ZoruInput id="expiryDate" name="expiryDate" type="date" />
            </div>
          </div>

          {/* Row 4: Contract Value + E-Signature Provider */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="value">Contract Value (₹)</ZoruLabel>
              <ZoruInput
                id="value"
                name="value"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel>E-Signature Provider</ZoruLabel>
              <EnumFormField
                enumName="esignProviderExtended"
                name="esignProvider"
                initialId="none"
                placeholder="Select provider"
              />
            </div>
          </div>

          {/* Row 5: Auto-renew + Renewal Notice (conditional) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 pt-6">
              <input
                id="autoRenew"
                name="autoRenew"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={autoRenew}
                onChange={(e) => setAutoRenew(e.target.checked)}
              />
              <ZoruLabel htmlFor="autoRenew" className="cursor-pointer">
                Auto-renew
              </ZoruLabel>
            </div>
            {autoRenew && (
              <div className="space-y-1.5">
                <ZoruLabel htmlFor="renewalNoticeDays">Renewal Notice (days before expiry)</ZoruLabel>
                <ZoruInput
                  id="renewalNoticeDays"
                  name="renewalNoticeDays"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 30"
                />
              </div>
            )}
          </div>

          {/* Row 6: Notes */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              placeholder="Internal notes or special terms"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </ZoruCard>
    </EntityDetailShell>
  );
}
