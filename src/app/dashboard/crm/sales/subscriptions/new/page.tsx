'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, Save, LoaderCircle, Repeat } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ZoruButton,
    ZoruCard,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
import { DatePicker } from '@/components/ui/date-picker';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { saveSubscription } from '@/app/actions/crm-subscriptions.actions';

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
            Save Subscription
        </ZoruButton>
    );
}

export default function NewSubscriptionPage() {
    const [state, formAction] = useActionState(saveSubscription, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();

    const [startDate, setStartDate] = useState<Date | undefined>(undefined);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/sales/subscriptions');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="New Subscription"
                subtitle="Add a recurring subscription plan."
                icon={Repeat}
                actions={
                    <Link href="/dashboard/crm/sales/subscriptions">
                        <ZoruButton variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </ZoruButton>
                    </Link>
                }
            />

            <form action={formAction}>
                {/* hidden input carries the ISO date string for startDate */}
                <input
                    type="hidden"
                    name="startDate"
                    value={startDate ? startDate.toISOString() : ''}
                />

                <ZoruCard className="p-6 max-w-xl">
                    <div className="space-y-5">
                        {/* Plan Name */}
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="planName" className="text-zoru-ink">
                                Plan Name <span className="text-zoru-danger-ink">*</span>
                            </ZoruLabel>
                            <ZoruInput
                                id="planName"
                                name="planName"
                                required
                                placeholder="e.g. Pro Monthly"
                                maxLength={120}
                            />
                        </div>

                        {/* Customer Name */}
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="customerName" className="text-zoru-ink">
                                Customer Name
                            </ZoruLabel>
                            <ZoruInput
                                id="customerName"
                                name="customerName"
                                placeholder="e.g. Acme Corp"
                                maxLength={120}
                            />
                        </div>

                        {/* Billing Frequency + Billing Amount */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="frequency" className="text-zoru-ink">
                                    Billing Frequency
                                </ZoruLabel>
                                <ZoruSelect name="frequency" defaultValue="monthly">
                                    <ZoruSelectTrigger id="frequency">
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="monthly">Monthly</ZoruSelectItem>
                                        <ZoruSelectItem value="quarterly">Quarterly</ZoruSelectItem>
                                        <ZoruSelectItem value="annual">Annual</ZoruSelectItem>
                                        <ZoruSelectItem value="custom">Custom</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>

                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="billingAmount" className="text-zoru-ink">
                                    Billing Amount
                                </ZoruLabel>
                                <ZoruInput
                                    id="billingAmount"
                                    name="billingAmount"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Currency + Trial Days */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="currency" className="text-zoru-ink">
                                    Currency
                                </ZoruLabel>
                                <ZoruSelect name="currency" defaultValue="INR">
                                    <ZoruSelectTrigger id="currency">
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="INR">INR (₹)</ZoruSelectItem>
                                        <ZoruSelectItem value="USD">USD ($)</ZoruSelectItem>
                                        <ZoruSelectItem value="EUR">EUR (€)</ZoruSelectItem>
                                        <ZoruSelectItem value="GBP">GBP (£)</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>

                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="trialDays" className="text-zoru-ink">
                                    Trial Days
                                </ZoruLabel>
                                <ZoruInput
                                    id="trialDays"
                                    name="trialDays"
                                    type="number"
                                    min={0}
                                    step={1}
                                    defaultValue={0}
                                />
                            </div>
                        </div>

                        {/* Start Date */}
                        <div className="space-y-1.5">
                            <ZoruLabel className="text-zoru-ink">Start Date</ZoruLabel>
                            <DatePicker
                                date={startDate}
                                setDate={setStartDate}
                                placeholder="Pick a start date"
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
                                placeholder="Optional notes about this subscription…"
                                maxLength={500}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end pt-2">
                            <SaveButton />
                        </div>
                    </div>
                </ZoruCard>
            </form>
        </div>
    );
}
