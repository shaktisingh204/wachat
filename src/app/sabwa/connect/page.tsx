/**
 * /sabwa/connect — Connect a personal WhatsApp number to a SabNode project.
 *
 * Server Component shell that owns metadata; everything else is handled
 * by the `<ConnectClient />` client component (tabs, pairing UI, ToS
 * acknowledgement modal, FAQ accordion).
 *
 * Source of truth: SABWA_PLAN.md § 6 page 2.
 */

import * as React from 'react';
import type { Metadata } from 'next';

import { ConnectClient } from './_client';

export const metadata: Metadata = {
  title: 'Connect Account — SabWa',
  description:
    'Link your personal WhatsApp number to SabNode using a refreshing QR code or an 8-character pair code.',
};

export default function ConnectPage() {
  return <ConnectClient />;
}
