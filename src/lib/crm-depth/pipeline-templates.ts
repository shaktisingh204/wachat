/**
 * Pre-built CRM pipelines for 8 common verticals. Each template is a complete
 * `Pipeline` with stages, probabilities, SLAs and stage requirements.
 *
 * Usage:
 *   import { pipelineTemplates, getPipelineTemplate } from '@/lib/crm-depth';
 *   const saas = getPipelineTemplate('saas');
 */
import type { Pipeline, Stage } from './types';

function stage(
  id: string,
  name: string,
  order: number,
  probability: number,
  type: Stage['type'],
  extras: Partial<Stage> = {},
): Stage {
  return { id, name, order, probability, type, ...extras };
}

export const saasPipeline: Pipeline = {
  id: 'tpl-saas',
  name: 'SaaS Sales',
  description: 'B2B SaaS pipeline from MQL through expansion.',
  industry: 'saas',
  currency: 'USD',
  stages: [
    stage('mql', 'MQL', 1, 5, 'open', { slaHours: 24, requirements: ['Qualify ICP fit'] }),
    stage('sql', 'SQL', 2, 15, 'open', { slaHours: 48, requirements: ['Discovery call booked'] }),
    stage('demo', 'Demo Scheduled', 3, 30, 'open', { slaHours: 72 }),
    stage('eval', 'Evaluation / Trial', 4, 50, 'open', { requirements: ['Trial activated', 'Success criteria documented'] }),
    stage('proposal', 'Proposal Sent', 5, 70, 'open', { requirements: ['Pricing approved', 'Quote shared'] }),
    stage('negotiation', 'Negotiation', 6, 85, 'open', { requirements: ['Legal review', 'Procurement contact'] }),
    stage('closed-won', 'Closed Won', 7, 100, 'won'),
    stage('closed-lost', 'Closed Lost', 8, 0, 'lost'),
  ],
};

export const agencyPipeline: Pipeline = {
  id: 'tpl-agency',
  name: 'Agency / Services',
  description: 'Creative or consulting agency project pipeline.',
  industry: 'agency',
  currency: 'USD',
  stages: [
    stage('inquiry', 'Inquiry', 1, 5, 'open', { slaHours: 4 }),
    stage('brief', 'Brief Received', 2, 15, 'open'),
    stage('discovery', 'Discovery Call', 3, 30, 'open', { requirements: ['Scope notes'] }),
    stage('sow', 'SOW Drafted', 4, 55, 'open', { requirements: ['Effort estimate'] }),
    stage('contract', 'Contract Sent', 5, 75, 'open'),
    stage('signed', 'Signed', 6, 100, 'won'),
    stage('lost', 'Lost', 7, 0, 'lost'),
  ],
};

export const realEstatePipeline: Pipeline = {
  id: 'tpl-real-estate',
  name: 'Real Estate',
  description: 'Residential / commercial real estate sales pipeline.',
  industry: 'real-estate',
  currency: 'USD',
  stages: [
    stage('lead', 'New Lead', 1, 5, 'open', { slaHours: 2 }),
    stage('qualified', 'Qualified Buyer', 2, 15, 'open'),
    stage('site-visit', 'Site Visit Scheduled', 3, 30, 'open'),
    stage('offer', 'Offer Submitted', 4, 55, 'open'),
    stage('under-contract', 'Under Contract', 5, 80, 'open', { requirements: ['Inspection', 'Financing'] }),
    stage('closed', 'Closed', 6, 100, 'won'),
    stage('fell-through', 'Fell Through', 7, 0, 'lost'),
  ],
};

export const fitnessPipeline: Pipeline = {
  id: 'tpl-fitness',
  name: 'Fitness & Wellness',
  description: 'Gym / studio member acquisition pipeline.',
  industry: 'fitness',
  currency: 'USD',
  stages: [
    stage('inquiry', 'Inquiry', 1, 10, 'open', { slaHours: 2 }),
    stage('intro-class', 'Intro Class Booked', 2, 30, 'open'),
    stage('attended', 'Attended Intro', 3, 50, 'open'),
    stage('membership', 'Membership Offered', 4, 70, 'open'),
    stage('member', 'Active Member', 5, 100, 'won'),
    stage('no-show', 'No-show / Lost', 6, 0, 'lost'),
  ],
};

export const retailPipeline: Pipeline = {
  id: 'tpl-retail',
  name: 'Retail / eCommerce',
  description: 'Wholesale retail or B2C eCommerce repeat-buyer pipeline.',
  industry: 'retail',
  currency: 'USD',
  stages: [
    stage('cart', 'Cart Created', 1, 10, 'open'),
    stage('checkout', 'Checkout Started', 2, 30, 'open'),
    stage('purchase', 'First Purchase', 3, 70, 'open'),
    stage('repeat', 'Repeat Buyer', 4, 90, 'open'),
    stage('vip', 'VIP / Loyalty', 5, 100, 'won'),
    stage('abandoned', 'Abandoned', 6, 0, 'lost'),
  ],
};

export const b2bServicesPipeline: Pipeline = {
  id: 'tpl-b2b-services',
  name: 'B2B Services',
  description: 'Professional services / consulting pipeline.',
  industry: 'b2b-services',
  currency: 'USD',
  stages: [
    stage('lead', 'Lead', 1, 5, 'open'),
    stage('discovery', 'Discovery Call', 2, 15, 'open'),
    stage('needs', 'Needs Analysis', 3, 30, 'open'),
    stage('proposal', 'Proposal', 4, 55, 'open'),
    stage('negotiation', 'Negotiation', 5, 75, 'open'),
    stage('won', 'Won', 6, 100, 'won'),
    stage('lost', 'Lost', 7, 0, 'lost'),
  ],
};

export const npoPipeline: Pipeline = {
  id: 'tpl-npo',
  name: 'Non-profit / Donor',
  description: 'Fundraising and donor cultivation pipeline.',
  industry: 'npo',
  currency: 'USD',
  stages: [
    stage('identified', 'Prospect Identified', 1, 5, 'open'),
    stage('cultivation', 'Cultivation', 2, 20, 'open'),
    stage('solicitation', 'Solicitation', 3, 50, 'open'),
    stage('pledged', 'Pledged', 4, 80, 'open'),
    stage('received', 'Gift Received', 5, 100, 'won'),
    stage('stewardship', 'Stewardship', 6, 100, 'nurture'),
    stage('declined', 'Declined', 7, 0, 'lost'),
  ],
};

export const educationPipeline: Pipeline = {
  id: 'tpl-education',
  name: 'Education / Admissions',
  description: 'Student admissions and enrolment pipeline.',
  industry: 'education',
  currency: 'USD',
  stages: [
    stage('inquiry', 'Inquiry', 1, 5, 'open', { slaHours: 24 }),
    stage('application', 'Application Started', 2, 20, 'open'),
    stage('submitted', 'Application Submitted', 3, 40, 'open'),
    stage('reviewed', 'Reviewed', 4, 55, 'open'),
    stage('accepted', 'Accepted', 5, 75, 'open'),
    stage('enrolled', 'Enrolled', 6, 100, 'won'),
    stage('declined', 'Declined / Withdrew', 7, 0, 'lost'),
  ],
};

export const pipelineTemplates: Pipeline[] = [
  saasPipeline,
  agencyPipeline,
  realEstatePipeline,
  fitnessPipeline,
  retailPipeline,
  b2bServicesPipeline,
  npoPipeline,
  educationPipeline,
];

export type PipelineTemplateKey =
  | 'saas'
  | 'agency'
  | 'real-estate'
  | 'fitness'
  | 'retail'
  | 'b2b-services'
  | 'npo'
  | 'education';

const templateMap: Record<PipelineTemplateKey, Pipeline> = {
  'saas': saasPipeline,
  'agency': agencyPipeline,
  'real-estate': realEstatePipeline,
  'fitness': fitnessPipeline,
  'retail': retailPipeline,
  'b2b-services': b2bServicesPipeline,
  'npo': npoPipeline,
  'education': educationPipeline,
};

export function getPipelineTemplate(key: PipelineTemplateKey): Pipeline {
  return templateMap[key];
}

export function listPipelineTemplates(): Pipeline[] {
  return pipelineTemplates.slice();
}
