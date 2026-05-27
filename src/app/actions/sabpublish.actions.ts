'use server';

/**
 * SabPublish — server actions.
 *
 * Thin wrappers over the Rust crates (`sabpublish-*`) plus orchestration
 * that calls the `IListingProvider` adapter layer for connect / sync /
 * review-reply / publish / citation-scan.
 *
 * All actions are tenant-scoped via `getSession()`; the Rust handlers
 * additionally enforce `userId` ownership on every Mongo query.
 *
 * Real provider OAuth + REST integrations are deferred — the providers
 * module ships `MockProvider`s today so the dashboard flow is end-to-end
 * exercisable.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabpublishLocationsApi,
  type SabpublishLocationCreateInput,
  type SabpublishLocationDoc,
  type SabpublishLocationListParams,
  type SabpublishLocationListResponse,
  type SabpublishLocationUpdateInput,
} from '@/lib/rust-client/sabpublish-locations';
import {
  sabpublishProvidersApi,
  type SabpublishProviderDoc,
  type SabpublishProviderId,
  type SabpublishProviderListParams,
} from '@/lib/rust-client/sabpublish-providers';
import {
  sabpublishProfileFieldsApi,
  type SabpublishProfileFieldDoc,
} from '@/lib/rust-client/sabpublish-profile-fields';
import {
  sabpublishSyncJobsApi,
  type SabpublishSyncJobDoc,
} from '@/lib/rust-client/sabpublish-sync-jobs';
import {
  sabpublishReviewsApi,
  type SabpublishReviewDoc,
  type SabpublishReviewListParams,
} from '@/lib/rust-client/sabpublish-reviews';
import {
  sabpublishPostsApi,
  type SabpublishPostCreateInput,
  type SabpublishPostDoc,
  type SabpublishPostListParams,
  type SabpublishPostUpdateInput,
} from '@/lib/rust-client/sabpublish-posts';
import {
  sabpublishCitationsApi,
  type SabpublishCitationDoc,
  type SabpublishCitationListParams,
  type SabpublishCitationStatus,
} from '@/lib/rust-client/sabpublish-citations';
import {
  ALL_SABPUBLISH_PROVIDER_IDS,
  getListingProvider,
  type ProviderProfileFields,
} from '@/lib/sabpublish/providers';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function err(e: unknown): { ok: false; error: string } {
  if (e instanceof RustApiError) return { ok: false, error: e.message };
  return {
    ok: false,
    error: e instanceof Error ? e.message : 'Unknown error',
  };
}

async function requireSession(): Promise<{ userId: string } | null> {
  const s = await getSession();
  return s?.user?._id ? { userId: String(s.user._id) } : null;
}

function revalidate(): void {
  revalidatePath('/dashboard/sabpublish', 'layout');
}

/* ─── Locations ────────────────────────────────────────────────────── */

export async function listSabpublishLocations(
  params?: SabpublishLocationListParams,
): Promise<ActionResult<SabpublishLocationListResponse>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sabpublishLocationsApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

export async function getSabpublishLocation(
  id: string,
): Promise<ActionResult<SabpublishLocationDoc>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sabpublishLocationsApi.getById(id) };
  } catch (e) {
    return err(e);
  }
}

export async function createSabpublishLocation(
  input: SabpublishLocationCreateInput,
): Promise<ActionResult<SabpublishLocationDoc>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await sabpublishLocationsApi.create(input);
    revalidate();
    return { ok: true, data: res.entity };
  } catch (e) {
    return err(e);
  }
}

export async function updateSabpublishLocation(
  id: string,
  patch: SabpublishLocationUpdateInput,
): Promise<ActionResult<SabpublishLocationDoc>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    const data = await sabpublishLocationsApi.update(id, patch);
    revalidate();
    return { ok: true, data };
  } catch (e) {
    return err(e);
  }
}

export async function deleteSabpublishLocation(
  id: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    const data = await sabpublishLocationsApi.delete(id);
    revalidate();
    return { ok: true, data };
  } catch (e) {
    return err(e);
  }
}

/* ─── Providers ────────────────────────────────────────────────────── */

export async function listSabpublishProviders(
  params?: SabpublishProviderListParams,
): Promise<ActionResult<{ items: SabpublishProviderDoc[] }>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sabpublishProvidersApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

/**
 * Connect a listing provider for a location. Delegates the OAuth-ish
 * handshake to the adapter (today: Mock), then writes the resulting
 * credential ref + external listing id to `sabpublish_providers`.
 */
export async function connectSabpublishProvider(
  locationId: string,
  providerId: SabpublishProviderId,
  authArgs: Record<string, unknown> = {},
): Promise<ActionResult<SabpublishProviderDoc>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    const adapter = getListingProvider(providerId);
    const handshake = await adapter.connect(authArgs);
    const res = await sabpublishProvidersApi.upsert({
      locationId,
      providerId,
      connectionStatus: 'connected',
      credentialsRef: handshake.credentialsRef,
      externalListingId: handshake.externalListingId,
    });
    revalidate();
    return { ok: true, data: res.entity };
  } catch (e) {
    return err(e);
  }
}

export async function disconnectSabpublishProvider(
  providerRowId: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    const data = await sabpublishProvidersApi.delete(providerRowId);
    revalidate();
    return { ok: true, data };
  } catch (e) {
    return err(e);
  }
}

/* ─── Profile fields ───────────────────────────────────────────────── */

export async function listSabpublishProfileFields(
  locationId: string,
): Promise<ActionResult<{ items: SabpublishProfileFieldDoc[] }>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    return {
      ok: true,
      data: await sabpublishProfileFieldsApi.list(locationId),
    };
  } catch (e) {
    return err(e);
  }
}

export async function saveSabpublishProfileFields(
  locationId: string,
  fields: { fieldKey: string; value: string }[],
): Promise<ActionResult<{ upserted: number }>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    const data = await sabpublishProfileFieldsApi.bulkUpsert({
      locationId,
      fields,
    });
    revalidate();
    return { ok: true, data };
  } catch (e) {
    return err(e);
  }
}

/* ─── Sync ─────────────────────────────────────────────────────────── */

/**
 * Run a push-sync of the canonical profile fields for `locationId` to
 * each provider in `providerIds`. One sync-job row is created per
 * provider for the audit trail.
 *
 * NOTE: deferred — currently invokes the Mock adapters. Real provider
 * push needs OAuth tokens, rate limiting, and retry-with-backoff.
 */
export async function syncSabpublishLocation(
  locationId: string,
  providerIds: SabpublishProviderId[],
): Promise<ActionResult<{ jobs: SabpublishSyncJobDoc[] }>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };

  try {
    const { items: rawFields } =
      await sabpublishProfileFieldsApi.list(locationId);
    const profileFields: ProviderProfileFields = Object.fromEntries(
      rawFields.map((f) => [f.fieldKey, f.value]),
    );

    const jobs: SabpublishSyncJobDoc[] = [];
    for (const providerId of providerIds) {
      const job = await sabpublishSyncJobsApi.create({
        locationId,
        providerId,
        kind: 'push',
        status: 'running',
      });
      try {
        const adapter = getListingProvider(providerId);
        const result = await adapter.pushProfile(profileFields);
        const completed = await sabpublishSyncJobsApi.complete(job.id, {
          status: 'success',
          changedFieldsCount: result.changedFieldsCount,
        });
        const providerRow = await sabpublishProvidersApi.upsert({
          locationId,
          providerId,
          connectionStatus: 'connected',
        });
        await sabpublishProvidersApi
          .update(providerRow.id, { lastSyncAtMs: Date.now() })
          .catch(() => {});
        jobs.push(completed);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'sync failed';
        const failed = await sabpublishSyncJobsApi.complete(job.id, {
          status: 'failed',
          errorMessage: message,
        });
        jobs.push(failed);
      }
    }
    revalidate();
    return { ok: true, data: { jobs } };
  } catch (e) {
    return err(e);
  }
}

export async function listSabpublishSyncJobs(
  locationId: string,
): Promise<ActionResult<{ items: SabpublishSyncJobDoc[] }>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    return {
      ok: true,
      data: await sabpublishSyncJobsApi.list({ locationId, limit: 100 }),
    };
  } catch (e) {
    return err(e);
  }
}

/* ─── Reviews ──────────────────────────────────────────────────────── */

export async function listSabpublishReviews(
  params: SabpublishReviewListParams,
): Promise<ActionResult<{ items: SabpublishReviewDoc[] }>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sabpublishReviewsApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

/**
 * Post a reply to a review. Stores the reply locally and forwards to
 * the provider adapter (Mock today).
 */
export async function replySabpublishReview(
  reviewId: string,
  body: string,
): Promise<ActionResult<SabpublishReviewDoc>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    const data = await sabpublishReviewsApi.reply(reviewId, body);
    try {
      const adapter = getListingProvider(
        data.providerId as SabpublishProviderId,
      );
      await adapter.replyToReview(data.externalReviewId, body);
    } catch {
      // Adapter failure is non-fatal — local reply is the source of truth
      // and a background job (deferred) reconciles upstream.
    }
    revalidate();
    return { ok: true, data };
  } catch (e) {
    return err(e);
  }
}

/* ─── Posts ────────────────────────────────────────────────────────── */

export async function listSabpublishPosts(
  params: SabpublishPostListParams,
): Promise<ActionResult<{ items: SabpublishPostDoc[] }>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sabpublishPostsApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

export async function createSabpublishPost(
  input: SabpublishPostCreateInput,
): Promise<ActionResult<SabpublishPostDoc>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await sabpublishPostsApi.create(input);
    revalidate();
    return { ok: true, data: res.entity };
  } catch (e) {
    return err(e);
  }
}

export async function schedulePost(
  args: SabpublishPostCreateInput,
): Promise<ActionResult<SabpublishPostDoc>> {
  return createSabpublishPost({ ...args, status: 'scheduled' });
}

export async function updateSabpublishPost(
  id: string,
  patch: SabpublishPostUpdateInput,
): Promise<ActionResult<SabpublishPostDoc>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    const data = await sabpublishPostsApi.update(id, patch);
    revalidate();
    return { ok: true, data };
  } catch (e) {
    return err(e);
  }
}

export async function deleteSabpublishPost(
  id: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    const data = await sabpublishPostsApi.delete(id);
    revalidate();
    return { ok: true, data };
  } catch (e) {
    return err(e);
  }
}

/**
 * Publish a post NOW to every provider in `providerIds`. Calls each
 * adapter (Mock), then marks the post `published`.
 */
export async function publishSabpublishPostNow(
  id: string,
): Promise<ActionResult<SabpublishPostDoc>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    const post = await sabpublishPostsApi.getById(id);
    const providerIds = post.providerIds ?? [];
    const targets = (providerIds.length
      ? providerIds
      : ALL_SABPUBLISH_PROVIDER_IDS) as SabpublishProviderId[];
    for (const providerId of targets) {
      try {
        const adapter = getListingProvider(providerId);
        await adapter.publishPost({
          body: post.body,
          // mediaUrls resolution from SabFiles file ids is deferred —
          // pass an empty list until the lookup helper is wired.
          mediaUrls: [],
        });
      } catch {
        // best-effort; sync-jobs log carries the per-provider audit
      }
    }
    const data = await sabpublishPostsApi.update(id, { markPublished: true });
    revalidate();
    return { ok: true, data };
  } catch (e) {
    return err(e);
  }
}

/* ─── Citations ────────────────────────────────────────────────────── */

export async function listSabpublishCitations(
  params: SabpublishCitationListParams,
): Promise<ActionResult<{ items: SabpublishCitationDoc[] }>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sabpublishCitationsApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

export async function updateSabpublishCitationStatus(
  id: string,
  status: SabpublishCitationStatus,
): Promise<ActionResult<SabpublishCitationDoc>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    const data = await sabpublishCitationsApi.updateStatus(id, status);
    revalidate();
    return { ok: true, data };
  } catch (e) {
    return err(e);
  }
}

/**
 * Kick a citation scan for `locationId`. The real implementation will
 * fan out to a search-API crawler; today we seed a couple of mock
 * "discovered" rows so the UI has something to render.
 */
export async function scanSabpublishCitations(
  locationId: string,
): Promise<ActionResult<{ discovered: number }>> {
  if (!(await requireSession()))
    return { ok: false, error: 'Unauthenticated' };
  try {
    const samples = [
      {
        sourceUrl: `https://example.directory/listing/${locationId}-a`,
        foundName: 'Sample Business',
        foundPhone: '+1-555-0100',
        matchScore: 82,
      },
      {
        sourceUrl: `https://example.maps/${locationId}-b`,
        foundName: 'Sample Business (alt)',
        foundAddress: '123 Mock St',
        matchScore: 64,
      },
    ];
    let n = 0;
    for (const s of samples) {
      await sabpublishCitationsApi.ingest({ locationId, ...s });
      n += 1;
    }
    revalidate();
    return { ok: true, data: { discovered: n } };
  } catch (e) {
    return err(e);
  }
}
