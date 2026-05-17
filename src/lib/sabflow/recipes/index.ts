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
