'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
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
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
  Award,
  LoaderCircle,
  Save,
  X,
  } from 'lucide-react';

// TODO 1E.sweep: type -> <EnumFormField enumName="recognitionType">; recipient/nominator -> <EntityFormField entity="employee">. See plan §1E.

/**
 * <RecognitionForm /> — shared create/edit form for HR Recognition.
 *
 * Wraps `saveRecognition` from `crm-recognitions.actions.ts` with
 * `useActionState` + `useFormStatus`. When `initialData` is supplied the
 * form acts as an edit form (a hidden `recognitionId` input is rendered
 * and the action takes the update branch).
 *
 * SabFiles policy: the badge image comes ONLY from the SabFiles library /
 * upload — there is NO free-text URL paste.
 */

import * as React from 'react';

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import {
    saveRecognition,
    type CrmRecognitionCategory,
    type CrmRecognitionDoc,
    type CrmRecognitionStatus,
} from '@/app/actions/crm-recognitions.actions';

const BASE = '/dashboard/hrm/hr/recognition';

const CATEGORY_OPTIONS: Array<{ value: CrmRecognitionCategory; label: string }> = [
    { value: 'achievement', label: 'Achievement' },
    { value: 'teamwork', label: 'Teamwork' },
    { value: 'leadership', label: 'Leadership' },
    { value: 'innovation', label: 'Innovation' },
    { value: 'customer_service', label: 'Customer service' },
    { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS: Array<{ value: CrmRecognitionStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'pending', label: 'Pending approval' },
    { value: 'approved', label: 'Approved' },
    { value: 'archived', label: 'Archived' },
];

const initialState: { message?: string; error?: string; id?: string } = {};

function nameFromUrl(url: string): string {
    if (!url) return '';
    try {
        const path = new URL(url, 'http://x').pathname;
        const last = path.split('/').filter(Boolean).pop() ?? '';
        const decoded = decodeURIComponent(last);
        return decoded.replace(/^[0-9a-f]{16,}-/i, '') || decoded || url;
    } catch {
        return url;
    }
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Send recognition'}
        </ZoruButton>
    );
}

export interface RecognitionFormProps {
    initialData?: CrmRecognitionDoc | null;
}

export function RecognitionForm({ initialData }: RecognitionFormProps) {
    const isEditing = !!initialData?._id;
    const router = useRouter();
    const { toast } = useZoruToast();

    const [state, formAction] = useActionState(saveRecognition, initialState);

    // Badge state (SabFiles only).
    const [badgeUrl, setBadgeUrl] = React.useState<string>(
        initialData?.badgeUrl ?? '',
    );
    const [badgeName, setBadgeName] = React.useState<string>(() =>
        initialData?.badgeUrl ? nameFromUrl(initialData.badgeUrl) : '',
    );

    // Driven selects.
    const [category, setCategory] = React.useState<CrmRecognitionCategory>(
        (initialData?.category as CrmRecognitionCategory) ?? 'achievement',
    );
    const [status, setStatus] = React.useState<CrmRecognitionStatus>(
        (initialData?.status as CrmRecognitionStatus) ?? 'approved',
    );

    React.useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) {
                router.push(`${BASE}/${id}`);
            } else {
                router.push(BASE);
            }
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const onPickBadge = React.useCallback((pick: SabFilePick) => {
        setBadgeUrl(pick.url);
        setBadgeName(pick.name);
    }, []);

    const clearBadge = React.useCallback(() => {
        setBadgeUrl('');
        setBadgeName('');
    }, []);

    return (
        <form action={formAction} className="flex flex-col gap-6">
            {isEditing ? (
                <input
                    type="hidden"
                    name="recognitionId"
                    value={String(initialData!._id)}
                />
            ) : null}
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="badgeUrl" value={badgeUrl} />

            {/* Recipient */}
            <ZoruCard className="p-6">
                <div className="mb-4 text-[14px] font-medium text-zoru-ink">
                    Recipient
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="toEmployeeName">
                            Recipient name *
                        </ZoruLabel>
                        <ZoruInput
                            id="toEmployeeName"
                            name="toEmployeeName"
                            required
                            placeholder="Employee being recognized"
                            defaultValue={initialData?.toEmployeeName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="toEmployeeId">
                            Recipient employee ID
                        </ZoruLabel>
                        <ZoruInput
                            id="toEmployeeId"
                            name="toEmployeeId"
                            placeholder="Optional internal id"
                            defaultValue={initialData?.toEmployeeId ?? ''}
                        />
                    </div>
                </div>
            </ZoruCard>

            {/* From */}
            <ZoruCard className="p-6">
                <div className="mb-4 text-[14px] font-medium text-zoru-ink">
                    From
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="fromEmployeeName">
                            Recognized by
                        </ZoruLabel>
                        <ZoruInput
                            id="fromEmployeeName"
                            name="fromEmployeeName"
                            placeholder="Person sending the recognition"
                            defaultValue={initialData?.fromEmployeeName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="fromEmployeeId">
                            Sender employee ID
                        </ZoruLabel>
                        <ZoruInput
                            id="fromEmployeeId"
                            name="fromEmployeeId"
                            placeholder="Optional internal id"
                            defaultValue={initialData?.fromEmployeeId ?? ''}
                        />
                    </div>
                </div>
            </ZoruCard>

            {/* Recognition body */}
            <ZoruCard className="p-6">
                <div className="mb-4 text-[14px] font-medium text-zoru-ink">
                    Recognition
                </div>
                <div className="flex flex-col gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="category-trigger">
                                Category
                            </ZoruLabel>
                            <ZoruSelect
                                value={category}
                                onValueChange={(v) =>
                                    setCategory(v as CrmRecognitionCategory)
                                }
                            >
                                <ZoruSelectTrigger id="category-trigger">
                                    <ZoruSelectValue placeholder="Category" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {CATEGORY_OPTIONS.map((o) => (
                                        <ZoruSelectItem
                                            key={o.value}
                                            value={o.value}
                                        >
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="points">Points</ZoruLabel>
                            <ZoruInput
                                id="points"
                                name="points"
                                type="number"
                                min={0}
                                placeholder="0"
                                defaultValue={initialData?.points ?? ''}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="message">Message *</ZoruLabel>
                        <ZoruTextarea
                            id="message"
                            name="message"
                            rows={6}
                            required
                            placeholder="Tell them what they did and why it matters."
                            defaultValue={initialData?.message ?? ''}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="awardProgramId">
                            Award program ID
                        </ZoruLabel>
                        <ZoruInput
                            id="awardProgramId"
                            name="awardProgramId"
                            placeholder="Optional — link to an award programme"
                            defaultValue={initialData?.awardProgramId ?? ''}
                        />
                    </div>
                </div>
            </ZoruCard>

            {/* Badge — SabFiles only */}
            <ZoruCard className="p-6">
                <div className="mb-1 text-[14px] font-medium text-zoru-ink">
                    Badge image
                </div>
                <p className="mb-4 text-[12px] text-zoru-ink-muted">
                    Pick from your SabFiles library or upload a new image.
                    External URLs are not supported.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    {badgeUrl ? (
                        <div className="flex items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface/40 p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={badgeUrl}
                                alt=""
                                className="h-12 w-12 rounded object-cover"
                            />
                            <span className="max-w-[180px] truncate text-xs text-zoru-ink">
                                {badgeName || 'Badge image'}
                            </span>
                            <ZoruButton
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Remove badge"
                                onClick={clearBadge}
                            >
                                <X className="h-4 w-4" />
                            </ZoruButton>
                        </div>
                    ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-[var(--zoru-radius)] border border-dashed border-zoru-line text-zoru-ink-muted">
                            <Award className="h-5 w-5" />
                        </div>
                    )}
                    <SabFilePickerButton
                        accept="image"
                        title="Pick a recognition badge"
                        onPick={onPickBadge}
                        variant="outline"
                    >
                        {badgeUrl ? 'Change badge' : 'Pick from SabFiles'}
                    </SabFilePickerButton>
                </div>
            </ZoruCard>

            {/* Visibility + status */}
            <ZoruCard className="p-6">
                <div className="mb-4 text-[14px] font-medium text-zoru-ink">
                    Visibility & status
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex items-center gap-2 pt-7 text-[13px] text-zoru-ink">
                        <ZoruCheckbox
                            id="isPublic"
                            name="isPublic"
                            defaultChecked={!!initialData?.isPublic}
                        />
                        Publish to the company feed
                    </label>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) =>
                                setStatus(v as CrmRecognitionStatus)
                            }
                        >
                            <ZoruSelectTrigger id="status-trigger">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <ZoruSelectItem
                                        key={o.value}
                                        value={o.value}
                                    >
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>
            </ZoruCard>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2">
                <ZoruButton variant="ghost" asChild>
                    <Link
                        href={
                            isEditing && initialData?._id
                                ? `${BASE}/${initialData._id}`
                                : BASE
                        }
                    >
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        Cancel
                    </Link>
                </ZoruButton>
                <SubmitButton isEditing={isEditing} />
            </div>
        </form>
    );
}
