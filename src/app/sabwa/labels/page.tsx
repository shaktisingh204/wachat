"use client";

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
 * Delete opens an AlertDialog that warns the user that chats keep
 * their tag references.
 */

import * as React from "react";
import {
  Check,
  MoreHorizontal,
  Pencil,
  Plus,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLabels } from "@/lib/sabwa/use-sabwa-data";
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

// TODO: replace with real active-session id wired from SessionSwitcher.
const PLACEHOLDER_SESSION_ID = "stub-primary";

export default function SabWaLabelsPage() {
  const { toast } = useToast();
  const sessionId = PLACEHOLDER_SESSION_ID;
  const { data: labels, loading, error, refetch } = useLabels(sessionId);

  const [editor, setEditor] = React.useState<{
    open: boolean;
    initial?: SabwaLabelRow;
  }>({ open: false });
  const [deleting, setDeleting] = React.useState<SabwaLabelRow | null>(null);

  const handleSaved = React.useCallback(
    (action: "created" | "updated") => {
      toast({
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
          toast({
            title: "Label deleted",
            description: `Chats keep their reference to "${label.name}".`,
          });
          refetch();
        } else {
          toast({
            title: "Couldn’t delete label",
            description: res.error,
            variant: "destructive",
          });
        }
      } catch (err) {
        toast({
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

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
          >
            <TagIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Labels</h1>
              <Badge variant="secondary" className="text-xs">
                {labels.length} total
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
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
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">
              Couldn’t load labels
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" size="sm" variant="outline" onClick={refetch}>
              Retry
            </Button>
          </CardContent>
        </Card>
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

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this label?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `"${deleting.name}" will be removed. Any chats already tagged with it keep their reference — the label just disappears from the picker.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && handleDelete(deleting)}
            >
              Delete label
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      <CardContent className="flex items-start gap-3 p-4">
        <span
          aria-hidden
          className="mt-0.5 h-8 w-8 shrink-0 rounded-md border"
          style={{ backgroundColor: label.color }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{label.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {count} chat{count === 1 ? "" : "s"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label="Label actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Rename / recolour
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
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
  const { toast } = useToast();
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
      toast({
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
        toast({
          title: "Couldn’t save label",
          description: res.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit label" : "New label"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Rename or pick a new colour. Existing chat references stay intact."
              : "Pick a memorable name and a colour swatch."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <UiLabel htmlFor="label-name">Name</UiLabel>
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
            <UiLabel>Colour</UiLabel>
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
                        ? "scale-110 border-foreground"
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
          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LabelGridSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i}>
          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <Skeleton className="h-8 w-8 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function LabelsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <TagIcon className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold">No labels yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create your first label to start grouping chats — pick a name and a
          colour swatch.
        </p>
        <Button type="button" onClick={onCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New label
        </Button>
      </CardContent>
    </Card>
  );
}
