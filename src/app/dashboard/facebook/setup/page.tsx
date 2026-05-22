"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Separator,
  Skeleton,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  Instagram,
  RefreshCw,
  Settings,
  Sparkles,
  } from "lucide-react";

import { getProjects } from "@/app/actions/project.actions";
import { getInstagramAccountForPage } from "@/app/actions/facebook.actions";
import type { Project,
  WithId } from "@/lib/definitions";

/**
 * /dashboard/facebook/setup — Meta Suite onboarding wizard.
 *
 * Three-step numbered stepper (no tab UI):
 *   1. Connect Meta — OAuth or manual setup
 *   2. Pick a page — choose a project / page to focus on
 *   3. Link assets — verify WhatsApp & Instagram links and finish
 *
 * Same data flow as `all-projects` (reads `getProjects`, OAuths through
 * `/api/auth/meta-suite/login`), zero behavioral changes. Pure zoru
 * tokens — neutral palette only.
 */

import * as React from "react";

import { ManualSetupDialog } from "../_components/manual-setup-dialog";
import { FacebookGlyph, WhatsAppGlyph } from "../_components/icons";

/* ── stepper types ───────────────────────────────────────────────── */

const STEPS = [
  {
    key: "connect",
    label: "Connect Meta",
    description: "Authorize SabNode to access your Facebook account.",
  },
  {
    key: "page",
    label: "Pick a page",
    description: "Choose which Facebook Page to focus on.",
  },
  {
    key: "assets",
    label: "Link assets",
    description: "Verify WhatsApp and Instagram links.",
  },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

/* ── skeleton ────────────────────────────────────────────────────── */

function SetupSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-3 w-48" />
      <div className="mt-5 flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-3 w-96" />
      </div>
      <Skeleton className="mt-6 h-16 w-full" />
      <Skeleton className="mt-6 h-72 w-full" />
    </div>
  );
}

/* ── numbered stepper ────────────────────────────────────────────── */

function StepperHeader({
  current,
}: {
  current: StepKey;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex flex-col gap-2 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-3 sm:flex-row sm:items-stretch sm:gap-0">
      {STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <React.Fragment key={step.key}>
            <li
              className={cn(
                "flex flex-1 items-start gap-3 rounded-[var(--zoru-radius)] px-3 py-2",
                isCurrent && "bg-zoru-surface",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px]",
                  isDone &&
                    "bg-zoru-ink text-zoru-on-primary",
                  isCurrent &&
                    "border border-zoru-ink bg-zoru-bg text-zoru-ink",
                  !isDone &&
                    !isCurrent &&
                    "border border-zoru-line bg-zoru-surface-2 text-zoru-ink-muted",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  idx + 1
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    "text-[12.5px] leading-none",
                    isCurrent || isDone ? "text-zoru-ink" : "text-zoru-ink-muted",
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-1 text-[11px] text-zoru-ink-muted leading-tight">
                  {step.description}
                </p>
              </div>
            </li>
            {idx !== STEPS.length - 1 ? (
              <span className="hidden items-center px-1 text-zoru-ink-subtle sm:flex">
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

/* ── step bodies ─────────────────────────────────────────────────── */

function ConnectStep({
  appId,
  onManualSuccess,
}: {
  appId: string | undefined;
  onManualSuccess: () => void;
}) {
  return (
    <Card className="p-6">
      <div className="flex flex-col items-start gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zoru-line bg-zoru-surface px-3 py-1 text-[11px] text-zoru-ink-muted">
          <Sparkles className="h-3 w-3" /> Step 1 of 3
        </span>
        <h2 className="text-[20px] tracking-tight text-zoru-ink leading-tight">
          Connect your Meta account
        </h2>
        <p className="max-w-2xl text-[13px] text-zoru-ink-muted leading-relaxed">
          We&apos;ll redirect you to Meta to authorize SabNode. You can grant access
          to multiple Pages at once — you&apos;ll pick which one to manage in the
          next step.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {appId ? (
          <Button asChild size="lg">
            <Link href="/api/auth/meta-suite/login">
              <FacebookGlyph className="h-4 w-4" /> Connect with Facebook
              <ArrowRight />
            </Link>
          </Button>
        ) : (
          <Alert variant="warning" className="w-full">
            <AlertCircle />
            <ZoruAlertTitle>Facebook App ID missing</ZoruAlertTitle>
            <ZoruAlertDescription>
              Ask an admin to set <code>NEXT_PUBLIC_FACEBOOK_APP_ID</code>.
            </ZoruAlertDescription>
          </Alert>
        )}
        <ManualSetupDialog onSuccess={onManualSuccess} />
      </div>

      <Separator className="my-6" />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "Pages access",
            body: "Read your Pages list, profile photos and basic insights.",
          },
          {
            title: "Messenger",
            body: "Send and receive messages on your behalf.",
          },
          {
            title: "Posts & ads",
            body: "Publish posts and run Click-to-WhatsApp campaigns.",
          },
        ].map((p) => (
          <div
            key={p.title}
            className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3"
          >
            <p className="text-[12px] text-zoru-ink">{p.title}</p>
            <p className="mt-1 text-[11.5px] text-zoru-ink-muted leading-snug">
              {p.body}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PickPageStep({
  projects,
  selectedId,
  onSelect,
  onConnectAnother,
  appId,
}: {
  projects: WithId<Project>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConnectAnother: () => void;
  appId: string | undefined;
}) {
  return (
    <Card className="p-6">
      <div className="flex flex-col items-start gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zoru-line bg-zoru-surface px-3 py-1 text-[11px] text-zoru-ink-muted">
          <Sparkles className="h-3 w-3" /> Step 2 of 3
        </span>
        <h2 className="text-[20px] tracking-tight text-zoru-ink leading-tight">
          Pick a page to focus on
        </h2>
        <p className="max-w-2xl text-[13px] text-zoru-ink-muted leading-relaxed">
          Choose which Facebook Page you want to manage now. You can switch
          between pages anytime from the project switcher.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {projects.map((p) => {
          const active = p._id.toString() === selectedId;
          return (
            <button
              key={p._id.toString()}
              type="button"
              onClick={() => onSelect(p._id.toString())}
              className={cn(
                "flex items-start gap-3 rounded-[var(--zoru-radius-lg)] border p-4 text-left transition-colors focus-visible:outline-none",
                active
                  ? "border-zoru-ink bg-zoru-surface"
                  : "border-zoru-line bg-zoru-bg hover:bg-zoru-surface",
              )}
            >
              <Avatar className="h-10 w-10">
                <ZoruAvatarImage
                  src={`https://graph.facebook.com/${p.facebookPageId}/picture?type=large`}
                />
                <ZoruAvatarFallback>
                  <FacebookGlyph className="h-5 w-5" />
                </ZoruAvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-zoru-ink">{p.name}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-zoru-ink-muted">
                  Page ID: {p.facebookPageId || "—"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {p.adAccountId ? (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3 text-zoru-success" />
                      Ad account
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <Circle className="h-2.5 w-2.5" />
                      No ad account
                    </Badge>
                  )}
                  {p.wabaId ? (
                    <Badge variant="outline" className="gap-1">
                      <WhatsAppGlyph className="h-3 w-3" />
                      WhatsApp
                    </Badge>
                  ) : null}
                </div>
              </div>
              <span
                className={cn(
                  "mt-1 flex h-5 w-5 items-center justify-center rounded-full",
                  active
                    ? "bg-zoru-ink text-zoru-on-primary"
                    : "border border-zoru-line bg-zoru-bg",
                )}
              >
                {active ? <CheckCircle2 className="h-3 w-3" /> : null}
              </span>
            </button>
          );
        })}

        {appId ? (
          <Link
            href="/api/auth/meta-suite/login"
            onClick={onConnectAnother}
            className="flex flex-col items-center justify-center gap-2 rounded-[var(--zoru-radius-lg)] border-2 border-dashed border-zoru-line bg-zoru-bg p-6 text-center transition-colors hover:border-zoru-line-strong hover:bg-zoru-surface"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
              <FacebookGlyph className="h-5 w-5" />
            </span>
            <p className="text-[12.5px] text-zoru-ink">Connect another page</p>
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

function LinkAssetsStep({
  project,
  instagramId,
}: {
  project: WithId<Project>;
  instagramId: string | null;
}) {
  return (
    <Card className="p-6">
      <div className="flex flex-col items-start gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zoru-line bg-zoru-surface px-3 py-1 text-[11px] text-zoru-ink-muted">
          <Sparkles className="h-3 w-3" /> Step 3 of 3
        </span>
        <h2 className="text-[20px] tracking-tight text-zoru-ink leading-tight">
          Link your other assets
        </h2>
        <p className="max-w-2xl text-[13px] text-zoru-ink-muted leading-relaxed">
          Verify the WhatsApp and Instagram accounts that you&apos;d like to
          manage alongside this Page.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <AssetRow
          icon={<FacebookGlyph className="h-4 w-4" />}
          title="Facebook Page"
          subtitle={project.name}
          status="connected"
          actionHref="/dashboard/facebook"
          actionLabel="Open page"
        />
        <AssetRow
          icon={<WhatsAppGlyph className="h-4 w-4" />}
          title="WhatsApp Business"
          subtitle={project.wabaId ? `WABA ID ${project.wabaId}` : "Not linked"}
          status={project.wabaId ? "connected" : "missing"}
          actionHref={project.wabaId ? "/wachat" : "/wachat/numbers"}
          actionLabel={project.wabaId ? "Open Wachat" : "Connect WhatsApp"}
        />
        <AssetRow
          icon={<Instagram className="h-4 w-4" />}
          title="Instagram"
          subtitle={instagramId ? `Linked · ${instagramId}` : "No business account linked to this Page"}
          status={instagramId ? "connected" : "missing"}
          actionHref="/dashboard/facebook/settings"
          actionLabel="Manage links"
        />
        <AssetRow
          icon={<Settings className="h-4 w-4" />}
          title="Ad Account"
          subtitle={project.adAccountId || "Not connected"}
          status={project.adAccountId ? "connected" : "missing"}
          actionHref="/dashboard/facebook/all-projects"
          actionLabel={project.adAccountId ? "Manage" : "Connect"}
        />
      </div>
    </Card>
  );
}

function AssetRow({
  icon,
  title,
  subtitle,
  status,
  actionHref,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  status: "connected" | "missing";
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-zoru-ink">{title}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-zoru-ink-muted">
          {subtitle}
        </p>
      </div>
      <Badge
        variant={status === "connected" ? "outline" : "secondary"}
        className="gap-1"
      >
        {status === "connected" ? (
          <CheckCircle2 className="h-3 w-3 text-zoru-success" />
        ) : (
          <Circle className="h-2.5 w-2.5" />
        )}
        {status === "connected" ? "Connected" : "Not linked"}
      </Badge>
      <Button asChild variant="outline" size="sm">
        <Link href={actionHref}>
          {actionLabel}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </Button>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function FacebookSetupPage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [projects, setProjects] = useState<WithId<Project>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState<StepKey>("connect");
  const [instagramId, setInstagramId] = useState<string | null>(null);
  const [igChecking, setIgChecking] = useState(false);

  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

  const fetchProjects = useCallback(() => {
    startLoading(async () => {
      try {
        const result = await getProjects(undefined, "facebook");
        const list = Array.isArray(result)
          ? result
          : result && Array.isArray((result as any).projects)
            ? (result as any).projects
            : [];
        setProjects(list);
      } catch (e) {
        console.error("[FacebookSetupPage] failed to fetch projects:", e);
        setProjects([]);
      }
    });
  }, []);

  useEffect(() => {
    fetchProjects();
    const stored = localStorage.getItem("activeProjectId");
    if (stored) setSelectedId(stored);
  }, [fetchProjects]);

  // Drive the active step from real state — no behavioral changes.
  useEffect(() => {
    if (projects.length === 0) {
      setStep("connect");
      return;
    }
    if (!selectedId) {
      setStep("page");
      return;
    }
    setStep("assets");
  }, [projects.length, selectedId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p._id.toString() === selectedId) || null,
    [projects, selectedId],
  );

  // Verify Instagram link when entering step 3.
  useEffect(() => {
    if (!selectedProject) {
      setInstagramId(null);
      return;
    }
    setIgChecking(true);
    getInstagramAccountForPage(selectedProject._id.toString())
      .then((res) => {
        setInstagramId(res.instagramAccount?.id || null);
      })
      .catch(() => setInstagramId(null))
      .finally(() => setIgChecking(false));
  }, [selectedProject]);

  const handlePickPage = (id: string) => {
    const proj = projects.find((p) => p._id.toString() === id);
    if (!proj) return;
    localStorage.setItem("activeProjectId", id);
    localStorage.setItem("activeProjectName", proj.name);
    setSelectedId(id);
    toast({
      title: "Page selected",
      description: `Now managing ${proj.name}.`,
      variant: "success",
    });
  };

  const handleFinish = () => {
    toast({
      title: "Setup complete",
      description: "Welcome to Meta Suite.",
      variant: "success",
    });
    router.push("/dashboard/facebook");
  };

  if (isLoading && projects.length === 0) return <SetupSkeleton />;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Setup</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5" bordered={false}>
        <ZoruPageHeading>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle">
            Meta Suite onboarding
          </p>
          <ZoruPageTitle>Get connected in three steps</ZoruPageTitle>
          <ZoruPageDescription>
            Connect a Meta account, choose a Page and link your other assets to
            unlock the full Meta Suite.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <Button variant="outline" size="sm" onClick={fetchProjects}>
          <RefreshCw /> Refresh
        </Button>
      </PageHeader>

      {/* ── Stepper ── */}
      <div className="mt-6">
        <StepperHeader current={step} />
      </div>

      {/* ── Step body ── */}
      <div className="mt-6">
        {step === "connect" ? (
          <ConnectStep appId={appId} onManualSuccess={fetchProjects} />
        ) : null}

        {step === "page" ? (
          projects.length === 0 ? (
            <Card className="p-6">
              <EmptyState
                icon={<FacebookGlyph />}
                title="No connected pages"
                description="Connect a Page in step 1 to continue."
                action={
                  <Button onClick={() => setStep("connect")}>
                    Back to step 1
                  </Button>
                }
              />
            </Card>
          ) : (
            <PickPageStep
              projects={projects}
              selectedId={selectedId}
              onSelect={handlePickPage}
              onConnectAnother={fetchProjects}
              appId={appId}
            />
          )
        ) : null}

        {step === "assets" && selectedProject ? (
          igChecking ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <LinkAssetsStep project={selectedProject} instagramId={instagramId} />
          )
        ) : null}
      </div>

      {/* ── Step nav ── */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={step === "connect"}
          onClick={() => {
            if (step === "page") setStep("connect");
            else if (step === "assets") setStep("page");
          }}
        >
          Back
        </Button>

        {step === "connect" ? (
          <Button
            size="sm"
            disabled={projects.length === 0}
            onClick={() => setStep("page")}
          >
            Continue <ArrowRight />
          </Button>
        ) : null}

        {step === "page" ? (
          <Button
            size="sm"
            disabled={!selectedId}
            onClick={() => setStep("assets")}
          >
            Continue <ArrowRight />
          </Button>
        ) : null}

        {step === "assets" ? (
          <Button size="sm" onClick={handleFinish}>
            Finish setup <CheckCircle2 />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
