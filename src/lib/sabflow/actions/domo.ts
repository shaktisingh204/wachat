'use server';

async function getDomoAccessToken(inputs: any): Promise<string> {
  const creds = Buffer.from(`${inputs.clientId}:${inputs.clientSecret}`).toString('base64');
  const res = await fetch(
    `https://api.domo.com/oauth/token?grant_type=client_credentials&scope=${inputs.scope || 'data'}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Accept': 'application/json',
      },
    }
  );
  if (!res.ok) throw new Error(`Domo OAuth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function executeDomoAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const accessToken = await getDomoAccessToken(inputs);
    const baseUrl = 'https://api.domo.com/v1';
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    switch (actionName) {
      case 'listDatasets': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        if (inputs.sort) params.set('sort', inputs.sort);
        const res = await fetch(`${baseUrl}/datasets?${params}`, { headers });
        if (!res.ok) return { error: `listDatasets failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getDataset': {
        const res = await fetch(`${baseUrl}/datasets/${inputs.datasetId}`, { headers });
        if (!res.ok) return { error: `getDataset failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createDataset': {
        const body = {
          name: inputs.name,
          description: inputs.description,
          schema: inputs.schema,
        };
        const res = await fetch(`${baseUrl}/datasets`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createDataset failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'updateDataset': {
        const body: Record<string, any> = {};
        if (inputs.name) body.name = inputs.name;
        if (inputs.description) body.description = inputs.description;
        if (inputs.schema) body.schema = inputs.schema;
        const res = await fetch(`${baseUrl}/datasets/${inputs.datasetId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateDataset failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteDataset': {
        const res = await fetch(`${baseUrl}/datasets/${inputs.datasetId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteDataset failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, datasetId: inputs.datasetId } };
      }

      case 'importData': {
        const importHeaders = { ...headers, 'Content-Type': 'text/csv' };
        const res = await fetch(`${baseUrl}/datasets/${inputs.datasetId}/data`, {
          method: 'PUT',
          headers: importHeaders,
          body: inputs.csvData,
        });
        if (!res.ok) return { error: `importData failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, datasetId: inputs.datasetId } };
      }

      case 'exportData': {
        const params = new URLSearchParams();
        if (inputs.includeHeader !== undefined) params.set('includeHeader', String(inputs.includeHeader));
        const exportHeaders = { ...headers, 'Accept': 'text/csv' };
        const res = await fetch(`${baseUrl}/datasets/${inputs.datasetId}/data?${params}`, { headers: exportHeaders });
        if (!res.ok) return { error: `exportData failed: ${res.status} ${await res.text()}` };
        return { output: { csv: await res.text() } };
      }

      case 'listPages': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/pages?${params}`, { headers });
        if (!res.ok) return { error: `listPages failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getPage': {
        const res = await fetch(`${baseUrl}/pages/${inputs.pageId}`, { headers });
        if (!res.ok) return { error: `getPage failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createPage': {
        const body: Record<string, any> = { name: inputs.name };
        if (inputs.parentId) body.parentId = inputs.parentId;
        if (inputs.locked !== undefined) body.locked = inputs.locked;
        const res = await fetch(`${baseUrl}/pages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createPage failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listUsers': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/users?${params}`, { headers });
        if (!res.ok) return { error: `listUsers failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getUser': {
        const res = await fetch(`${baseUrl}/users/${inputs.userId}`, { headers });
        if (!res.ok) return { error: `getUser failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createUser': {
        const body: Record<string, any> = {
          name: inputs.name,
          email: inputs.email,
          role: inputs.role || 'Participant',
        };
        if (inputs.sendInvite !== undefined) body.sendInvite = inputs.sendInvite;
        const res = await fetch(`${baseUrl}/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createUser failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteUser': {
        const res = await fetch(`${baseUrl}/users/${inputs.userId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteUser failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, userId: inputs.userId } };
      }

      case 'listGroups': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/groups?${params}`, { headers });
        if (!res.ok) return { error: `listGroups failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Domo action: ${actionName}` };
    }
  } catch (err: any) {
    return { error: err?.message || 'Domo action failed' };
  }
}
