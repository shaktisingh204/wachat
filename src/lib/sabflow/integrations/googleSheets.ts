import type { IntegrationResult, ResolvedOptions, Credential } from './types';

export async function executeGoogleSheets(
  options: ResolvedOptions,
  credential?: Credential,
): Promise<IntegrationResult> {
  const spreadsheetId = options.spreadsheetId as string;
  const range = (options.range as string) ?? 'Sheet1!A1';
  const operation = (options.operation as string) ?? 'read';
  const accessToken = credential?.accessToken ?? (options.accessToken as string);

  if (!accessToken) return { error: 'google_sheets: accessToken credential is required' };
  if (!spreadsheetId) return { error: 'google_sheets: spreadsheetId is required' };

  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  try {
    if (operation === 'read') {
      const res = await fetch(`${base}/values/${encodeURIComponent(range)}`, { headers });
      if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { values?: unknown[][] };
      return {
        outputs: { rows: JSON.stringify(data.values ?? []), count: String(data.values?.length ?? 0) },
      };
    }
    if (operation === 'append') {
      const values = options.values as unknown[][];
      const res = await fetch(
        `${base}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
        { method: 'POST', headers, body: JSON.stringify({ values }) },
      );
      if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { updates?: { updatedRows?: number } };
      return { outputs: { updatedRows: String(data.updates?.updatedRows ?? 0) } };
    }
    if (operation === 'update') {
      const values = options.values as unknown[][];
      const res = await fetch(
        `${base}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        { method: 'PUT', headers, body: JSON.stringify({ values }) },
      );
      if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { updatedRows?: number };
      return { outputs: { updatedRows: String(data.updatedRows ?? 0) } };
    }
    return { error: `google_sheets: unknown operation "${operation}"` };
  } catch (err) {
    return { error: `google_sheets failed: ${(err as Error).message}` };
  }
}
