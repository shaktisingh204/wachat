/**
 * Outreach campaign manager. Tracks prospects, threads, and campaign-level
 * stats. Storage and email sending are pluggable.
 */
import type { LinkProspect, OutreachThread, OutreachMessage } from './types';

export interface OutreachStore {
  saveProspect(p: LinkProspect): Promise<void>;
  saveThread(t: OutreachThread): Promise<void>;
  listThreads(campaignId: string): Promise<OutreachThread[]>;
}
export interface OutreachSender {
  send(thread: OutreachThread, message: OutreachMessage): Promise<void>;
}

let store: OutreachStore | null = null;
let sender: OutreachSender | null = null;

export function setOutreachStore(s: OutreachStore | null): void {
  store = s;
}
export function setOutreachSender(s: OutreachSender | null): void {
  sender = s;
}

export type CreateCampaignInput = {
  campaignId: string;
  name: string;
  prospects: LinkProspect[];
};

export type Campaign = {
  campaignId: string;
  name: string;
  prospects: LinkProspect[];
  threads: OutreachThread[];
  createdAt: string;
};

const campaigns = new Map<string, Campaign>();

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  const c: Campaign = {
    campaignId: input.campaignId,
    name: input.name,
    prospects: input.prospects,
    threads: [],
    createdAt: new Date().toISOString(),
  };
  campaigns.set(c.campaignId, c);
  if (store) {
    for (const p of input.prospects) await store.saveProspect(p);
  }
  return c;
}

export function getCampaign(campaignId: string): Campaign | undefined {
  return campaigns.get(campaignId);
}

export type StartThreadInput = {
  campaignId: string;
  prospect: LinkProspect;
  subject: string;
  body: string;
};

export async function startThread(input: StartThreadInput): Promise<OutreachThread> {
  const camp = campaigns.get(input.campaignId);
  if (!camp) throw new Error(`Campaign ${input.campaignId} not found`);
  const now = new Date().toISOString();
  const message: OutreachMessage = { from: 'us', body: input.body, sentAt: now };
  const thread: OutreachThread = {
    prospect: { ...input.prospect, status: 'contacted' },
    subject: input.subject,
    messages: [message],
    lastActivity: now,
    status: 'contacted',
  };
  camp.threads.push(thread);
  if (sender) await sender.send(thread, message);
  if (store) await store.saveThread(thread);
  return thread;
}

export async function recordReply(thread: OutreachThread, body: string): Promise<OutreachThread> {
  const now = new Date().toISOString();
  thread.messages.push({ from: 'them', body, sentAt: now });
  thread.lastActivity = now;
  thread.status = 'replied';
  thread.prospect.status = 'replied';
  if (store) await store.saveThread(thread);
  return thread;
}

export async function markWon(thread: OutreachThread): Promise<OutreachThread> {
  thread.status = 'won';
  thread.prospect.status = 'won';
  thread.lastActivity = new Date().toISOString();
  if (store) await store.saveThread(thread);
  return thread;
}

export async function markLost(thread: OutreachThread): Promise<OutreachThread> {
  thread.status = 'lost';
  thread.prospect.status = 'lost';
  thread.lastActivity = new Date().toISOString();
  if (store) await store.saveThread(thread);
  return thread;
}

export type CampaignStats = {
  prospects: number;
  contacted: number;
  replied: number;
  won: number;
  lost: number;
  responseRate: number;
  winRate: number;
};

export function summarizeCampaign(camp: Campaign): CampaignStats {
  const contacted = camp.threads.length;
  const replied = camp.threads.filter((t) => t.status === 'replied' || t.status === 'won' || t.status === 'lost').length;
  const won = camp.threads.filter((t) => t.status === 'won').length;
  const lost = camp.threads.filter((t) => t.status === 'lost').length;
  return {
    prospects: camp.prospects.length,
    contacted,
    replied,
    won,
    lost,
    responseRate: contacted > 0 ? replied / contacted : 0,
    winRate: contacted > 0 ? won / contacted : 0,
  };
}

/** Rank prospects by `relevanceScore`, optionally weighted by DA. */
export function prioritizeProspects(prospects: LinkProspect[]): LinkProspect[] {
  return [...prospects].sort((a, b) => {
    const aScore = a.relevanceScore * 0.7 + ((a.domainAuthority ?? 0) / 100) * 0.3;
    const bScore = b.relevanceScore * 0.7 + ((b.domainAuthority ?? 0) / 100) * 0.3;
    return bScore - aScore;
  });
}

/** Reset module state — useful in tests. */
export function __resetForTests(): void {
  campaigns.clear();
  store = null;
  sender = null;
}
