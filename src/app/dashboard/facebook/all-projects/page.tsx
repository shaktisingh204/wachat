"use client";

import { Avatar, AvatarFallback, AvatarImage, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton, cn } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from "react";
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

import { m } from "motion/react";

import { getProjects } from "@/app/actions";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { Project,
  WithId } from "@/lib/definitions";

/**
 * /dashboard/facebook/all-projects - connected Facebook Pages.
 *
 * Rebuilt on 20ui primitives. Same `getProjects` server action, same
 * "Connect Page" OAuth entry, same manual-setup flow - visual layer is
 * pure 20ui, neutral palette.
 */

import * as React from "react";

import { ManualSetupDialog } from "../_components/manual-setup-dialog";
import { FacebookGlyph } from "../_components/icons";

const META_SUITE_LOGIN = "/api/auth/meta-suite/login";

/* feature catalog (neutral palette) */

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

/* skeleton */

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-3 w-48" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    </div>
  );
}

/* connected page card */

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

  const quickLinks = [
    { label: "Messages", href: "/dashboard/facebook/messages" },
    { label: "Posts", href: "/dashboard/facebook/posts" },
    { label: "Commerce", href: "/dashboard/facebook/commerce/products" },
  ];

  return (
    <Card className="flex flex-col p-0">
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage
                src={`https://graph.facebook.com/${project.facebookPageId}/picture?type=large`}
                alt={`${project.name} page picture`}
              />
              <AvatarFallback>
                <FacebookGlyph className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <span
              className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--st-bg)] bg-[var(--st-status-ok)] text-[var(--st-text-inverted)]"
              aria-hidden="true"
            >
              <CheckCircle2 className="h-2.5 w-2.5" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-[var(--st-text)]">{project.name}</p>
            <p className="truncate text-[11.5px] text-[var(--st-text-secondary)]">
              ID: {project.facebookPageId || "n/a"}
            </p>
          </div>
          <Badge variant="outline">Live</Badge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {quickLinks.map((link) => (
            <Button
              key={link.label}
              variant="outline"
              size="sm"
              className="h-auto w-full justify-center px-2 py-1.5 text-[11px]"
              onClick={() => {
                setActive();
                router.push(link.href);
              }}
            >
              {link.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-5 py-3">
        <a
          href={`https://facebook.com/${project.facebookPageId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11.5px] text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" /> Facebook
        </a>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          onClick={handleManage}
          iconLeft={Settings}
          className="h-7 text-[11px]"
        >
          Manage
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={handleManage}
          iconRight={ArrowRight}
          className="h-7 text-[11px]"
        >
          Open
        </Button>
      </div>
    </Card>
  );
}

/* empty state */

function ConnectEmptyState({
  appId,
  onSuccess,
}: {
  appId: string | undefined;
  onSuccess: () => void;
}) {
  const router = useRouter();

  return (
    <Card className="px-6 py-12 md:px-12">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[var(--st-radius-lg)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
          <FacebookGlyph className="h-8 w-8" />
        </div>

        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-1 text-[11px] text-[var(--st-text-secondary)]">
          <Sparkles className="h-3 w-3" aria-hidden="true" /> Meta Business Suite
        </span>

        <h2 className="mt-4 text-[26px] tracking-tight text-[var(--st-text)] leading-tight">
          No pages connected yet
        </h2>
        <p className="mt-2 max-w-xl text-[13px] text-[var(--st-text-secondary)] leading-relaxed">
          Connect your Facebook Page to manage Messenger conversations,
          schedule posts, run broadcasts, sync your catalog and track analytics,
          all in one place.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {appId ? (
            <Button
              variant="primary"
              iconRight={ArrowRight}
              onClick={() => router.push(META_SUITE_LOGIN)}
            >
              <FacebookGlyph className="mr-2 h-4 w-4" aria-hidden="true" />
              Connect Facebook Page
            </Button>
          ) : (
            <p className="text-[12.5px] text-[var(--st-danger)]">
              Facebook App ID not configured.
            </p>
          )}
          <ManualSetupDialog onSuccess={onSuccess} />
        </div>

        <div className="mt-10 w-full">
          <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-[var(--st-text-tertiary)]">
            Everything you unlock
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-left"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] [&_svg]:size-3.5">
                  <f.icon aria-hidden="true" />
                </span>
                <p className="text-[12.5px] text-[var(--st-text)]">{f.label}</p>
                <p className="text-[11px] text-[var(--st-text-secondary)] leading-snug">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* page */

export default function AllFacebookPagesPage() {
  const router = useRouter();
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
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard">SabNode</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/facebook">Meta Suite</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Connected pages</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5" bordered={false}>
        <PageHeading>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--st-text-tertiary)]">
            Meta Suite
          </p>
          <PageTitle>Connected pages</PageTitle>
          <PageDescription>
            Connect and manage your Facebook Pages, Messenger, posts and
            commerce.
          </PageDescription>
        </PageHeading>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} iconLeft={RefreshCw}>
            Refresh
          </Button>
          <ManualSetupDialog onSuccess={fetchData} />
          {appId ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push(META_SUITE_LOGIN)}
            >
              <FacebookGlyph className="mr-2 h-4 w-4" aria-hidden="true" />
              Connect page
            </Button>
          ) : null}
        </div>
      </PageHeader>

      {/* stats row */}
      {projects.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-1.5 text-[12px] text-[var(--st-text)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--st-status-ok)]" aria-hidden="true" />
            {projects.length} page{projects.length !== 1 ? "s" : ""} connected
          </span>
          {FEATURES.slice(0, 3).map((f) => (
            <span
              key={f.label}
              className="inline-flex items-center gap-1.5 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-1.5 text-[11.5px] text-[var(--st-text-secondary)]"
            >
              <f.icon className="h-3 w-3" aria-hidden="true" /> {f.label}
            </span>
          ))}
        </div>
      ) : null}

      {/* grid or empty state */}
      {projects.length > 0 ? (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--st-text-tertiary)] inline-flex items-center gap-2">
              <Users className="h-3 w-3" aria-hidden="true" /> Connected pages
            </p>
            <span className="text-[11.5px] text-[var(--st-text-secondary)]">
              {projects.length} page{projects.length !== 1 ? "s" : ""}
            </span>
          </div>

          <m.div
            className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {projects.map((project) => (
              <m.div key={project._id.toString()} variants={staggerItem}>
                <ConnectedPageCard project={project} />
              </m.div>
            ))}

            {appId ? (
              <Link
                href={META_SUITE_LOGIN}
                className={cn(
                  "group flex flex-col items-center justify-center gap-3 rounded-[var(--st-radius-lg)] border-2 border-dashed border-[var(--st-border)] bg-[var(--st-bg)] p-8 text-center transition-colors hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-secondary)]",
                )}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                  <FacebookGlyph className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[13px] text-[var(--st-text)]">
                    Connect another page
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
                    Add more Facebook Pages to your account
                  </p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-[var(--st-text-tertiary)] transition-colors group-hover:text-[var(--st-text)]" aria-hidden="true" />
              </Link>
            ) : null}
          </m.div>

          <div className="mt-8">
            <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--st-text-tertiary)]">
              Available features
            </p>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {FEATURES.map((f) => (
                <div
                  key={f.label}
                  className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] [&_svg]:size-3.5">
                    <f.icon aria-hidden="true" />
                  </span>
                  <p className="text-[12px] text-[var(--st-text)]">{f.label}</p>
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
