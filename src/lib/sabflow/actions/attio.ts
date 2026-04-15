'use server';

export async function executeAttioAction(actionName: string, inputs: any, user: any, logger: any) {
  const BASE_URL = 'https://api.attio.com/v2';
  const { accessToken } = inputs;

  if (!accessToken) {
    return { error: 'accessToken is required' };
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
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
      throw new Error(`Attio ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  try {
    switch (actionName) {
      case 'listObjects': {
        const data = await req('GET', '/objects');
        return { output: data };
      }

      case 'getObject': {
        const { objectSlug } = inputs;
        if (!objectSlug) return { error: 'objectSlug is required' };
        const data = await req('GET', `/objects/${objectSlug}`);
        return { output: data };
      }

      case 'listRecords': {
        const { objectSlug, limit = 25, offset = 0 } = inputs;
        if (!objectSlug) return { error: 'objectSlug is required' };
        const data = await req('POST', `/objects/${objectSlug}/records/query`, {
          limit,
          offset,
          sorts: inputs.sorts || [],
          filter: inputs.filter || {},
        });
        return { output: data };
      }

      case 'getRecord': {
        const { objectSlug, recordId } = inputs;
        if (!objectSlug || !recordId) return { error: 'objectSlug and recordId are required' };
        const data = await req('GET', `/objects/${objectSlug}/records/${recordId}`);
        return { output: data };
      }

      case 'createRecord': {
        const { objectSlug, values } = inputs;
        if (!objectSlug || !values) return { error: 'objectSlug and values are required' };
        const data = await req('POST', `/objects/${objectSlug}/records`, { data: { values } });
        return { output: data };
      }

      case 'updateRecord': {
        const { objectSlug, recordId, values } = inputs;
        if (!objectSlug || !recordId || !values) return { error: 'objectSlug, recordId, and values are required' };
        const data = await req('PATCH', `/objects/${objectSlug}/records/${recordId}`, { data: { values } });
        return { output: data };
      }

      case 'deleteRecord': {
        const { objectSlug, recordId } = inputs;
        if (!objectSlug || !recordId) return { error: 'objectSlug and recordId are required' };
        const data = await req('DELETE', `/objects/${objectSlug}/records/${recordId}`);
        return { output: data };
      }

      case 'listLists': {
        const data = await req('GET', '/lists');
        return { output: data };
      }

      case 'getList': {
        const { listSlug } = inputs;
        if (!listSlug) return { error: 'listSlug is required' };
        const data = await req('GET', `/lists/${listSlug}`);
        return { output: data };
      }

      case 'createList': {
        const { name, objectSlug } = inputs;
        if (!name || !objectSlug) return { error: 'name and objectSlug are required' };
        const data = await req('POST', '/lists', { data: { name, api_slug: name.toLowerCase().replace(/\s+/g, '_'), parent_object: objectSlug } });
        return { output: data };
      }

      case 'listWorkspaceMembers': {
        const data = await req('GET', '/workspace-members');
        return { output: data };
      }

      case 'listAttributes': {
        const { objectSlug } = inputs;
        if (!objectSlug) return { error: 'objectSlug is required' };
        const data = await req('GET', `/objects/${objectSlug}/attributes`);
        return { output: data };
      }

      case 'createNote': {
        const { parentObjectSlug, parentRecordId, title, content } = inputs;
        if (!parentObjectSlug || !parentRecordId || !content) {
          return { error: 'parentObjectSlug, parentRecordId, and content are required' };
        }
        const data = await req('POST', '/notes', {
          data: {
            parent_object: parentObjectSlug,
            parent_record_id: parentRecordId,
            title: title || 'Note',
            content_plaintext: content,
          },
        });
        return { output: data };
      }

      case 'listNotes': {
        const { parentObjectSlug, parentRecordId } = inputs;
        if (!parentObjectSlug || !parentRecordId) {
          return { error: 'parentObjectSlug and parentRecordId are required' };
        }
        const params = new URLSearchParams({
          parent_object: parentObjectSlug,
          parent_record_id: parentRecordId,
        });
        const data = await req('GET', `/notes?${params.toString()}`);
        return { output: data };
      }

      case 'searchRecords': {
        const { objectSlug, query } = inputs;
        if (!objectSlug || !query) return { error: 'objectSlug and query are required' };
        const data = await req('POST', `/objects/${objectSlug}/records/query`, {
          filter: inputs.filter || {},
          sorts: [],
          limit: inputs.limit || 25,
          offset: 0,
        });
        return { output: data };
      }

      default:
        return { error: `Unknown Attio action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`Attio action error: ${err.message}`);
    return { error: err.message };
  }
}
