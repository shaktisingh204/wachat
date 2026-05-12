// Public types for the SabNode "Features" SEO site section.
// Each Feature drives a dedicated long-form page at /features/[slug].

export type FeatureCategory =
  | 'conversations'
  | 'automation'
  | 'customer-data'
  | 'growth'
  | 'analytics'
  | 'commerce'
  | 'developer';

export type FeatureIconKey =
  | 'inbox' | 'whatsapp' | 'instagram' | 'email' | 'webchat' | 'clock' | 'reply' | 'tag'
  | 'workflow' | 'bot' | 'brain' | 'zap' | 'gitBranch' | 'calendar'
  | 'users' | 'filter' | 'layers' | 'database' | 'shield'
  | 'send' | 'fileText' | 'trendingUp' | 'globe' | 'image'
  | 'lineChart' | 'activity' | 'star' | 'download' | 'target' | 'eye'
  | 'dollar' | 'badge' | 'hash' | 'sparkles';

export interface FeatureCapability {
  title: string;
  body: string;
}

export interface FeatureUseCase {
  title: string;
  industry?: string;
  body: string;
}

export interface FeatureStep {
  step: string;
  title: string;
  body: string;
}

export interface FeatureFAQ {
  q: string;
  a: string;
}

export interface FeatureMetric {
  value: string;
  label: string;
}

export interface Feature {
  slug: string;
  name: string;
  brand?: string;
  category: FeatureCategory;
  tagline: string;
  iconKey: FeatureIconKey;
  color: string;
  tint: string;

  /* SEO */
  seoTitle: string;
  seoDescription: string;
  keywords: string[];

  /* Hero */
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
    bullets: string[];
  };

  /* Long narrative */
  problem: { title: string; body: string };
  overview: string[]; // 3-4 paragraphs

  /* Body sections */
  capabilities: FeatureCapability[]; // 6-8
  useCases: FeatureUseCase[];        // 4-6
  howItWorks: FeatureStep[];         // 4-6
  integrations: string[];            // 6-10
  metrics?: FeatureMetric[];         // 3-4
  faqs: FeatureFAQ[];                // 6-8

  related: string[]; // slugs
}

export interface FeatureCategoryMeta {
  id: FeatureCategory;
  label: string;
  blurb: string;
  accent: string;
}

export const FEATURE_CATEGORIES: FeatureCategoryMeta[] = [
  { id: 'conversations', label: 'Conversations',  blurb: 'Every channel, one shared queue. Reply faster, together.',     accent: '#4F46E5' },
  { id: 'automation',    label: 'Automation',      blurb: 'Build flows, bots and AI without writing code.',                accent: '#7C3AED' },
  { id: 'customer-data', label: 'Customer Data',   blurb: 'Contacts, segments and pipelines that stay accurate forever.',  accent: '#8B5CF6' },
  { id: 'growth',        label: 'Growth',          blurb: 'Broadcasts, campaigns and templates that convert.',             accent: '#06B6D4' },
  { id: 'analytics',     label: 'Analytics',       blurb: 'Outcome dashboards stitched from every module.',                accent: '#F59E0B' },
  { id: 'commerce',      label: 'Commerce',        blurb: 'Sell, recover carts and reorder — all inside chat.',            accent: '#10B981' },
  { id: 'developer',     label: 'Developer',       blurb: 'APIs, webhooks, MCP and OAuth for builders.',                   accent: '#EC4899' },
];
