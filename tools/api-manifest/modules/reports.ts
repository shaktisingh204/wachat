/**
 * Reports surface — pre-built aggregations per CRM domain.
 *
 * Every report is read-only (`GET`) and accepts a `from`/`to` window.
 * Forwards to `/v1/crm/reports/*` Rust paths.
 */

import type { EndpointSpec } from '../types';

const generic2xx = { description: 'OK', schema: { type: 'object' as const } };
const auth = {
  '401': { description: 'Missing or invalid API key' },
  '429': { description: 'Rate limit exceeded' },
};

function report(
  resource: string,
  segment: string,
  scope: string,
  summary: string,
): EndpointSpec {
  return {
    module: 'reports',
    resource,
    verb: 'list',
    path: `/reports/${segment}`,
    method: 'GET',
    scope,
    tier: 'PRO',
    summary,
    queryParams: [
      { name: 'from', schema: { type: 'string', format: 'date-time' } },
      { name: 'to', schema: { type: 'string', format: 'date-time' } },
      { name: 'groupBy', schema: { type: 'string', enum: ['day', 'week', 'month', 'quarter', 'year'] } },
      { name: 'format', schema: { type: 'string', enum: ['json', 'csv', 'xlsx', 'pdf'], default: 'json' } },
    ],
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: `/v1/crm/reports/${segment}`, method: 'GET' },
  };
}

export const reportsEndpoints: ReadonlyArray<EndpointSpec> = [
  /* ── Sales ────────────────────────────────────────────────────────────── */
  report('sales', 'sales/summary', 'crm:sales:read', 'Aggregate sales summary'),
  report('sales', 'sales/by-product', 'crm:sales:read', 'Sales grouped by product'),
  report('sales', 'sales/by-customer', 'crm:sales:read', 'Sales grouped by customer'),
  report('sales', 'sales/by-rep', 'crm:sales:read', 'Sales grouped by sales rep'),
  report('sales', 'sales/by-region', 'crm:sales:read', 'Sales grouped by region'),
  report('sales', 'sales/by-channel', 'crm:sales:read', 'Sales grouped by channel'),
  report('sales', 'sales/pipeline', 'crm:sales:read', 'Sales pipeline + win/loss rates'),
  report('sales', 'sales/forecast', 'crm:sales:read', 'Sales forecast for the window'),
  report('sales', 'sales/aging-receivables', 'crm:sales:read', 'A/R aging buckets'),
  report('sales', 'sales/top-deals', 'crm:sales:read', 'Top open and closed deals'),

  /* ── Purchases ────────────────────────────────────────────────────────── */
  report('purchases', 'purchases/summary', 'crm:purchases:read', 'Aggregate purchases summary'),
  report('purchases', 'purchases/by-vendor', 'crm:purchases:read', 'Purchases grouped by vendor'),
  report('purchases', 'purchases/by-category', 'crm:purchases:read', 'Purchases grouped by category'),
  report('purchases', 'purchases/aging-payables', 'crm:purchases:read', 'A/P aging buckets'),
  report('purchases', 'purchases/open-orders', 'crm:purchases:read', 'Open purchase orders'),

  /* ── Inventory ────────────────────────────────────────────────────────── */
  report('inventory', 'inventory/stock-summary', 'crm:inventory:read', 'On-hand stock summary'),
  report('inventory', 'inventory/stock-valuation', 'crm:inventory:read', 'Stock valuation by warehouse'),
  report('inventory', 'inventory/stock-movement', 'crm:inventory:read', 'Stock movements over a window'),
  report('inventory', 'inventory/low-stock', 'crm:inventory:read', 'Items at or below reorder threshold'),
  report('inventory', 'inventory/dead-stock', 'crm:inventory:read', 'Items with no movement in N days'),
  report('inventory', 'inventory/abc-analysis', 'crm:inventory:read', 'ABC classification by velocity / margin'),
  report('inventory', 'inventory/by-warehouse', 'crm:inventory:read', 'Stock grouped by warehouse'),

  /* ── Accounting ───────────────────────────────────────────────────────── */
  report('accounting', 'accounting/trial-balance', 'crm:accounting:read', 'Trial balance'),
  report('accounting', 'accounting/balance-sheet', 'crm:accounting:read', 'Balance sheet'),
  report('accounting', 'accounting/income-statement', 'crm:accounting:read', 'Income statement (P&L)'),
  report('accounting', 'accounting/cash-flow', 'crm:accounting:read', 'Cash-flow statement'),
  report('accounting', 'accounting/day-book', 'crm:accounting:read', 'Day book'),
  report('accounting', 'accounting/general-ledger', 'crm:accounting:read', 'General ledger'),
  report('accounting', 'accounting/by-account', 'crm:accounting:read', 'Transactions grouped by account'),
  report('accounting', 'accounting/tax-summary', 'crm:accounting:read', 'Tax liability summary'),
  report('accounting', 'accounting/tds-summary', 'crm:accounting:read', 'TDS deducted + remitted summary'),
  report('accounting', 'accounting/reconciliation-status', 'crm:accounting:read', 'Bank reconciliation status'),

  /* ── HR ───────────────────────────────────────────────────────────────── */
  report('hr', 'hr/headcount', 'crm:hr:read', 'Headcount by department / location / employment type'),
  report('hr', 'hr/turnover', 'crm:hr:read', 'Turnover + attrition rate'),
  report('hr', 'hr/attendance-summary', 'crm:hr:read', 'Attendance summary by employee / department'),
  report('hr', 'hr/leave-balance', 'crm:hr:read', 'Leave balances by employee'),
  report('hr', 'hr/leave-utilisation', 'crm:hr:read', 'Leave utilisation by team'),
  report('hr', 'hr/payroll-summary', 'crm:hr:read', 'Payroll summary by run'),
  report('hr', 'hr/payroll-by-component', 'crm:hr:read', 'Payroll grouped by salary component'),
  report('hr', 'hr/employee-cost', 'crm:hr:read', 'Total cost of employment per employee'),
  report('hr', 'hr/diversity', 'crm:hr:read', 'Diversity breakdown'),
  report('hr', 'hr/training-completions', 'crm:hr:read', 'Training completion rates'),
  report('hr', 'hr/recruitment-funnel', 'crm:hr:read', 'Candidate funnel + time-to-hire'),
  report('hr', 'hr/performance-distribution', 'crm:hr:read', 'Performance rating distribution'),

  /* ── Projects ─────────────────────────────────────────────────────────── */
  report('projects', 'projects/summary', 'crm:projects:read', 'Project portfolio summary'),
  report('projects', 'projects/timesheet-summary', 'crm:projects:read', 'Time logged by user / project / task'),
  report('projects', 'projects/utilization', 'crm:projects:read', 'Resource utilisation per user'),
  report('projects', 'projects/burndown', 'crm:projects:read', 'Burndown by milestone'),
  report('projects', 'projects/profitability', 'crm:projects:read', 'Project profitability'),
  report('projects', 'projects/overdue-tasks', 'crm:projects:read', 'Overdue task list'),

  /* ── Support ──────────────────────────────────────────────────────────── */
  report('support', 'support/ticket-volume', 'crm:support:read', 'Ticket volume by channel / queue'),
  report('support', 'support/sla-compliance', 'crm:support:read', 'SLA compliance + breach list'),
  report('support', 'support/first-response-time', 'crm:support:read', 'First-response and resolution times'),
  report('support', 'support/csat', 'crm:support:read', 'CSAT scores'),
  report('support', 'support/by-agent', 'crm:support:read', 'Tickets handled by agent'),

  /* ── Marketing ────────────────────────────────────────────────────────── */
  report('marketing', 'marketing/campaign-performance', 'crm:marketing:read', 'Campaign performance summary'),
  report('marketing', 'marketing/coupon-usage', 'crm:marketing:read', 'Coupon redemption stats'),
  report('marketing', 'marketing/loyalty-summary', 'crm:marketing:read', 'Loyalty program enrolment + spend'),
  report('marketing', 'marketing/conversion-funnel', 'crm:marketing:read', 'Top-of-funnel → conversion'),
  report('marketing', 'marketing/cohort-analysis', 'crm:marketing:read', 'Customer cohort retention'),

  /* ── Messaging / wachat ───────────────────────────────────────────────── */
  report('messaging', 'messaging/delivery-rate', 'messages:read', 'Outbound delivery + read-receipt rates'),
  report('messaging', 'messaging/conversation-volume', 'messages:read', 'Conversation volume'),
  report('messaging', 'messaging/response-time', 'messages:read', 'Average response time per agent'),
  report('messaging', 'messaging/template-performance', 'templates:read', 'Per-template send + reply stats'),
  report('messaging', 'messaging/cost-summary', 'messages:read', 'Messaging cost by phone number / project'),
];
