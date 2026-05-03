/**
 * Webinar registration + lead capture.
 *
 * Pure helpers; persistence happens in the route handlers / server actions
 * that wrap these functions.
 */

import 'server-only';

import { randomUUID } from 'node:crypto';

import type { Webinar, WebinarRegistrant, WebinarStatus } from './types';

export interface CreateWebinarInput {
  title: string;
  description: string;
  hostName: string;
  hostTenantId: string;
  startsAt: Date;
  durationMin: number;
}

export function createWebinar(input: CreateWebinarInput): Webinar {
  return {
    webinarId: randomUUID(),
    title: input.title,
    description: input.description,
    hostName: input.hostName,
    hostTenantId: input.hostTenantId,
    startsAt: input.startsAt,
    durationMin: input.durationMin,
    status: 'scheduled' as WebinarStatus,
    registrants: [],
  };
}

export interface RegisterAttendeeInput {
  email: string;
  name: string;
  tenantId?: string;
  utmSource?: string;
}

export function registerAttendee(webinar: Webinar, input: RegisterAttendeeInput): Webinar {
  if (webinar.status !== 'scheduled' && webinar.status !== 'live') {
    throw new Error(`Cannot register for a ${webinar.status} webinar`);
  }
  const email = input.email.trim().toLowerCase();
  if (webinar.registrants.some((r) => r.email === email)) {
    return webinar; // idempotent re-registration
  }
  const registrant: WebinarRegistrant = {
    email,
    name: input.name,
    tenantId: input.tenantId,
    utmSource: input.utmSource,
    registeredAt: new Date(),
  };
  return { ...webinar, registrants: [...webinar.registrants, registrant] };
}

export function startWebinar(webinar: Webinar, roomUrl: string): Webinar {
  return { ...webinar, status: 'live', roomUrl };
}

export function endWebinar(webinar: Webinar, recordingUrl?: string): Webinar {
  return { ...webinar, status: 'ended', recordingUrl };
}

export function cancelWebinar(webinar: Webinar): Webinar {
  return { ...webinar, status: 'cancelled' };
}

export function markAttendance(webinar: Webinar, attendedEmails: string[]): Webinar {
  const set = new Set(attendedEmails.map((e) => e.trim().toLowerCase()));
  return {
    ...webinar,
    registrants: webinar.registrants.map((r) =>
      set.has(r.email) ? { ...r, attended: true } : r,
    ),
  };
}

/** Lead-capture digest — emails marked `attended` first, others after. */
export function leadList(webinar: Webinar): WebinarRegistrant[] {
  return [...webinar.registrants].sort((a, b) => {
    if ((a.attended ? 1 : 0) !== (b.attended ? 1 : 0)) {
      return (b.attended ? 1 : 0) - (a.attended ? 1 : 0);
    }
    return a.registeredAt.getTime() - b.registeredAt.getTime();
  });
}
