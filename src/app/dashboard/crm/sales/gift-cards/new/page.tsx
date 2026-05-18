'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  Save,
  LoaderCircle,
  Gift } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { saveGiftCard } from '@/app/actions/crm-gift-cards.actions';

export const dynamic = 'force-dynamic';

const initialState = { message: '', error: '' };

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            Save Gift Card
        </ZoruButton>
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
        <div className="max-w-2xl mx-auto space-y-6">
            <CrmPageHeader
                title="New Gift Card"
                subtitle="Create a new gift card to issue to a customer."
                icon={Gift}
                actions={
                    <Link href="/dashboard/crm/sales/gift-cards">
                        <ZoruButton variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Gift Cards
                        </ZoruButton>
                    </Link>
                }
            />

            <form action={formAction}>
                <ZoruCard className="p-6 space-y-6">
                    {/* Code */}
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="code" className="text-zoru-ink">
                            Gift Card Code
                        </ZoruLabel>
                        <ZoruInput
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
                            <ZoruLabel className="text-zoru-ink">Issued To</ZoruLabel>
                            <EntityFormField
                                entity="client"
                                name="clientId"
                                dualWriteName="issuedTo"
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
                                placeholder="customer@example.com"
                                maxLength={200}
                            />
                        </div>
                    </div>

                    {/* Value + Expiry */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="value" className="text-zoru-ink">
                                Value (₹) *
                            </ZoruLabel>
                            <ZoruInput
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
                            <ZoruLabel htmlFor="expiryDate" className="text-zoru-ink">
                                Expiry Date
                            </ZoruLabel>
                            <ZoruInput
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
                        <ZoruLabel htmlFor="transferable" className="text-zoru-ink cursor-pointer">
                            Transferable
                        </ZoruLabel>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="notes" className="text-zoru-ink">
                            Notes
                        </ZoruLabel>
                        <ZoruTextarea
                            id="notes"
                            name="notes"
                            placeholder="Optional internal notes about this gift card…"
                            maxLength={500}
                        />
                    </div>

                    <div className="flex justify-end pt-2">
                        <SaveButton />
                    </div>
                </ZoruCard>
            </form>
        </div>
    );
}
