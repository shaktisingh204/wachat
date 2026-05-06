'use client';

import * as React from 'react';
import { useTransition, useActionState, useEffect, useState } from 'react';
import { Star, Plus, Pencil, Trash2, LoaderCircle } from 'lucide-react';
import { format } from 'date-fns';

import {
  ZoruCard,
  ZoruBadge,
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  getCrmAppraisalReviews,
  saveCrmAppraisalReview,
  deleteCrmAppraisalReview,
} from '@/app/actions/crm-hr-appraisals.actions';

const STATUS_VARIANTS: Record<string, 'secondary' | 'success' | 'warning' | 'danger'> = {
  Scheduled: 'warning',
  Completed: 'success',
  Cancelled: 'danger',
};

const RATING_FIELDS: { name: string; label: string }[] = [
  { name: 'rating_qualityOfWork', label: 'Quality of Work' },
  { name: 'rating_communication', label: 'Communication' },
  { name: 'rating_teamwork', label: 'Teamwork' },
  { name: 'rating_problemSolving', label: 'Problem Solving' },
  { name: 'rating_punctuality', label: 'Punctuality' },
];

function StarRating({ value }: { value: number }) {
  const n = Math.round(Math.min(5, Math.max(0, value || 0)));
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i <= n ? 'fill-yellow-400 text-yellow-400' : 'fill-transparent text-zoru-line'}`}
        />
      ))}
      <span className="ml-1 text-[12px] tabular-nums text-zoru-ink-muted">
        {value?.toFixed(1) ?? '—'}
      </span>
    </div>
  );
}

function avgRatings(ratings: Record<string, number> | undefined): number {
  if (!ratings) return 0;
  const vals = Object.values(ratings).filter((v) => typeof v === 'number') as number[];
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

const SAVE_INITIAL = { message: '', error: '' };

function ReviewFormDialog({
  open,
  onOpenChange,
  review,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  review: any | null;
  onSaved: () => void;
}) {
  const { toast } = useZoruToast();
  const [state, formAction, isPending] = useActionState(saveCrmAppraisalReview, SAVE_INITIAL);
  const isEdit = Boolean(review?._id);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      onOpenChange(false);
      onSaved();
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onOpenChange, onSaved]);

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <ZoruDialogHeader>
          <ZoruDialogTitle className="text-zoru-ink">
            {isEdit ? 'Edit Appraisal Review' : 'New Appraisal Review'}
          </ZoruDialogTitle>
          <ZoruDialogDescription className="text-zoru-ink-muted">
            Complete the performance evaluation form below.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <form action={formAction} className="space-y-5 py-2">
          {isEdit && <input type="hidden" name="id" value={review._id} />}

          {/* Core fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">
                Employee ID <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                name="employeeId"
                required
                defaultValue={review?.employeeId?.toString() ?? ''}
                placeholder="Employee ObjectId"
                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">
                Reviewer ID <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                name="reviewerId"
                required
                defaultValue={review?.reviewerId?.toString() ?? ''}
                placeholder="Reviewer ObjectId"
                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">
                Period / Cycle <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                name="reviewDate"
                type="date"
                required
                defaultValue={
                  review?.reviewDate
                    ? new Date(review.reviewDate).toISOString().slice(0, 10)
                    : ''
                }
                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">Status</ZoruLabel>
              <ZoruSelect
                name="status"
                defaultValue={review?.status ?? 'Scheduled'}
              >
                <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="Scheduled">Scheduled</ZoruSelectItem>
                  <ZoruSelectItem value="Completed">Completed</ZoruSelectItem>
                  <ZoruSelectItem value="Cancelled">Cancelled</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>

          {/* Ratings */}
          <div>
            <p className="mb-2 text-[13px] text-zoru-ink">
              Ratings (1 = Poor, 5 = Excellent)
            </p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {RATING_FIELDS.map(({ name, label }) => (
                <div key={name} className="space-y-1.5">
                  <ZoruLabel className="text-zoru-ink">{label}</ZoruLabel>
                  <ZoruInput
                    name={name}
                    type="number"
                    min={1}
                    max={5}
                    step={1}
                    defaultValue={
                      review?.ratings?.[name.replace('rating_', '')] ?? ''
                    }
                    placeholder="1–5"
                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Qualitative */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">Strengths</ZoruLabel>
              <ZoruTextarea
                name="strengths"
                rows={3}
                defaultValue={review?.strengths ?? ''}
                placeholder="Key strengths demonstrated…"
                className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">Areas of Improvement</ZoruLabel>
              <ZoruTextarea
                name="areasForImprovement"
                rows={3}
                defaultValue={review?.areasForImprovement ?? ''}
                placeholder="Opportunities to grow…"
                className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">Goals / Comments</ZoruLabel>
              <ZoruTextarea
                name="reviewerComments"
                rows={3}
                defaultValue={review?.reviewerComments ?? ''}
                placeholder="Goals for next period, additional comments…"
                className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
          </div>

          <ZoruDialogFooter className="gap-2">
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <ZoruButton
              type="submit"
              disabled={isPending}
            >
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Update Review' : 'Create Review'}
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

export default function AppraisalReviewsPage() {
  const { toast } = useZoruToast();
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const data = await getCrmAppraisalReviews();
        setReviews(data as any[]);
      } catch {
        setReviews([]);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteCrmAppraisalReview(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Appraisal review removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({ title: 'Error', description: res.error ?? 'Failed to delete', variant: 'destructive' });
    }
  };

  return (
    <>
      <ReviewFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        review={editing}
        onSaved={refresh}
      />
      <ZoruAlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle className="text-zoru-ink">Delete Review?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription className="text-zoru-ink-muted">
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="Appraisal Reviews"
          subtitle="Performance evaluations — ratings, strengths, and improvement areas."
          icon={Star}
          actions={
            <ZoruButton
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New Review
            </ZoruButton>
          }
        />

        <ZoruCard className="p-6">
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line">
                  <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">Employee</th>
                  <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">Reviewer</th>
                  <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">Period</th>
                  <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">Status</th>
                  <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">Overall Rating</th>
                  <th className="px-4 py-3 text-right text-[12px] text-zoru-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && reviews.length === 0 ? (
                  [0, 1, 2].map((i) => (
                    <tr key={i} className="border-b border-zoru-line">
                      <td colSpan={6} className="px-4 py-3">
                        <ZoruSkeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : reviews.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-[13px] text-zoru-ink-muted"
                    >
                      No appraisal reviews yet — click New Review to get started.
                    </td>
                  </tr>
                ) : (
                  reviews.map((review) => {
                    const avg = avgRatings(review.ratings);
                    const empName = review.employeeInfo
                      ? `${review.employeeInfo.firstName ?? ''} ${review.employeeInfo.lastName ?? ''}`.trim()
                      : String(review.employeeId ?? '—');
                    const revName =
                      review.reviewerInfo?.name ?? String(review.reviewerId ?? '—');
                    const periodDate = review.reviewDate
                      ? format(new Date(review.reviewDate), 'PP')
                      : '—';
                    return (
                      <tr
                        key={String(review._id)}
                        className="border-b border-zoru-line last:border-0"
                      >
                        <td className="px-4 py-3 text-zoru-ink">
                          {empName || '—'}
                        </td>
                        <td className="px-4 py-3 text-zoru-ink">{revName}</td>
                        <td className="px-4 py-3 text-zoru-ink-muted">{periodDate}</td>
                        <td className="px-4 py-3">
                          <ZoruBadge variant={STATUS_VARIANTS[review.status] ?? 'secondary'}>
                            {review.status}
                          </ZoruBadge>
                        </td>
                        <td className="px-4 py-3">
                          <StarRating value={avg} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <ZoruButton
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditing(review);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </ZoruButton>
                            <ZoruButton
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingId(String(review._id))}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                            </ZoruButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </ZoruCard>
      </div>
    </>
  );
}
