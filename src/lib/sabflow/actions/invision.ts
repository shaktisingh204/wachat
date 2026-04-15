'use server';

export async function executeInVisionAction(actionName: string, inputs: any, user: any, logger: any) {
  const BASE_URL = 'https://api.invisionapp.com/d/api/v1';
  const privateToken = inputs.privateToken;

  if (!privateToken) return { error: 'Missing required credential: privateToken' };

  const headers: Record<string, string> = {
    'Private-Token': privateToken,
    'Content-Type': 'application/json',
  };

  try {
    switch (actionName) {
      case 'listPrototypes': {
        const params = new URLSearchParams();
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
        const res = await fetch(`${BASE_URL}/prototypes?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listPrototypes failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getPrototype': {
        const { prototypeId } = inputs;
        if (!prototypeId) return { error: 'Missing required input: prototypeId' };
        const res = await fetch(`${BASE_URL}/prototypes/${prototypeId}`, { headers });
        if (!res.ok) return { error: `getPrototype failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listScreens': {
        const { prototypeId } = inputs;
        if (!prototypeId) return { error: 'Missing required input: prototypeId' };
        const params = new URLSearchParams();
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
        const res = await fetch(`${BASE_URL}/prototypes/${prototypeId}/screens?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listScreens failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getScreen': {
        const { prototypeId, screenId } = inputs;
        if (!prototypeId || !screenId) return { error: 'Missing required inputs: prototypeId, screenId' };
        const res = await fetch(`${BASE_URL}/prototypes/${prototypeId}/screens/${screenId}`, { headers });
        if (!res.ok) return { error: `getScreen failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createScreen': {
        const { prototypeId, name } = inputs;
        if (!prototypeId || !name) return { error: 'Missing required inputs: prototypeId, name' };
        const body: any = { name };
        if (inputs.imageUrl) body.imageUrl = inputs.imageUrl;
        if (inputs.width) body.width = inputs.width;
        if (inputs.height) body.height = inputs.height;
        const res = await fetch(`${BASE_URL}/prototypes/${prototypeId}/screens`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createScreen failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'updateScreen': {
        const { prototypeId, screenId } = inputs;
        if (!prototypeId || !screenId) return { error: 'Missing required inputs: prototypeId, screenId' };
        const body: any = {};
        if (inputs.name) body.name = inputs.name;
        if (inputs.description) body.description = inputs.description;
        const res = await fetch(`${BASE_URL}/prototypes/${prototypeId}/screens/${screenId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateScreen failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteScreen': {
        const { prototypeId, screenId } = inputs;
        if (!prototypeId || !screenId) return { error: 'Missing required inputs: prototypeId, screenId' };
        const res = await fetch(`${BASE_URL}/prototypes/${prototypeId}/screens/${screenId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteScreen failed: ${res.status} ${await res.text()}` };
        return { output: { deleted: true, screenId } };
      }

      case 'listComments': {
        const { prototypeId } = inputs;
        if (!prototypeId) return { error: 'Missing required input: prototypeId' };
        const params = new URLSearchParams();
        if (inputs.screenId) params.set('screenId', inputs.screenId);
        if (inputs.page) params.set('page', String(inputs.page));
        const res = await fetch(`${BASE_URL}/prototypes/${prototypeId}/comments?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listComments failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createComment': {
        const { prototypeId, screenId, body: commentBody } = inputs;
        if (!prototypeId || !screenId || !commentBody) {
          return { error: 'Missing required inputs: prototypeId, screenId, body' };
        }
        const payload: any = { body: commentBody };
        if (inputs.x !== undefined) payload.x = inputs.x;
        if (inputs.y !== undefined) payload.y = inputs.y;
        const res = await fetch(`${BASE_URL}/prototypes/${prototypeId}/screens/${screenId}/comments`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) return { error: `createComment failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listProjects': {
        const params = new URLSearchParams();
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
        const res = await fetch(`${BASE_URL}/projects?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listProjects failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getProject': {
        const { projectId } = inputs;
        if (!projectId) return { error: 'Missing required input: projectId' };
        const res = await fetch(`${BASE_URL}/projects/${projectId}`, { headers });
        if (!res.ok) return { error: `getProject failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createProject': {
        const { name } = inputs;
        if (!name) return { error: 'Missing required input: name' };
        const body: any = { name };
        if (inputs.description) body.description = inputs.description;
        const res = await fetch(`${BASE_URL}/projects`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createProject failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listDocuments': {
        const params = new URLSearchParams();
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
        const res = await fetch(`${BASE_URL}/documents?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listDocuments failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getDocument': {
        const { documentId } = inputs;
        if (!documentId) return { error: 'Missing required input: documentId' };
        const res = await fetch(`${BASE_URL}/documents/${documentId}`, { headers });
        if (!res.ok) return { error: `getDocument failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listUsers': {
        const params = new URLSearchParams();
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
        const res = await fetch(`${BASE_URL}/users?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listUsers failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown InVision action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executeInVisionAction error: ${err.message}`);
    return { error: err.message || 'Unknown error in executeInVisionAction' };
  }
}
