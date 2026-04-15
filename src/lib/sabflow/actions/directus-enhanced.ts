'use server';

export async function executeDirectusEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = inputs.baseUrl.replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${inputs.accessToken}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listItems': {
        const collection = inputs.collection;
        if (!collection) return { error: 'collection is required' };
        const params = new URLSearchParams();
        if (inputs.filter) params.set('filter', JSON.stringify(inputs.filter));
        if (inputs.sort) params.set('sort', inputs.sort);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        if (inputs.fields) params.set('fields', inputs.fields);
        const res = await fetch(`${baseUrl}/items/${collection}?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listItems failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getItem': {
        const collection = inputs.collection;
        const id = inputs.id;
        if (!collection || !id) return { error: 'collection and id are required' };
        const params = new URLSearchParams();
        if (inputs.fields) params.set('fields', inputs.fields);
        const res = await fetch(`${baseUrl}/items/${collection}/${id}?${params.toString()}`, { headers });
        if (!res.ok) return { error: `getItem failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createItem': {
        const collection = inputs.collection;
        if (!collection) return { error: 'collection is required' };
        const body = inputs.item || inputs.body || {};
        const res = await fetch(`${baseUrl}/items/${collection}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createItem failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'updateItem': {
        const collection = inputs.collection;
        const id = inputs.id;
        if (!collection || !id) return { error: 'collection and id are required' };
        const body = inputs.item || inputs.body || {};
        const res = await fetch(`${baseUrl}/items/${collection}/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateItem failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteItem': {
        const collection = inputs.collection;
        const id = inputs.id;
        if (!collection || !id) return { error: 'collection and id are required' };
        const res = await fetch(`${baseUrl}/items/${collection}/${id}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteItem failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, collection, id } };
      }

      case 'searchItems': {
        const collection = inputs.collection;
        if (!collection) return { error: 'collection is required' };
        const body = inputs.query || inputs.body || {};
        const res = await fetch(`${baseUrl}/items/${collection}/search`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `searchItems failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listCollections': {
        const res = await fetch(`${baseUrl}/collections`, { headers });
        if (!res.ok) return { error: `listCollections failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getCollection': {
        const collection = inputs.collection;
        if (!collection) return { error: 'collection is required' };
        const res = await fetch(`${baseUrl}/collections/${collection}`, { headers });
        if (!res.ok) return { error: `getCollection failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createCollection': {
        const body = inputs.collection || inputs.body || {};
        const res = await fetch(`${baseUrl}/collections`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createCollection failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listFiles': {
        const params = new URLSearchParams();
        if (inputs.filter) params.set('filter', JSON.stringify(inputs.filter));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/files?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listFiles failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getFile': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${baseUrl}/files/${id}`, { headers });
        if (!res.ok) return { error: `getFile failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'uploadFile': {
        const body = inputs.file || inputs.body || {};
        const res = await fetch(`${baseUrl}/files`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `uploadFile failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteFile': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${baseUrl}/files/${id}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteFile failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, id } };
      }

      case 'listUsers': {
        const params = new URLSearchParams();
        if (inputs.filter) params.set('filter', JSON.stringify(inputs.filter));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/users?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listUsers failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getUser': {
        const id = inputs.id || 'me';
        const res = await fetch(`${baseUrl}/users/${id}`, { headers });
        if (!res.ok) return { error: `getUser failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Directus Enhanced action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executeDirectusEnhancedAction error: ${err.message}`);
    return { error: err.message };
  }
}
