'use server';

export async function executeCraftCMSAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = `${inputs.siteUrl}/api`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${inputs.apiToken}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'getEntries': {
        const params = new URLSearchParams();
        if (inputs.section) params.set('section', inputs.section);
        if (inputs.type) params.set('type', inputs.type);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        if (inputs.status) params.set('status', inputs.status);
        const res = await fetch(`${baseUrl}/entries?${params.toString()}`, { headers });
        if (!res.ok) return { error: `getEntries failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getEntry': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${baseUrl}/entries/${id}`, { headers });
        if (!res.ok) return { error: `getEntry failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createEntry': {
        const body = inputs.entry || inputs.body || {};
        const res = await fetch(`${baseUrl}/entries`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createEntry failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'saveEntry': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const body = inputs.entry || inputs.body || {};
        const res = await fetch(`${baseUrl}/entries/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `saveEntry failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteEntry': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${baseUrl}/entries/${id}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteEntry failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, id } };
      }

      case 'getCategories': {
        const params = new URLSearchParams();
        if (inputs.group) params.set('group', inputs.group);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseUrl}/categories?${params.toString()}`, { headers });
        if (!res.ok) return { error: `getCategories failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getCategory': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${baseUrl}/categories/${id}`, { headers });
        if (!res.ok) return { error: `getCategory failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getTags': {
        const params = new URLSearchParams();
        if (inputs.group) params.set('group', inputs.group);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseUrl}/tags?${params.toString()}`, { headers });
        if (!res.ok) return { error: `getTags failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getTag': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${baseUrl}/tags/${id}`, { headers });
        if (!res.ok) return { error: `getTag failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getGlobals': {
        const handle = inputs.handle;
        const url = handle ? `${baseUrl}/globals/${handle}` : `${baseUrl}/globals`;
        const res = await fetch(url, { headers });
        if (!res.ok) return { error: `getGlobals failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getSections': {
        const res = await fetch(`${baseUrl}/sections`, { headers });
        if (!res.ok) return { error: `getSections failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getFields': {
        const params = new URLSearchParams();
        if (inputs.group) params.set('group', inputs.group);
        const res = await fetch(`${baseUrl}/fields?${params.toString()}`, { headers });
        if (!res.ok) return { error: `getFields failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getUsers': {
        const params = new URLSearchParams();
        if (inputs.group) params.set('group', inputs.group);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseUrl}/users?${params.toString()}`, { headers });
        if (!res.ok) return { error: `getUsers failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getUser': {
        const id = inputs.id;
        if (!id) return { error: 'id is required' };
        const res = await fetch(`${baseUrl}/users/${id}`, { headers });
        if (!res.ok) return { error: `getUser failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getAssets': {
        const params = new URLSearchParams();
        if (inputs.volume) params.set('volume', inputs.volume);
        if (inputs.kind) params.set('kind', inputs.kind);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/assets?${params.toString()}`, { headers });
        if (!res.ok) return { error: `getAssets failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Craft CMS action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executeCraftCMSAction error: ${err.message}`);
    return { error: err.message };
  }
}
