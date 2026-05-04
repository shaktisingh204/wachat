"use client";

/**
 * /dashboard/facebook/all-projects — connected Facebook Pages.
 *
 * Rebuilt on ZoruUI primitives. Same `getProjects` server action, same
 * "Connect Page" OAuth entry, same manual-setup flow — visual layer is
 * pure zoru, neutral palette.
 */

import * as React from "react";
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import { getProjects } from "@/app/actions";
import type { Project, WithId } from "@/lib/definitions";

import {
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  cn,
} from "@/components/zoruui";

import { ManualSetupDialog } from "../_components/manual-setup-dialog";
import { FacebookGlyph } from "../_components/icons";

/* ── feature catalog (neutral palette) ───────────────────────────── */

const FEATURES = [
  {
    icon: MessageSquare,
    label: "Messenger Inbox",
    description: "Manage all customer messages in one place",
  },
  {
    icon: Megaphone,
    label: "Broadcasts",
    description: "Send campaigns to your page followers",
  },
  {
    icon: Zap,
    label: "Auto Replies",
    description: "Respond instantly with flow automation",
  },
  {
    icon: ImageIcon,
    label: "Post Scheduler",
    description: "Plan and publish posts on a schedule",
  },
  {
    icon: ShoppingBag,
    label: "Commerce",
    description: "Sync your catalog and manage orders",
  },
  {
    icon: BarChart3,
    label: "Analytics",
    description: "Track reach, engagement and conversions",
  },
];

/* ── skeleton ────────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-48" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <ZoruSkeleton className="h-3 w-24" />
          <ZoruSkeleton className="h-7 w-64" />
          <ZoruSkeleton className="h-3 w-80" />
        </div>
        <div className="flex gap-2">
          <ZoruSkeleton className="h-9 w-28" />
          <ZoruSkeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    </div>
  );
}

/* ── connected page card ─────────────────────────────────────────── */

function ConnectedPageCard({ project }: { project: WithId<Project> }) {
  const router = useRouter();

  const setActive = () => {
    localStorage.setItem("activeProjectId", project._id.toString());
    localStorage.setItem("activeProjectName", project.name);
  };

  const handleManage = () => {
    setActive();
    router.push("/dashboard/facebook");
  };

  return (
    <ZoruCard className="flex flex-col p-0">
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <ZoruAvatar className="h-12 w-12">
              <ZoruAvatarImage
                src={`https://graph.facebook.com/${project.facebookPageId}/picture?type=large`}
              />
              <ZoruAvatarFallback>
                <FacebookGlyph className="h-5 w-5" />
              </ZoruAvatarFallback>
            </ZoruAvatar>
            <span
              className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-zoru-bg bg-zoru-success text-zoru-on-primary"
              aria-hidden
            >
              <CheckCircle2 className="h-2.5 w-2.5" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-zoru-ink">{project.name}</p>
            <p className="truncate text-[11.5px] text-zoru-ink-muted">
              ID: {project.facebookPageId || "—"}
            </p>
          </div>
          <ZoruBadge variant="outline">Live</ZoruBadge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Messages", href: "/dashboard/facebook/messages" },
            { label: "Posts", href: "/dashboard/facebook/posts" },
            {
              label: "Commerce",
              href: "/dashboard/facebook/commerce/products",
            },
          ].map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={() => {
                setActive();
                router.push(link.href);
              }}
              className="rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface px-2 py-1.5 text-[11px] text-zoru-ink transition-colors hover:bg-zoru-surface-2"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-zoru-line bg-zoru-surface px-5 py-3">
        <a
          href={`https://facebook.com/${project.facebookPageId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11.5px] text-zoru-ink-muted transition-colors hover:text-zoru-ink"
        >
          <ExternalLink className="h-3 w-3" /> Facebook
        </a>
        <div className="flex-1" />
        <ZoruButton
          size="sm"
          variant="outline"
          onClick={handleManage}
          className="h-7 text-[11px]"
        >
          <Settings /> Manage
        </ZoruButton>
        <ZoruButton size="sm" onClick={handleManage} className="h-7 text-[11px]">
          Open <ArrowRight />
        </ZoruButton>
      </div>
    </ZoruCard>
  );
}

/* ── empty state ─────────────────────────────────────────────────── */

function ConnectEmptyState({
  appId,
  onSuccess,
}: {
  appId: string | undefined;
  onSuccess: () => void;
}) {
  return (
    <ZoruCard className="px-6 py-12 md:px-12">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[var(--zoru-radius-lg)] bg-zoru-surface-2 text-zoru-ink">
          <FacebookGlyph className="h-8 w-8" />
        </div>

        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-zoru-line bg-zoru-surface px-3 py-1 text-[11px] text-zoru-ink-muted">
          <Sparkles className="h-3 w-3" /> Meta Business Suite
        </span>

        <h2 className="mt-4 text-[26px] tracking-tight text-zoru-ink leading-tight">
          No pages connected yet
        </h2>
        <p className="mt-2 max-w-xl text-[13px] text-zoru-ink-muted leading-relaxed">
          Connect your Facebook Page to manage Messenger conversations,
          schedule posts, run broadcasts, sync your catalog and track analytics
          — all in one place.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {appId ? (
            <ZoruButton asChild>
              <Link href="/api/auth/meta-suite/login">
                <FacebookGlyph className="h-4 w-4" /> Connect Facebook Page
                <ArrowRight />
              </Link>
            </ZoruButton>
          ) : (
            <p className="text-[12.5px] text-zoru-danger">
              Facebook App ID not configured.
            </p>
          )}
          <ManualSetupDialog onSuccess={onSuccess} />
        </div>

        <div className="mt-10 w-full">
          <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-zoru-ink-subtle">
            Everything you unlock
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="flex flex-col gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3 text-left"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink-muted [&_svg]:size-3.5">
                  <f.icon />
                </span>
                <p className="text-[12.5px] text-zoru-ink">{f.label}</p>
                <p className="text-[11px] text-zoru-ink-muted leading-snug">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ZoruCard>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function AllFacebookPagesPage() {
  const [projects, setProjects] = useState<WithId<Project>[]>([]);
  const [isLoading, startLoading] = useTransition();

  const fetchData = useCallback(() => {
    startLoading(async () => {
      try {
        const result = await getProjects(undefined, "facebook");
        const projectsData = Array.isArray(result)
          ? result
          : result && Array.isArray((result as any).projects)
            ? (result as any).projects
            : [];
        setProjects(projectsData);
      } catch (e) {
        console.error("[AllFacebookPagesPage] failed to fetch projects:", e);
        setProjects([]);
      }
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

  if (isLoading && projects.length === 0) return <PageSkeleton />;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbPage>Connected pages</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5" bordered={false}>
        <ZoruPageHeading>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle">
            Meta Suite
          </p>
          <ZoruPageTitle>Connected pages</ZoruPageTitle>
          <ZoruPageDescription>
            Connect and manage your Facebook Pages, Messenger, posts and
            commerce.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <div className="flex flex-wrap items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw /> Refresh
          </ZoruButton>
          <ManualSetupDialog onSuccess={fetchData} />
          {appId ? (
            <ZoruButton asChild size="sm">
              <Link href="/api/auth/meta-suite/login">
                <FacebookGlyph className="h-4 w-4" /> Connect page
              </Link>
            </ZoruButton>
          ) : null}
        </div>
      </ZoruPageHeader>

      {/* ── stats row ── */}
      {projects.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-bg px-3 py-1.5 text-[12px] text-zoru-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-zoru-success" />
            {projects.length} page{projects.length !== 1 ? "s" : ""} connected
          </span>
          {FEATURES.slice(0, 3).map((f) => (
            <span
              key={f.label}
              className="inline-flex items-center gap-1.5 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-bg px-3 py-1.5 text-[11.5px] text-zoru-ink-muted"
            >
              <f.icon className="h-3 w-3" /> {f.label}
            </span>
          ))}
        </div>
      ) : null}

      {/* ── grid or empty state ── */}
      {projects.length > 0 ? (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle inline-flex items-center gap-2">
              <Users className="h-3 w-3" /> Connected pages
            </p>
            <span className="text-[11.5px] text-zoru-ink-muted">
              {projects.length} page{projects.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ConnectedPageCard
                key={project._id.toString()}
                project={project}
              />
            ))}

            {appId ? (
              <Link
                href="/api/auth/meta-suite/login"
                className={cn(
                  "group flex flex-col items-center justify-center gap-3 rounded-[var(--zoru-radius-lg)] border-2 border-dashed border-zoru-line bg-zoru-bg p-8 text-center transition-colors hover:border-zoru-line-strong hover:bg-zoru-surface",
                )}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                  <FacebookGlyph className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[13px] text-zoru-ink">
                    Connect another page
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                    Add more Facebook Pages to your account
                  </p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-zoru-ink-subtle transition-colors group-hover:text-zoru-ink" />
              </Link>
            ) : null}
          </div>

          <div className="mt-8">
            <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-zoru-ink-subtle">
              Available features
            </p>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {FEATURES.map((f) => (
                <div
                  key={f.label}
                  className="flex flex-col gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink-muted [&_svg]:size-3.5">
                    <f.icon />
                  </span>
                  <p className="text-[12px] text-zoru-ink">{f.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <ConnectEmptyState appId={appId} onSuccess={fetchData} />
        </div>
      )}
    </div>
  );
}
