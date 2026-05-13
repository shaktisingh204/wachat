'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle, PiggyBank, Save } from 'lucide-react';

import { updateBudget } from '@/app/actions/crm-budgets.actions';
import {
    ZoruButton,
    ZoruCard,
    ZoruInput,
    ZoruLabel,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';

interface Props {
    budget: any;
    budgetId: string;
}

const initialState = { message: null, error: null, id: undefined } as any;

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
                <Save className="h-4 w-4" strokeWidth={1.75} />
            )}
            Save Changes
        </ZoruButton>
    );
}

export function EditBudgetForm({ budget, budgetId }: Props) {
    const [state, formAction] = useActionState(updateBudget as any, initialState);
    const { toast } = useZoruToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success!', description: state.message });
            window.location.href = `/dashboard/crm/budgets/${state.id ?? budgetId}`;
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, budgetId]);

    return (
        <div className="flex w-full max-w-2xl flex-col gap-6">
            <Link
                href={`/dashboard/crm/budgets/${budgetId}`}
                className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
            >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                Back to Budget
            </Link>

            <CrmPageHeader
                title="Edit Budget"
                subtitle={`Update the details for ${budget.budgetHead ?? 'this budget'}.`}
                icon={PiggyBank}
            />

            <form action={formAction} ref={formRef}>
                <input type="hidden" name="id" value={budgetId} />
                <ZoruCard className="p-6">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <ZoruLabel
                                htmlFor="budgetHead"
                                className="text-[12.5px] text-zoru-ink-muted"
                            >
                                Budget Head
                            </ZoruLabel>
                            <ZoruInput
                                id="budgetHead"
                                name="budgetHead"
                                required
                                defaultValue={budget.budgetHead ?? ''}
                                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel
                                    htmlFor="period"
                                    className="text-[12.5px] text-zoru-ink-muted"
                                >
                                    Period
                                </ZoruLabel>
                                <ZoruInput
                                    id="period"
                                    name="period"
                                    defaultValue={budget.period ?? ''}
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel
                                    htmlFor="scenario"
                                    className="text-[12.5px] text-zoru-ink-muted"
                                >
                                    Scenario
                                </ZoruLabel>
                                <ZoruInput
                                    id="scenario"
                                    name="scenario"
                                    defaultValue={budget.scenario ?? 'base'}
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel
                                    htmlFor="planAmount"
                                    className="text-[12.5px] text-zoru-ink-muted"
                                >
                                    Plan amount
                                </ZoruLabel>
                                <ZoruInput
                                    id="planAmount"
                                    name="planAmount"
                                    type="number"
                                    step="0.01"
                                    defaultValue={budget.planAmount ?? 0}
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel
                                    htmlFor="alertAt"
                                    className="text-[12.5px] text-zoru-ink-muted"
                                >
                                    Alert at (%)
                                </ZoruLabel>
                                <ZoruInput
                                    id="alertAt"
                                    name="alertAt"
                                    type="number"
                                    defaultValue={budget.alertAt ?? 0}
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel
                                htmlFor="ownerName"
                                className="text-[12.5px] text-zoru-ink-muted"
                            >
                                Owner
                            </ZoruLabel>
                            <ZoruInput
                                id="ownerName"
                                name="ownerName"
                                defaultValue={budget.ownerName ?? ''}
                                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel
                                htmlFor="status"
                                className="text-[12.5px] text-zoru-ink-muted"
                            >
                                Status
                            </ZoruLabel>
                            <ZoruInput
                                id="status"
                                name="status"
                                defaultValue={budget.status ?? 'draft'}
                                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel
                                htmlFor="notes"
                                className="text-[12.5px] text-zoru-ink-muted"
                            >
                                Notes
                            </ZoruLabel>
                            <ZoruTextarea
                                id="notes"
                                name="notes"
                                defaultValue={budget.notes ?? ''}
                                className="min-h-24 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end border-t border-zoru-line pt-4">
                        <SubmitButton />
                    </div>
                </ZoruCard>
            </form>
        </div>
    );
}
