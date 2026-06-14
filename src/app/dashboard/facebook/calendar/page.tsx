"use client";

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, EmptyState, FullscreenCalendar, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, Skeleton, type CalendarEvent } from '@/components/sabcrm/20ui';
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
 * /dashboard/facebook/calendar — Post calendar, Ui20 rebuild.
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
import { RescheduleStrip, type ScheduledItem } from "../_components/reschedule-strip";

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

  const events = useMemo<CalendarEvent[]>(
    () =>
      posts.map((p) => ({
        id: `${p.kind}-${p.id}`,
        date: p.date,
        color:
          p.kind === "scheduled"
            ? "var(--st-warn, #d97706)"
            : "var(--st-status-ok, #16a34a)",
        title: (
          <span className="truncate">
            {format(p.date, "p")} · {p.message?.slice(0, 50) || "Media post"}
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

  const scheduledItems = useMemo<ScheduledItem[]>(
    () =>
      posts
        .filter((p) => p.kind === "scheduled")
        .map((p) => ({ id: p.id, message: p.message, date: p.date })),
    [posts],
  );

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
          <div className="flex flex-col gap-4">
            <div className="h-[720px]">
              <FullscreenCalendar events={events} />
            </div>
            {projectId ? (
              <RescheduleStrip
                projectId={projectId}
                items={scheduledItems}
                onChanged={fetchData}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
