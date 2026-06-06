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
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Input,
  Label as ZoruUiLabel,
  Skeleton,
  cn,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  Check,
  MoreHorizontal,
  Pencil,
  Plus,
  Smartphone,
  Tag as TagIcon,
  Trash2,
  } from "lucide-react";

/**
 * /sabwa/labels — Manage chat labels.
 *
 * CRUD over `SabwaLabelRow` via the server actions in
 * `@/app/actions/sabwa.actions`:
 *  - `listLabels(sessionId)`          — fetch
 *  - `upsertLabel({ sessionId, ... })` — create or rename / recolour
 *  - `deleteLabel(id)`                — destroy (chats keep tag refs)
 *
 * Layout: header + "New label" button + grid of label cards (swatch +
 * name + chat count + Rename/Recolour/Delete actions). Edit/create
 * open a Dialog with a name input and a 10-swatch colour picker.
 * Delete opens a ZoruAlertDialog that warns the user that chats keep
 * their tag references.
 *
 * Rendered with ZoruUI primitives — no shadcn `/ui/*` imports.
 */

import * as React from "react";
import Link from "next/link";

import { useLabels } from "@/lib/sabwa/use-sabwa-data";
import { useSabwaSession } from "@/lib/sabwa/session-context";
import {
  deleteLabel,
  upsertLabel,
  type SabwaLabelRow,
} from "@/app/actions/sabwa.actions";

// 10 preset swatches — picked to render well in both light and dark themes.
const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#64748b", // slate
];

export default function SabWaLabelsPage() {
  const toast = useZoruToast();
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';
  const { data: labels, loading, error, refetch } = useLabels(sessionId);

  const [editor, setEditor] = React.useState<{
    open: boolean;
    initial?: SabwaLabelRow;
  }>({ open: false });
  const [deleting, setDeleting] = React.useState<SabwaLabelRow | null>(null);

  const handleSaved = React.useCallback(
    (action: "created" | "updated") => {
      toast.toast({
        title: action === "created" ? "Label created" : "Label updated",
      });
      refetch();
    },
    [toast, refetch],
  );

  const handleDelete = React.useCallback(
    async (label: SabwaLabelRow) => {
      try {
        const res = await deleteLabel(label.id);
        if (res.ok) {
          toast.toast({
            title: "Label deleted",
            description: `Chats keep their reference to "${label.name}".`,
          });
          refetch();
        } else {
          toast.toast({
            title: "Couldn’t delete label",
            description: res.error,
            variant: "destructive",
          });
        }
      } catch (err) {
        toast.toast({
          title: "Couldn’t delete label",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      } finally {
        setDeleting(null);
      }
    },
    [toast, refetch],
  );

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button size="md">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Labels</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
          >
            <TagIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] tracking-[-0.015em] text-[var(--st-text)] leading-[1.2]">
                Labels
              </h1>
              <Badge variant="ghost" className="text-[10.5px]">
                {labels.length} total
              </Badge>
            </div>
            <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
              Group chats with named, colour-coded labels. Bulk-apply from
              the Chats screen, or filter the inbox.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => setEditor({ open: true })}
          className="shrink-0"
        >
          <Plus className="mr-1.5 h-4 w-4" /> New label
        </Button>
      </header>

      {error ? (
        // We treat any load failure as "no labels yet" — the engine's
        // 404/empty path is the common case. Show a friendly empty
        // state with a retry, not a scary red card.
        <LabelsEmptyState onCreate={() => setEditor({ open: true })} onRetry={refetch} />
      ) : loading ? (
        <LabelGridSkeleton />
      ) : labels.length === 0 ? (
        <LabelsEmptyState onCreate={() => setEditor({ open: true })} />
      ) : (
        <ul
          aria-label="Labels"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {labels.map((label) => (
            <li key={label.id}>
              <LabelCard
                label={label}
                onEdit={() => setEditor({ open: true, initial: label })}
                onDelete={() => setDeleting(label)}
              />
            </li>
          ))}
        </ul>
      )}

      <LabelEditorDialog
        open={editor.open}
        initial={editor.initial}
        sessionId={sessionId}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        onSaved={handleSaved}
      />

      <ZoruAlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this label?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {deleting
                ? `"${deleting.name}" will be removed. Any chats already tagged with it keep their reference — the label just disappears from the picker.`
                : ""}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              className="bg-[var(--st-danger)] text-zoru-danger-foreground hover:bg-[var(--st-danger)]/90"
              onClick={() => deleting && handleDelete(deleting)}
            >
              Delete label
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface LabelCardProps {
  label: SabwaLabelRow;
  onEdit: () => void;
  onDelete: () => void;
}

function LabelCard({ label, onEdit, onDelete }: LabelCardProps) {
  const count = label.chatCount ?? 0;
  return (
    <Card>
      <ZoruCardContent className="flex items-start gap-3 p-4">
        <span
          aria-hidden
          className="mt-0.5 h-8 w-8 shrink-0 rounded-[var(--zoru-radius)] border border-[var(--st-border)]"
          style={{ backgroundColor: label.color }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--st-text)]">{label.name}</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
            {count} chat{count === 1 ? "" : "s"}
          </p>
        </div>
        <DropdownMenu>
          <ZoruDropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label="Label actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </ZoruDropdownMenuTrigger>
          <ZoruDropdownMenuContent align="end">
            <ZoruDropdownMenuItem onSelect={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Rename / recolour
            </ZoruDropdownMenuItem>
            <ZoruDropdownMenuItem
              onSelect={onDelete}
              className="text-[var(--st-danger)] focus:text-[var(--st-danger)]"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </ZoruDropdownMenuItem>
          </ZoruDropdownMenuContent>
        </DropdownMenu>
      </ZoruCardContent>
    </Card>
  );
}

interface LabelEditorDialogProps {
  open: boolean;
  initial?: SabwaLabelRow;
  sessionId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (action: "created" | "updated") => void;
}

function LabelEditorDialog({
  open,
  initial,
  sessionId,
  onOpenChange,
  onSaved,
}: LabelEditorDialogProps) {
  const toast = useZoruToast();
  const isEdit = Boolean(initial);
  const [name, setName] = React.useState(initial?.name ?? "");
  const [color, setColor] = React.useState(
    initial?.color ?? PRESET_COLORS[6],
  );
  const [saving, setSaving] = React.useState(false);

  // Reset local state when the dialog (re-)opens with a fresh `initial`.
  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setColor(initial?.color ?? PRESET_COLORS[6]);
    }
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.toast({
        title: "Name is required",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await upsertLabel({
        sessionId,
        id: initial?.id,
        name: trimmed,
        color,
      });
      if (res.ok) {
        onSaved(isEdit ? "updated" : "created");
        onOpenChange(false);
      } else {
        toast.toast({
          title: "Couldn’t save label",
          description: res.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast.toast({
        title: "Couldn’t save label",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>{isEdit ? "Edit label" : "New label"}</ZoruDialogTitle>
          <ZoruDialogDescription>
            {isEdit
              ? "Rename or pick a new colour. Existing chat references stay intact."
              : "Pick a memorable name and a colour swatch."}
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <ZoruUiLabel htmlFor="label-name">Name</ZoruUiLabel>
            <Input
              id="label-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Family, Work, VIP"
              autoFocus
              maxLength={48}
            />
          </div>
          <div className="space-y-1.5">
            <ZoruUiLabel>Colour</ZoruUiLabel>
            <div
              role="radiogroup"
              aria-label="Label colour"
              className="flex flex-wrap gap-2"
            >
              {PRESET_COLORS.map((c) => {
                const active = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`Colour ${c}`}
                    onClick={() => setColor(c)}
                    className={cn(
                      "relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform",
                      active
                        ? "scale-110 border-[var(--st-text)]"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {active ? (
                      <Check
                        className="h-4 w-4 text-white drop-shadow"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          <ZoruDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create label"}
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

function LabelGridSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i}>
          <Card>
            <ZoruCardContent className="flex items-start gap-3 p-4">
              <Skeleton className="h-8 w-8 rounded-[var(--zoru-radius)]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </ZoruCardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function LabelsEmptyState({
  onCreate,
  onRetry,
}: {
  onCreate: () => void;
  onRetry?: () => void;
}) {
  return (
    <Card>
      <ZoruCardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
        >
          <TagIcon className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-[var(--st-text)]">No labels yet</h2>
        <p className="max-w-sm text-[13px] text-[var(--st-text-secondary)]">
          Create your first label to start grouping chats — pick a name and a
          colour swatch.
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={onCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> New label
          </Button>
          {onRetry && (
            <Button type="button" variant="outline" onClick={onRetry}>
              Reload
            </Button>
          )}
        </div>
      </ZoruCardContent>
    </Card>
  );
}
