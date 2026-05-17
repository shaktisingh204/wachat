/**
 * SabFlow Recipes — package entry point.
 *
 * Re-exports the registry API and side-effect-imports each built-in recipe
 * so the registry is populated by the time consumers call `listRecipes()`.
 *
 * The recipe modules MUST be imported here (not inside `registry.ts`) — if
 * registry side-effect-imports them itself, a circular import causes the
 * recipes to call `registerRecipe(...)` before `registry.ts`'s top-level
 * `const recipeMap = new Map()` has run, and Node throws
 * "Cannot access 'recipeMap' before initialization" (TDZ).
 */

export {
  registerRecipe,
  listRecipes,
  getRecipe,
  instantiateRecipe,
} from './registry';

import './lead-to-whatsapp-welcome';
import './abandoned-cart';
import './ad-spend-alert';
import './welcome-onboarding';
import './payment-received';
// Step 23 — additional seed-pack recipes.
import './openai-qa-bot';
import './newsletter-signup';
import './customer-feedback-survey';
import './appointment-scheduler';
import './support-escalation';
// Step 35 — second seed-pack (10 more templates → total of 20).
import './seed-pack-2';
// Agent A3 — third seed-pack (20 more templates → total of 40).
import './seed-pack-3';
// Agent B10 — fourth seed-pack (20 more templates → total of 60).
import './seed-pack-4';

// Step 24 — content-push batch: 40+ new recipes across 10 categories.
// Lead capture → CRM
import './lead-capture-to-hubspot';
import './lead-capture-to-salesforce';
import './lead-capture-to-pipedrive';
import './lead-capture-to-airtable';
// Slack notifications
import './slack-deal-won-alert';
import './slack-new-signup-alert';
import './slack-error-alert';
import './slack-daily-digest';
// Database sync
import './db-sync-mongo-to-sheets';
import './db-sync-postgres-to-airtable';
import './db-sync-stripe-to-warehouse';
import './db-sync-shopify-to-hubspot';
// Email sequences
import './email-sequence-drip-3step';
import './email-sequence-trial-nudge';
import './email-sequence-reengagement';
import './email-sequence-event-followup';
// Webhook receivers
import './webhook-relay-stripe';
import './webhook-relay-github';
import './webhook-relay-shopify-order';
import './webhook-relay-typeform';
// Calendar automation
import './calendar-meeting-reminder';
import './calendar-booking-confirm';
import './calendar-noshow-followup';
import './calendar-followup-tasks';
// AI content generation
import './ai-blog-draft-generator';
import './ai-social-rewriter';
import './ai-email-personalizer';
import './ai-image-caption-alt';
import './ai-meeting-summary';
// Form processing
import './form-processing-applicant';
import './form-processing-rsvp';
import './form-processing-contact';
import './form-processing-nps';
// E-commerce events
import './ecommerce-order-fulfilled';
import './ecommerce-refund-issued';
import './ecommerce-low-stock-alert';
import './ecommerce-review-request';
// Customer support routing
import './support-route-by-tier';
import './support-ai-triage';
import './support-sla-breach-alert';
import './support-csat-collect';
// Onboarding bonus
import './onboarding-task-assign';

// ═══════════════════════════════════════════════════════════════
// === Wave-C imports: support, devops, sales, HR ===
// ═══════════════════════════════════════════════════════════════
// Support & incident management
import './support-incident-triage-sentiment';
import './support-sla-breach-pagerduty';
import './support-auto-close-stale';
import './support-zendesk-to-linear';
import './support-csat-health-alert';
import './support-oncall-rotation-reminder';
// DevOps & monitoring alerts
import './devops-datadog-anomaly-slack';
import './devops-sentry-spike-to-jira';
import './devops-github-deploy-discord';
import './devops-uptime-probe-sms';
import './devops-aws-cost-spike-email';
import './devops-pr-auto-merge';
// Sales pipeline automation
import './sales-deal-stage-advanced-slack';
import './sales-stripe-payment-hubspot-closedwon';
import './sales-calendly-to-salesforce';
import './sales-lost-deal-segment-event';
import './sales-quarterly-pipeline-summary';
import './sales-trial-expiring-email';
// HR onboarding / offboarding
import './hr-new-hire-provision';
import './hr-offboarding-revoke-credentials';
import './hr-birthday-anniversary-slack';
import './hr-timeoff-request-notify';
import './hr-performance-review-reminder';
import './hr-offboarding-equipment-return';

// ═══════════════════════════════════════════════════════════════
// === Wave-D imports: marketing, finance, data, social ===
// ═══════════════════════════════════════════════════════════════
// Marketing campaign automation
import './marketing-trial-drip-klaviyo';
import './marketing-cart-abandon-7day';
import './marketing-reengage-90day';
import './marketing-lead-magnet-hubspot';
import './marketing-webinar-reminder';
import './marketing-influencer-outreach';
// Finance & billing automation
import './finance-stripe-dunning';
import './finance-monthly-revenue-rollup';
import './finance-chargebee-provision-auth0';
import './finance-quarterly-expense-categorize';
import './finance-refund-issued-sentry';
import './finance-invoice-overdue-followup';
// Data enrichment & validation
import './data-enrich-clearbit-hubspot';
import './data-enrich-email-validate-neverbounce';
import './data-enrich-address-salesforce';
import './data-enrich-phone-twilio-lookup';
import './data-enrich-apollo-firmographics';
import './data-enrich-mx-probe';
// Social media scheduling & engagement
import './social-rss-crosspost';
import './social-mention-monitor-slack';
import './social-twitter-thread-from-blog';
import './social-linkedin-job-to-ats';
import './social-instagram-dm-autoreply';
import './social-content-calendar-reminder';
