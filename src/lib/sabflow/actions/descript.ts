'use server';

export async function executeDescriptAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseURL = 'https://api.descript.com/v1';
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${inputs.accessToken}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listProjects': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.cursor) params.set('cursor', String(inputs.cursor));
        const res = await fetch(`${baseURL}/projects?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getProject': {
        const res = await fetch(`${baseURL}/projects/${inputs.projectId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'createProject': {
        const res = await fetch(`${baseURL}/projects`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'updateProject': {
        const res = await fetch(`${baseURL}/projects/${inputs.projectId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'deleteProject': {
        const res = await fetch(`${baseURL}/projects/${inputs.projectId}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listCompositions': {
        const params = new URLSearchParams();
        if (inputs.projectId) params.set('project_id', String(inputs.projectId));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.cursor) params.set('cursor', String(inputs.cursor));
        const res = await fetch(`${baseURL}/compositions?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getComposition': {
        const res = await fetch(`${baseURL}/compositions/${inputs.compositionId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listMedia': {
        const params = new URLSearchParams();
        if (inputs.projectId) params.set('project_id', String(inputs.projectId));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.cursor) params.set('cursor', String(inputs.cursor));
        const res = await fetch(`${baseURL}/media?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getMedia': {
        const res = await fetch(`${baseURL}/media/${inputs.mediaId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'uploadMedia': {
        const res = await fetch(`${baseURL}/media`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'deleteMedia': {
        const res = await fetch(`${baseURL}/media/${inputs.mediaId}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'exportComposition': {
        const res = await fetch(`${baseURL}/compositions/${inputs.compositionId}/export`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getTranscript': {
        const res = await fetch(`${baseURL}/compositions/${inputs.compositionId}/transcript`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listDrives': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.cursor) params.set('cursor', String(inputs.cursor));
        const res = await fetch(`${baseURL}/drives?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getDrive': {
        const res = await fetch(`${baseURL}/drives/${inputs.driveId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      default:
        return { error: `Descript action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`Descript action error: ${err?.message}`);
    return { error: err?.message ?? 'Unknown error in Descript action' };
  }
}
