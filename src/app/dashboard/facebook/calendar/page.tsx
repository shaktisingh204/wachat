"use client";

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  EmptyState,
  ZoruFullscreenCalendar,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  type ZoruFullscreenCalendarEvent,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  CalendarDays,
  Newspaper,
  Plus,
  RefreshCw,
  } from "lucide-react";

import {
  getFacebookPosts,
  getScheduledPosts,
  } from "@/app/actions/facebook.actions";

/**
 * /dashboard/facebook/calendar — Post calendar, ZoruUI rebuild.
 *
 * Same handlers + server actions (`getFacebookPosts`, `getScheduledPosts`).
 * Visual layer: PageHeader + Breadcrumb, ZoruFullscreenCalendar
 * showing both published and scheduled posts as events.
 */

import * as React from "react";

import {
  ErrorState,
  NoProjectState,
} from "../_components/no-project-state";

/* ── helpers ─────────────────────────────────────────────────────── */

type CalendarPostKind = "published" | "scheduled";

interface CalendarPost {
  id: string;
  message?: string;
  date: Date;
  kind: CalendarPostKind;
}

/* ── skeleton ────────────────────────────────────────────────────── */

function CalendarPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-3 w-52" />
      <div className="mt-5 flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="mt-6 h-[600px] w-full" />
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function CalendarPage() {
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectIdReady, setProjectIdReady] = useState(false);

  useEffect(() => {
    document.title = "Calendar · Meta Suite · SabNode";
    setProjectId(localStorage.getItem("activeProjectId"));
    setProjectIdReady(true);
  }, []);

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const [pubResult, schedResult] = await Promise.all([
        getFacebookPosts(projectId),
        getScheduledPosts(projectId),
      ]);

      if (pubResult.error && schedResult.error) {
        setError(pubResult.error);
        return;
      }
      setError(null);

      const combined: CalendarPost[] = [];

      (pubResult.posts ?? []).forEach((p) => {
        if (p.created_time) {
          combined.push({
            id: p.id,
            message: p.message,
            date: new Date(p.created_time),
            kind: "published",
          });
        }
      });

      (schedResult.posts ?? []).forEach((p) => {
        const t = p.scheduled_publish_time;
        if (t) {
          combined.push({
            id: p.id,
            message: p.message,
            date: new Date(t * 1000),
            kind: "scheduled",
          });
        } else if (p.created_time) {
          combined.push({
            id: p.id,
            message: p.message,
            date: new Date(p.created_time),
            kind: "scheduled",
          });
        }
      });

      setPosts(combined);
    });
  }, [projectId]);

  useEffect(() => {
    if (projectId) fetchData();
  }, [projectId, fetchData]);

  const events = useMemo<ZoruFullscreenCalendarEvent[]>(
    () =>
      posts.map((p) => ({
        id: `${p.kind}-${p.id}`,
        date: p.date,
        title: (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={
                p.kind === "scheduled"
                  ? "h-1.5 w-1.5 rounded-full bg-zoru-warning"
                  : "h-1.5 w-1.5 rounded-full bg-zoru-success"
              }
            />
            <span className="truncate">
              {p.message?.slice(0, 60) || "Media post"}
            </span>
          </span>
        ),
        meta: (
          <span className="text-[10.5px] text-zoru-ink-subtle">
            {format(p.date, "p")}
          </span>
        ),
      })),
    [posts],
  );

  const counts = useMemo(() => {
    let published = 0;
    let scheduled = 0;
    for (const p of posts) {
      if (p.kind === "published") published += 1;
      else scheduled += 1;
    }
    return { published, scheduled };
  }, [posts]);

  if (!projectIdReady || (isLoading && posts.length === 0 && !error)) {
    return <CalendarPageSkeleton />;
  }

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
            <ZoruBreadcrumbPage>Calendar</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader bordered={false} className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Meta Suite</ZoruPageEyebrow>
          <ZoruPageTitle>Post calendar</ZoruPageTitle>
          <ZoruPageDescription>
            View your published and scheduled Facebook posts on a single
            calendar.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Badge variant="success">
            <CalendarDays />
            {counts.published} published
          </Badge>
          <Badge variant="warning">
            <CalendarDays />
            {counts.scheduled} scheduled
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw /> Refresh
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/facebook/create-post">
              <Plus /> New post
            </Link>
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="mt-6">
        {!projectId ? (
          <NoProjectState />
        ) : error ? (
          <ErrorState message={error} />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<Newspaper />}
            title="No posts to show"
            description="Once you publish or schedule posts on this Page they will appear on the calendar."
            action={
              <Button asChild>
                <Link href="/dashboard/facebook/create-post">
                  <Plus /> Create post
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="h-[720px]">
            <ZoruFullscreenCalendar
              events={events}
              onCreateEvent={() => {
                // Defer to dedicated create page; calendar primitive
                // exposes the event as a hint only.
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
