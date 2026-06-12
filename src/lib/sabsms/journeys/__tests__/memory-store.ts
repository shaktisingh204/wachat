/**
 * In-memory `JourneyStore` for the V2.9 unit tests — mirrors the Mongo
 * implementation's semantics (claim ordering, stale reclaim, history
 * pushes) without a database. Also exposes test-only knobs: suppression
 * lists, template bodies, campaign recipients, message phones, and a
 * record of minted short links.
 */

import { ObjectId } from 'mongodb';

import type { VariantStats } from '../ab';
import { RUN_PROCESSING_STALE_MS, type ContactRef, type JourneyStore } from '../store';
import {
  LIVE_RUN_STATUSES,
  type JourneyAbWinner,
  type JourneyEvent,
  type JourneyRunHistoryEntry,
  type JourneyStats,
  type SabsmsJourney,
  type SabsmsJourneyRun,
} from '../types';

export interface MemoryJourneyStore extends JourneyStore {
  journeys: Map<string, SabsmsJourney>;
  runs: Map<string, SabsmsJourneyRun>;
  suppressedHashes: Set<string>;
  templates: Map<string, string>;
  campaignRecipients: Map<string, Array<{ phone: string; contactId?: string }>>;
  messagePhones: Map<string, string>;
  /** Variant stats served to `collectVariantStats` (keyed `journeyId:stepId`). */
  variantStats: Map<string, VariantStats[]>;
  mintedLinks: Array<{ workspaceId: string; body: string; contactId?: string }>;
  attachedMessageIds: Array<{ slugs: string[]; messageId: string }>;
  addJourney(journey: Omit<SabsmsJourney, '_id'> & { _id?: ObjectId }): string;
}

export function createMemoryJourneyStore(): MemoryJourneyStore {
  const journeys = new Map<string, SabsmsJourney>();
  const runs = new Map<string, SabsmsJourneyRun>();
  const suppressedHashes = new Set<string>();
  const templates = new Map<string, string>();
  const campaignRecipients = new Map<string, Array<{ phone: string; contactId?: string }>>();
  const messagePhones = new Map<string, string>();
  const variantStats = new Map<string, VariantStats[]>();
  const mintedLinks: MemoryJourneyStore['mintedLinks'] = [];
  const attachedMessageIds: MemoryJourneyStore['attachedMessageIds'] = [];

  const matchesContact = (run: SabsmsJourneyRun, ref: ContactRef): boolean => {
    if (!ref.phone && !ref.contactId) return false;
    if (ref.phone && run.contactPhone === ref.phone) return true;
    if (ref.contactId && run.contactId === ref.contactId) return true;
    return false;
  };

  const store: MemoryJourneyStore = {
    journeys,
    runs,
    suppressedHashes,
    templates,
    campaignRecipients,
    messagePhones,
    variantStats,
    mintedLinks,
    attachedMessageIds,

    addJourney(journey) {
      const _id = journey._id ?? new ObjectId();
      const id = String(_id);
      journeys.set(id, { ...journey, _id } as SabsmsJourney);
      return id;
    },

    async getJourney(journeyId) {
      return journeys.get(journeyId) ?? null;
    },

    async listJourneys(filter) {
      return [...journeys.values()].filter((j) => {
        if (filter.workspaceId && j.workspaceId !== filter.workspaceId) return false;
        if (filter.status && j.status !== filter.status) return false;
        if (filter.triggerKind && j.trigger.kind !== filter.triggerKind) return false;
        return true;
      });
    },

    async incJourneyStats(journeyId, inc) {
      const j = journeys.get(journeyId);
      if (!j) return;
      for (const [k, v] of Object.entries(inc)) {
        if (typeof v !== 'number') continue;
        const key = k as keyof JourneyStats;
        j.stats[key] = (j.stats[key] ?? 0) + v;
      }
    },

    async listJourneysDueAbCheck(now, intervalMs) {
      const cutoff = now.getTime() - intervalMs;
      return [...journeys.values()].filter((j) => {
        if (j.status !== 'active') return false;
        const hasAb = j.steps.some(
          (s) => s.kind === 'send' && (s.abVariants?.length ?? 0) >= 2,
        );
        if (!hasAb) return false;
        const last = j.ab?.lastCheckAt?.getTime();
        return last === undefined || last <= cutoff;
      });
    },

    async markAbCheck(journeyId, at) {
      const j = journeys.get(journeyId);
      if (!j) return;
      j.ab = { ...(j.ab ?? {}), lastCheckAt: at };
    },

    async promoteWinner(journeyId, stepId, winner: JourneyAbWinner) {
      const j = journeys.get(journeyId);
      if (!j) return;
      const step = j.steps.find((s) => s.id === stepId);
      if (step && step.kind === 'send') {
        step.templateId = winner.templateId;
        delete step.abVariants;
      }
      j.ab = {
        ...(j.ab ?? {}),
        winners: { ...(j.ab?.winners ?? {}), [stepId]: winner },
      };
    },

    async collectVariantStats(journeyId, stepId, variantTemplateIds) {
      const preset = variantStats.get(`${journeyId}:${stepId}`);
      if (preset) return preset;
      // Derive from run history like the Mongo aggregation does.
      const byVariant = new Map<string, VariantStats>();
      for (const id of variantTemplateIds) {
        byVariant.set(id, { templateId: id, sent: 0, delivered: 0, replied: 0, clicked: 0 });
      }
      for (const run of runs.values()) {
        if (run.journeyId !== journeyId) continue;
        const sendEntry = run.history.find(
          (h) => h.stepId === stepId && h.result === 'sent' && h.variantTemplateId,
        );
        if (!sendEntry?.variantTemplateId) continue;
        const stats = byVariant.get(sendEntry.variantTemplateId);
        if (!stats) continue;
        stats.sent += 1;
        if (run.repliedAt) stats.replied += 1;
        if (run.clickedAt) stats.clicked += 1;
      }
      return [...byVariant.values()];
    },

    async insertRun(run) {
      const _id = new ObjectId();
      const id = String(_id);
      runs.set(id, { ...run, _id } as SabsmsJourneyRun);
      return id;
    },

    async getRun(runId) {
      return runs.get(runId) ?? null;
    },

    async claimDueRun(now) {
      const stale = now.getTime() - RUN_PROCESSING_STALE_MS;
      const due = [...runs.values()]
        .filter((r) => {
          if (r.status === 'active') return true;
          if (r.status === 'waiting') return !!r.wakeAt && r.wakeAt.getTime() <= now.getTime();
          if (r.status === 'processing') {
            return !!r.processingAt && r.processingAt.getTime() <= stale;
          }
          return false;
        })
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
      const run = due[0];
      if (!run) return null;
      run.status = 'processing';
      run.processingAt = now;
      run.updatedAt = now;
      return { ...run, history: [...run.history] };
    },

    async updateRun(runId, set, opts) {
      const run = runs.get(runId);
      if (!run) return;
      Object.assign(run, set, { updatedAt: new Date() });
      for (const key of opts?.unset ?? []) {
        delete (run as Record<string, unknown>)[key];
      }
      if (opts?.pushHistory) {
        run.history.push(opts.pushHistory as JourneyRunHistoryEntry);
      }
    },

    async setRunStepKey(runId, key) {
      const run = runs.get(runId);
      if (!run) return;
      run.idempotency = { lastExecutedStepKey: key };
      run.updatedAt = new Date();
    },

    async findLiveRun(journeyId, phone) {
      for (const run of runs.values()) {
        if (
          run.journeyId === journeyId &&
          run.contactPhone === phone &&
          LIVE_RUN_STATUSES.includes(run.status)
        ) {
          return run;
        }
      }
      return null;
    },

    async findRunsForContact(workspaceId, ref, statuses) {
      return [...runs.values()].filter((r) => {
        if (r.workspaceId !== workspaceId) return false;
        if (statuses && !statuses.includes(r.status)) return false;
        return matchesContact(r, ref);
      });
    },

    async findWaitingRuns(workspaceId, ref, event: JourneyEvent) {
      return [...runs.values()].filter(
        (r) =>
          r.workspaceId === workspaceId &&
          r.status === 'waiting' &&
          r.waitingFor?.event === event &&
          matchesContact(r, ref),
      );
    },

    async countLiveRuns(journeyId) {
      return [...runs.values()].filter(
        (r) => r.journeyId === journeyId && LIVE_RUN_STATUSES.includes(r.status),
      ).length;
    },

    async findLiveRunsByPhoneHash(workspaceId, phoneHash) {
      return [...runs.values()].filter(
        (r) =>
          r.workspaceId === workspaceId &&
          r.contactPhoneHash === phoneHash &&
          LIVE_RUN_STATUSES.includes(r.status),
      );
    },

    async isSuppressed(_workspaceId, phoneHash) {
      return suppressedHashes.has(phoneHash);
    },

    async getTemplateBody(_workspaceId, templateId) {
      return templates.get(templateId) ?? null;
    },

    async listCampaignRecipients(_workspaceId, campaignId, cap) {
      return (campaignRecipients.get(campaignId) ?? []).slice(0, cap);
    },

    async findMessagePhone(_workspaceId, messageId) {
      return messagePhones.get(messageId) ?? null;
    },

    async mintShortLinks(workspaceId, body, attribution) {
      mintedLinks.push({ workspaceId, body, contactId: attribution.contactId });
      return { body, slugs: [] };
    },

    async attachMessageIdToSlugs(_workspaceId, slugs, messageId) {
      attachedMessageIds.push({ slugs, messageId });
    },
  };

  return store;
}
