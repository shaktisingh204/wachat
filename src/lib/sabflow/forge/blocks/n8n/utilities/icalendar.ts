/**
 * Forge block: iCalendar
 *
 * Source: n8n-master/packages/nodes-base/nodes/ICalendar/ICalendar.node.ts
 *
 * Pure-JS ICS string generator — no native deps. The n8n original uses
 * `ical-generator`; this port emits the RFC 5545 VEVENT envelope by hand
 * so it stays runtime-portable.
 *
 * Operations covered:
 *   - event.create   build an ICS string for a single VEVENT
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

function toICSDate(input: string): string {
  // Accept ISO-ish input and emit YYYYMMDDTHHMMSSZ.
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error(`iCalendar: invalid date "${input}"`);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeICS(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

async function eventCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const start = asString(ctx.options.start);
  const end = asString(ctx.options.end);
  if (!title) throw new Error('iCalendar: title is required');
  if (!start) throw new Error('iCalendar: start is required');
  if (!end) throw new Error('iCalendar: end is required');
  const description = asString(ctx.options.description);
  const location = asString(ctx.options.location);
  const uid = asString(ctx.options.uid) || `${Date.now()}@sabflow`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SabFlow//Forge iCalendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeICS(uid)}`,
    `DTSTAMP:${toICSDate(new Date().toISOString())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeICS(title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeICS(description)}`);
  if (location) lines.push(`LOCATION:${escapeICS(location)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  const ics = lines.join('\r\n');
  return {
    outputs: { ics, uid },
    logs: [`iCalendar event → ${title}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_icalendar',
  name: 'iCalendar',
  description: 'Generate ICS (RFC 5545) calendar event strings.',
  iconName: 'LuCalendar',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'event_create',
      label: 'Create event',
      description: 'Build an ICS string for a single VEVENT.',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'start', label: 'Start (ISO 8601)', type: 'text', required: true, placeholder: '2026-05-20T10:00:00Z' },
        { id: 'end', label: 'End (ISO 8601)', type: 'text', required: true, placeholder: '2026-05-20T11:00:00Z' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'location', label: 'Location', type: 'text' },
        { id: 'uid', label: 'UID (optional)', type: 'text' },
      ],
      run: eventCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
