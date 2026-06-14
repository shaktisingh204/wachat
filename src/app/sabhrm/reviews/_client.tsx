"use client";

import * as React from "react";
import { CheckCircle, ClipboardList, Pencil, Plus, Search, Send, Star, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  SelectField,
  useToast,
  type DataTableColumn,
  type SelectOption,
} from "@/components/sabcrm/20ui";
import { SabHrmPageShell, statusTone } from "@/components/sabhrm/page-toolkit";
import {
  createReview,
  deleteReview,
  listReviews,
  setReviewStatus,
  updateReview,
  type ReviewFormValues,
  type ReviewPickerOptions,
} from "@/app/actions/sabhrm/reviews.actions";
import type { ReviewRow, ReviewStatus, Paginated } from "@/lib/sabhrm/types";

const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  acknowledged: "Acknowledged",
};

const STATUS_OPTIONS: SelectOption[] = (Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[]).map(
  (value) => ({ value, label: REVIEW_STATUS_LABELS[value] }),
);

const RATING_OPTIONS: SelectOption[] = [
  { value: "", label: "—" },
  { value: "1", label: "1 / 5" },
  { value: "2", label: "2 / 5" },
  { value: "3", label: "3 / 5" },
  { value: "4", label: "4 / 5" },
  { value: "5", label: "5 / 5" },
];

const TONE_BADGE: Record<string, "default" | "success" | "warning" | "destructive"> = {
  default: "default",
  positive: "success",
  warning: "warning",
  danger: "destructive",
};

const EMPTY_FORM: ReviewFormValues = {
  employeeId: "",
  reviewerId: undefined,
  cycle: "",
  rating: undefined,
  status: "draft",
};

export function ReviewsClient({
  initial,
  options,
  loadError,
}: {
  initial: Paginated<ReviewRow>;
  options: ReviewPickerOptions;
  loadError: string | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<ReviewRow[]>(initial.rows);
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<ReviewFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(
    async (nextQ = q, nextStatus = statusFilter) => {
      setLoading(true);
      const res = await listReviews({ q: nextQ || undefined, status: nextStatus || undefined, pageSize: 50 });
      setLoading(false);
      if (res.ok) setRows(res.data.rows);
      else toast({ title: "Couldn't load reviews", description: res.error, variant: "destructive" });
    },
    [q, statusFilter, toast],
  );

  // Debounced search.
  React.useEffect(() => {
    const t = setTimeout(() => void refresh(q, statusFilter), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter]);

  const patch = (p: Partial<ReviewFormValues>) => setForm((f) => ({ ...f, ...p }));

  const openCreate = React.useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErr(null);
    setOpen(true);
  }, []);

  const openEdit = React.useCallback((row: ReviewRow) => {
    setEditingId(row.id);
    setForm({
      employeeId: row.employeeId,
      reviewerId: row.reviewerId ?? undefined,
      cycle: row.cycle,
      rating: row.rating ?? undefined,
      status: row.status,
    });
    setFormErr(null);
    setOpen(true);
  }, []);

  const submit = React.useCallback(async () => {
    setFormErr(null);
    setSaving(true);
    const res = editingId ? await updateReview(editingId, form) : await createReview(form);
    setSaving(false);
    if (!res.ok) {
      setFormErr(res.error);
      return;
    }
    toast({ title: editingId ? "Review updated" : "Review added" });
    setOpen(false);
    setForm(EMPTY_FORM);
    if (editingId) {
      setRows((r) => r.map((x) => (x.id === res.data.id ? res.data : x)));
      setEditingId(null);
    } else {
      setRows((r) => [res.data, ...r]);
    }
  }, [editingId, form, toast]);

  const remove = React.useCallback(
    async (row: ReviewRow) => {
      if (!window.confirm(`Delete the ${row.cycle} review for ${row.employeeName}?`)) return;
      const res = await deleteReview(row.id);
      if (!res.ok) {
        toast({ title: "Couldn't delete", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.filter((x) => x.id !== row.id));
      toast({ title: "Review deleted" });
    },
    [toast],
  );

  const changeStatus = React.useCallback(
    async (row: ReviewRow, status: "submitted" | "acknowledged") => {
      const res = await setReviewStatus(row.id, status);
      if (!res.ok) {
        toast({ title: "Couldn't update", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.map((x) => (x.id === res.data.id ? res.data : x)));
      toast({ title: status === "submitted" ? "Review submitted" : "Review acknowledged" });
    },
    [toast],
  );

  const columns: DataTableColumn<ReviewRow>[] = [
    {
      key: "employeeName",
      header: "Employee",
      render: (r) => <span className="text-sm font-medium text-[var(--st-text)]">{r.employeeName}</span>,
    },
    {
      key: "reviewerName",
      header: "Reviewer",
      render: (r) => r.reviewerName ?? "—",
    },
    {
      key: "cycle",
      header: "Cycle",
      render: (r) => <span className="text-sm">{r.cycle}</span>,
    },
    {
      key: "rating",
      header: "Rating",
      render: (r) => (r.rating != null ? <span className="text-sm tabular-nums">{`${r.rating}/5`}</span> : "—"),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={TONE_BADGE[statusTone(r.status)]}>{REVIEW_STATUS_LABELS[r.status]}</Badge>
          {r.status === "draft" ? (
            <Button
              variant="outline"
              size="sm"
              iconLeft={Send}
              onClick={(e) => {
                e.stopPropagation();
                void changeStatus(r, "submitted");
              }}
            >
              Submit
            </Button>
          ) : null}
          {r.status === "submitted" ? (
            <Button
              variant="outline"
              size="sm"
              iconLeft={CheckCircle}
              onClick={(e) => {
                e.stopPropagation();
                void changeStatus(r, "acknowledged");
              }}
            >
              Acknowledge
            </Button>
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Pencil}
            aria-label={`Edit ${r.employeeName} review`}
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Trash2}
            aria-label={`Delete ${r.employeeName} review`}
            onClick={(e) => {
              e.stopPropagation();
              void remove(r);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <SabHrmPageShell
      title="Performance reviews"
      description="Run review cycles for your team. Capture a rating, then submit and acknowledge each review."
      actions={
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
          Add review
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search employee, reviewer, cycle…"
            className="pl-8"
          />
        </div>
        <div className="w-44">
          <SelectField
            value={statusFilter}
            options={[{ value: "", label: "All statuses" }, ...STATUS_OPTIONS]}
            onChange={(v) => setStatusFilter(String(v))}
          />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<ClipboardList aria-hidden />}
            title={loadError ? "Couldn't load reviews" : "No reviews yet"}
            description={loadError ?? "Add a performance review to start tracking your review cycles."}
            action={
              !loadError ? (
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
                  Add review
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(r) => r.id}
            hover
            density={loading ? "comfortable" : "comfortable"}
          />
        </Card>
      )}

      {/* Add / edit review dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit review" : "Add review"}</DialogTitle>
            <DialogDescription>
              Pick the employee under review and (optionally) the reviewer, set the cycle
              and a rating, then submit and acknowledge as the review progresses.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Employee">
              <SelectField
                value={form.employeeId}
                options={[{ value: "", label: "Select employee" }, ...options.employees]}
                onChange={(v) => patch({ employeeId: String(v) })}
              />
            </Field>
            <Field label="Reviewer">
              <SelectField
                value={form.reviewerId ?? ""}
                options={[{ value: "", label: "—" }, ...options.employees]}
                onChange={(v) => patch({ reviewerId: String(v) || undefined })}
              />
            </Field>
            <Field label="Cycle">
              <Input
                value={form.cycle}
                onChange={(e) => patch({ cycle: e.target.value })}
                placeholder="e.g. Q1 2026"
              />
            </Field>
            <Field label="Rating">
              <SelectField
                value={form.rating != null ? String(form.rating) : ""}
                options={RATING_OPTIONS}
                onChange={(v) => patch({ rating: String(v) ? Number(v) : undefined })}
              />
            </Field>
            <Field label="Status">
              <SelectField
                value={form.status ?? "draft"}
                options={STATUS_OPTIONS}
                onChange={(v) => patch({ status: v as ReviewStatus })}
              />
            </Field>
          </div>

          {formErr ? <p className="mt-1 text-sm text-[var(--st-status-bad,#dc2626)]">{formErr}</p> : null}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={editingId ? Star : Plus}
              loading={saving}
              disabled={saving || !form.employeeId || !form.cycle.trim()}
              onClick={() => void submit()}
            >
              {editingId ? "Save changes" : "Add review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabHrmPageShell>
  );
}
