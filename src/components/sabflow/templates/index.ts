import type { TemplateDefinition, TemplateCategory } from './types';
import {
  registerTemplate as registerCanonicalTemplate,
  normaliseCategory,
  FIRST_PARTY_PUBLISHER,
  type Template as CanonicalTemplate,
} from '@/lib/sabflow/marketplace/registry';

import {
  leadCaptureTemplate,
  customerSupportTemplate,
  feedbackSurveyTemplate,
  quizTemplate,
} from './definitions/core';

import {
  productRecommendationTemplate,
  newsletterSignupTemplate,
  customerOnboardingTemplate,
  saasDemoRequestTemplate,
  mortgageCalculatorTemplate,
} from './definitions/marketing';

import {
  orderTrackingTemplate,
  restaurantMenuTemplate,
  productReturnsTemplate,
  faqBotTemplate,
} from './definitions/ecommerce';

import {
  jobApplicationTemplate,
  eventRsvpTemplate,
  bookingAppointmentTemplate,
  fitnessCoachTemplate,
  legalIntakeTemplate,
  mentalHealthCheckinTemplate,
} from './definitions/hrHealth';

/**
 * Full list of flow templates exposed to the dashboard picker.
 * Order here = display order in the grid.  Keep the 4 original templates at
 * the top so existing users see familiar entries first.
 */
export const TEMPLATES: TemplateDefinition[] = [
  // Core (original 4)
  leadCaptureTemplate,
  customerSupportTemplate,
  feedbackSurveyTemplate,
  quizTemplate,

  // Marketing / Sales
  productRecommendationTemplate,
  newsletterSignupTemplate,
  customerOnboardingTemplate,
  saasDemoRequestTemplate,
  mortgageCalculatorTemplate,
  eventRsvpTemplate,

  // E-commerce / Support
  orderTrackingTemplate,
  restaurantMenuTemplate,
  productReturnsTemplate,
  faqBotTemplate,

  // HR / Health / Services
  jobApplicationTemplate,
  bookingAppointmentTemplate,
  fitnessCoachTemplate,
  legalIntakeTemplate,
  mentalHealthCheckinTemplate,
];

/**
 * Category list used by the filter chips.  `"All"` is rendered first in the
 * UI and is not part of this array (it's a convenience filter that shows
 * every template).
 */
export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Marketing',
  'Support',
  'Sales',
  'HR',
  'E-commerce',
  'Health',
];

/* ── C.10.8 #8 — push chatbot templates into the unified registry ─────
 *
 * The marketplace browse page (Phase C.10.5) reads from
 * `@/lib/sabflow/marketplace/registry`.  Side-effect-register every chatbot
 * template here so the in-builder picker and the marketplace see the same
 * catalogue.  The legacy `TEMPLATES` array above stays as-is for any code
 * that still imports the chatbot-specific shape directly. */
function adaptChatbotTemplate(tpl: TemplateDefinition): CanonicalTemplate {
  return {
    id: tpl.id,
    slug: tpl.id,
    displayName: tpl.name,
    description: tpl.description,
    category: normaliseCategory(tpl.category),
    tags: [],
    requiredCredentials: [],
    screenshots: [],
    version: '1.0.0',
    publisher: FIRST_PARTY_PUBLISHER,
    installCount: 0,
    kind: 'chatbot',
    chrome: {
      emoji: tpl.emoji,
      color: tpl.color,
      bgColor: tpl.bgColor,
      icon: tpl.icon,
    },
    build: tpl.build,
  };
}

for (const tpl of TEMPLATES) {
  registerCanonicalTemplate(adaptChatbotTemplate(tpl));
}

export type { TemplateDefinition, TemplateCategory } from './types';
