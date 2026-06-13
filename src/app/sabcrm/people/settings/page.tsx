/**
 * SabCRM People — Payroll settings (`/sabcrm/people/settings`, WI-35).
 *
 * Server entry for the singleton-per-project payroll configuration
 * (WI-14): one gated read returns the project's settings document (or
 * null on first run — the form starts blank and the save upserts).
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * the save action re-runs the full session → project → RBAC → plan
 * gate.
 */

import * as React from 'react';

import { getSabcrmPayrollSettings } from '@/app/actions/sabcrm-people-payroll-settings.actions';
import { PayrollSettingsClient } from './payroll-settings-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'People settings — SabCRM',
};

export default async function SabcrmPeopleSettingsPage(): Promise<React.JSX.Element> {
  const res = await getSabcrmPayrollSettings();

  return (
    <PayrollSettingsClient
      initial={res.ok ? res.data : null}
      initialError={res.ok ? null : res.error}
    />
  );
}
