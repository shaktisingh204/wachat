'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import React, {
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
import QRCode from 'react-qr-code';

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

    const [code, setCode] = React.useState('');
    const [value, setValue] = React.useState('');
    const [issuedTo, setIssuedTo] = React.useState('');
    const [sendEmail, setSendEmail] = React.useState(false);

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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
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
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
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
                                        onChange={(_, hydrated) => {
                                            setIssuedTo(hydrated?.chip.primary ?? '');
                                        }}
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
                                        value={value}
                                        onChange={(e) => setValue(e.target.value)}
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

                            {/* Transferable & Send Email */}
                            <div className="flex flex-col gap-3">
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
                                <div className="flex items-center gap-3">
                                    <input
                                        id="sendEmail"
                                        name="sendEmail"
                                        type="checkbox"
                                        checked={sendEmail}
                                        onChange={(e) => setSendEmail(e.target.checked)}
                                        className="h-4 w-4 rounded border-zoru-line accent-zoru-ink"
                                    />
                                    <Label htmlFor="sendEmail" className="text-zoru-ink cursor-pointer">
                                        Email gift card directly to customer upon creation
                                    </Label>
                                </div>
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
                    </div>
                    
                    <div className="lg:col-span-1">
                        <Card className="p-6 sticky top-6 bg-gradient-to-br from-zoru-brand to-zoru-brand/80 text-white shadow-xl">
                            <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide opacity-80">
                                Gift Card Preview
                            </h2>
                            <div className="bg-white/10 rounded-xl p-6 backdrop-blur-sm border border-white/20 shadow-inner">
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <p className="text-xs uppercase tracking-wider opacity-70 mb-1">Value</p>
                                        <p className="text-3xl font-bold font-mono">₹{value || '0.00'}</p>
                                    </div>
                                </div>
                                
                                <div className="mb-8 flex justify-center">
                                    <div className="bg-white p-3 rounded-lg inline-block">
                                        <QRCode value={code || 'GIFT-CARD-PREVIEW'} size={120} />
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-wider opacity-70 mb-1">Gift Code</p>
                                        <p className="text-lg font-mono tracking-widest">{code.toUpperCase() || '••••-••••-••••'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wider opacity-70 mb-1">For</p>
                                        <p className="text-sm font-medium">{issuedTo || 'Valued Customer'}</p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </form>
        </EntityDetailShell>
    );
}
