'use server';

export async function executePimcoreAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = `${inputs.host}/api`;
    const headers: Record<string, string> = {
      'X-API-Key': inputs.apiKey,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'getObject': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${baseUrl}/objects/${id}`, { headers });
        if (!res.ok) return { error: `getObject failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createObject': {
        const body = inputs.object || inputs.body || {};
        const res = await fetch(`${baseUrl}/objects`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createObject failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'updateObject': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const body = inputs.object || inputs.body || {};
        const res = await fetch(`${baseUrl}/objects/${id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateObject failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteObject': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${baseUrl}/objects/${id}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteObject failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, id } };
      }

      case 'searchObjects': {
        const params = new URLSearchParams();
        if (inputs.query) params.set('q', inputs.query);
        if (inputs.type) params.set('type', inputs.type);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/objects?${params.toString()}`, { headers });
        if (!res.ok) return { error: `searchObjects failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getDocument': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${baseUrl}/documents/${id}`, { headers });
        if (!res.ok) return { error: `getDocument failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createDocument': {
        const body = inputs.document || inputs.body || {};
        const res = await fetch(`${baseUrl}/documents`, {
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
        const res = await fetch(`${baseUrl}/documents/${id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateDocument failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listDocuments': {
        const params = new URLSearchParams();
        if (inputs.type) params.set('type', inputs.type);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/documents?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listDocuments failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getAsset': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${baseUrl}/assets/${id}`, { headers });
        if (!res.ok) return { error: `getAsset failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createAsset': {
        const body = inputs.asset || inputs.body || {};
        const res = await fetch(`${baseUrl}/assets`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createAsset failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteAsset': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${baseUrl}/assets/${id}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteAsset failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, id } };
      }

      case 'listAssets': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/assets?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listAssets failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'executeQuery': {
        const body = inputs.query || inputs.body || {};
        const res = await fetch(`${baseUrl}/search/index/search`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `executeQuery failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getMetadata': {
        const elementType = inputs.elementType || 'object';
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${baseUrl}/${elementType}s/${id}/metadata`, { headers });
        if (!res.ok) return { error: `getMetadata failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Pimcore action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executePimcoreAction error: ${err.message}`);
    return { error: err.message };
  }
}
