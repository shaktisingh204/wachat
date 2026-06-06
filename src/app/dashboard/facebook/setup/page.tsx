"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardTitle,
  EmptyState,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeading,
  PageTitle,
  Separator,
  Skeleton,
  cn,
  useToast } from '@/components/sabcrm/20ui';
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
  Facebook,
  Instagram,
  RefreshCw,
  Settings,
  Sparkles,
  } from "lucide-react";

import { getProjects } from "@/app/actions/project.actions";
import { getInstagramAccountForPage } from "@/app/actions/facebook.actions";
import type { Project,
  WithId } from "@/lib/definitions";
import { useProject } from '@/context/project-context';

/**
 * /dashboard/facebook/setup - Meta Suite onboarding wizard.
 *
 * Three-step numbered stepper (no tab UI):
 *   1. Connect Meta - OAuth or manual setup
 *   2. Pick a page - choose a project / page to focus on
 *   3. Link assets - verify WhatsApp & Instagram links and finish
 *
 * Same data flow as `all-projects` (reads `getProjects`, OAuths through
 * `/api/auth/meta-suite/login`), zero behavioral changes. Pure 20ui design
 * system, neutral palette only.
 */

import * as React from "react";

import { ManualSetupDialog } from "../_components/manual-setup-dialog";
import { FacebookGlyph, WhatsAppGlyph } from "../_components/icons";

const META_SUITE_LOGIN = "/api/auth/meta-suite/login";

/* -- stepper types ------------------------------------------------------- */

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

/* -- skeleton ------------------------------------------------------------ */

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

/* -- numbered stepper ---------------------------------------------------- */

function StepperHeader({
  current,
}: {
  current: StepKey;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex flex-col gap-2 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 sm:flex-row sm:items-stretch sm:gap-0">
      {STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <React.Fragment key={step.key}>
            <li
              className={cn(
                "flex flex-1 items-start gap-3 rounded-[var(--st-radius)] px-3 py-2",
                isCurrent && "bg-[var(--st-bg-secondary)]",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px]",
                  isDone &&
                    "bg-[var(--st-text)] text-[var(--st-text-inverted)]",
                  isCurrent &&
                    "border border-[var(--st-text)] bg-[var(--st-bg)] text-[var(--st-text)]",
                  !isDone &&
                    !isCurrent &&
                    "border border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  idx + 1
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    "text-[12.5px] leading-none",
                    isCurrent || isDone ? "text-[var(--st-text)]" : "text-[var(--st-text-secondary)]",
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-1 text-[11px] text-[var(--st-text-secondary)] leading-tight">
                  {step.description}
                </p>
              </div>
            </li>
            {idx !== STEPS.length - 1 ? (
              <span className="hidden items-center px-1 text-[var(--st-text-tertiary)] sm:flex">
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            ) : null}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

/* -- step bodies --------------------------------------------------------- */

function StepBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-1 text-[11px] text-[var(--st-text-secondary)]">
      <Sparkles className="h-3 w-3" aria-hidden="true" /> {label}
    </span>
  );
}

function ConnectStep({
  appId,
  onConnect,
  onManualSuccess,
}: {
  appId: string | undefined;
  onConnect: () => void;
  onManualSuccess: () => void;
}) {
  return (
    <Card padding="lg">
      <div className="flex flex-col items-start gap-2">
        <StepBadge label="Step 1 of 3" />
        <CardTitle className="text-[20px] tracking-tight text-[var(--st-text)] leading-tight">
          Connect your Meta account
        </CardTitle>
        <p className="max-w-2xl text-[13px] text-[var(--st-text-secondary)] leading-relaxed">
          We&apos;ll redirect you to Meta to authorize SabNode. You can grant access
          to multiple Pages at once, you&apos;ll pick which one to manage in the
          next step.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {appId ? (
          <Button variant="primary" size="lg" iconLeft={Facebook} iconRight={ArrowRight} onClick={onConnect}>
            Connect with Facebook
          </Button>
        ) : (
          <Alert tone="warning" icon={AlertCircle} className="w-full">
            <AlertTitle>Facebook App ID missing</AlertTitle>
            <AlertDescription>
              Ask an admin to set <code>NEXT_PUBLIC_FACEBOOK_APP_ID</code>.
            </AlertDescription>
          </Alert>
        )}
        <ManualSetupDialog onSuccess={onManualSuccess} />
      </div>

      <Alert tone="info" icon={AlertCircle} className="mt-5">
        <AlertTitle>Troubleshooting permission errors</AlertTitle>
        <AlertDescription className="space-y-1">
          <p>If you encounter permission errors after returning from Meta:</p>
          <ul className="list-disc pl-4 space-y-0.5 text-[12px] opacity-80">
            <li>Ensure your personal Meta account has Admin rights to the Facebook Page.</li>
            <li>In the Meta popup, click &quot;Edit previous settings&quot; and ensure all pages and permissions are checked.</li>
            <li>Ensure your Meta Business Manager has unrestricted access to the Page.</li>
          </ul>
        </AlertDescription>
      </Alert>

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
            className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3"
          >
            <p className="text-[12px] text-[var(--st-text)]">{p.title}</p>
            <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)] leading-snug">
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
    <Card padding="lg">
      <div className="flex flex-col items-start gap-2">
        <StepBadge label="Step 2 of 3" />
        <CardTitle className="text-[20px] tracking-tight text-[var(--st-text)] leading-tight">
          Pick a page to focus on
        </CardTitle>
        <p className="max-w-2xl text-[13px] text-[var(--st-text-secondary)] leading-relaxed">
          Choose which Facebook Page you want to manage now. You can switch
          between pages anytime from the project switcher.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {projects.map((p) => {
          const id = p._id.toString();
          const active = id === selectedId;
          return (
            <Card
              key={id}
              variant="interactive"
              padding="none"
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onClick={() => onSelect(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(id);
                }
              }}
              className={cn(
                "flex items-start gap-3 p-4 text-left",
                active
                  ? "border-[var(--st-text)] bg-[var(--st-bg-secondary)]"
                  : "hover:bg-[var(--st-bg-secondary)]",
              )}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={`https://graph.facebook.com/${p.facebookPageId}/picture?type=large`}
                  alt={`${p.name} page photo`}
                />
                <AvatarFallback>
                  <FacebookGlyph className="h-5 w-5" aria-hidden="true" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-[var(--st-text)]">{p.name}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--st-text-secondary)]">
                  Page ID: {p.facebookPageId || "Not set"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {p.adAccountId ? (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3 text-[var(--st-status-ok)]" aria-hidden="true" />
                      Ad account
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <Circle className="h-2.5 w-2.5" aria-hidden="true" />
                      No ad account
                    </Badge>
                  )}
                  {p.wabaId ? (
                    <Badge variant="outline" className="gap-1">
                      <WhatsAppGlyph className="h-3 w-3" aria-hidden="true" />
                      WhatsApp
                    </Badge>
                  ) : null}
                </div>
              </div>
              <span
                className={cn(
                  "mt-1 flex h-5 w-5 items-center justify-center rounded-full",
                  active
                    ? "bg-[var(--st-text)] text-[var(--st-text-inverted)]"
                    : "border border-[var(--st-border)] bg-[var(--st-bg)]",
                )}
              >
                {active ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : null}
              </span>
            </Card>
          );
        })}

        {appId ? (
          <Link
            href={META_SUITE_LOGIN}
            onClick={onConnectAnother}
            className="flex flex-col items-center justify-center gap-2 rounded-[var(--st-radius-lg)] border-2 border-dashed border-[var(--st-border)] bg-[var(--st-bg)] p-6 text-center transition-colors hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-secondary)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
              <FacebookGlyph className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-[12.5px] text-[var(--st-text)]">Connect another page</p>
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
    <Card padding="lg">
      <div className="flex flex-col items-start gap-2">
        <StepBadge label="Step 3 of 3" />
        <CardTitle className="text-[20px] tracking-tight text-[var(--st-text)] leading-tight">
          Link your other assets
        </CardTitle>
        <p className="max-w-2xl text-[13px] text-[var(--st-text-secondary)] leading-relaxed">
          Verify the WhatsApp and Instagram accounts that you&apos;d like to
          manage alongside this Page.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <AssetRow
          icon={<FacebookGlyph className="h-4 w-4" aria-hidden="true" />}
          title="Facebook Page"
          subtitle={project.name}
          status="connected"
          actionHref="/dashboard/facebook"
          actionLabel="Open page"
        />
        <AssetRow
          icon={<WhatsAppGlyph className="h-4 w-4" aria-hidden="true" />}
          title="WhatsApp Business"
          subtitle={project.wabaId ? `WABA ID ${project.wabaId}` : "Not linked"}
          status={project.wabaId ? "connected" : "missing"}
          actionHref={project.wabaId ? "/wachat" : "/wachat/numbers"}
          actionLabel={project.wabaId ? "Open Wachat" : "Connect WhatsApp"}
        />
        <AssetRow
          icon={<Instagram className="h-4 w-4" aria-hidden="true" />}
          title="Instagram"
          subtitle={instagramId ? `Linked, ${instagramId}` : "No business account linked to this Page"}
          status={instagramId ? "connected" : "missing"}
          actionHref="/dashboard/facebook/settings"
          actionLabel="Manage links"
        />
        <AssetRow
          icon={<Settings className="h-4 w-4" aria-hidden="true" />}
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
  const router = useRouter();
  return (
    <div className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-[var(--st-text)]">{title}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-[var(--st-text-secondary)]">
          {subtitle}
        </p>
      </div>
      <Badge
        variant={status === "connected" ? "outline" : "secondary"}
        className="gap-1"
      >
        {status === "connected" ? (
          <CheckCircle2 className="h-3 w-3 text-[var(--st-status-ok)]" aria-hidden="true" />
        ) : (
          <Circle className="h-2.5 w-2.5" aria-hidden="true" />
        )}
        {status === "connected" ? "Connected" : "Not linked"}
      </Badge>
      <Button
        variant="outline"
        size="sm"
        iconRight={ExternalLink}
        onClick={() => router.push(actionHref)}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

/* -- page ---------------------------------------------------------------- */

export default function FacebookSetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeProjectId, setActiveProjectId } = useProject();
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
    if (activeProjectId) setSelectedId(activeProjectId);
  }, [fetchProjects, activeProjectId]);

  // Drive the active step from real state, no behavioral changes.
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

  const startMetaOAuth = useCallback(() => {
    window.location.href = META_SUITE_LOGIN;
  }, []);

  const handlePickPage = (id: string) => {
    const proj = projects.find((p) => p._id.toString() === id);
    if (!proj) return;
    setSelectedId(id);
    setActiveProjectId(id);
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
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Setup</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5" bordered={false}>
        <PageHeading>
          <PageEyebrow>Meta Suite onboarding</PageEyebrow>
          <PageTitle>Get connected in three steps</PageTitle>
          <PageDescription>
            Connect a Meta account, choose a Page and link your other assets to
            unlock the full Meta Suite.
          </PageDescription>
        </PageHeading>
        <Button variant="outline" size="sm" iconLeft={RefreshCw} onClick={fetchProjects}>
          Refresh
        </Button>
      </PageHeader>

      {/* Stepper */}
      <div className="mt-6">
        <StepperHeader current={step} />
      </div>

      {/* Step body */}
      <div className="mt-6">
        {step === "connect" ? (
          <ConnectStep
            appId={appId}
            onConnect={startMetaOAuth}
            onManualSuccess={fetchProjects}
          />
        ) : null}

        {step === "page" ? (
          projects.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={Facebook}
                title="No connected pages"
                description="Connect a Page in step 1 to continue."
                action={
                  <Button variant="primary" onClick={() => setStep("connect")}>
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

      {/* Step nav */}
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
            variant="primary"
            size="sm"
            iconRight={ArrowRight}
            disabled={projects.length === 0}
            onClick={() => setStep("page")}
          >
            Continue
          </Button>
        ) : null}

        {step === "page" ? (
          <Button
            variant="primary"
            size="sm"
            iconRight={ArrowRight}
            disabled={!selectedId}
            onClick={() => setStep("assets")}
          >
            Continue
          </Button>
        ) : null}

        {step === "assets" ? (
          <Button variant="primary" size="sm" iconRight={CheckCircle2} onClick={handleFinish}>
            Finish setup
          </Button>
        ) : null}
      </div>
    </div>
  );
}
