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
} from '@/components/sabcrm/20ui/compat';
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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            Save changes
        </Button>
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
            <Card className="w-full p-6">
                <input type="hidden" name="proformaId" value={proformaId} />

                <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="proformaNumber" className="text-zoru-ink">
                                Proforma Number
                            </Label>
                            <Input
                                id="proformaNumber"
                                name="proformaNumber"
                                defaultValue={(initial.proformaNumber as string) || ''}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="status" className="text-zoru-ink">
                                Status
                            </Label>
                            <Select
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
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="proformaDate" className="text-zoru-ink">
                                Proforma Date
                            </Label>
                            <Input
                                id="proformaDate"
                                name="proformaDate"
                                type="date"
                                defaultValue={toDateInputValue(initial.proformaDate)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="validTillDate" className="text-zoru-ink">
                                Valid Till
                            </Label>
                            <Input
                                id="validTillDate"
                                name="validTillDate"
                                type="date"
                                defaultValue={toDateInputValue(initial.validTillDate)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zoru-ink">Currency</Label>
                        <EntityFormField
                            entity="currency"
                            name="currency"
                            initialId={(initial.currency as string) || 'INR'}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="notes" className="text-zoru-ink">
                            Notes
                        </Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            defaultValue={(initial.notes as string) || ''}
                            rows={4}
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <SaveButton />
                        <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/crm/sales/proforma/${proformaId}`}>
                                <ArrowLeft className="h-4 w-4" />
                                Cancel
                            </Link>
                        </Button>
                    </div>
                </div>
            </Card>
        </form>
    );
}
