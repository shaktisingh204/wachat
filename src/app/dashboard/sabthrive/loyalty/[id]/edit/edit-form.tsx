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
 * Client form island for the Edit Loyalty Program page. Posts to
 * `updateLoyaltyProgram`.
 */

import { updateLoyaltyProgram } from '@/app/actions/crm-loyalty.actions';
import { EnumFormField } from '@/components/crm/enum-form-field';

const initialState: { message?: string; error?: string; id?: string } = {};

function SubmitButton() {
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
            router.push(`/dashboard/sabthrive/loyalty/${loyaltyId}`);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast, loyaltyId]);

    return (
        <form action={formAction}>
            <Card className="w-full p-6">
                <input type="hidden" name="loyaltyId" value={loyaltyId} />

                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <Label htmlFor="name" className="text-zoru-ink">
                            Program Name <span className="text-zoru-danger-ink">*</span>
                        </Label>
                        <Input
                            id="name"
                            name="name"
                            required
                            defaultValue={(initial.name as string) || ''}
                            maxLength={120}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="pointsPerCurrencyUnit" className="text-zoru-ink">
                                Points per ₹1 Spent
                            </Label>
                            <Input
                                id="pointsPerCurrencyUnit"
                                name="pointsPerCurrencyUnit"
                                type="number"
                                min={0}
                                step="0.01"
                                defaultValue={initial.pointsPerCurrencyUnit ?? 1}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="redemptionRatio" className="text-zoru-ink">
                                Points needed per ₹1 Redemption
                            </Label>
                            <Input
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
                            <Label htmlFor="minRedemptionPoints" className="text-zoru-ink">
                                Min Redemption Points
                            </Label>
                            <Input
                                id="minRedemptionPoints"
                                name="minRedemptionPoints"
                                type="number"
                                min={0}
                                step={1}
                                defaultValue={initial.minRedemptionPoints ?? ''}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="expiryDays" className="text-zoru-ink">
                                Points Expiry (days)
                            </Label>
                            <Input
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
                        <Label htmlFor="welcomeBonus" className="text-zoru-ink">
                            Welcome Bonus Points
                        </Label>
                        <Input
                            id="welcomeBonus"
                            name="welcomeBonus"
                            type="number"
                            min={0}
                            step={1}
                            defaultValue={initial.welcomeBonus ?? ''}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zoru-ink">Status</Label>
                        <EnumFormField
                            enumName="loyaltyStatus"
                            name="status"
                            initialId={(initial.status as string) || 'active'}
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
                            maxLength={500}
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <SubmitButton />
                        <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/sabthrive/loyalty/${loyaltyId}`}>
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
