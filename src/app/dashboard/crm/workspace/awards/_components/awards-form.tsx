'use client';

import {
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
  useActionState,
  useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { EntityFormShell } from '@/components/crm/entity-form-shell';

/**
 * Award form (§1D.3) — shared by /new and /[id]/edit.
 * Preserves FormData keys used by `saveAward`: title, summary, icon,
 * frequency. Adds optional `criteria` and `prize` keys (genericSave
 * passes them through).
 */

import { saveAward } from '@/app/actions/worksuite/knowledge.actions';
import type { WsAward } from '@/lib/worksuite/knowledge-types';

export interface AwardsFormProps {
    mode: 'new' | 'edit';
    award?: (WsAward & { _id: string; criteria?: string; prize?: string }) | null;
}

export function AwardsForm({ mode, award }: AwardsFormProps): React.JSX.Element {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = useActionState(saveAward, {
        message: '',
        error: '',
    } as { message?: string; error?: string });

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            router.push('/dashboard/crm/workspace/awards');
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    return (
        <EntityFormShell
            title={mode === 'edit' ? 'Edit award' : 'New award program'}
            subtitle="Define a recognition program with a period, criteria, and prize."
            action={formAction}
            cancelHref="/dashboard/crm/workspace/awards"
            submitLabel={mode === 'edit' ? 'Save changes' : 'Create award'}
            hiddenInputs={award?._id ? <input type="hidden" name="id" value={award._id} /> : null}
            error={state?.error}
            message={state?.message}
            sections={[
                {
                    id: 'basics',
                    title: 'Basics',
                    description: 'Name, icon, and short summary.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <ZoruLabel htmlFor="title">Program name *</ZoruLabel>
                                <ZoruInput
                                    id="title"
                                    name="title"
                                    required
                                    defaultValue={award?.title ?? ''}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <ZoruLabel htmlFor="summary">Summary</ZoruLabel>
                                <ZoruTextarea
                                    id="summary"
                                    name="summary"
                                    rows={3}
                                    defaultValue={award?.summary ?? ''}
                                    className="mt-1.5"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="icon">Icon (emoji)</ZoruLabel>
                                <ZoruInput
                                    id="icon"
                                    name="icon"
                                    defaultValue={award?.icon ?? '🏆'}
                                    placeholder="🏆"
                                    className="mt-1.5 h-10"
                                />
                            </div>
                            <div>
                                <ZoruLabel>Frequency *</ZoruLabel>
                                <div className="mt-1.5">
                                    <EnumFormField
                                        enumName="awardFrequency"
                                        name="frequency"
                                        initialId={award?.frequency ?? 'one-time'}
                                    />
                                </div>
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'criteria',
                    title: 'Criteria & prize',
                    description: 'How nominees qualify and what they receive.',
                    children: (
                        <div className="grid gap-4">
                            <div>
                                <ZoruLabel htmlFor="criteria">Criteria</ZoruLabel>
                                <ZoruTextarea
                                    id="criteria"
                                    name="criteria"
                                    rows={4}
                                    defaultValue={award?.criteria ?? ''}
                                    placeholder="Who qualifies and how nominations are evaluated."
                                    className="mt-1.5"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="prize">Prize / payout / certificate</ZoruLabel>
                                <ZoruTextarea
                                    id="prize"
                                    name="prize"
                                    rows={3}
                                    defaultValue={award?.prize ?? ''}
                                    placeholder="₹5,000 voucher + custom certificate, etc."
                                    className="mt-1.5"
                                />
                            </div>
                        </div>
                    ),
                },
            ]}
        />
    );
}

export default AwardsForm;
