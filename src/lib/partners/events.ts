/**
 * Meetup directory + RSVP.
 *
 * Capacity-aware RSVP; idempotent per (eventId, userId).
 */

import 'server-only';

import { randomUUID } from 'node:crypto';

import type { MeetupEvent } from './types';

export interface CreateEventInput {
  title: string;
  description: string;
  city: string;
  region: string;
  venue?: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  organizerUserId: string;
}

export function createMeetup(input: CreateEventInput): MeetupEvent {
  if (input.capacity < 1) throw new Error('capacity must be >= 1');
  if (input.endsAt.getTime() <= input.startsAt.getTime()) {
    throw new Error('endsAt must be after startsAt');
  }
  return {
    eventId: randomUUID(),
    title: input.title,
    description: input.description,
    city: input.city,
    region: input.region,
    venue: input.venue,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    capacity: input.capacity,
    rsvps: [],
    organizerUserId: input.organizerUserId,
  };
}

export type RsvpResult =
  | { ok: true; event: MeetupEvent; alreadyRsvped: boolean }
  | { ok: false; reason: 'full' | 'past' };

export function rsvp(event: MeetupEvent, userId: string, tenantId?: string): RsvpResult {
  if (event.startsAt.getTime() < Date.now()) {
    return { ok: false, reason: 'past' };
  }
  const already = event.rsvps.find((r) => r.userId === userId);
  if (already) {
    return { ok: true, event, alreadyRsvped: true };
  }
  if (event.rsvps.length >= event.capacity) {
    return { ok: false, reason: 'full' };
  }
  const updated: MeetupEvent = {
    ...event,
    rsvps: [...event.rsvps, { userId, tenantId, rsvpedAt: new Date() }],
  };
  return { ok: true, event: updated, alreadyRsvped: false };
}

export function cancelRsvp(event: MeetupEvent, userId: string): MeetupEvent {
  return { ...event, rsvps: event.rsvps.filter((r) => r.userId !== userId) };
}

export interface MeetupFilter {
  city?: string;
  region?: string;
  /** Only return events starting on/after this time. Defaults to "now". */
  fromDate?: Date;
}

export function listMeetups(events: MeetupEvent[], filter: MeetupFilter = {}): MeetupEvent[] {
  const from = (filter.fromDate ?? new Date()).getTime();
  return events
    .filter((e) => {
      if (e.startsAt.getTime() < from) return false;
      if (filter.city && e.city.toLowerCase() !== filter.city.toLowerCase()) return false;
      if (filter.region && e.region.toLowerCase() !== filter.region.toLowerCase()) return false;
      return true;
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function seatsRemaining(event: MeetupEvent): number {
  return Math.max(0, event.capacity - event.rsvps.length);
}
