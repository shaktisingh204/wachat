import {
  getAuditLogEntries,
  type AuditLogQuery,
  type AuditLogRow,
} from '@/app/actions/crm-audit-log.actions';
import { AuditLogBrowser } from './_components/audit-log-browser';

/**
 * /dashboard/crm/audit-log — §5.5 audit-log viewer.
 *
 * Supports URL-driven filter chips (entityKind, actorId, action,
 * from, to, search). CSV export is wired through the
 * `exportAuditLogCsv` server action invoked from the client (see
 * `audit-log-browser.tsx`) — the `?export=csv` URL flag, when present,
 * triggers that download on mount.
 *
 * The audit document shape is owned by `writeAuditEntry` and is NOT
 * mutated here.
 */

type RawSp = Record<string, string | string[] | undefined>;

function firstStr(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function toQuery(sp: RawSp): AuditLogQuery {
  return {
    entityKind: firstStr(sp.entityKind),
    actorId: firstStr(sp.actorId),
    action: firstStr(sp.action),
    from: firstStr(sp.from),
    to: firstStr(sp.to),
    search: firstStr(sp.search),
  };
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<RawSp>;
}) {
  const sp = await searchParams;
  const query = toQuery(sp);
  const autoExport = firstStr(sp.export) === 'csv';

  const rows: AuditLogRow[] = await getAuditLogEntries(query);

  return (
    <AuditLogBrowser
      entries={rows}
      initialQuery={query}
      autoExportCsv={autoExport}
    />
  );
}
