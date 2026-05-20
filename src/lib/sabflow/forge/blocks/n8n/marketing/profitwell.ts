/**
 * Forge block: ProfitWell
 *
 * Source: n8n-master/packages/nodes-base/nodes/ProfitWell/ProfitWell.node.ts
 * Credential type: 'profitwell' — { apiToken } sent as `Authorization: <token>`.
 *
 * Operations covered:
 *   - metric.list           (account / daily / monthly aggregates)
 *   - metric.plans          (list configured plan ids — needed for per-plan
 *                            calls in any downstream block)
 *   - company.settings      (workspace currency / counted-events config)
 *   - churn.list            (monthly churn report)
 *
 * Out of scope (deferred):
 *   - per-plan metric breakdowns: those need a plan-id-aware UI (currently
 *     we only expose flat metric names), so they'd just confuse flow authors
 *     without dynamic option loading. Revisit once forge supports loadOptions.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.profitwell.com/v2';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('ProfitWell', ctx.credential);
  const tok = cred.apiToken ?? '';
  if (!tok) throw new Error('ProfitWell: credential is missing `apiToken`');
  return { Authorization: tok };
}

async function get(ctx: ForgeActionContext, path: string, query?: Record<string, string>): Promise<unknown> {
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== '' && v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : '';
  const res = await apiRequest({
    service: 'ProfitWell',
    method: 'GET',
    url: `${BASE}${path}${qs}`,
    headers: authHeader(ctx),
  });
  return res.data;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function metricList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const period = asString(ctx.options.period) || 'monthly';
  const month = asString(ctx.options.month);
  const day = asString(ctx.options.day);
  const path = period === 'daily' ? '/metrics/daily/' : '/metrics/monthly/';
  const query: Record<string, string> = {};
  if (month) query.month = month;
  if (day) query.day = day;
  const data = await get(ctx, path, query);
  return { outputs: { result: data }, logs: [`ProfitWell metrics (${period})`] };
}

async function metricPlans(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await get(ctx, '/metrics/plans');
  return { outputs: { result: data }, logs: ['ProfitWell metric plans'] };
}

async function companySettings(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await get(ctx, '/company/settings/');
  return { outputs: { result: data }, logs: ['ProfitWell company settings'] };
}

async function churnList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const month = asString(ctx.options.month);
  const query: Record<string, string> = {};
  if (month) query.month = month;
  const data = await get(ctx, '/company/churn/', query);
  return { outputs: { result: data }, logs: ['ProfitWell churn list'] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_profitwell',
  name: 'ProfitWell',
  description: 'Pull subscription metrics and churn data from ProfitWell.',
  iconName: 'LuTrendingUp',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'profitwell',
  },
  actions: [
    {
      id: 'metric_list',
      label: 'List metrics',
      description: 'Fetch ProfitWell subscription metrics (daily or monthly).',
      fields: [
        {
          id: 'period',
          label: 'Period',
          type: 'select',
          defaultValue: 'monthly',
          options: [
            { label: 'Monthly', value: 'monthly' },
            { label: 'Daily', value: 'daily' },
          ],
        },
        { id: 'month', label: 'Month (YYYY-MM)', type: 'text' },
        { id: 'day', label: 'Day (YYYY-MM-DD)', type: 'text' },
      ],
      run: metricList,
    },
    {
      id: 'metric_plans',
      label: 'List plan ids',
      description: 'Fetch the configured plan ids for this workspace.',
      fields: [],
      run: metricPlans,
    },
    {
      id: 'company_settings',
      label: 'Get company settings',
      description: 'Fetch the ProfitWell workspace-level settings (currency, etc.).',
      fields: [],
      run: companySettings,
    },
    {
      id: 'churn_list',
      label: 'List churn',
      description: 'Fetch the monthly company-level churn report.',
      fields: [
        { id: 'month', label: 'Month (YYYY-MM)', type: 'text' },
      ],
      run: churnList,
    },
  ],
};

registerForgeBlock(block);
export default block;
