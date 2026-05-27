import 'server-only';

import {
  ALL_SABPUBLISH_PROVIDER_IDS,
  SABPUBLISH_PROVIDER_LABELS,
  type SabpublishProviderId,
} from './provider-ids';

export {
  ALL_SABPUBLISH_PROVIDER_IDS,
  SABPUBLISH_PROVIDER_LABELS,
  type SabpublishProviderId,
};

/**
 * SabPublish — provider adapter contract.
 *
 * Each upstream listing service (Google Business Profile, Yelp, Bing
 * Places, Apple Maps, Facebook Places) implements `IListingProvider`.
 * Real OAuth + REST integrations are deferred; for now we ship a
 * `MockProvider` for each so the dashboard, sync-job logging, and
 * review/post flows have a working end-to-end path.
 *
 * Profile fields are passed as a flat key/value bag (`fieldKey` →
 * stringified value) so adapters don't need to share a giant DTO.
 */

export interface ProviderProfileFields {
  /** Flat key/value bag; values are stringified by the caller. */
  [fieldKey: string]: string;
}

export interface ProviderReview {
  externalReviewId: string;
  reviewerName?: string;
  rating: number;
  body?: string;
  postedAtMs: number;
}

export interface PublishPostArgs {
  body: string;
  /**
   * Caller resolves SabFile ids to public download URLs before invoking.
   * Adapters that need to re-upload should fetch + push.
   */
  mediaUrls?: string[];
  scheduleAtMs?: number;
}

export interface ProviderConnectResult {
  /** Encrypted token reference written to `sabpublish_providers.credentialsRef`. */
  credentialsRef: string;
  externalListingId?: string;
}

export interface ProviderSyncResult {
  changedFieldsCount: number;
  /** Optional human-readable line for the sync-job log. */
  message?: string;
}

export interface PublishPostResult {
  externalPostIds: Partial<Record<SabpublishProviderId, string>>;
}

export interface IListingProvider {
  readonly id: SabpublishProviderId;
  /**
   * Establish a connection. `authArgs` is provider-specific (OAuth
   * authorization code, API key, etc.) — left intentionally loose.
   */
  connect(authArgs: Record<string, unknown>): Promise<ProviderConnectResult>;
  pushProfile(profileFields: ProviderProfileFields): Promise<ProviderSyncResult>;
  pullProfile(): Promise<ProviderProfileFields>;
  listReviews(): Promise<ProviderReview[]>;
  replyToReview(externalReviewId: string, body: string): Promise<void>;
  publishPost(args: PublishPostArgs): Promise<PublishPostResult>;
}

/* ───────────────── Mock implementations ─────────────────
 *
 * Each Mock returns plausible static data with a small artificial
 * latency. Useful for wiring the dashboard before the real adapters
 * exist. Real provider clients should live next to this file as
 * `gbp.ts`, `yelp.ts`, etc. once OAuth lands.
 */

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class MockProvider implements IListingProvider {
  public readonly id: SabpublishProviderId;
  constructor(id: SabpublishProviderId) {
    this.id = id;
  }

  async connect(): Promise<ProviderConnectResult> {
    await delay();
    return {
      credentialsRef: `mock-${this.id}-cred-${Date.now()}`,
      externalListingId: `mock-${this.id}-listing-${Math.floor(Math.random() * 1e6)}`,
    };
  }

  async pushProfile(
    profileFields: ProviderProfileFields,
  ): Promise<ProviderSyncResult> {
    await delay();
    return {
      changedFieldsCount: Object.keys(profileFields).length,
      message: `Mock ${this.id}: accepted ${Object.keys(profileFields).length} fields`,
    };
  }

  async pullProfile(): Promise<ProviderProfileFields> {
    await delay();
    return {
      name: `Mock ${this.id} business`,
      phone: '+1-555-0100',
    };
  }

  async listReviews(): Promise<ProviderReview[]> {
    await delay();
    const base = Date.now();
    return [
      {
        externalReviewId: `${this.id}-r-1`,
        reviewerName: 'Jane Doe',
        rating: 5,
        body: `Loved this place (via ${this.id} mock).`,
        postedAtMs: base - 86_400_000,
      },
      {
        externalReviewId: `${this.id}-r-2`,
        reviewerName: 'John Smith',
        rating: 4,
        body: `Good service (via ${this.id} mock).`,
        postedAtMs: base - 2 * 86_400_000,
      },
    ];
  }

  async replyToReview(_externalReviewId: string, _body: string): Promise<void> {
    await delay();
  }

  async publishPost(_args: PublishPostArgs): Promise<PublishPostResult> {
    await delay();
    return {
      externalPostIds: {
        [this.id]: `mock-${this.id}-post-${Date.now()}`,
      } as PublishPostResult['externalPostIds'],
    };
  }
}

export class MockGbpProvider extends MockProvider {
  constructor() {
    super('gbp');
  }
}
export class MockYelpProvider extends MockProvider {
  constructor() {
    super('yelp');
  }
}
export class MockBingProvider extends MockProvider {
  constructor() {
    super('bing');
  }
}
export class MockAppleProvider extends MockProvider {
  constructor() {
    super('apple');
  }
}
export class MockFacebookProvider extends MockProvider {
  constructor() {
    super('facebook');
  }
}

/** Provider registry. Replace mocks one-by-one as real adapters ship. */
export function getListingProvider(id: SabpublishProviderId): IListingProvider {
  switch (id) {
    case 'gbp':
      return new MockGbpProvider();
    case 'yelp':
      return new MockYelpProvider();
    case 'bing':
      return new MockBingProvider();
    case 'apple':
      return new MockAppleProvider();
    case 'facebook':
      return new MockFacebookProvider();
  }
}

// (ALL_SABPUBLISH_PROVIDER_IDS + SABPUBLISH_PROVIDER_LABELS are re-exported
// from './provider-ids' at the top of this file so client code can also
// import them without picking up `server-only`.)
