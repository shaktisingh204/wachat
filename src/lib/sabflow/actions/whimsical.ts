'use server';

export async function executeWhimsicalAction(actionName: string, inputs: any, user: any, logger: any) {
  const BASE_URL = 'https://whimsical.com/api/v1';
  const token = inputs.apiToken;

  if (!token) return { error: 'Missing required credential: apiToken' };

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    switch (actionName) {
      case 'listFiles': {
        const params = new URLSearchParams();
        if (inputs.folderId) params.set('folder_id', inputs.folderId);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.cursor) params.set('cursor', inputs.cursor);
        const res = await fetch(`${BASE_URL}/files?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listFiles failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getFile': {
        const { fileId } = inputs;
        if (!fileId) return { error: 'Missing required input: fileId' };
        const res = await fetch(`${BASE_URL}/files/${fileId}`, { headers });
        if (!res.ok) return { error: `getFile failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createFile': {
        const { name, type } = inputs;
        if (!name || !type) return { error: 'Missing required inputs: name, type' };
        const body: any = { name, type };
        if (inputs.folderId) body.folder_id = inputs.folderId;
        if (inputs.description) body.description = inputs.description;
        const res = await fetch(`${BASE_URL}/files`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createFile failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'updateFile': {
        const { fileId } = inputs;
        if (!fileId) return { error: 'Missing required input: fileId' };
        const body: any = {};
        if (inputs.name) body.name = inputs.name;
        if (inputs.description) body.description = inputs.description;
        const res = await fetch(`${BASE_URL}/files/${fileId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateFile failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteFile': {
        const { fileId } = inputs;
        if (!fileId) return { error: 'Missing required input: fileId' };
        const res = await fetch(`${BASE_URL}/files/${fileId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteFile failed: ${res.status} ${await res.text()}` };
        return { output: { deleted: true, fileId } };
      }

      case 'createDiagram': {
        const { name, diagramType } = inputs;
        if (!name || !diagramType) return { error: 'Missing required inputs: name, diagramType' };
        const body: any = { name, type: diagramType };
        if (inputs.folderId) body.folder_id = inputs.folderId;
        if (inputs.content) body.content = inputs.content;
        const res = await fetch(`${BASE_URL}/files/diagram`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createDiagram failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getFolders': {
        const params = new URLSearchParams();
        if (inputs.parentFolderId) params.set('parent_folder_id', inputs.parentFolderId);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${BASE_URL}/folders?${params.toString()}`, { headers });
        if (!res.ok) return { error: `getFolders failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getFolder': {
        const { folderId } = inputs;
        if (!folderId) return { error: 'Missing required input: folderId' };
        const res = await fetch(`${BASE_URL}/folders/${folderId}`, { headers });
        if (!res.ok) return { error: `getFolder failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createFolder': {
        const { name } = inputs;
        if (!name) return { error: 'Missing required input: name' };
        const body: any = { name };
        if (inputs.parentFolderId) body.parent_folder_id = inputs.parentFolderId;
        const res = await fetch(`${BASE_URL}/folders`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createFolder failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteFolder': {
        const { folderId } = inputs;
        if (!folderId) return { error: 'Missing required input: folderId' };
        const res = await fetch(`${BASE_URL}/folders/${folderId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteFolder failed: ${res.status} ${await res.text()}` };
        return { output: { deleted: true, folderId } };
      }

      case 'shareFile': {
        const { fileId, email } = inputs;
        if (!fileId || !email) return { error: 'Missing required inputs: fileId, email' };
        const body: any = { email };
        if (inputs.permission) body.permission = inputs.permission;
        const res = await fetch(`${BASE_URL}/files/${fileId}/share`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `shareFile failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getShareLink': {
        const { fileId } = inputs;
        if (!fileId) return { error: 'Missing required input: fileId' };
        const body: any = {};
        if (inputs.permission) body.permission = inputs.permission;
        if (inputs.expiresAt) body.expires_at = inputs.expiresAt;
        const res = await fetch(`${BASE_URL}/files/${fileId}/share-link`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `getShareLink failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listTemplates': {
        const params = new URLSearchParams();
        if (inputs.type) params.set('type', inputs.type);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${BASE_URL}/templates?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listTemplates failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getTemplate': {
        const { templateId } = inputs;
        if (!templateId) return { error: 'Missing required input: templateId' };
        const res = await fetch(`${BASE_URL}/templates/${templateId}`, { headers });
        if (!res.ok) return { error: `getTemplate failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'duplicateFile': {
        const { fileId } = inputs;
        if (!fileId) return { error: 'Missing required input: fileId' };
        const body: any = {};
        if (inputs.name) body.name = inputs.name;
        if (inputs.folderId) body.folder_id = inputs.folderId;
        const res = await fetch(`${BASE_URL}/files/${fileId}/duplicate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `duplicateFile failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Whimsical action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executeWhimsicalAction error: ${err.message}`);
    return { error: err.message || 'Unknown error in executeWhimsicalAction' };
  }
}
