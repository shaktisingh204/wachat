"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Plus,
  Trash2,
  Workflow,
} from "lucide-react";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  useToast,
} from "@/components/sabcrm/20ui";
import { CreatingOverlay } from "@/components/sabmail/motion";

import {
  createSabmailJourney,
  deleteSabmailJourney,
  type SabmailJourneyRow,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SabmailAutomationsClient({
  initialJourneys,
}: {
  initialJourneys: SabmailJourneyRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [journeys, setJourneys] =
    React.useState<SabmailJourneyRow[]>(initialJourneys);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [createErr, setCreateErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const handleCreate = React.useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setCreateErr("Journey name is required.");
      return;
    }
    setBusy(true);
    setCreateErr(null);
    const res = await createSabmailJourney({ name: trimmed });
    if (!res.ok) {
      setCreateErr(res.error);
      setBusy(false);
      return;
    }
    setOpen(false);
    setCreating(true);
    router.push(`/sabmail/automations/${res.id}`);
  }, [name, router]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      setDeletingId(id);
      const res = await deleteSabmailJourney(id);
      if (!res.ok) {
        toast({
          title: "Could not delete journey",
          description: res.error,
          variant: "destructive",
        });
        setDeletingId(null);
        return;
      }
      setJourneys((prev) => prev.filter((j) => j.id !== id));
      setDeletingId(null);
      toast({ title: "Journey deleted" });
    },
    [toast],
  );

  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <CreatingOverlay
        show={creating}
        variant="connect"
        title="Creating journey…"
        subtitle="Opening the visual builder"
        icon={<Workflow className="h-1/2 w-1/2" />}
      />

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Automations</PageTitle>
          <PageDescription>
            Build visual journeys — chain triggers, sends, waits and conditions
            on a drag-and-drop canvas. Design and save the flow here; it runs
            once the automation engine is enabled.
          </PageDescription>
        </PageHeaderHeading>
        <Button
          variant="primary"
          size="sm"
          iconLeft={Plus}
          onClick={() => {
            setName("");
            setCreateErr(null);
            setOpen(true);
          }}
        >
          New journey
        </Button>
      </PageHeader>

      <div
        className="mt-4 flex items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-xs text-[var(--st-text-secondary)]"
        role="note"
      >
        <Workflow className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Automation runs when the engine is enabled (coming soon).</span>
      </div>

      <div className="mt-6">
        {journeys.length === 0 ? (
          <Card className="p-10">
            <EmptyState
              icon={<Workflow aria-hidden />}
              title="No journeys yet"
              description="Create your first journey to design an automated flow on the canvas."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={Plus}
                  onClick={() => {
                    setName("");
                    setCreateErr(null);
                    setOpen(true);
                  }}
                >
                  Create journey
                </Button>
              }
            />
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {journeys.map((j, idx) => {
              const deleting = deletingId === j.id;
              return (
                <li
                  key={j.id}
                  className="sabmail-stagger-item"
                  style={{ ["--i" as string]: idx } as React.CSSProperties}
                >
                  <Card className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                          <Workflow className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="truncate text-sm font-semibold text-[var(--st-text)]">
                          {j.name}
                        </span>
                      </div>
                      {j.enabled ? (
                        <Badge variant="default" className="shrink-0 gap-1">
                          <CheckCircle2 className="h-3 w-3" aria-hidden /> Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">
                          Draft
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-[var(--st-text-secondary)]">
                      {j.nodeCount} {j.nodeCount === 1 ? "node" : "nodes"} ·{" "}
                      {j.edgeCount} {j.edgeCount === 1 ? "edge" : "edges"} ·
                      Updated {formatWhen(j.updatedAt)}
                    </div>

                    <div className="mt-auto flex items-center gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        iconRight={ArrowRight}
                        onClick={() =>
                          router.push(`/sabmail/automations/${j.id}`)
                        }
                      >
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Trash2}
                        loading={deleting}
                        disabled={deleting}
                        onClick={() => void handleDelete(j.id)}
                        aria-label={`Delete ${j.name}`}
                      />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New journey</DialogTitle>
            <DialogDescription>
              Give your automation a name. You&apos;ll design its flow on the
              visual canvas next.
            </DialogDescription>
          </DialogHeader>

          <Field label="Journey name" error={createErr ?? undefined}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Welcome series"
              autoFocus
              maxLength={120}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
          </Field>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              loading={busy}
              disabled={busy || !name.trim()}
              onClick={() => void handleCreate()}
            >
              Create &amp; open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
