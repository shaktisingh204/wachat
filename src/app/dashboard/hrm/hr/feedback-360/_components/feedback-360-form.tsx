'use client';

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
import {
  useActionState,
  useEffect,
  useMemo,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Plus,
  Save,
  Trash2 } from 'lucide-react';

// §1E.sweep: status migrated to <EnumFormField enumName="feedback360Status">.
// reviewer role ZoruSelect kept — no dedicated enum in catalogue yet (values: self/peer/manager/direct_report).

/**
 * <Feedback360Form /> — create + edit form for 360° feedback.
 *
 * Binds to the `saveFeedback360` server action via `useActionState`. The
 * reviewer roster + per-reviewer score grid are structured collections,
 * so they're serialised to hidden JSON inputs that the server action
 * decodes.
 *
 * Aggregated scores and overall rating are computed live in the client
 * for instant feedback, and re-computed server-side at save time so we
 * never trust client maths.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveFeedback360 } from '@/app/actions/crm-feedback-360.actions';
import type {
    Feedback360Doc,
    Feedback360ReviewerResponse,
    Feedback360ReviewerRole,
    Feedback360Status,
} from '@/app/actions/crm-feedback-360.actions';

import {
    REVIEWER_ROLE_OPTIONS,
    SCORE_CATEGORIES,
} from '../_config';

const BASE = '/dashboard/hrm/hr/feedback-360';

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function newReviewer(): Feedback360ReviewerResponse {
    return {
        reviewerId: '',
        role: 'peer',
        scores: {},
        comments: '',
    };
}

function clamp1to5(v: number): number {
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(5, v));
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
            {isEditing ? 'Save changes' : 'Create review'}
        </ZoruButton>
    );
}

interface Feedback360FormProps {
    initialData?: Feedback360Doc | null;
}

export function Feedback360Form({ initialData }: Feedback360FormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveFeedback360, initialState);

    const [status, setStatus] = useState<Feedback360Status>(
        (initialData?.status as Feedback360Status) ?? 'draft',
    );
    const [reviewers, setReviewers] = useState<Feedback360ReviewerResponse[]>(
        Array.isArray(initialData?.reviewerResponses)
            ? (initialData!.reviewerResponses as Feedback360ReviewerResponse[])
            : [],
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

    const addReviewer = () => setReviewers((rs) => [...rs, newReviewer()]);
    const removeReviewer = (idx: number) =>
        setReviewers((rs) => rs.filter((_, i) => i !== idx));

    const updateReviewer = <K extends keyof Feedback360ReviewerResponse>(
        idx: number,
        field: K,
        value: Feedback360ReviewerResponse[K],
    ) => {
        setReviewers((rs) =>
            rs.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
        );
    };

    const updateReviewerScore = (
        idx: number,
        key: string,
        raw: string,
    ) => {
        setReviewers((rs) =>
            rs.map((r, i) => {
                if (i !== idx) return r;
                const next = { ...(r.scores ?? {}) };
                if (raw === '') {
                    delete next[key];
                } else {
                    next[key] = clamp1to5(Number(raw));
                }
                return { ...r, scores: next };
            }),
        );
    };

    // Derived: reviewerIds + aggregated preview.
    const reviewerIds = useMemo(
        () =>
            reviewers
                .map((r) => r.reviewerId.trim())
                .filter((id) => id.length > 0),
        [reviewers],
    );

    const { aggregated, overall } = useMemo(() => {
        const sums = new Map<string, { total: number; n: number }>();
        for (const r of reviewers) {
            if (!r.scores) continue;
            for (const [k, v] of Object.entries(r.scores)) {
                const slot = sums.get(k) ?? { total: 0, n: 0 };
                slot.total += v;
                slot.n += 1;
                sums.set(k, slot);
            }
        }
        const aggregated: Record<string, number> = {};
        for (const [k, { total, n }] of sums.entries()) {
            if (n > 0) aggregated[k] = Math.round((total / n) * 100) / 100;
        }
        const vals = Object.values(aggregated);
        const overall =
            vals.length > 0
                ? Math.round(
                      (vals.reduce((a, b) => a + b, 0) / vals.length) * 100,
                  ) / 100
                : null;
        return { aggregated, overall };
    }, [reviewers]);

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="reviewId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="status" value={status} />
                <input
                    type="hidden"
                    name="reviewerIds"
                    value={JSON.stringify(reviewerIds)}
                />
                <input
                    type="hidden"
                    name="reviewerResponses"
                    value={JSON.stringify(reviewers)}
                />

                {/* Row 1: Employee */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeId">Employee id *</ZoruLabel>
                        <ZoruInput
                            id="employeeId"
                            name="employeeId"
                            required
                            placeholder="Employee id"
                            defaultValue={initialData?.employeeId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeName">Employee name</ZoruLabel>
                        <ZoruInput
                            id="employeeName"
                            name="employeeName"
                            placeholder="Display name"
                            defaultValue={initialData?.employeeName ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Period + status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="period">Period</ZoruLabel>
                        <ZoruInput
                            id="period"
                            name="period"
                            placeholder="e.g. 2026-Q2"
                            defaultValue={initialData?.period ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            name="status-picker"
                            enumName="feedback360Status"
                            initialId={status}
                            onChange={(id) => setStatus((id as Feedback360Status) ?? 'draft')}
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Row 3: Completed date */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="completedAt">Completed at</ZoruLabel>
                    <ZoruInput
                        id="completedAt"
                        name="completedAt"
                        type="date"
                        defaultValue={toDateInput(initialData?.completedAt)}
                    />
                </div>

                {/* Reviewer roster */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <ZoruLabel>Reviewers</ZoruLabel>
                            <p className="text-[11.5px] text-zoru-ink-muted">
                                Each reviewer answers the same score grid (1–5). Scores
                                are averaged per dimension and into an overall rating.
                            </p>
                        </div>
                        <ZoruButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addReviewer}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add reviewer
                        </ZoruButton>
                    </div>
                    {reviewers.length === 0 ? (
                        <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                            No reviewers yet. Click &ldquo;Add reviewer&rdquo; to start.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {reviewers.map((r, idx) => (
                                <div
                                    key={idx}
                                    className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3"
                                >
                                    <div className="mb-2 flex flex-wrap items-end gap-2">
                                        <div className="flex-1 space-y-1.5">
                                            <ZoruLabel htmlFor={`rev-id-${idx}`}>
                                                Reviewer id *
                                            </ZoruLabel>
                                            <ZoruInput
                                                id={`rev-id-${idx}`}
                                                value={r.reviewerId}
                                                onChange={(e) =>
                                                    updateReviewer(idx, 'reviewerId', e.target.value)
                                                }
                                                placeholder="user_…"
                                            />
                                        </div>
                                        <div className="w-[180px] space-y-1.5">
                                            <ZoruLabel>Role</ZoruLabel>
                                            <ZoruSelect
                                                value={r.role}
                                                onValueChange={(v) =>
                                                    updateReviewer(
                                                        idx,
                                                        'role',
                                                        v as Feedback360ReviewerRole,
                                                    )
                                                }
                                            >
                                                <ZoruSelectTrigger>
                                                    <ZoruSelectValue />
                                                </ZoruSelectTrigger>
                                                <ZoruSelectContent>
                                                    {REVIEWER_ROLE_OPTIONS.map((o) => (
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
                                        <ZoruButton
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeReviewer(idx)}
                                            aria-label="Remove reviewer"
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </ZoruButton>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-5">
                                        {SCORE_CATEGORIES.map((cat) => (
                                            <div key={cat.key} className="space-y-1.5">
                                                <ZoruLabel
                                                    htmlFor={`rev-${idx}-${cat.key}`}
                                                    className="text-[11.5px]"
                                                >
                                                    {cat.label}
                                                </ZoruLabel>
                                                <ZoruInput
                                                    id={`rev-${idx}-${cat.key}`}
                                                    type="number"
                                                    min={0}
                                                    max={5}
                                                    step={0.5}
                                                    value={
                                                        typeof r.scores?.[cat.key] === 'number'
                                                            ? String(r.scores[cat.key])
                                                            : ''
                                                    }
                                                    onChange={(e) =>
                                                        updateReviewerScore(
                                                            idx,
                                                            cat.key,
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="1–5"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 space-y-1.5">
                                        <ZoruLabel htmlFor={`rev-comments-${idx}`}>
                                            Comments
                                        </ZoruLabel>
                                        <ZoruTextarea
                                            id={`rev-comments-${idx}`}
                                            rows={2}
                                            value={r.comments ?? ''}
                                            onChange={(e) =>
                                                updateReviewer(idx, 'comments', e.target.value)
                                            }
                                            placeholder="Qualitative feedback from this reviewer…"
                                        />
                                    </div>
                                    <div className="mt-2 space-y-1.5">
                                        <ZoruLabel htmlFor={`rev-submitted-${idx}`}>
                                            Submitted at
                                        </ZoruLabel>
                                        <ZoruInput
                                            id={`rev-submitted-${idx}`}
                                            type="date"
                                            value={
                                                r.submittedAt
                                                    ? toDateInput(r.submittedAt)
                                                    : ''
                                            }
                                            onChange={(e) =>
                                                updateReviewer(
                                                    idx,
                                                    'submittedAt',
                                                    e.target.value || undefined,
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Live aggregate preview */}
                <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="text-[13px] font-medium text-zoru-ink">
                            Aggregated scores (preview)
                        </div>
                        <div className="text-[12.5px] text-zoru-ink-muted">
                            Overall:{' '}
                            <span className="font-mono tabular-nums text-zoru-ink">
                                {overall != null ? overall.toFixed(2) : '—'}
                            </span>
                        </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-5">
                        {SCORE_CATEGORIES.map((cat) => (
                            <div
                                key={cat.key}
                                className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-2 py-1.5 text-center"
                            >
                                <div className="text-[10.5px] uppercase tracking-wide text-zoru-ink-muted">
                                    {cat.label}
                                </div>
                                <div className="font-mono text-[14px] tabular-nums text-zoru-ink">
                                    {typeof aggregated[cat.key] === 'number'
                                        ? aggregated[cat.key].toFixed(2)
                                        : '—'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Manual overall override */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="overallRating">
                            Overall rating override
                        </ZoruLabel>
                        <ZoruInput
                            id="overallRating"
                            name="overallRating"
                            type="number"
                            min={0}
                            max={5}
                            step={0.1}
                            placeholder="Leave blank to use computed average"
                            defaultValue={
                                typeof initialData?.overallRating === 'number'
                                    ? String(initialData.overallRating)
                                    : ''
                            }
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to reviews
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
