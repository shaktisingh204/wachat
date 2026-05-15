/**
 * /sabwa/devices — Linked WhatsApp sessions for the active project.
 *
 * Server-rendered shell that owns metadata; the client component
 * fetches `listSessions(activeProjectId)` once `activeProjectId` is
 * resolved from `ProjectContext` (the active project is stored in
 * localStorage, so we cannot read it server-side here).
 *
 * Source of truth: SABWA_PLAN.md § 6 page 3.
 */

import * as React from 'react';
import type { Metadata } from 'next';

import { DevicesClient } from './_client';

export const metadata: Metadata = {
  title: 'Linked Devices — SabWa',
  description:
    'Manage every WhatsApp session linked to this project: rename, log out, or connect another number.',
};

export default function DevicesPage() {
  return <DevicesClient />;
}
