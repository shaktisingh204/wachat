'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Save,
  LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { saveServiceContract } from '@/app/actions/crm-service-contracts.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';

const initialState: { message?: string; error?: string; id?: string } = {
  message: '',
  error: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Save contract
    </Button>
  );
}

export default function NewServiceContractPage() {
  const [state, formAction] = useActionState(saveServiceContract, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Created', description: state.message });
      router.push('/dashboard/crm/service-contracts');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <EntityDetailShell
      eyebrow="SERVICE CONTRACT"
      title="New Service Contract"
      back={{ href: '/dashboard/crm/service-contracts', label: 'Service Contracts' }}
    >
      <Card className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Row 1: Contract No + Customer Name */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contractNo">Contract No</Label>
              <Input
                id="contractNo"
                name="contractNo"
                placeholder="Auto-generated if blank"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <EntityFormField
                entity="client"
                name="customerId"
                dualWriteName="customerName"
                required
                placeholder="Select customer…"
              />
            </div>
          </div>

          {/* Row 2: Asset + Frequency */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="assetName">Asset / Equipment</Label>
              <Input
                id="assetName"
                name="assetName"
                placeholder="e.g. HVAC Unit, Generator"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frequency">Frequency</Label>
              <Select name="frequency">
                <ZoruSelectTrigger id="frequency">
                  <ZoruSelectValue placeholder="Select frequency" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="monthly">Monthly</ZoruSelectItem>
                  <ZoruSelectItem value="quarterly">Quarterly</ZoruSelectItem>
                  <ZoruSelectItem value="annual">Annual</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Coverage Description */}
          <div className="space-y-1.5">
            <Label htmlFor="coverage">Coverage Description</Label>
            <Textarea
              id="coverage"
              name="coverage"
              placeholder="Describe what is covered under this contract"
              rows={3}
            />
          </div>

          {/* Row 4: Start Date + End Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="periodStart">Start Date</Label>
              <Input id="periodStart" name="periodStart" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="periodEnd">End Date</Label>
              <Input id="periodEnd" name="periodEnd" type="date" />
            </div>
          </div>

          {/* Row 5: Billing Amount + Technician */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="billingAmount">Billing Amount</Label>
              <Input
                id="billingAmount"
                name="billingAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Technician</Label>
              <EntityFormField
                entity="employee"
                name="technicianId"
                dualWriteName="technician"
                placeholder="Select technician…"
              />
            </div>
          </div>

          {/* Row 6: Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Internal notes or special instructions"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </Card>
    </EntityDetailShell>
  );
}
