/**
 * Row shape consumed by the petty-cash list client.
 */

export interface PettyCashRow {
  _id: string;
  branchId?: string;
  branchName?: string;
  custodianId?: string;
  custodianName?: string;
  openingBalance?: number;
  totalTopUps?: number;
  totalSpent?: number;
  balance?: number;
  topUpDueAt?: string | null;
  pendingIous?: number;
  lastReconciledAt?: string | null;
  lastToppedUpAt?: string | null;
  status?: string;
  createdAt?: string | null;
}
