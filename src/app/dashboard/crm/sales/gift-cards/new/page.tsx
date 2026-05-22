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
import { EntityFormField } from '@/components/crm/entity-form-field';
import { saveGiftCard } from '@/app/actions/crm-gift-cards.actions';

export const dynamic = 'force-dynamic';

const initialState = { message: '', error: '' };

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            Save Gift Card
        </Button>
    );
}

export default function NewGiftCardPage() {
    const [state, formAction] = useActionState(saveGiftCard, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Gift Card Created', description: state.message });
            router.push('/dashboard/crm/sales/gift-cards');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);

    return (
        <EntityDetailShell
            eyebrow="GIFT CARD"
            title="New Gift Card"
            back={{ href: '/dashboard/crm/sales/gift-cards', label: 'Gift Cards' }}
        >

            <form action={formAction}>
                <Card className="p-6 space-y-6">
                    {/* Code */}
                    <div className="space-y-1.5">
                        <Label htmlFor="code" className="text-zoru-ink">
                            Gift Card Code
                        </Label>
                        <Input
                            id="code"
                            name="code"
                            placeholder="e.g. SUMMER25 — leave blank to auto-generate"
                            maxLength={50}
                        />
                        <p className="text-[12px] text-zoru-ink-muted">
                            Auto-uppercased. If left blank, a code will be generated automatically.
                        </p>
                    </div>

                    {/* Issued To + Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <Label className="text-zoru-ink">Issued To</Label>
                            <EntityFormField
                                entity="client"
                                name="clientId"
                                dualWriteName="issuedTo"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="issuedToEmail" className="text-zoru-ink">
                                Customer Email
                            </Label>
                            <Input
                                id="issuedToEmail"
                                name="issuedToEmail"
                                type="email"
                                placeholder="customer@example.com"
                                maxLength={200}
                            />
                        </div>
                    </div>

                    {/* Value + Expiry */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <Label htmlFor="value" className="text-zoru-ink">
                                Value (₹) *
                            </Label>
                            <Input
                                id="value"
                                name="value"
                                type="number"
                                min="1"
                                step="0.01"
                                placeholder="500"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="expiryDate" className="text-zoru-ink">
                                Expiry Date
                            </Label>
                            <Input
                                id="expiryDate"
                                name="expiryDate"
                                type="date"
                            />
                        </div>
                    </div>

                    {/* Transferable */}
                    <div className="flex items-center gap-3">
                        <input
                            id="transferable"
                            name="transferable"
                            type="checkbox"
                            className="h-4 w-4 rounded border-zoru-line accent-zoru-ink"
                        />
                        <Label htmlFor="transferable" className="text-zoru-ink cursor-pointer">
                            Transferable
                        </Label>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <Label htmlFor="notes" className="text-zoru-ink">
                            Notes
                        </Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            placeholder="Optional internal notes about this gift card…"
                            maxLength={500}
                        />
                    </div>

                    <div className="flex justify-end pt-2">
                        <SaveButton />
                    </div>
                </Card>
            </form>
        </EntityDetailShell>
    );
}
