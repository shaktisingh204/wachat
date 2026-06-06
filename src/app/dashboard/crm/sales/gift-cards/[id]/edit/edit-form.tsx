'use client';

import {
  Button,
  Card,
  Input,
  Label,
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
 * Client form island for the Edit Gift Card page. Posts to
 * `updateGiftCard`.
 */

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { updateGiftCard } from '@/app/actions/crm-gift-cards.actions';

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

export function EditGiftCardForm({
    giftCardId,
    initial,
}: {
    giftCardId: string;
    initial: Record<string, any>;
}) {
    const [state, formAction] = useActionState(updateGiftCard, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Gift card updated', description: state.message });
            router.push(`/dashboard/crm/sales/gift-cards/${giftCardId}`);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast, giftCardId]);

    return (
        <form action={formAction} className="w-full">
            <Card className="space-y-6 p-6">
                <input type="hidden" name="giftCardId" value={giftCardId} />

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label className="text-[var(--st-text)]">Issued To</Label>
                        <EntityFormField
                            entity="client"
                            name="clientId"
                            dualWriteName="issuedTo"
                            initialId={(initial.clientId as string) || null}
                            initialLabel={(initial.issuedTo as string) || ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="issuedToEmail" className="text-[var(--st-text)]">
                            Customer Email
                        </Label>
                        <Input
                            id="issuedToEmail"
                            name="issuedToEmail"
                            type="email"
                            defaultValue={(initial.issuedToEmail as string) || ''}
                            maxLength={200}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="expiryDate" className="text-[var(--st-text)]">
                            Expiry Date
                        </Label>
                        <Input
                            id="expiryDate"
                            name="expiryDate"
                            type="date"
                            defaultValue={toDateInputValue(initial.expiryDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status" className="text-[var(--st-text)]">
                            Status
                        </Label>
                        <EnumFormField
                            name="status"
                            enumName="giftCardStatus"
                            initialId={(initial.status as string) || 'active'}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        id="transferable"
                        name="transferable"
                        type="checkbox"
                        className="h-4 w-4 rounded border-[var(--st-border)] accent-[var(--st-text)]"
                        defaultChecked={initial.transferable === true}
                    />
                    <Label htmlFor="transferable" className="cursor-pointer text-[var(--st-text)]">
                        Transferable
                    </Label>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-[var(--st-text)]">
                        Notes
                    </Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        defaultValue={(initial.notes as string) || ''}
                        maxLength={500}
                    />
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <SaveButton />
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/crm/sales/gift-cards/${giftCardId}`}>
                            <ArrowLeft className="h-4 w-4" />
                            Cancel
                        </Link>
                    </Button>
                </div>
            </Card>
        </form>
    );
}
