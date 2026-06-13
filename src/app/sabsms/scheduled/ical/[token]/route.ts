/**
 * SabSMS scheduled sends — iCal subscription feed.
 *
 * `mintIcalSubscription` (../../actions.ts) persists a token to
 * `sabsms_scheduled_subscriptions` ({ _id: token, workspaceId }) and hands
 * the user a URL of `/sabsms/scheduled/ical/<token>.ics`. This handler
 * resolves that token → workspaceId, loads the workspace's upcoming
 * scheduled sends, and returns a `text/calendar` feed a calendar app can
 * subscribe to.
 *
 * Public + unauthenticated by design — the random token IS the credential
 * (mirrors the analytics-share token pattern). It is scoped to one workspace
 * and only exposes campaign NAMES + times, never recipient data.
 */

import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";

import { loadScheduledSends } from "../../actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SubscriptionDoc {
  _id: string;
  workspaceId: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** YYYYMMDDTHHMMSSZ (UTC). */
function toIcsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token: rawToken } = await ctx.params;
  // The minted URL carries a `.ics` suffix so calendar apps recognise the
  // feed — strip it before the lookup.
  const token = rawToken.replace(/\.ics$/i, "");
  if (!token) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { db } = await connectToDatabase();
  const sub = (await db
    .collection("sabsms_scheduled_subscriptions")
    .findOne({ _id: token as unknown as never })) as SubscriptionDoc | null;
  if (!sub) {
    return new NextResponse("Subscription not found", { status: 404 });
  }

  // Window: now → +90 days (a reasonable subscription horizon).
  const from = new Date();
  const to = new Date(from.getTime() + 90 * 24 * 60 * 60 * 1000);
  const sends = await loadScheduledSends(sub.workspaceId, { from, to });

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SabSMS//Scheduled//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:SabSMS Scheduled Sends",
  ];
  for (const s of sends) {
    const dt = new Date(s.sendAt);
    if (Number.isNaN(dt.getTime())) continue;
    const start = toIcsDate(dt);
    const end = toIcsDate(new Date(dt.getTime() + 15 * 60_000));
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@sabsms`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeIcs(s.name)}`,
      `DESCRIPTION:${escapeIcs(`${s.recipientCount} recipients · sender ${s.senderId}`)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="sabsms-schedule.ics"',
      "Cache-Control": "no-store",
    },
  });
}
