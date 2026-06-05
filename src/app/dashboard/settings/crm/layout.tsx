import React from 'react';
import type { Metadata } from 'next';

import '@/styles/sabcrm-twenty.css';
import { CrmSettingsShell } from './_components/crm-settings-shell';

export const metadata: Metadata = {
  title: 'Settings · SabNode',
  description: 'Your account, workspace, billing and module settings in one place.',
};

/**
 * CRM settings layout — `/dashboard/settings/crm/*`.
 *
 * SabCRM's settings pages were relocated here out of `/sabcrm/settings/*` so
 * they live inside SabNode's settings hub, while keeping their Twenty-faithful
 * look. The pages render with the `.st-*` design system, which is scoped under
 * `.sabcrm-twenty` — so this layout re-establishes that scope (the dashboard
 * `TwentyAppFrame` that previously provided it is not in this route tree).
 *
 * Gating, project context and locale come from the parent
 * `dashboard/layout.tsx` (RBACGuard + ProjectProvider + LocaleProvider), which
 * mirrors the old `/sabcrm` layout — so `useProject()` and the gated server
 * actions resolve a project exactly as before. Only the visual scope is added
 * here; no extra providers are needed.
 */
export default function CrmSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CrmSettingsShell>{children}</CrmSettingsShell>;
}
