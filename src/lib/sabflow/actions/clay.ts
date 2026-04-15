'use server';

export async function executeClayAction(actionName: string, inputs: any, user: any, logger: any) {
  const BASE_URL = 'https://api.clay.com/v1';
  const { apiKey } = inputs;

  if (!apiKey) {
    return { error: 'apiKey is required' };
  }

  const headers: Record<string, string> = {
    'x-clay-api-key': apiKey,
    'Content-Type': 'application/json',
  };

  async function req(method: string, path: string, body?: any) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Clay ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  try {
    switch (actionName) {
      case 'listTables': {
        const { limit = 50, offset = 0 } = inputs;
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        const data = await req('GET', `/tables?${params.toString()}`);
        return { output: data };
      }

      case 'getTable': {
        const { tableId } = inputs;
        if (!tableId) return { error: 'tableId is required' };
        const data = await req('GET', `/tables/${tableId}`);
        return { output: data };
      }

      case 'createTable': {
        const { name, description } = inputs;
        if (!name) return { error: 'name is required' };
        const data = await req('POST', '/tables', { name, description });
        return { output: data };
      }

      case 'updateTable': {
        const { tableId, name, description } = inputs;
        if (!tableId) return { error: 'tableId is required' };
        const body: any = {};
        if (name) body.name = name;
        if (description) body.description = description;
        const data = await req('PATCH', `/tables/${tableId}`, body);
        return { output: data };
      }

      case 'deleteTable': {
        const { tableId } = inputs;
        if (!tableId) return { error: 'tableId is required' };
        const data = await req('DELETE', `/tables/${tableId}`);
        return { output: data };
      }

      case 'listRows': {
        const { tableId, limit = 50, offset = 0 } = inputs;
        if (!tableId) return { error: 'tableId is required' };
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        const data = await req('GET', `/tables/${tableId}/rows?${params.toString()}`);
        return { output: data };
      }

      case 'getRow': {
        const { tableId, rowId } = inputs;
        if (!tableId || !rowId) return { error: 'tableId and rowId are required' };
        const data = await req('GET', `/tables/${tableId}/rows/${rowId}`);
        return { output: data };
      }

      case 'createRow': {
        const { tableId, fields } = inputs;
        if (!tableId || !fields) return { error: 'tableId and fields are required' };
        const data = await req('POST', `/tables/${tableId}/rows`, { fields });
        return { output: data };
      }

      case 'updateRow': {
        const { tableId, rowId, fields } = inputs;
        if (!tableId || !rowId || !fields) return { error: 'tableId, rowId, and fields are required' };
        const data = await req('PATCH', `/tables/${tableId}/rows/${rowId}`, { fields });
        return { output: data };
      }

      case 'deleteRow': {
        const { tableId, rowId } = inputs;
        if (!tableId || !rowId) return { error: 'tableId and rowId are required' };
        const data = await req('DELETE', `/tables/${tableId}/rows/${rowId}`);
        return { output: data };
      }

      case 'searchRows': {
        const { tableId, query, limit = 50 } = inputs;
        if (!tableId || !query) return { error: 'tableId and query are required' };
        const data = await req('POST', `/tables/${tableId}/rows/search`, { query, limit });
        return { output: data };
      }

      case 'runEnrichment': {
        const { tableId, rowId, enrichmentId } = inputs;
        if (!tableId || !rowId || !enrichmentId) return { error: 'tableId, rowId, and enrichmentId are required' };
        const data = await req('POST', `/tables/${tableId}/rows/${rowId}/enrichments/${enrichmentId}/run`, {});
        return { output: data };
      }

      case 'listEnrichments': {
        const { tableId } = inputs;
        if (!tableId) return { error: 'tableId is required' };
        const data = await req('GET', `/tables/${tableId}/enrichments`);
        return { output: data };
      }

      case 'getEnrichment': {
        const { tableId, enrichmentId } = inputs;
        if (!tableId || !enrichmentId) return { error: 'tableId and enrichmentId are required' };
        const data = await req('GET', `/tables/${tableId}/enrichments/${enrichmentId}`);
        return { output: data };
      }

      case 'exportTable': {
        const { tableId, format = 'csv' } = inputs;
        if (!tableId) return { error: 'tableId is required' };
        const params = new URLSearchParams({ format });
        const data = await req('GET', `/tables/${tableId}/export?${params.toString()}`);
        return { output: data };
      }

      default:
        return { error: `Unknown Clay action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`Clay action error: ${err.message}`);
    return { error: err.message };
  }
}
