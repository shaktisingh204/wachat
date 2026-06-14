"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  MessagesSquare,
  Plus,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  useToast,
} from "@/components/sabcrm/20ui";
import { useProject } from "@/context/project-context";
import {
  createSabchatProject,
  setActiveSabchatProject,
  type SabchatProjectRow,
} from "@/app/actions/sabchat-projects.actions";

export function SabchatProjectsClient({
  projects,
  activeProjectId,
}: {
  projects: SabchatProjectRow[];
  activeProjectId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { setActiveProjectId } = useProject();

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [createErr, setCreateErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [selectingId, setSelectingId] = React.useState<string | null>(null);

  const goToProject = React.useCallback(
    (id: string, setupComplete: boolean) => {
      try {
        setActiveProjectId(id);
      } catch {
        /* context may persist later; cookie is the source of truth */
      }
      router.push(setupComplete ? "/sabchat/inbox" : "/sabchat/setup");
    },
    [router, setActiveProjectId],
  );

  const select = React.useCallback(
    async (id: string, setupComplete: boolean) => {
      setSelectingId(id);
      const res = await setActiveSabchatProject(id);
      if (!res.success) {
        toast({
          title: "Could not select project",
          description: res.error,
          variant: "destructive",
        });
        setSelectingId(null);
        return;
      }
      goToProject(id, setupComplete);
    },
    [goToProject, toast],
  );

  const handleCreate = React.useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setCreateErr("Project name is required.");
      return;
    }
    setBusy(true);
    setCreateErr(null);
    const res = await createSabchatProject({ name: trimmed });
    if (!res.success) {
      setCreateErr(res.error);
      setBusy(false);
      return;
    }
    const sel = await setActiveSabchatProject(res.projectId);
    if (!sel.success) {
      toast({
        title: "Project created, but selection failed",
        description: sel.error,
        variant: "destructive",
      });
      setBusy(false);
      return;
    }
    setOpen(false);
    // A brand-new project always lands on the mandatory setup wizard.
    goToProject(res.projectId, false);
  }, [name, goToProject, toast]);

  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>SabChat projects</PageTitle>
          <PageDescription>
            Each project is an isolated chat workspace — its own conversations,
            contacts, inboxes, widget, and agents. Pick one to continue, or
            create a new one. New projects finish a short setup before they go
            live.
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
          New project
        </Button>
      </PageHeader>

      <div className="mt-6">
        {projects.length === 0 ? (
          <Card className="p-10">
            <EmptyState
              icon={<MessagesSquare aria-hidden />}
              title="No SabChat projects yet"
              description="Create your first project to set up your brand, widget, and first inbox, then start chatting with visitors."
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
                  Create project
                </Button>
              }
            />
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const isActive = p.id === activeProjectId;
              const selecting = selectingId === p.id;
              return (
                <li key={p.id}>
                  <Card
                    className={`flex h-full flex-col gap-3 p-5 transition-colors ${
                      isActive
                        ? "ring-2 ring-[var(--st-primary,var(--st-accent))]"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                          <MessagesSquare className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="truncate text-sm font-semibold text-[var(--st-text)]">
                          {p.name}
                        </span>
                      </div>
                      {p.setupComplete ? (
                        <Badge variant="default" className="shrink-0 gap-1">
                          <CheckCircle2 className="h-3 w-3" aria-hidden /> Live
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 gap-1">
                          <AlertCircle className="h-3 w-3" aria-hidden /> Setup
                          incomplete
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-[var(--st-text-secondary)]">
                      {p.businessName ? p.businessName : "Brand not set"}
                      {isActive ? " · Current" : ""}
                    </div>

                    <div className="mt-auto pt-1">
                      <Button
                        variant={p.setupComplete ? "outline" : "primary"}
                        size="sm"
                        className="w-full"
                        loading={selecting}
                        disabled={selecting}
                        iconRight={ArrowRight}
                        onClick={() => void select(p.id, p.setupComplete)}
                      >
                        {p.setupComplete ? "Open" : "Continue setup"}
                      </Button>
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
            <DialogTitle>New SabChat project</DialogTitle>
            <DialogDescription>
              A project is an isolated chat workspace. After creating it
              you&apos;ll complete a short setup (brand profile and a first
              inbox) before going live.
            </DialogDescription>
          </DialogHeader>

          <Field label="Project name" error={createErr ?? undefined}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Support"
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
              Create &amp; set up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
