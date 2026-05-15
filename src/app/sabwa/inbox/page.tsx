/**
 * /sabwa/inbox — WhatsApp-Web-style 3-pane inbox.
 *
 * Server entry is a thin wrapper that hands the client shell over. The
 * shell itself reads the active session via `useSabwaSession()` and
 * deep-link state via URL query params:
 *
 *   ?chat=<jid>      — currently selected conversation
 *   ?panel=open      — right-hand contact panel toggle
 *
 * Desktop renders all three columns. Mobile renders one pane at a time,
 * driven by whether `?chat` is set. Browser back / forward works for free.
 *
 * Per SABWA_PLAN.md §6 page 4.
 */

import * as React from 'react';
import type { Metadata } from 'next';

import { InboxShell } from './_inbox-shell';

export const metadata: Metadata = { title: 'Inbox — SabWa' };

export default function InboxPage() {
  // Stateful UI lives entirely in the client shell. The server page is
  // intentionally tiny — it only sets metadata and mounts the shell.
  return <InboxShell />;
}
