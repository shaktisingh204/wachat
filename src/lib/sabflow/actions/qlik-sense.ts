'use server';

export async function executeQlikSenseAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = `${inputs.tenantUrl}/api/v1`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${inputs.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    switch (actionName) {
      case 'listApps': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.next) params.set('next', inputs.next);
        if (inputs.prev) params.set('prev', inputs.prev);
        if (inputs.sort) params.set('sort', inputs.sort);
        const res = await fetch(`${baseUrl}/items?resourceType=app&${params}`, { headers });
        if (!res.ok) return { error: `listApps failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getApp': {
        const res = await fetch(`${baseUrl}/apps/${inputs.appId}`, { headers });
        if (!res.ok) return { error: `getApp failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createApp': {
        const body: Record<string, any> = { attributes: { name: inputs.name } };
        if (inputs.spaceId) body.attributes.spaceId = inputs.spaceId;
        if (inputs.description) body.attributes.description = inputs.description;
        const res = await fetch(`${baseUrl}/apps`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createApp failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'updateApp': {
        const body: Record<string, any> = { attributes: {} };
        if (inputs.name) body.attributes.name = inputs.name;
        if (inputs.description) body.attributes.description = inputs.description;
        if (inputs.spaceId) body.attributes.spaceId = inputs.spaceId;
        const res = await fetch(`${baseUrl}/apps/${inputs.appId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateApp failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteApp': {
        const res = await fetch(`${baseUrl}/apps/${inputs.appId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteApp failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, appId: inputs.appId } };
      }

      case 'listSpaces': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.type) params.set('type', inputs.type);
        const res = await fetch(`${baseUrl}/spaces?${params}`, { headers });
        if (!res.ok) return { error: `listSpaces failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getSpace': {
        const res = await fetch(`${baseUrl}/spaces/${inputs.spaceId}`, { headers });
        if (!res.ok) return { error: `getSpace failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listUsers': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.filter) params.set('filter', inputs.filter);
        const res = await fetch(`${baseUrl}/users?${params}`, { headers });
        if (!res.ok) return { error: `listUsers failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getUser': {
        const res = await fetch(`${baseUrl}/users/${inputs.userId}`, { headers });
        if (!res.ok) return { error: `getUser failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listGroups': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.filter) params.set('filter', inputs.filter);
        const res = await fetch(`${baseUrl}/groups?${params}`, { headers });
        if (!res.ok) return { error: `listGroups failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listDataFiles': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.path) params.set('path', inputs.path);
        const res = await fetch(`${baseUrl}/data-files?${params}`, { headers });
        if (!res.ok) return { error: `listDataFiles failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'uploadDataFile': {
        const uploadHeaders: Record<string, string> = {
          'Authorization': `Bearer ${inputs.apiKey}`,
          'Accept': 'application/json',
        };
        const formData = new FormData();
        if (inputs.name) formData.append('name', inputs.name);
        if (inputs.data) {
          const blob = new Blob([inputs.data], { type: 'text/csv' });
          formData.append('data', blob, inputs.filename || 'upload.csv');
        }
        const res = await fetch(`${baseUrl}/data-files`, {
          method: 'POST',
          headers: uploadHeaders,
          body: formData,
        });
        if (!res.ok) return { error: `uploadDataFile failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteDataFile': {
        const res = await fetch(`${baseUrl}/data-files/${inputs.fileId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteDataFile failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, fileId: inputs.fileId } };
      }

      case 'listReloadTasks': {
        const params = new URLSearchParams();
        if (inputs.appId) params.set('appId', inputs.appId);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseUrl}/reload-tasks?${params}`, { headers });
        if (!res.ok) return { error: `listReloadTasks failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'reloadApp': {
        const body: Record<string, any> = { appId: inputs.appId };
        if (inputs.partial !== undefined) body.partial = inputs.partial;
        const res = await fetch(`${baseUrl}/reloads`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `reloadApp failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Qlik Sense action: ${actionName}` };
    }
  } catch (err: any) {
    return { error: err?.message || 'Qlik Sense action failed' };
  }
}
