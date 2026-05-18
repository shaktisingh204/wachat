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
        <form action={formAction} className="max-w-2xl">
            <ZoruCard className="space-y-6 p-6">
                <input type="hidden" name="giftCardId" value={giftCardId} />

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel className="text-zoru-ink">Issued To</ZoruLabel>
                        <EntityFormField
                            entity="client"
                            name="clientId"
                            dualWriteName="issuedTo"
                            initialId={(initial.clientId as string) || null}
                            initialLabel={(initial.issuedTo as string) || ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="issuedToEmail" className="text-zoru-ink">
                            Customer Email
                        </ZoruLabel>
                        <ZoruInput
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
                        <ZoruLabel htmlFor="expiryDate" className="text-zoru-ink">
                            Expiry Date
                        </ZoruLabel>
                        <ZoruInput
                            id="expiryDate"
                            name="expiryDate"
                            type="date"
                            defaultValue={toDateInputValue(initial.expiryDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status" className="text-zoru-ink">
                            Status
                        </ZoruLabel>
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
                        className="h-4 w-4 rounded border-zoru-line accent-zoru-ink"
                        defaultChecked={initial.transferable === true}
                    />
                    <ZoruLabel htmlFor="transferable" className="cursor-pointer text-zoru-ink">
                        Transferable
                    </ZoruLabel>
                </div>

                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="notes" className="text-zoru-ink">
                        Notes
                    </ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        defaultValue={(initial.notes as string) || ''}
                        maxLength={500}
                    />
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <SaveButton />
                    <ZoruButton variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/crm/sales/gift-cards/${giftCardId}`}>
                            <ArrowLeft className="h-4 w-4" />
                            Cancel
                        </Link>
                    </ZoruButton>
                </div>
            </ZoruCard>
        </form>
    );
}
