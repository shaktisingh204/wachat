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
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Client form island for the Edit Contract page. Mirrors the `/new`
 * form fields and posts to `updateContract`.
 */

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { updateContract } from '@/app/actions/crm-contracts.actions';

const initialState: { message?: string; error?: string; id?: string } = {};

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            Save changes
        </ZoruButton>
    );
}

function toDateInputValue(v: unknown): string {
    if (!v) return '';
    const d = new Date(v as string | number | Date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

export function EditContractForm({
    contractId,
    initial,
}: {
    contractId: string;
    initial: Record<string, any>;
}) {
    const [state, formAction] = useActionState(updateContract, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();
    const [autoRenew, setAutoRenew] = useState<boolean>(initial.autoRenew === true);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Contract updated', description: state.message });
            router.push(`/dashboard/crm/sales/contracts/${contractId}`);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router, contractId]);

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                <input type="hidden" name="contractId" value={contractId} />

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="title">Contract Title</ZoruLabel>
                        <ZoruInput
                            id="title"
                            name="title"
                            required
                            defaultValue={(initial.title as string) || ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="type">Contract Type</ZoruLabel>
                        <EnumFormField
                            enumName="contractTypeExtended"
                            name="type"
                            initialId={(initial.type as string) || 'nda'}
                            placeholder="Select type"
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel>Counter-party</ZoruLabel>
                        <EntityFormField
                            entity="client"
                            name="clientId"
                            dualWriteName="partyName"
                            initialId={(initial.clientId as string) || null}
                            initialLabel={(initial.partyName as string) || ''}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="partyEmail">Counter-party Email</ZoruLabel>
                        <ZoruInput
                            id="partyEmail"
                            name="partyEmail"
                            type="email"
                            defaultValue={(initial.partyEmail as string) || ''}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="effectiveDate">Effective Date</ZoruLabel>
                        <ZoruInput
                            id="effectiveDate"
                            name="effectiveDate"
                            type="date"
                            defaultValue={toDateInputValue(initial.effectiveDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="expiryDate">Expiry Date</ZoruLabel>
                        <ZoruInput
                            id="expiryDate"
                            name="expiryDate"
                            type="date"
                            defaultValue={toDateInputValue(initial.expiryDate)}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="value">Contract Value (₹)</ZoruLabel>
                        <ZoruInput
                            id="value"
                            name="value"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={initial.value ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="esignProvider">E-Signature Provider</ZoruLabel>
                        <EnumFormField
                            enumName="esignProviderExtended"
                            name="esignProvider"
                            initialId={(initial.esignProvider as string) || 'none'}
                            placeholder="Select provider"
                        />
                    </div>
                </div>

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
                    {autoRenew ? (
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="renewalNoticeDays">
                                Renewal Notice (days before expiry)
                            </ZoruLabel>
                            <ZoruInput
                                id="renewalNoticeDays"
                                name="renewalNoticeDays"
                                type="number"
                                min="1"
                                step="1"
                                defaultValue={initial.renewalNoticeDays ?? ''}
                            />
                        </div>
                    ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            enumName="contractStatus"
                            name="status"
                            initialId={(initial.status as string) || 'draft'}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        rows={3}
                        defaultValue={(initial.notes as string) || ''}
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`/dashboard/crm/sales/contracts/${contractId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Cancel
                        </Link>
                    </ZoruButton>
                    <SaveButton />
                </div>
            </form>
        </ZoruCard>
    );
}
