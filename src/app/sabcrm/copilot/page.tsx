/**
 * SabCRM — Copilot route (`/sabcrm/copilot`).
 *
 * Server entry: renders the client chat surface. The agent loop, RBAC gate, and
 * `ai_requests` metering all live behind the `runCopilotTw` server action the
 * client calls — nothing in this route is cached (every run is authenticated,
 * per-user, and metered).
 */

import type { Metadata } from 'next';

import CopilotClient from './copilot-client';

export const metadata: Metadata = {
  title: 'Copilot · SabCRM',
  description:
    'Agentic CRM copilot — ask in plain language and watch it plan, retrieve, ' +
    'and act on your records under your permissions.',
};

export default function CopilotPage(): React.ReactElement {
  return <CopilotClient />;
}
