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
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Client form island for the Edit Proforma Invoice page. Posts to
 * `updateProformaInvoice`. Edits only header-level fields; line items
 * are not editable here.
 */

import { EntityFormField } from '@/components/crm/entity-form-field';
import { updateProformaInvoice } from '@/app/actions/crm-proforma-invoices.actions';

const initialState: { message?: string; error?: string; id?: string } = {};

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
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

export function EditProformaForm({
    proformaId,
    initial,
}: {
    proformaId: string;
    initial: Record<string, any>;
}) {
    const [state, formAction] = useActionState(updateProformaInvoice, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Proforma updated', description: state.message });
            router.push(`/dashboard/crm/sales/proforma/${proformaId}`);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast, proformaId]);

    return (
        <form action={formAction}>
            <ZoruCard className="max-w-2xl p-6">
                <input type="hidden" name="proformaId" value={proformaId} />

                <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="proformaNumber" className="text-zoru-ink">
                                Proforma Number
                            </ZoruLabel>
                            <ZoruInput
                                id="proformaNumber"
                                name="proformaNumber"
                                defaultValue={(initial.proformaNumber as string) || ''}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="status" className="text-zoru-ink">
                                Status
                            </ZoruLabel>
                            <ZoruSelect
                                name="status"
                                defaultValue={(initial.status as string) || 'Draft'}
                            >
                                <ZoruSelectTrigger id="status">
                                    <ZoruSelectValue placeholder="Select status" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="Draft">Draft</ZoruSelectItem>
                                    <ZoruSelectItem value="Sent">Sent</ZoruSelectItem>
                                    <ZoruSelectItem value="Accepted">Accepted</ZoruSelectItem>
                                    <ZoruSelectItem value="Rejected">Rejected</ZoruSelectItem>
                                    <ZoruSelectItem value="Expired">Expired</ZoruSelectItem>
                                    <ZoruSelectItem value="Converted">Converted</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="proformaDate" className="text-zoru-ink">
                                Proforma Date
                            </ZoruLabel>
                            <ZoruInput
                                id="proformaDate"
                                name="proformaDate"
                                type="date"
                                defaultValue={toDateInputValue(initial.proformaDate)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="validTillDate" className="text-zoru-ink">
                                Valid Till
                            </ZoruLabel>
                            <ZoruInput
                                id="validTillDate"
                                name="validTillDate"
                                type="date"
                                defaultValue={toDateInputValue(initial.validTillDate)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <ZoruLabel className="text-zoru-ink">Currency</ZoruLabel>
                        <EntityFormField
                            entity="currency"
                            name="currency"
                            initialId={(initial.currency as string) || 'INR'}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="notes" className="text-zoru-ink">
                            Notes
                        </ZoruLabel>
                        <ZoruTextarea
                            id="notes"
                            name="notes"
                            defaultValue={(initial.notes as string) || ''}
                            rows={4}
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <SaveButton />
                        <ZoruButton variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/crm/sales/proforma/${proformaId}`}>
                                <ArrowLeft className="h-4 w-4" />
                                Cancel
                            </Link>
                        </ZoruButton>
                    </div>
                </div>
            </ZoruCard>
        </form>
    );
}
