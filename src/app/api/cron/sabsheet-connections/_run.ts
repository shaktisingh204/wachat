import 'server-only';

/**
 * Cron-side glue for the SabSheet connections tick. Maps a raw
 * `sabsheet_connections` Mongo doc (with ObjectId ids) to the
 * `SabsheetConnection` wire shape the run module consumes, and re-exports
 * `runAndLand` so the route doesn't import the run module's full surface.
 */

import type { SabsheetConnection } from '@/lib/sabsheet/connections/types';
import { runAndLand } from '@/lib/sabsheet/connections/run.server';

export { runAndLand };

/** Map a raw Mongo connection doc into the run module's `SabsheetConnection`. */
export function fromCronDoc(d: any): SabsheetConnection {
  return {
    _id: String(d._id),
    ownerUserId: String(d.ownerUserId),
    workbookId: String(d.workbookId),
    sheetId: d.sheetId ? String(d.sheetId) : undefined,
    type: d.type,
    config: d.config ?? {},
    target: d.target ?? { anchorRow: 1, anchorCol: 1 },
    schedule: d.schedule ?? { mode: 'manual' },
    credentialId: d.credentialId ? String(d.credentialId) : undefined,
    lastRunAt: d.lastRunAt instanceof Date ? d.lastRunAt.toISOString() : undefined,
    lastStatus: d.lastStatus ?? undefined,
    lastError: d.lastError ?? undefined,
    rowCount: typeof d.rowCount === 'number' ? d.rowCount : undefined,
    status: d.status ?? 'active',
  };
}
