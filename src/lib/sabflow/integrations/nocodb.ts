import type { IntegrationResult, ResolvedOptions, Credential } from './types';

export async function executeNocoDB(
  options: ResolvedOptions,
  credential?: Credential,
): Promise<IntegrationResult> {
  const apiKey = credential?.apiKey ?? (options.apiKey as string);
  const baseUrl = ((credential?.url ?? (options.url as string)) ?? '').replace(/\/$/, '');
  const tableId = options.tableId as string;
  const operation = (options.operation as string) ?? 'list';

  if (!apiKey) return { error: 'nocodb: apiKey credential is required' };
  if (!baseUrl) return { error: 'nocodb: url is required' };
  if (!tableId) return { error: 'nocodb: tableId is required' };

  const headers = { 'xc-auth': apiKey, 'Content-Type': 'application/json' };
  const apiBase = `${baseUrl}/api/v1/db/data/noco`;

  try {
    if (operation === 'list') {
      const res = await fetch(`${apiBase}/${tableId}`, { headers });
      if (!res.ok) throw new Error(`NocoDB ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { list?: unknown[]; pageInfo?: { totalRows?: number } };
      return {
        outputs: {
          rows: JSON.stringify(data.list ?? []),
          total: String(data.pageInfo?.totalRows ?? 0),
        },
      };
    }
    if (operation === 'create') {
      const row = (options.row as Record<string, unknown>) ?? {};
      const res = await fetch(`${apiBase}/${tableId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(row),
      });
      if (!res.ok) throw new Error(`NocoDB ${res.status}: ${await res.text()}`);
      const created = (await res.json()) as { id?: unknown };
      return { outputs: { id: String(created.id ?? '') } };
    }
    if (operation === 'update') {
      const rowId = options.rowId as string;
      if (!rowId) return { error: 'nocodb update: rowId is required' };
      const row = (options.row as Record<string, unknown>) ?? {};
      const res = await fetch(`${apiBase}/${tableId}/${rowId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(row),
      });
      if (!res.ok) throw new Error(`NocoDB ${res.status}: ${await res.text()}`);
      return { outputs: { updated: 'true' } };
    }
    if (operation === 'delete') {
      const rowId = options.rowId as string;
      if (!rowId) return { error: 'nocodb delete: rowId is required' };
      const res = await fetch(`${apiBase}/${tableId}/${rowId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(`NocoDB ${res.status}: ${await res.text()}`);
      return { outputs: { deleted: 'true' } };
    }
    return { error: `nocodb: unknown operation "${operation}"` };
  } catch (err) {
    return { error: `nocodb failed: ${(err as Error).message}` };
  }
}
