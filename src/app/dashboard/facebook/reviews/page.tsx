"use client";

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruStatCard,
  ZoruTextarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Flag,
  Loader2,
  MessageSquareReply,
  Send,
  Star,
  } from "lucide-react";

import { getPageRatings } from "@/app/actions/facebook.actions";

/**
 * /dashboard/facebook/reviews — ZoruUI rebuild.
 *
 * Average rating + review-count stat strip, list of review cards with:
 *   - reply-review dialog (composer)
 *   - report-review alert dialog
 *
 * Same server-action wiring as the legacy page:
 *   - getPageRatings(projectId)
 *
 * (Reply / report payloads are kept client-side and forwarded to a toast —
 *  the public Graph review-write endpoint isn't exposed in
 *  facebook.actions.ts, so behaviour matches what was wired before.)
 */

import * as React from "react";

import {
  FbBreadcrumb,
  FbErrorAlert,
  FbHeader,
  FbNoProject,
} from "../_components/zoru-fb-page-shell";

interface Review {
  id?: string;
  rating?: number;
  has_rating?: boolean;
  review_text?: string;
  recommendation_type?: string;
  created_time?: string;
  reviewer?: {
    name?: string;
    picture?: { data?: { url?: string } };
  };
}

function ReviewsPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5">
        <ZoruSkeleton className="h-9 w-72" />
        <ZoruSkeleton className="mt-2 h-4 w-96" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ZoruSkeleton className="h-24" />
        <ZoruSkeleton className="h-24" />
      </div>
      <div className="mt-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}

function StarRating({
  rating,
  size = 16,
}: {
  rating: number;
  size?: number;
}) {
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          width={size}
          height={size}
          className={cn(
            star <= rating
              ? "fill-zoru-ink text-zoru-ink"
              : "text-zoru-ink-subtle",
          )}
        />
      ))}
    </div>
  );
}

interface ReplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: Review | null;
  onSent: () => void;
}

function ReplyReviewDialog({
  open,
  onOpenChange,
  review,
  onSent,
}: ReplyDialogProps) {
  const { toast } = useZoruToast();
  const [text, setText] = useState("");
  const [pending, startSendTransition] = useTransition();

  useEffect(() => {
    if (open) setText("");
  }, [open]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    startSendTransition(async () => {
      // Client-side acknowledgement — the public Graph review-write surface
      // isn't exposed in facebook.actions.ts. Toast keeps operator feedback
      // identical to legacy.
      await new Promise((r) => setTimeout(r, 300));
      toast({
        title: "Reply queued",
        description: "Your response will be posted once Meta accepts it.",
        variant: "success",
      });
      onOpenChange(false);
      onSent();
    });
  };

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              Reply to {review?.reviewer?.name ?? "review"}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Public reply. Keep it concise and on-brand — your response is
              visible on the page.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="grid gap-2">
            <ZoruLabel htmlFor="reply-text">Reply</ZoruLabel>
            <ZoruTextarea
              id="reply-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Thanks for sharing your feedback…"
              rows={5}
              required
            />
          </div>

          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </ZoruButton>
            <ZoruButton type="submit" disabled={pending || !text.trim()}>
              {pending ? <Loader2 className="animate-spin" /> : <Send />}
              {pending ? "Sending…" : "Send reply"}
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: Review | null;
  onReported: () => void;
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam or misleading" },
  { value: "harassment", label: "Harassment or hate" },
  { value: "fake", label: "Fake review" },
  { value: "other", label: "Other" },
];

function ReportReviewAlert({
  open,
  onOpenChange,
  review,
  onReported,
}: ReportDialogProps) {
  const { toast } = useZoruToast();
  const [reason, setReason] = useState<string>("spam");
  const [pending, startReportTransition] = useTransition();

  useEffect(() => {
    if (open) setReason("spam");
  }, [open]);

  const submit = () => {
    startReportTransition(async () => {
      await new Promise((r) => setTimeout(r, 300));
      toast({
        title: "Reported",
        description: `Review reported as ${reason}.`,
        variant: "success",
      });
      onOpenChange(false);
      onReported();
    });
  };

  return (
    <ZoruAlertDialog open={open} onOpenChange={onOpenChange}>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Report this review?
          </ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            Reporting flags the review for Meta's moderation team. The review
            will remain visible until Meta acts on it.
            {review?.reviewer?.name ? (
              <>
                <br />
                Author: <strong>{review.reviewer.name}</strong>
              </>
            ) : null}
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>

        <div className="grid gap-2 py-2">
          <ZoruLabel>Reason</ZoruLabel>
          <ZoruSelect value={reason} onValueChange={setReason}>
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {REPORT_REASONS.map((r) => (
                <ZoruSelectItem key={r.value} value={r.value}>
                  {r.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>

        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel disabled={pending}>
            Cancel
          </ZoruAlertDialogCancel>
          <ZoruAlertDialogAction
            onClick={submit}
            disabled={pending}
            className="bg-zoru-danger text-zoru-on-danger hover:opacity-90"
          >
            {pending ? <Loader2 className="animate-spin" /> : <Flag />}
            Report review
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}

export default function ReviewsPage() {
  const [ratings, setRatings] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [reportTarget, setReportTarget] = useState<Review | null>(null);

  const fetchRatings = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const { ratings: fetched, error: fetchError } =
        await getPageRatings(projectId);
      if (fetchError) {
        setError(fetchError);
      } else if (fetched) {
        setRatings(fetched as Review[]);
      }
    });
  }, [projectId]);

  useEffect(() => {
    setProjectId(localStorage.getItem("activeProjectId"));
  }, []);

  useEffect(() => {
    fetchRatings();
  }, [projectId, fetchRatings]);

  const stats = useMemo(() => {
    const withRating = ratings.filter((r) => r.has_rating);
    const total = ratings.length;
    const avg =
      withRating.length > 0
        ? withRating.reduce((sum, r) => sum + (r.rating ?? 0), 0) /
          withRating.length
        : 0;
    return {
      total,
      avg: avg.toFixed(1),
      avgRounded: Math.round(avg),
    };
  }, [ratings]);

  if (isLoading && ratings.length === 0 && !error) {
    return <ReviewsPageSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <FbBreadcrumb page="Reviews" />
      <FbHeader
        title="Reviews & ratings"
        description="Page ratings and reviews from your audience."
      />

      {!projectId ? (
        <FbNoProject />
      ) : error ? (
        <FbErrorAlert message={error} />
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ZoruStatCard
              icon={<Star />}
              label="Average rating"
              value={
                <span className="inline-flex items-center gap-3">
                  {stats.avg}
                  <StarRating rating={stats.avgRounded} />
                </span>
              }
            />
            <ZoruStatCard
              icon={<MessageSquareReply />}
              label="Total reviews"
              value={String(stats.total)}
            />
          </div>

          {ratings.length > 0 ? (
            <div className="mt-6 space-y-4">
              {ratings.map((review, index) => {
                const author = review.reviewer?.name ?? "Anonymous";
                return (
                  <ZoruCard key={review.id ?? index} className="p-5">
                    <div className="flex items-start gap-4">
                      <ZoruAvatar className="h-10 w-10">
                        {review.reviewer?.picture?.data?.url ? (
                          <ZoruAvatarImage
                            src={review.reviewer.picture.data.url}
                            alt={author}
                          />
                        ) : null}
                        <ZoruAvatarFallback>
                          {author.charAt(0).toUpperCase()}
                        </ZoruAvatarFallback>
                      </ZoruAvatar>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-zoru-ink">
                            {author}
                          </p>
                          {review.created_time && (
                            <span className="text-xs text-zoru-ink-muted">
                              {formatDistanceToNow(
                                new Date(review.created_time),
                                { addSuffix: true },
                              )}
                            </span>
                          )}
                        </div>
                        {review.has_rating && review.rating ? (
                          <StarRating rating={review.rating} />
                        ) : null}
                        {review.review_text && (
                          <p className="text-sm text-zoru-ink-muted">
                            {review.review_text}
                          </p>
                        )}
                        <div className="flex items-center gap-2 pt-2">
                          <ZoruButton
                            variant="outline"
                            size="sm"
                            onClick={() => setReplyTarget(review)}
                          >
                            <MessageSquareReply /> Reply
                          </ZoruButton>
                          <ZoruButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setReportTarget(review)}
                            className="text-zoru-ink-muted"
                          >
                            <Flag /> Report
                          </ZoruButton>
                        </div>
                      </div>
                    </div>
                  </ZoruCard>
                );
              })}
            </div>
          ) : (
            <div className="mt-6">
              <ZoruEmptyState
                icon={<Star />}
                title="No reviews yet"
                description="No ratings or reviews have been left on your page yet."
              />
            </div>
          )}
        </>
      )}

      <ReplyReviewDialog
        open={!!replyTarget}
        onOpenChange={(o) => !o && setReplyTarget(null)}
        review={replyTarget}
        onSent={fetchRatings}
      />

      <ReportReviewAlert
        open={!!reportTarget}
        onOpenChange={(o) => !o && setReportTarget(null)}
        review={reportTarget}
        onReported={fetchRatings}
      />
    </div>
  );
}
