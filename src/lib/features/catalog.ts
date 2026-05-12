import type { Feature, FeatureCategory } from './types';
import { conversationsFeatures }      from './data/conversations';
import { automationFeatures }          from './data/automation';
import { growthAnalyticsFeatures }     from './data/growth-analytics';
import { commerceDeveloperFeatures }   from './data/commerce-developer';

export const FEATURES: Feature[] = [
  ...conversationsFeatures,
  ...automationFeatures,
  ...growthAnalyticsFeatures,
  ...commerceDeveloperFeatures,
];

const FEATURE_BY_SLUG = new Map<string, Feature>(FEATURES.map(f => [f.slug, f]));

export function getFeature(slug: string): Feature | undefined {
  return FEATURE_BY_SLUG.get(slug);
}

export function getRelatedFeatures(feature: Feature): Feature[] {
  return feature.related
    .map(slug => FEATURE_BY_SLUG.get(slug))
    .filter((f): f is Feature => Boolean(f) && f!.slug !== feature.slug)
    .slice(0, 4);
}

export const FEATURES_BY_CATEGORY: Record<FeatureCategory, Feature[]> = FEATURES.reduce(
  (acc, f) => {
    (acc[f.category] ||= []).push(f);
    return acc;
  },
  {
    conversations: [],
    automation: [],
    'customer-data': [],
    growth: [],
    analytics: [],
    commerce: [],
    developer: [],
  } as Record<FeatureCategory, Feature[]>,
);
