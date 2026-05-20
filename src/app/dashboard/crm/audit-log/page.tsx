/**
 * /dashboard/crm/audit-log — §5.5 audit-log viewer.
 *
 * Server component. Reads filter params from the URL and passes a
 * paginated result (50/page) plus server-computed KPIs to
 * <AuditLogBrowser>. The browser drives subsequent filter/page changes
 * via URL push.
 *
 * New in this revision:
 *  - KPI strip sourced server-side (eventsToday, eventsThisWeek,
 *    uniqueActorsToday, errorEvents)
 *  - Pagination: 50 rows/page, driven by `?page=N`
 *  - Total count passed to browser so it can render page count
 */

import {
  getAuditLogPage,
  getAuditLogKpis,
  type AuditLogQuery,
} from '@/app/actions/crm-audit-log.actions';
import { AuditLogBrowser } from './_components/audit-log-browser';

type RawSp = Record<string, string | string[] | undefined>;

function firstStr(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function toQuery(sp: RawSp): AuditLogQuery & { page: number } {
  return {
    entityKind: firstStr(sp.entityKind),
    actorId: firstStr(sp.actorId),
    action: firstStr(sp.action),
    from: firstStr(sp.from),
    to: firstStr(sp.to),
    search: firstStr(sp.search),
    page: Math.max(1, Number(firstStr(sp.page) ?? '1') || 1),
  };
}

export const dynamic = 'force-dynamic';

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<RawSp>;
}) {
  const sp = await searchParams;
  const query = toQuery(sp);
  const autoExport = firstStr(sp.export) === 'csv';

  const [pageResult, kpis] = await Promise.all([
    getAuditLogPage({ ...query, pageSize: 50 }),
    getAuditLogKpis(),
  ]);

  return (
    <AuditLogBrowser
      entries={pageResult.rows}
      total={pageResult.total}
      page={pageResult.page}
      pageSize={pageResult.pageSize}
      kpis={kpis}
      initialQuery={query}
      autoExportCsv={autoExport}
    />
  );
}
