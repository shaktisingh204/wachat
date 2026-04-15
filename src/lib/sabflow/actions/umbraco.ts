'use server';

async function getUmbracoToken(baseUrl: string, inputs: any): Promise<string> {
  const res = await fetch(`${baseUrl}/umbraco/management/api/v1/security/back-office/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      username: inputs.username,
      password: inputs.password,
      client_id: inputs.clientId || 'umbraco-back-office',
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Umbraco auth failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token || data.token;
}

export async function executeUmbracoAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = inputs.baseUrl.replace(/\/$/, '');
    const token = await getUmbracoToken(baseUrl, inputs);
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const apiBase = `${baseUrl}/umbraco/management/api/v1`;

    switch (actionName) {
      case 'listDocuments': {
        const params = new URLSearchParams();
        if (inputs.skip) params.set('skip', String(inputs.skip));
        if (inputs.take) params.set('take', String(inputs.take));
        if (inputs.filter) params.set('filter', inputs.filter);
        const res = await fetch(`${apiBase}/document?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listDocuments failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getDocument': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${apiBase}/document/${id}`, { headers });
        if (!res.ok) return { error: `getDocument failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createDocument': {
        const body = inputs.document || inputs.body || {};
        const res = await fetch(`${apiBase}/document`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createDocument failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'updateDocument': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const body = inputs.document || inputs.body || {};
        const res = await fetch(`${apiBase}/document/${id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateDocument failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteDocument': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${apiBase}/document/${id}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteDocument failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, id } };
      }

      case 'publishDocument': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const body = inputs.publishSchedule || { publishSchedule: [] };
        const res = await fetch(`${apiBase}/document/${id}/publish`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `publishDocument failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, published: id } };
      }

      case 'unpublishDocument': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const body = inputs.cultures || { cultures: [] };
        const res = await fetch(`${apiBase}/document/${id}/unpublish`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `unpublishDocument failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, unpublished: id } };
      }

      case 'listDocumentTypes': {
        const params = new URLSearchParams();
        if (inputs.skip) params.set('skip', String(inputs.skip));
        if (inputs.take) params.set('take', String(inputs.take));
        const res = await fetch(`${apiBase}/document-type?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listDocumentTypes failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getDocumentType': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${apiBase}/document-type/${id}`, { headers });
        if (!res.ok) return { error: `getDocumentType failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listMedia': {
        const params = new URLSearchParams();
        if (inputs.skip) params.set('skip', String(inputs.skip));
        if (inputs.take) params.set('take', String(inputs.take));
        if (inputs.filter) params.set('filter', inputs.filter);
        const res = await fetch(`${apiBase}/media?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listMedia failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getMedia': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${apiBase}/media/${id}`, { headers });
        if (!res.ok) return { error: `getMedia failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createMedia': {
        const body = inputs.media || inputs.body || {};
        const res = await fetch(`${apiBase}/media`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createMedia failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'updateMedia': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const body = inputs.media || inputs.body || {};
        const res = await fetch(`${apiBase}/media/${id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateMedia failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listLanguages': {
        const res = await fetch(`${apiBase}/language`, { headers });
        if (!res.ok) return { error: `listLanguages failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getLanguage': {
        const isoCode = inputs.isoCode;
        if (!isoCode) return { error: 'isoCode is required' };
        const res = await fetch(`${apiBase}/language/${isoCode}`, { headers });
        if (!res.ok) return { error: `getLanguage failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Umbraco action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executeUmbracoAction error: ${err.message}`);
    return { error: err.message };
  }
}
