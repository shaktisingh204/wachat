"use client";

/**
 * /sabwa/labels - Manage chat labels.
 *
 * CRUD over `SabwaLabelRow` via the server actions in
 * `@/app/actions/sabwa.actions`:
 *  - `listLabels(sessionId)`           - fetch
 *  - `upsertLabel({ sessionId, ... })` - create or rename / recolour
 *  - `deleteLabel(id)`                 - destroy (chats keep tag refs)
 *
 * Layout: PageHeader + "New label" button + grid of label cards (swatch +
 * name + chat count + Rename/Recolour/Delete actions). Edit/create open a
 * Dialog with a name field and a 10-swatch colour picker. Delete opens an
 * AlertDialog that warns the user that chats keep their tag references.
 *
 * Rendered with the 20ui design system - no shadcn, clay, or zoru imports.
 */

import * as React from "react";
import Link from "next/link";
import {
  Check,
  MoreHorizontal,
  Pencil,
  Plus,
  Smartphone,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Radio,
  RadioGroup,
  Skeleton,
  cn,
  useToast,
} from "@/components/sabcrm/20ui";

import { useLabels } from "@/lib/sabwa/use-sabwa-data";
import { useSabwaSession } from "@/lib/sabwa/session-context";
import {
  deleteLabel,
  upsertLabel,
  type SabwaLabelRow,
} from "@/app/actions/sabwa.actions";

// 10 preset swatches - picked to render well in both light and dark themes.
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
  const { toast } = useToast();
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? "";
  const { data: labels, loading, error, refetch } = useLabels(sessionId);

  const [editor, setEditor] = React.useState<{
    open: boolean;
    initial?: SabwaLabelRow;
  }>({ open: false });
  const [deleting, setDeleting] = React.useState<SabwaLabelRow | null>(null);

  const handleSaved = React.useCallback(
    (action: "created" | "updated") => {
      toast.success(action === "created" ? "Label created" : "Label updated");
      refetch();
    },
    [toast, refetch],
  );

  const handleDelete = React.useCallback(
    async (label: SabwaLabelRow) => {
      try {
        const res = await deleteLabel(label.id);
        if (res.ok) {
          toast.success({
            title: "Label deleted",
            description: `Chats keep their reference to "${label.name}".`,
          });
          refetch();
        } else {
          toast.error({
            title: "Could not delete label",
            description: res.error,
          });
        }
      } catch (err) {
        toast.error({
          title: "Could not delete label",
          description: err instanceof Error ? err.message : String(err),
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
          icon={Smartphone}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button variant="primary">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/sabwa">SabWa</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Labels</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
          >
            <TagIcon className="h-6 w-6" />
          </span>
          <PageHeaderHeading>
            <div className="flex flex-wrap items-center gap-2">
              <PageTitle>Labels</PageTitle>
              <Badge tone="neutral">{labels.length} total</Badge>
            </div>
            <PageDescription>
              Group chats with named, colour-coded labels. Bulk-apply from the
              Chats screen, or filter the inbox.
            </PageDescription>
          </PageHeaderHeading>
        </div>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setEditor({ open: true })}
            className="shrink-0"
          >
            New label
          </Button>
        </PageActions>
      </PageHeader>

      {error ? (
        // We treat any load failure as "no labels yet" - the engine's
        // 404/empty path is the common case. Show a friendly empty state
        // with a retry, not a scary red card.
        <LabelsEmptyState
          onCreate={() => setEditor({ open: true })}
          onRetry={refetch}
        />
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
                ? `"${deleting.name}" will be removed. Any chats already tagged with it keep their reference, the label just disappears from the picker.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
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

// --- Sub-components --------------------------------------------------------

interface LabelCardProps {
  label: SabwaLabelRow;
  onEdit: () => void;
  onDelete: () => void;
}

function LabelCard({ label, onEdit, onDelete }: LabelCardProps) {
  const count = label.chatCount ?? 0;
  return (
    <Card>
      <CardBody className="flex items-start gap-3 p-4">
        <span
          aria-hidden="true"
          className="mt-0.5 h-8 w-8 shrink-0 rounded-[var(--st-radius)] border border-[var(--st-border)]"
          // Runtime-computed: the swatch fill is the user-picked label colour.
          style={{ backgroundColor: label.color }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--st-text)]">
            {label.name}
          </p>
          <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
            {count} chat{count === 1 ? "" : "s"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              aria-label="Label actions"
              iconLeft={MoreHorizontal}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit} iconLeft={Pencil}>
              Rename / recolour
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="danger"
              onSelect={onDelete}
              iconLeft={Trash2}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardBody>
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
  const [color, setColor] = React.useState(initial?.color ?? PRESET_COLORS[6]);
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
      toast.error("Name is required");
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
        toast.error({
          title: "Could not save label",
          description: res.error,
        });
      }
    } catch (err) {
      toast.error({
        title: "Could not save label",
        description: err instanceof Error ? err.message : String(err),
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
          <Field label="Name">
            <Input
              id="label-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Family, Work, VIP"
              autoFocus
              maxLength={48}
            />
          </Field>
          <Field label="Colour">
            <RadioGroup
              aria-label="Label colour"
              orientation="horizontal"
              value={color}
              onValueChange={setColor}
              className="flex flex-wrap gap-2"
            >
              {PRESET_COLORS.map((c) => {
                const active = color === c;
                return (
                  <label
                    key={c}
                    className={cn(
                      "relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 transition-transform",
                      active
                        ? "scale-110 border-[var(--st-text)]"
                        : "border-transparent hover:scale-105",
                    )}
                    // Runtime-computed: each swatch fill is its preset colour.
                    style={{ backgroundColor: c }}
                  >
                    <Radio
                      value={c}
                      aria-label={`Colour ${c}`}
                      className="sr-only"
                    />
                    {active ? (
                      <Check
                        className="h-4 w-4 text-white drop-shadow"
                        aria-hidden="true"
                      />
                    ) : null}
                  </label>
                );
              })}
            </RadioGroup>
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={saving}
            >
              {isEdit ? "Save changes" : "Create label"}
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
            <CardBody className="flex items-start gap-3 p-4">
              <Skeleton className="h-8 w-8 rounded-[var(--st-radius)]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </CardBody>
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
      <CardBody className="py-4">
        <EmptyState
          icon={TagIcon}
          title="No labels yet"
          description="Create your first label to start grouping chats, pick a name and a colour swatch."
          action={
            <div className="flex items-center gap-2">
              <Button variant="primary" iconLeft={Plus} onClick={onCreate}>
                New label
              </Button>
              {onRetry ? (
                <Button variant="outline" onClick={onRetry}>
                  Reload
                </Button>
              ) : null}
            </div>
          }
        />
      </CardBody>
    </Card>
  );
}
