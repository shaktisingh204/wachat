/**
 * /sabwa/overview — Accounts hub for the active SabWa project.
 *
 * Shows linked WhatsApp accounts (sessions) for the active project,
 * lets the user pick one as the active session (unlocks Inbox /
 * Chats / etc. sidebar features), and offers a "Connect another"
 * CTA that drops the user into the pairing flow.
 *
 * Server entry just sets metadata. Active project + active session
 * both live client-side (localStorage), so the bulk of the logic is
 * in the client component.
 */

import * as React from 'react';
import type { Metadata } from 'next';

import { OverviewAccountsClient } from '../_components/overview-accounts-client';

export const metadata: Metadata = {
  title: 'Accounts — SabWa',
  description:
    'Linked WhatsApp accounts for this SabWa project. Pick one to activate, or connect another number.',
};

export const dynamic = 'force-dynamic';

export default function SabwaOverviewPage() {
  return <OverviewAccountsClient />;
}
