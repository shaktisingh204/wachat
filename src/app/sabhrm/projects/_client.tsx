"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
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
  createSabHrmProject,
  setActiveSabHrmProject,
  type SabHrmProjectRow,
} from "@/app/actions/sabhrm-projects.actions";

const REGION_LABEL: Record<string, string> = {
  IN: "India",
  US: "United States",
  OTHER: "Other",
};

export function SabHrmProjectsClient({
  projects,
  activeProjectId,
}: {
  projects: SabHrmProjectRow[];
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
        /* cookie is the source of truth */
      }
      router.push(setupComplete ? "/sabhrm" : "/sabhrm/setup");
    },
    [router, setActiveProjectId],
  );

  const select = React.useCallback(
    async (id: string, setupComplete: boolean) => {
      setSelectingId(id);
      const res = await setActiveSabHrmProject(id);
      if (!res.success) {
        toast({
          title: "Could not select organization",
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
      setCreateErr("Organization name is required.");
      return;
    }
    setBusy(true);
    setCreateErr(null);
    const res = await createSabHrmProject({ name: trimmed });
    if (!res.success) {
      setCreateErr(res.error);
      setBusy(false);
      return;
    }
    const sel = await setActiveSabHrmProject(res.projectId);
    if (!sel.success) {
      toast({
        title: "Organization created, but selection failed",
        description: sel.error,
        variant: "destructive",
      });
      setBusy(false);
      return;
    }
    goToProject(res.projectId, false);
  }, [name, goToProject, toast]);

  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>SabHRM organizations</PageTitle>
          <PageDescription>
            Each organization is an isolated HR workspace — its own employees,
            attendance, leave, payroll, and performance data. Pick one to
            continue, or create a new one. New organizations finish a short
            setup before they unlock.
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
          New organization
        </Button>
      </PageHeader>

      <div className="mt-6">
        {projects.length === 0 ? (
          <Card className="p-10">
            <EmptyState
              icon={<Building2 aria-hidden />}
              title="No SabHRM organizations yet"
              description="Create your first organization to set up your team, payroll region, and HR policies."
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
                  Create organization
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
                          <Building2 className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="truncate text-sm font-semibold text-[var(--st-text)]">
                          {p.name}
                        </span>
                      </div>
                      {p.setupComplete ? (
                        <Badge variant="default" className="shrink-0 gap-1">
                          <CheckCircle2 className="h-3 w-3" aria-hidden /> Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 gap-1">
                          <AlertCircle className="h-3 w-3" aria-hidden /> Setup
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-[var(--st-text-secondary)]">
                      {p.region
                        ? `Region: ${REGION_LABEL[p.region] ?? p.region}`
                        : "Region not set"}
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
            <DialogTitle>New SabHRM organization</DialogTitle>
            <DialogDescription>
              An organization is an isolated HR workspace. After creating it
              you&apos;ll complete a short setup (legal name, region, currency)
              before it unlocks.
            </DialogDescription>
          </DialogHeader>

          <Field label="Organization name" error={createErr ?? undefined}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Inc."
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
