'use client';

import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  FileUp,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <OfferForm /> — create + edit form for HR offers.
 *
 * Binds to `saveOffer` via `useActionState`. The offer-letter slot uses
 * `<SabFilePickerButton>` because SabFiles policy forbids free-text URL
 * paste for file inputs.
 */

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';

import { saveOffer } from '@/app/actions/crm-offers.actions';
import type {
    CrmOfferDoc,
    CrmOfferSalaryPeriod,
    CrmOfferStatus,
} from '@/lib/rust-client/crm-offers';

const BASE = '/dashboard/hrm/hr/offers';

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface OfferFormProps {
    initialData?: CrmOfferDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };

const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create offer'}
        </Button>
    );
}

export function OfferForm({ initialData }: OfferFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveOffer, initialState);

    const [offerLetterUrl, setOfferLetterUrl] = useState<string>(
        initialData?.offerLetterUrl ?? '',
    );
    const [offerLetterName, setOfferLetterName] = useState<string>(() => {
        const u = initialData?.offerLetterUrl;
        if (!u) return '';
        try {
            const path = new URL(u, 'http://x').pathname;
            return decodeURIComponent(path.split('/').pop() ?? '') || u;
        } catch {
            return u;
        }
    });

    const [salaryPeriod, setSalaryPeriod] = useState<CrmOfferSalaryPeriod>(
        (initialData?.salaryPeriod as CrmOfferSalaryPeriod) ?? 'annual',
    );
    const [status, setStatus] = useState<CrmOfferStatus>(
        (initialData?.status as CrmOfferStatus) ?? 'draft',
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const onPickLetter = (pick: SabFilePick) => {
        setOfferLetterUrl(pick.url);
        setOfferLetterName(pick.name);
    };
    const clearLetter = () => {
        setOfferLetterUrl('');
        setOfferLetterName('');
    };

    const benefitsInitial = Array.isArray(initialData?.benefits)
        ? (initialData?.benefits ?? []).join(', ')
        : '';

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="offerId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="offerLetterUrl" value={offerLetterUrl} />

                {/* Row 1: Candidate id + name */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="candidateId">Candidate id *</Label>
                        <Input
                            id="candidateId"
                            name="candidateId"
                            required
                            placeholder="Candidate record id"
                            defaultValue={initialData?.candidateId ?? ''}
                            readOnly={isEditing}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="candidateName">Candidate name</Label>
                        <Input
                            id="candidateName"
                            name="candidateName"
                            placeholder="e.g. Priya Sharma"
                            defaultValue={initialData?.candidateName ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Job id + title */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="jobId">Job id</Label>
                        <Input
                            id="jobId"
                            name="jobId"
                            placeholder="Optional"
                            defaultValue={initialData?.jobId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="jobTitle">Job title</Label>
                        <Input
                            id="jobTitle"
                            name="jobTitle"
                            placeholder="e.g. Senior Frontend Engineer"
                            defaultValue={initialData?.jobTitle ?? ''}
                        />
                    </div>
                </div>

                {/* Row 3: Salary amount + currency + period */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="salaryAmount">Salary amount *</Label>
                        <Input
                            id="salaryAmount"
                            name="salaryAmount"
                            type="number"
                            min={0}
                            required
                            placeholder="1200000"
                            defaultValue={
                                initialData?.salaryAmount != null
                                    ? String(initialData.salaryAmount)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Currency</Label>
                        <EntityFormField
                            entity="currency"
                            name="salaryCurrency"
                            initialId={initialData?.salaryCurrency ?? 'INR'}
                            allowCreate
                            placeholder="INR"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Period</Label>
                        <EnumFormField
                            enumName="offerSalaryPeriod"
                            name="salaryPeriod"
                            initialId={salaryPeriod}
                            onChange={(id) =>
                                setSalaryPeriod(
                                    (id as CrmOfferSalaryPeriod) ?? 'annual',
                                )
                            }
                            placeholder="Period"
                        />
                    </div>
                </div>

                {/* Row 4: Bonus + equity */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="bonus">Bonus</Label>
                        <Input
                            id="bonus"
                            name="bonus"
                            type="number"
                            min={0}
                            placeholder="Optional bonus amount"
                            defaultValue={
                                initialData?.bonus != null
                                    ? String(initialData.bonus)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="equity">Equity</Label>
                        <Input
                            id="equity"
                            name="equity"
                            placeholder="e.g. 0.1% over 4y"
                            defaultValue={initialData?.equity ?? ''}
                        />
                    </div>
                </div>

                {/* Row 5: Benefits */}
                <div className="space-y-1.5">
                    <Label htmlFor="benefits">Benefits</Label>
                    <Input
                        id="benefits"
                        name="benefits"
                        placeholder="health, gratuity, relocation"
                        defaultValue={benefitsInitial}
                    />
                </div>

                {/* Row 6: Offer letter (SabFile) */}
                <div className="space-y-1.5">
                    <Label>Offer letter</Label>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="document"
                            onPick={onPickLetter}
                            title="Pick an offer letter"
                        >
                            <FileUp className="mr-1.5 h-4 w-4" />
                            {offerLetterUrl
                                ? 'Replace letter'
                                : 'Choose from SabFiles'}
                        </SabFilePickerButton>
                        {offerLetterUrl ? (
                            <>
                                <a
                                    href={offerLetterUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="max-w-[260px] truncate text-[12.5px] text-[var(--st-text)] underline-offset-2 hover:underline"
                                >
                                    {offerLetterName || offerLetterUrl}
                                </a>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearLetter}
                                >
                                    Remove
                                </Button>
                            </>
                        ) : (
                            <span className="text-[12px] text-[var(--st-text-secondary)]">
                                No offer letter attached.
                            </span>
                        )}
                    </div>
                </div>

                {/* Row 7: Joining + Expiry */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="joiningDate">Joining date</Label>
                        <Input
                            id="joiningDate"
                            name="joiningDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.joiningDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="expiresAt">Expires at</Label>
                        <Input
                            id="expiresAt"
                            name="expiresAt"
                            type="date"
                            defaultValue={toDateInput(initialData?.expiresAt)}
                        />
                    </div>
                </div>

                {/* Row 8: Approver + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Approver</Label>
                        <EntityFormField
                            entity="employee"
                            name="approverId"
                            initialId={initialData?.approverId ?? null}
                            allowCreate
                            placeholder="Approver"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            enumName="offerStatus"
                            name="status"
                            initialId={status}
                            onChange={(id) =>
                                setStatus((id as CrmOfferStatus) ?? 'draft')
                            }
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Row 9: Notes */}
                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Internal notes."
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Row 10: Response notes (edit only) */}
                {isEditing ? (
                    <div className="space-y-1.5">
                        <Label htmlFor="responseNotes">
                            Response notes
                        </Label>
                        <Textarea
                            id="responseNotes"
                            name="responseNotes"
                            rows={2}
                            placeholder="Captured when candidate responds."
                            defaultValue={initialData?.responseNotes ?? ''}
                        />
                    </div>
                ) : null}

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to offers
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
