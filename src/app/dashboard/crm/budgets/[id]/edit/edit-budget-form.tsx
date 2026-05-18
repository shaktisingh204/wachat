'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Save } from 'lucide-react';

import { updateBudget } from '@/app/actions/crm-budgets.actions';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import type { EntityKey } from '@/lib/lookup-registry';

type HeadType = 'account' | 'department' | 'project';

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
    const [headType, setHeadType] = useState<HeadType>(
        (budget?.budgetHeadType as HeadType) ?? 'account',
    );

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
        <EntityDetailShell
            eyebrow="BUDGET"
            title="Edit Budget"
            back={{ href: `/dashboard/crm/budgets/${budgetId}`, label: 'Back to budget' }}
        >
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="id" value={budgetId} />
                <ZoruCard className="p-6">
                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel
                                    htmlFor="budgetHeadType"
                                    className="text-[12.5px] text-zoru-ink-muted"
                                >
                                    Head Type
                                </ZoruLabel>
                                <ZoruInput
                                    id="budgetHeadType"
                                    name="budgetHeadType"
                                    value={headType}
                                    onChange={(e) => setHeadType(e.target.value as HeadType)}
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                                    Budget Head
                                </ZoruLabel>
                                <EntityFormField
                                    entity={headType as EntityKey}
                                    name="budgetHeadId"
                                    dualWriteName="budgetHead"
                                    initialId={budget.budgetHeadId ?? null}
                                    initialLabel={budget.budgetHead ?? ''}
                                    required
                                    placeholder="Select head…"
                                />
                            </div>
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
                            <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                                Owner
                            </ZoruLabel>
                            <EntityFormField
                                entity="user"
                                name="ownerId"
                                dualWriteName="ownerName"
                                initialId={budget.ownerId ?? null}
                                initialLabel={budget.ownerName ?? ''}
                                placeholder="Select owner…"
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
        </EntityDetailShell>
    );
}
