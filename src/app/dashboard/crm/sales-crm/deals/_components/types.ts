/**
 * Shared types for the canonical Deals module client islands.
 *
 * `DealListRow` is the wire-format the server-side `page.tsx` projects
 * its Mongo docs into before handing them off to the client tables /
 * kanban / calendar. Keeping it ID-stringified (no ObjectId on the wire)
 * keeps the client components serialization-safe.
 */

export interface DealListRow {
  _id: string;
  name: string;
  description?: string;
  /** Counter-party label resolved server-side (account name or contact name). */
  clientLabel?: string;
  /** Account ObjectId (string) when partyKind=client. */
  accountId?: string | null;
  /** First contact ObjectId (string) when partyKind=lead/contact. */
  contactId?: string | null;
  amount?: number;
  currency?: string;
  stage?: string;
  pipelineId?: string | null;
  ownerId?: string | null;
  probability?: number | null;
  expectedClose?: string | null;
  status?: string;
  priority?: string;
  leadSource?: string;
  campaign?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

export interface DealKpiSummary {
  openCount: number;
  openValue: number;
  wonThisMonth: number;
  lostThisMonth: number;
  avgCycleDays: number;
}
