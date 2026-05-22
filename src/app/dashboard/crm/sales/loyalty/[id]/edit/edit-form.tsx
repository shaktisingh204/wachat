'use client';

import {
  Button,
  Card,
  Input,
  Label,
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
 * Client form island for the Edit Loyalty Program page. Posts to
 * `updateLoyaltyProgram`.
 */

import { updateLoyaltyProgram } from '@/app/actions/crm-loyalty.actions';
import { EnumFormField } from '@/components/crm/enum-form-field';

const initialState: { message?: string; error?: string; id?: string } = {};

function SubmitButton() {
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

export function EditLoyaltyForm({
    loyaltyId,
    initial,
}: {
    loyaltyId: string;
    initial: Record<string, any>;
}) {
    const [state, formAction] = useActionState(updateLoyaltyProgram, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Loyalty program updated', description: state.message });
            router.push(`/dashboard/crm/sales/loyalty/${loyaltyId}`);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast, loyaltyId]);

    return (
        <form action={formAction}>
            <ZoruCard className="max-w-xl p-6">
                <input type="hidden" name="loyaltyId" value={loyaltyId} />

                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="name" className="text-zoru-ink">
                            Program Name <span className="text-zoru-danger-ink">*</span>
                        </ZoruLabel>
                        <ZoruInput
                            id="name"
                            name="name"
                            required
                            defaultValue={(initial.name as string) || ''}
                            maxLength={120}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="pointsPerCurrencyUnit" className="text-zoru-ink">
                                Points per ₹1 Spent
                            </ZoruLabel>
                            <ZoruInput
                                id="pointsPerCurrencyUnit"
                                name="pointsPerCurrencyUnit"
                                type="number"
                                min={0}
                                step="0.01"
                                defaultValue={initial.pointsPerCurrencyUnit ?? 1}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="redemptionRatio" className="text-zoru-ink">
                                Points needed per ₹1 Redemption
                            </ZoruLabel>
                            <ZoruInput
                                id="redemptionRatio"
                                name="redemptionRatio"
                                type="number"
                                min={1}
                                step={1}
                                defaultValue={initial.redemptionRatio ?? 100}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="minRedemptionPoints" className="text-zoru-ink">
                                Min Redemption Points
                            </ZoruLabel>
                            <ZoruInput
                                id="minRedemptionPoints"
                                name="minRedemptionPoints"
                                type="number"
                                min={0}
                                step={1}
                                defaultValue={initial.minRedemptionPoints ?? ''}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="expiryDays" className="text-zoru-ink">
                                Points Expiry (days)
                            </ZoruLabel>
                            <ZoruInput
                                id="expiryDays"
                                name="expiryDays"
                                type="number"
                                min={1}
                                step={1}
                                defaultValue={initial.expiryDays ?? ''}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="welcomeBonus" className="text-zoru-ink">
                            Welcome Bonus Points
                        </ZoruLabel>
                        <ZoruInput
                            id="welcomeBonus"
                            name="welcomeBonus"
                            type="number"
                            min={0}
                            step={1}
                            defaultValue={initial.welcomeBonus ?? ''}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <ZoruLabel className="text-zoru-ink">Status</ZoruLabel>
                        <EnumFormField
                            enumName="loyaltyStatus"
                            name="status"
                            initialId={(initial.status as string) || 'active'}
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
                            maxLength={500}
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <SubmitButton />
                        <ZoruButton variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/crm/sales/loyalty/${loyaltyId}`}>
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
