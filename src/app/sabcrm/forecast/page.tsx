/**
 * SabCRM — Forecast (`/sabcrm/forecast`), 20ui.
 *
 * Server entry for the Sales suite's weighted forecast + goals surface:
 *
 *   - the weighted forecast series via the gated `computeSabcrmForecast`
 *     action (sum of open-lead `amount × stage probability`, bucketed by
 *     close-date period, plus won-so-far — see
 *     `sabcrm-forecast.actions.types.ts` for the math);
 *   - the project's pipelines (selector) via `listPipelinesTw`;
 *   - the sales targets / quotas via `listSalesTargetsTw`
 *     (`/v1/sabcrm/targets/quotas`);
 *   - the workspace members via `listMembersAction` (per-member quotas).
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM
 * `layout.tsx`. The Rust engine may be down at dev time — every action
 * normalises that into `{ ok: false, error }`, which renders as an inline
 * error state instead of crashing the route.
 *
 * Documents are narrowed to flat serialisable rows so the `server-only`
 * rust-client modules never enter the client bundle.
 */

import * as React from 'react';

import { computeSabcrmForecast } from '@/app/actions/sabcrm-forecast.actions';
import { listPipelinesTw } from '@/app/actions/sabcrm-pipelines.actions';
import { listSalesTargetsTw } from '@/app/actions/sabcrm-targets.actions';
import { listMembersAction } from '@/app/actions/sabcrm.actions';
import {
  ForecastClient,
  type ForecastMemberOption,
  type ForecastPipelineOption,
} from './forecast-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Forecast — SabCRM',
};

export default async function SabcrmForecastPage(): Promise<React.JSX.Element> {
  const [forecastRes, pipelinesRes, targetsRes, membersRes] =
    await Promise.all([
      computeSabcrmForecast({ period: 'month' }),
      listPipelinesTw(),
      listSalesTargetsTw(),
      listMembersAction(),
    ]);

  const pipelines: ForecastPipelineOption[] = pipelinesRes.ok
    ? pipelinesRes.data.map((p) => ({
        id: p.id,
        name: p.name,
        isDefault: !!p.isDefault,
      }))
    : [];

  const members: ForecastMemberOption[] = membersRes.ok
    ? membersRes.data.map((m) => ({
        userId: m.userId,
        label: m.name || m.email,
      }))
    : [];

  // The forecast error is the page's primary failure signal; pipelines /
  // targets / members degrade quietly into empty selectors.
  return (
    <ForecastClient
      initialForecast={forecastRes.ok ? forecastRes.data : null}
      initialError={forecastRes.ok ? null : forecastRes.error}
      initialTargets={targetsRes.ok ? targetsRes.data : []}
      pipelines={pipelines}
      members={members}
    />
  );
}
