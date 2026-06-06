"use client";

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, EmptyState, FullscreenCalendar, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, Skeleton, type LegacyFullscreenCalendarEvent } from '@/components/sabcrm/20ui';
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
 * Visual layer: PageHeader + Breadcrumb, FullscreenCalendar
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

  const events = useMemo<LegacyFullscreenCalendarEvent[]>(
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
                  ? "h-1.5 w-1.5 rounded-full bg-[var(--st-warn)]"
                  : "h-1.5 w-1.5 rounded-full bg-[var(--st-status-ok)]"
              }
            />
            <span className="truncate">
              {p.message?.slice(0, 60) || "Media post"}
            </span>
          </span>
        ),
        meta: (
          <span className="text-[10.5px] text-[var(--st-text-tertiary)]">
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
            <BreadcrumbPage>Calendar</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader bordered={false} className="mt-5">
        <PageHeading>
          <PageEyebrow>Meta Suite</PageEyebrow>
          <PageTitle>Post calendar</PageTitle>
          <PageDescription>
            View your published and scheduled Facebook posts on a single
            calendar.
          </PageDescription>
        </PageHeading>
        <PageActions>
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
        </PageActions>
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
            <FullscreenCalendar
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
