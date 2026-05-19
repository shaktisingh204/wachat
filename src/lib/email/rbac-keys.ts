/**
 * Email Suite permission keys (single source of truth for the module).
 *
 * Mirrored pattern from `src/lib/sabwa/rbac-keys.ts`. Keys should also be
 * enumerated in `src/lib/permission-modules.ts` under `moduleCategories.Email`.
 *
 * See `plan/EMAIL_APP_REBUILD_PLAN.md` §8 for plan-tier mapping.
 */

export const EMAIL_PERMISSION_KEYS = [
  'email_overview',
  // Audience
  'email_audience',
  'email_audience_import',
  'email_audience_export',
  'email_segments',
  'email_tags',
  'email_fields',
  'email_signup_forms',
  // Campaigns
  'email_campaigns',
  'email_campaign_send',
  'email_campaign_schedule',
  'email_ab_testing',
  // Journeys
  'email_journeys',
  'email_journey_activate',
  // Templates
  'email_templates',
  'email_template_builder',
  'email_brand_kit',
  // Inbox
  'email_inbox',
  'email_inbox_reply',
  'email_inbox_assign',
  // Reports
  'email_reports',
  'email_reports_export',
  'email_revenue_attribution',
  // Deliverability
  'email_deliverability',
  'email_dns_manage',
  'email_dkim_rotate',
  'email_warmup',
  'email_placement_test',
  'email_suppressions',
  // Integrations
  'email_integrations',
  'email_api_keys',
  'email_webhooks',
  // Settings
  'email_settings',
  'email_compliance',
  'email_team',
  'email_billing',
] as const;

export type EmailPermissionKey = (typeof EMAIL_PERMISSION_KEYS)[number];
