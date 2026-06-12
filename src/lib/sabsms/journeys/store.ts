/**
 * SabSMS journeys — persistence layer.
 *
 * `JourneyStore` is the seam between the executor / trigger / event
 * orchestration logic and Mongo: the production implementation
 * (`createMongoJourneyStore`) binds to a raw `Db` (worker- AND
 * Next-safe — no `server-only`, no `@/` aliases), while tests use the
 * in-memory implementation under `__tests__/memory-store.ts`.
 *
 * Collections owned here (V2.9):
 *   - `sabsms_journeys`      — definitions + stats + A/B winners
 *   - `sabsms_journey_runs`  — per-contact state machine instances
 *
 * Read-only touches on existing SabSMS collections: templates (send
 * bodies), suppressions (enrolment gate), messages (campaign recipients,
 * click→phone resolution, delivered counts), short links (journey send
 * link tracking — mirrors `../links.ts` semantics with `links-core`).
 */

import { ObjectId, type Collection, type Db, type Document } from 'mongodb';

import {
  extractUrls,
  generateSlug,
  isAlreadyShortened,
  replaceUrls,
  resolveShortLinkBase,
  reuseFilterFor,
} from '../links-core';
import type { VariantStats } from './ab';
import {
  LIVE_RUN_STATUSES,
  SABSMS_JOURNEYS_COLLECTION,
  SABSMS_JOURNEY_RUNS_COLLECTION,
  type JourneyAbWinner,
  type JourneyEvent,
  type JourneyRunHistoryEntry,
  type JourneyStats,
  type SabsmsJourney,
  type SabsmsJourneyRun,
} from './types';

/** `processing` claims older than this are considered crashed and reclaimed. */
export const RUN_PROCESSING_STALE_MS = 5 * 60 * 1000;

// ─── Interface ────────────────────────────────────────────────────────────

export interface ContactRef {
  phone?: string;
  contactId?: string;
}

export interface JourneyStore {
  // Journeys
  getJourney(journeyId: string): Promise<SabsmsJourney | null>;
  listJourneys(filter: {
    workspaceId?: string;
    status?: SabsmsJourney['status'];
    triggerKind?: SabsmsJourney['trigger']['kind'];
  }): Promise<SabsmsJourney[]>;
  incJourneyStats(journeyId: string, inc: Partial<JourneyStats>): Promise<void>;
  /** Journeys whose A/B sweep is due (active + has un-promoted ab steps). */
  listJourneysDueAbCheck(now: Date, intervalMs: number): Promise<SabsmsJourney[]>;
  markAbCheck(journeyId: string, at: Date): Promise<void>;
  promoteWinner(journeyId: string, stepId: string, winner: JourneyAbWinner): Promise<void>;
  collectVariantStats(
    journeyId: string,
    stepId: string,
    variantTemplateIds: string[],
  ): Promise<VariantStats[]>;

  // Runs
  insertRun(run: Omit<SabsmsJourneyRun, '_id'>): Promise<string>;
  getRun(runId: string): Promise<SabsmsJourneyRun | null>;
  /** Atomically claim ONE due run (active, or waiting+due, or stale processing). */
  claimDueRun(now: Date): Promise<SabsmsJourneyRun | null>;
  updateRun(
    runId: string,
    set: Partial<Omit<SabsmsJourneyRun, '_id' | 'history'>>,
    opts?: { unset?: Array<'wakeAt' | 'waitingFor' | 'processingAt'>; pushHistory?: JourneyRunHistoryEntry },
  ): Promise<void>;
  setRunStepKey(runId: string, key: string): Promise<void>;
  findLiveRun(journeyId: string, phone: string): Promise<SabsmsJourneyRun | null>;
  findRunsForContact(
    workspaceId: string,
    ref: ContactRef,
    statuses?: SabsmsJourneyRun['status'][],
  ): Promise<SabsmsJourneyRun[]>;
  /** Waiting runs for the contact whose `waitingFor.event` matches. */
  findWaitingRuns(
    workspaceId: string,
    ref: ContactRef,
    event: JourneyEvent,
  ): Promise<SabsmsJourneyRun[]>;
  countLiveRuns(journeyId: string): Promise<number>;
  /** Live runs for a phone hash (engine unsubscribe events carry only the hash). */
  findLiveRunsByPhoneHash(workspaceId: string, phoneHash: string): Promise<SabsmsJourneyRun[]>;

  // Cross-collection reads
  isSuppressed(workspaceId: string, phoneHash: string): Promise<boolean>;
  getTemplateBody(workspaceId: string, templateId: string): Promise<string | null>;
  listCampaignRecipients(
    workspaceId: string,
    campaignId: string,
    cap: number,
  ): Promise<Array<{ phone: string; contactId?: string }>>;
  findMessagePhone(workspaceId: string, messageId: string): Promise<string | null>;

  // Short links for journey sends (click tracking)
  mintShortLinks(
    workspaceId: string,
    body: string,
    attribution: { contactId?: string },
  ): Promise<{ body: string; slugs: string[] }>;
  attachMessageIdToSlugs(workspaceId: string, slugs: string[], messageId: string): Promise<void>;
}

// ─── Indexes ──────────────────────────────────────────────────────────────

let journeyIndexesEnsured = false;

export async function ensureJourneyIndexes(db: Db): Promise<void> {
  if (journeyIndexesEnsured) return;
  const journeys = db.collection(SABSMS_JOURNEYS_COLLECTION);
  const runs = db.collection(SABSMS_JOURNEY_RUNS_COLLECTION);

  await journeys.createIndex({ workspaceId: 1, status: 1 });
  await journeys.createIndex({ workspaceId: 1, 'trigger.kind': 1, status: 1 });

  await runs.createIndex({ status: 1, wakeAt: 1 });
  await runs.createIndex({ workspaceId: 1, journeyId: 1 });
  await runs.createIndex({ contactPhone: 1, status: 1 });
  await runs.createIndex({ workspaceId: 1, contactPhoneHash: 1, status: 1 });
  journeyIndexesEnsured = true;
}

// ─── Mongo implementation ─────────────────────────────────────────────────

function oid(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

const MAX_SLUG_ATTEMPTS = 5;

export function createMongoJourneyStore(db: Db): JourneyStore {
  const journeys = db.collection<SabsmsJourney>(SABSMS_JOURNEYS_COLLECTION);
  const runs = db.collection<SabsmsJourneyRun>(SABSMS_JOURNEY_RUNS_COLLECTION);
  const suppressions = db.collection('sabsms_suppressions');
  const templates = db.collection('sabsms_templates');
  const messages = db.collection('sabsms_messages');
  const shortLinks: Collection<Document> = db.collection('sabsms_short_links');

  const contactFilter = (ref: ContactRef): Document => {
    const ors: Document[] = [];
    if (ref.phone) ors.push({ contactPhone: ref.phone });
    if (ref.contactId) ors.push({ contactId: ref.contactId });
    if (ors.length === 0) return { _id: { $exists: false } }; // match nothing
    return ors.length === 1 ? ors[0] : { $or: ors };
  };

  return {
    async getJourney(journeyId) {
      const id = oid(journeyId);
      if (!id) return null;
      return journeys.findOne({ _id: id } as Document);
    },

    async listJourneys(filter) {
      const query: Document = {};
      if (filter.workspaceId) query.workspaceId = filter.workspaceId;
      if (filter.status) query.status = filter.status;
      if (filter.triggerKind) query['trigger.kind'] = filter.triggerKind;
      return journeys.find(query).limit(500).toArray();
    },

    async incJourneyStats(journeyId, inc) {
      const id = oid(journeyId);
      if (!id) return;
      const incDoc: Document = {};
      for (const [k, v] of Object.entries(inc)) {
        if (typeof v === 'number' && v !== 0) incDoc[`stats.${k}`] = v;
      }
      if (Object.keys(incDoc).length === 0) return;
      await journeys.updateOne({ _id: id } as Document, { $inc: incDoc });
    },

    async listJourneysDueAbCheck(now, intervalMs) {
      const cutoff = new Date(now.getTime() - intervalMs);
      return journeys
        .find({
          status: 'active',
          'steps.abVariants.1': { $exists: true },
          $or: [{ 'ab.lastCheckAt': { $exists: false } }, { 'ab.lastCheckAt': { $lte: cutoff } }],
        } as Document)
        .limit(50)
        .toArray();
    },

    async markAbCheck(journeyId, at) {
      const id = oid(journeyId);
      if (!id) return;
      await journeys.updateOne({ _id: id } as Document, {
        $set: { 'ab.lastCheckAt': at },
      });
    },

    async promoteWinner(journeyId, stepId, winner) {
      const id = oid(journeyId);
      if (!id) return;
      await journeys.updateOne(
        { _id: id, 'steps.id': stepId } as Document,
        {
          $set: {
            'steps.$.templateId': winner.templateId,
            [`ab.winners.${stepId}`]: winner,
            updatedAt: new Date(),
          },
          $unset: { 'steps.$.abVariants': '' },
        },
      );
    },

    async collectVariantStats(journeyId, stepId, variantTemplateIds) {
      // Per-run attribution from history: the 'sent' entry for this step
      // records the variant; run-level repliedAt/clickedAt flags count
      // engagement once per run.
      const fromRuns = await runs
        .aggregate<{
          _id: string;
          sent: number;
          replied: number;
          clicked: number;
        }>([
          { $match: { journeyId, 'history.stepId': stepId } },
          {
            $project: {
              repliedAt: 1,
              clickedAt: 1,
              sendEntry: {
                $first: {
                  $filter: {
                    input: '$history',
                    as: 'h',
                    cond: {
                      $and: [
                        { $eq: ['$$h.stepId', stepId] },
                        { $eq: ['$$h.result', 'sent'] },
                      ],
                    },
                  },
                },
              },
            },
          },
          { $match: { 'sendEntry.variantTemplateId': { $type: 'string' } } },
          {
            $group: {
              _id: '$sendEntry.variantTemplateId',
              sent: { $sum: 1 },
              replied: { $sum: { $cond: [{ $gt: ['$repliedAt', null] }, 1, 0] } },
              clicked: { $sum: { $cond: [{ $gt: ['$clickedAt', null] }, 1, 0] } },
            },
          },
        ])
        .toArray();

      const byVariant = new Map(fromRuns.map((r) => [r._id, r]));

      const stats: VariantStats[] = [];
      for (const templateId of variantTemplateIds) {
        const r = byVariant.get(templateId);
        // Delivered comes from the message tag aggregation (engine-written
        // statuses) — tags are stamped by the executor on every journey send.
        const delivered = await messages.countDocuments({
          tags: { $all: [`journey:${journeyId}`, `journeyStep:${stepId}`, `journeyVariant:${templateId}`] },
          status: 'delivered',
        });
        stats.push({
          templateId,
          sent: r?.sent ?? 0,
          delivered,
          replied: r?.replied ?? 0,
          clicked: r?.clicked ?? 0,
        });
      }
      return stats;
    },

    async insertRun(run) {
      const res = await runs.insertOne(run as SabsmsJourneyRun);
      return String(res.insertedId);
    },

    async getRun(runId) {
      const id = oid(runId);
      if (!id) return null;
      return runs.findOne({ _id: id } as Document);
    },

    async claimDueRun(now) {
      const stale = new Date(now.getTime() - RUN_PROCESSING_STALE_MS);
      return runs.findOneAndUpdate(
        {
          $or: [
            { status: 'active' },
            { status: 'waiting', wakeAt: { $lte: now } },
            { status: 'processing', processingAt: { $lte: stale } },
          ],
        } as Document,
        { $set: { status: 'processing', processingAt: now, updatedAt: now } },
        { sort: { updatedAt: 1 }, returnDocument: 'after' },
      );
    },

    async updateRun(runId, set, opts) {
      const id = oid(runId);
      if (!id) return;
      const update: Document = { $set: { ...set, updatedAt: new Date() } };
      if (opts?.unset && opts.unset.length > 0) {
        update.$unset = Object.fromEntries(opts.unset.map((k) => [k, '']));
      }
      if (opts?.pushHistory) {
        update.$push = { history: opts.pushHistory };
      }
      await runs.updateOne({ _id: id } as Document, update);
    },

    async setRunStepKey(runId, key) {
      const id = oid(runId);
      if (!id) return;
      await runs.updateOne({ _id: id } as Document, {
        $set: { 'idempotency.lastExecutedStepKey': key, updatedAt: new Date() },
      });
    },

    async findLiveRun(journeyId, phone) {
      return runs.findOne({
        journeyId,
        contactPhone: phone,
        status: { $in: LIVE_RUN_STATUSES },
      } as Document);
    },

    async findRunsForContact(workspaceId, ref, statuses) {
      const query: Document = { workspaceId, ...contactFilter(ref) };
      if (statuses && statuses.length > 0) query.status = { $in: statuses };
      return runs.find(query).limit(200).toArray();
    },

    async findWaitingRuns(workspaceId, ref, event) {
      return runs
        .find({
          workspaceId,
          status: 'waiting',
          'waitingFor.event': event,
          ...contactFilter(ref),
        } as Document)
        .limit(200)
        .toArray();
    },

    async countLiveRuns(journeyId) {
      return runs.countDocuments({ journeyId, status: { $in: LIVE_RUN_STATUSES } } as Document);
    },

    async findLiveRunsByPhoneHash(workspaceId, phoneHash) {
      return runs
        .find({
          workspaceId,
          contactPhoneHash: phoneHash,
          status: { $in: LIVE_RUN_STATUSES },
        } as Document)
        .limit(200)
        .toArray();
    },

    async isSuppressed(workspaceId, phoneHash) {
      const doc = await suppressions.findOne(
        { workspaceId, phoneHash },
        { projection: { _id: 1 } },
      );
      return doc !== null;
    },

    async getTemplateBody(workspaceId, templateId) {
      const id = oid(templateId);
      if (!id) return null;
      const doc = await templates.findOne(
        { _id: id, workspaceId } as Document,
        { projection: { bodies: 1 } },
      );
      if (!doc) return null;
      const bodies = (doc as { bodies?: Array<{ locale: string; body: string }> }).bodies ?? [];
      return bodies.find((b) => b.locale === 'en')?.body ?? bodies[0]?.body ?? null;
    },

    async listCampaignRecipients(workspaceId, campaignId, cap) {
      const docs = await messages
        .find(
          { workspaceId, campaignId, direction: 'outbound' } as Document,
          { projection: { to: 1, contactId: 1 } },
        )
        .limit(cap * 2)
        .toArray();
      const seen = new Set<string>();
      const out: Array<{ phone: string; contactId?: string }> = [];
      for (const doc of docs) {
        const phone = (doc as { to?: string }).to;
        if (!phone || seen.has(phone)) continue;
        seen.add(phone);
        out.push({ phone, contactId: (doc as { contactId?: string }).contactId });
        if (out.length >= cap) break;
      }
      return out;
    },

    async findMessagePhone(workspaceId, messageId) {
      const id = oid(messageId);
      if (!id) return null;
      const doc = await messages.findOne(
        { _id: id, workspaceId } as Document,
        { projection: { to: 1 } },
      );
      return (doc as { to?: string } | null)?.to ?? null;
    },

    async mintShortLinks(workspaceId, body, attribution) {
      // Mirror of `../links.ts` shortenUrlsInBody, bound to this Db so the
      // worker never needs the server-only module. Branded workspace
      // domains are looked up like the Next-side path does.
      const settings = await db
        .collection('sabsms_settings')
        .findOne({ workspaceId }, { projection: { shortLinkDomain: 1 } });
      const base = resolveShortLinkBase({
        workspaceDomain: (settings as { shortLinkDomain?: string } | null)?.shortLinkDomain,
      });
      const knownBases = [base, resolveShortLinkBase()];
      const urls = extractUrls(body).filter((url) => !isAlreadyShortened(url, knownBases));
      if (urls.length === 0) return { body, slugs: [] };

      const replacements: Array<{ from: string; to: string }> = [];
      const slugs: string[] = [];
      for (const targetUrl of urls) {
        const reuse = await shortLinks.findOne(
          reuseFilterFor({ workspaceId, targetUrl, contactId: attribution.contactId }) as Document,
        );
        if (reuse) {
          const slug = (reuse as unknown as { slug: string }).slug;
          slugs.push(slug);
          replacements.push({ from: targetUrl, to: `${base}/${slug}` });
          continue;
        }
        let minted = false;
        for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS && !minted; attempt++) {
          const slug = generateSlug();
          try {
            await shortLinks.insertOne({
              workspaceId,
              slug,
              target: targetUrl,
              ...(attribution.contactId ? { contactId: attribution.contactId } : {}),
              clickCount: 0,
              createdAt: new Date(),
            });
            slugs.push(slug);
            replacements.push({ from: targetUrl, to: `${base}/${slug}` });
            minted = true;
          } catch (e) {
            if ((e as { code?: number })?.code === 11000) continue; // slug collision — re-roll
            throw e;
          }
        }
        if (!minted) {
          // Could not allocate a slug — leave the raw URL in place.
          continue;
        }
      }
      return { body: replaceUrls(body, replacements), slugs };
    },

    async attachMessageIdToSlugs(workspaceId, slugs, messageId) {
      if (slugs.length === 0 || !messageId) return;
      await shortLinks.updateMany(
        { workspaceId, slug: { $in: slugs }, messageId: { $exists: false } },
        { $set: { messageId } },
      );
    },
  };
}
