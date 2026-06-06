'use client';

import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
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

const initialState = { message: '', error: '' };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            Save Program
        </Button>
    );
}

export default function NewLoyaltyProgramPage() {
    const [state, formAction] = useActionState(saveLoyaltyProgram, initialState);
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/sabthrive/loyalty');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);

    return (
        <EntityDetailShell
            eyebrow="LOYALTY PROGRAM"
            title="New Loyalty Program"
            back={{ href: '/dashboard/sabthrive/loyalty', label: 'Loyalty' }}
        >

            <form action={formAction}>
                <Card className="p-6 w-full">
                    <div className="space-y-5">
                        {/* Program Name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-[var(--st-text)]">
                                Program Name <span className="text-[var(--st-danger)]">*</span>
                            </Label>
                            <Input
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
                                <Label htmlFor="pointsPerCurrencyUnit" className="text-[var(--st-text)]">
                                    Points per ₹1 Spent
                                </Label>
                                <Input
                                    id="pointsPerCurrencyUnit"
                                    name="pointsPerCurrencyUnit"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    defaultValue={1}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="redemptionRatio" className="text-[var(--st-text)]">
                                    Points needed per ₹1 Redemption
                                </Label>
                                <Input
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
                                <Label htmlFor="minRedemptionPoints" className="text-[var(--st-text)]">
                                    Min Redemption Points
                                </Label>
                                <Input
                                    id="minRedemptionPoints"
                                    name="minRedemptionPoints"
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="Optional"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="expiryDays" className="text-[var(--st-text)]">
                                    Points Expiry (days)
                                </Label>
                                <Input
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
                            <Label htmlFor="welcomeBonus" className="text-[var(--st-text)]">
                                Welcome Bonus Points
                            </Label>
                            <Input
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
                            <Label htmlFor="notes" className="text-[var(--st-text)]">
                                Notes
                            </Label>
                            <Textarea
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
                </Card>
            </form>
        </EntityDetailShell>
    );
}
