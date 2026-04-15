'use server';

export async function executeFramerAction(actionName: string, inputs: any, user: any, logger: any) {
  const BASE_URL = 'https://api.framer.com/public';
  const token = inputs.apiToken;

  if (!token) return { error: 'Missing required credential: apiToken' };

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    switch (actionName) {
      case 'listProjects': {
        const res = await fetch(`${BASE_URL}/projects`, { headers });
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

      case 'updateProject': {
        const { projectId } = inputs;
        if (!projectId) return { error: 'Missing required input: projectId' };
        const body: any = {};
        if (inputs.name) body.name = inputs.name;
        if (inputs.description) body.description = inputs.description;
        const res = await fetch(`${BASE_URL}/projects/${projectId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateProject failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteProject': {
        const { projectId } = inputs;
        if (!projectId) return { error: 'Missing required input: projectId' };
        const res = await fetch(`${BASE_URL}/projects/${projectId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteProject failed: ${res.status} ${await res.text()}` };
        return { output: { deleted: true, projectId } };
      }

      case 'listPages': {
        const { projectId } = inputs;
        if (!projectId) return { error: 'Missing required input: projectId' };
        const res = await fetch(`${BASE_URL}/projects/${projectId}/pages`, { headers });
        if (!res.ok) return { error: `listPages failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getPage': {
        const { projectId, pageId } = inputs;
        if (!projectId || !pageId) return { error: 'Missing required inputs: projectId, pageId' };
        const res = await fetch(`${BASE_URL}/projects/${projectId}/pages/${pageId}`, { headers });
        if (!res.ok) return { error: `getPage failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createPage': {
        const { projectId, name } = inputs;
        if (!projectId || !name) return { error: 'Missing required inputs: projectId, name' };
        const body: any = { name };
        if (inputs.path) body.path = inputs.path;
        if (inputs.title) body.title = inputs.title;
        const res = await fetch(`${BASE_URL}/projects/${projectId}/pages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createPage failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deletePage': {
        const { projectId, pageId } = inputs;
        if (!projectId || !pageId) return { error: 'Missing required inputs: projectId, pageId' };
        const res = await fetch(`${BASE_URL}/projects/${projectId}/pages/${pageId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deletePage failed: ${res.status} ${await res.text()}` };
        return { output: { deleted: true, pageId } };
      }

      case 'listComponents': {
        const { projectId } = inputs;
        if (!projectId) return { error: 'Missing required input: projectId' };
        const res = await fetch(`${BASE_URL}/projects/${projectId}/components`, { headers });
        if (!res.ok) return { error: `listComponents failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getComponent': {
        const { projectId, componentId } = inputs;
        if (!projectId || !componentId) return { error: 'Missing required inputs: projectId, componentId' };
        const res = await fetch(`${BASE_URL}/projects/${projectId}/components/${componentId}`, { headers });
        if (!res.ok) return { error: `getComponent failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listCollections': {
        const { projectId } = inputs;
        if (!projectId) return { error: 'Missing required input: projectId' };
        const res = await fetch(`${BASE_URL}/projects/${projectId}/collections`, { headers });
        if (!res.ok) return { error: `listCollections failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getCollection': {
        const { projectId, collectionId } = inputs;
        if (!projectId || !collectionId) return { error: 'Missing required inputs: projectId, collectionId' };
        const res = await fetch(`${BASE_URL}/projects/${projectId}/collections/${collectionId}`, { headers });
        if (!res.ok) return { error: `getCollection failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'publishProject': {
        const { projectId } = inputs;
        if (!projectId) return { error: 'Missing required input: projectId' };
        const body: any = {};
        if (inputs.domains) body.domains = inputs.domains;
        const res = await fetch(`${BASE_URL}/projects/${projectId}/publish`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `publishProject failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'duplicateProject': {
        const { projectId } = inputs;
        if (!projectId) return { error: 'Missing required input: projectId' };
        const body: any = {};
        if (inputs.name) body.name = inputs.name;
        const res = await fetch(`${BASE_URL}/projects/${projectId}/duplicate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `duplicateProject failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Framer action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executeFramerAction error: ${err.message}`);
    return { error: err.message || 'Unknown error in executeFramerAction' };
  }
}
