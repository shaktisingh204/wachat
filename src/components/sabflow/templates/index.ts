import type { TemplateDefinition, TemplateCategory } from './types';

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

export type { TemplateDefinition, TemplateCategory } from './types';
