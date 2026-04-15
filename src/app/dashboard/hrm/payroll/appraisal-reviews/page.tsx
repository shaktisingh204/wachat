'use client';

import * as React from 'react';
import { useTransition, useActionState, useEffect, useState } from 'react';
import { Star, Plus, Pencil, Trash2, LoaderCircle } from 'lucide-react';
import { format } from 'date-fns';

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getCrmAppraisalReviews,
  saveCrmAppraisalReview,
  deleteCrmAppraisalReview,
} from '@/app/actions/crm-hr-appraisals.actions';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  Scheduled: 'amber',
  Completed: 'green',
  Cancelled: 'red',
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
          className={`h-3 w-3 ${i <= n ? 'fill-yellow-400 text-yellow-400' : 'fill-transparent text-clay-border'}`}
        />
      ))}
      <span className="ml-1 text-[12px] tabular-nums text-clay-ink-muted">
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
  const { toast } = useToast();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-clay-ink">
            {isEdit ? 'Edit Appraisal Review' : 'New Appraisal Review'}
          </DialogTitle>
          <DialogDescription className="text-clay-ink-muted">
            Complete the performance evaluation form below.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5 py-2">
          {isEdit && <input type="hidden" name="id" value={review._id} />}

          {/* Core fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-clay-ink">
                Employee ID <span className="text-clay-red">*</span>
              </Label>
              <Input
                name="employeeId"
                required
                defaultValue={review?.employeeId?.toString() ?? ''}
                placeholder="Employee ObjectId"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-clay-ink">
                Reviewer ID <span className="text-clay-red">*</span>
              </Label>
              <Input
                name="reviewerId"
                required
                defaultValue={review?.reviewerId?.toString() ?? ''}
                placeholder="Reviewer ObjectId"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-clay-ink">
                Period / Cycle <span className="text-clay-red">*</span>
              </Label>
              <Input
                name="reviewDate"
                type="date"
                required
                defaultValue={
                  review?.reviewDate
                    ? new Date(review.reviewDate).toISOString().slice(0, 10)
                    : ''
                }
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-clay-ink">Status</Label>
              <Select
                name="status"
                defaultValue={review?.status ?? 'Scheduled'}
              >
                <SelectTrigger className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ratings */}
          <div>
            <p className="mb-2 text-[13px] font-semibold text-clay-ink">
              Ratings (1 = Poor, 5 = Excellent)
            </p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {RATING_FIELDS.map(({ name, label }) => (
                <div key={name} className="space-y-1.5">
                  <Label className="text-clay-ink">{label}</Label>
                  <Input
                    name={name}
                    type="number"
                    min={1}
                    max={5}
                    step={1}
                    defaultValue={
                      review?.ratings?.[name.replace('rating_', '')] ?? ''
                    }
                    placeholder="1–5"
                    className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Qualitative */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-clay-ink">Strengths</Label>
              <Textarea
                name="strengths"
                rows={3}
                defaultValue={review?.strengths ?? ''}
                placeholder="Key strengths demonstrated…"
                className="rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-clay-ink">Areas of Improvement</Label>
              <Textarea
                name="areasForImprovement"
                rows={3}
                defaultValue={review?.areasForImprovement ?? ''}
                placeholder="Opportunities to grow…"
                className="rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-clay-ink">Goals / Comments</Label>
              <Textarea
                name="reviewerComments"
                rows={3}
                defaultValue={review?.reviewerComments ?? ''}
                placeholder="Goals for next period, additional comments…"
                className="rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <ClayButton
              type="button"
              variant="pill"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ClayButton>
            <ClayButton
              type="submit"
              variant="obsidian"
              disabled={isPending}
              leading={
                isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : null
              }
            >
              {isEdit ? 'Update Review' : 'Create Review'}
            </ClayButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AppraisalReviewsPage() {
  const { toast } = useToast();
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
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-clay-ink">Delete Review?</AlertDialogTitle>
            <AlertDialogDescription className="text-clay-ink-muted">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="Appraisal Reviews"
          subtitle="Performance evaluations — ratings, strengths, and improvement areas."
          icon={Star}
          actions={
            <ClayButton
              variant="obsidian"
              leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              New Review
            </ClayButton>
          }
        />

        <ClayCard>
          <div className="overflow-x-auto rounded-clay-md border border-clay-border">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-clay-border">
                  <th className="px-4 py-3 text-[12px] font-medium text-clay-ink-muted">Employee</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-clay-ink-muted">Reviewer</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-clay-ink-muted">Period</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-clay-ink-muted">Status</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-clay-ink-muted">Overall Rating</th>
                  <th className="px-4 py-3 text-right text-[12px] font-medium text-clay-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && reviews.length === 0 ? (
                  [0, 1, 2].map((i) => (
                    <tr key={i} className="border-b border-clay-border">
                      <td colSpan={6} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : reviews.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-[13px] text-clay-ink-muted"
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
                        className="border-b border-clay-border last:border-0"
                      >
                        <td className="px-4 py-3 font-medium text-clay-ink">
                          {empName || '—'}
                        </td>
                        <td className="px-4 py-3 text-clay-ink">{revName}</td>
                        <td className="px-4 py-3 text-clay-ink-muted">{periodDate}</td>
                        <td className="px-4 py-3">
                          <ClayBadge tone={STATUS_TONES[review.status] ?? 'neutral'} dot>
                            {review.status}
                          </ClayBadge>
                        </td>
                        <td className="px-4 py-3">
                          <StarRating value={avg} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <ClayButton
                              variant="pill"
                              size="sm"
                              leading={<Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />}
                              onClick={() => {
                                setEditing(review);
                                setDialogOpen(true);
                              }}
                            />
                            <ClayButton
                              variant="pill"
                              size="sm"
                              leading={
                                <Trash2 className="h-3.5 w-3.5 text-clay-red" strokeWidth={1.75} />
                              }
                              onClick={() => setDeletingId(String(review._id))}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </ClayCard>
      </div>
    </>
  );
}
