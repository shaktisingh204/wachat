"use server";

/**
 * Server actions bridging the SabSheet grid (client) to the authoritative op endpoint
 * (`/v1/sabsheet/ops`). These are the only entry the client uses for persistence — the rust-client is
 * `server-only`. Auth + tenant scoping happen in the Rust crate (`assert_workbook_access`).
 */
import {
  applyOps as applyOpsClient,
  opsSince as opsSinceClient,
  getSnapshot as getSnapshotClient,
  exportXlsx as exportXlsxClient,
  importXlsx as importXlsxClient,
  type ApplyOpsInput,
  type ApplyOpsResponse,
  type SnapshotResponse,
  type OpEntry,
} from "@/lib/rust-client/sabsheet-ops";

export async function applyOpsAction(input: ApplyOpsInput): Promise<ApplyOpsResponse> {
  return applyOpsClient(input);
}

export async function opsSinceAction(workbookId: string, since = 0): Promise<{ ops: OpEntry[] }> {
  return opsSinceClient(workbookId, since);
}

export async function getSnapshotAction(workbookId: string): Promise<SnapshotResponse> {
  return getSnapshotClient(workbookId);
}

export async function exportXlsxAction(workbookId: string): Promise<{ xlsxB64: string }> {
  return exportXlsxClient(workbookId);
}

export async function importXlsxAction(
  workbookId: string,
  name: string,
  xlsxB64: string,
): Promise<{ seq: number }> {
  return importXlsxClient(workbookId, name, xlsxB64);
}
