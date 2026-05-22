'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Save,
  LoaderCircle,
  } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { saveLoyaltyProgram } from '@/app/actions/crm-loyalty.actions';

export const dynamic = 'force-dynamic';

const initialState = { message: '', error: '' };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            Save Program
        </ZoruButton>
    );
}

export default function NewLoyaltyProgramPage() {
    const [state, formAction] = useActionState(saveLoyaltyProgram, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/sales/loyalty');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);

    return (
        <EntityDetailShell
            eyebrow="LOYALTY PROGRAM"
            title="New Loyalty Program"
            back={{ href: '/dashboard/crm/sales/loyalty', label: 'Loyalty' }}
        >

            <form action={formAction}>
                <ZoruCard className="p-6 max-w-xl">
                    <div className="space-y-5">
                        {/* Program Name */}
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="name" className="text-zoru-ink">
                                Program Name <span className="text-zoru-danger-ink">*</span>
                            </ZoruLabel>
                            <ZoruInput
                                id="name"
                                name="name"
                                required
                                placeholder="e.g. Gold Rewards"
                                maxLength={120}
                            />
                        </div>

                        {/* Points per ₹1 Spent + Points needed per ₹1 Redemption */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                    defaultValue={1}
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
                                    defaultValue={100}
                                />
                            </div>
                        </div>

                        {/* Min Redemption Points + Points Expiry */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                    placeholder="Optional"
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
                                    placeholder="Optional"
                                />
                            </div>
                        </div>

                        {/* Welcome Bonus Points */}
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
                                placeholder="Optional — points awarded on signup"
                            />
                        </div>

                        {/* Notes */}
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="notes" className="text-zoru-ink">
                                Notes
                            </ZoruLabel>
                            <ZoruTextarea
                                id="notes"
                                name="notes"
                                placeholder="Optional notes about this loyalty program…"
                                maxLength={500}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end pt-2">
                            <SubmitButton />
                        </div>
                    </div>
                </ZoruCard>
            </form>
        </EntityDetailShell>
    );
}
