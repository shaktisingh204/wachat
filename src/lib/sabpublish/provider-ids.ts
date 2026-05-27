/**
 * SabPublish — listing-provider identifiers + display labels.
 *
 * Lives in its own file (no `'server-only'`) so client components can
 * import the ids/labels for picker UIs without dragging in the full
 * adapter contract from `./providers.ts`.
 */

export type SabpublishProviderId =
  | 'gbp'
  | 'yelp'
  | 'bing'
  | 'apple'
  | 'facebook';

export const ALL_SABPUBLISH_PROVIDER_IDS: SabpublishProviderId[] = [
  'gbp',
  'yelp',
  'bing',
  'apple',
  'facebook',
];

export const SABPUBLISH_PROVIDER_LABELS: Record<SabpublishProviderId, string> = {
  gbp: 'Google Business Profile',
  yelp: 'Yelp',
  bing: 'Bing Places',
  apple: 'Apple Maps',
  facebook: 'Facebook Places',
};
