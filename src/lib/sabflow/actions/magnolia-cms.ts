'use server';

export async function executeMagnoliaCMSAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = `${inputs.host}/.rest`;
    const authHeader = `Basic ${Buffer.from(inputs.username + ':' + inputs.password).toString('base64')}`;
    const headers: Record<string, string> = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listNodes': {
        const workspace = inputs.workspace || 'website';
        const path = inputs.path || '/';
        const res = await fetch(`${baseUrl}/nodes/v1/${workspace}${path}`, { headers });
        if (!res.ok) return { error: `listNodes failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getNode': {
        const workspace = inputs.workspace || 'website';
        const path = inputs.path;
        if (!path) return { error: 'path is required' };
        const res = await fetch(`${baseUrl}/nodes/v1/${workspace}${path}`, { headers });
        if (!res.ok) return { error: `getNode failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createNode': {
        const workspace = inputs.workspace || 'website';
        const parentPath = inputs.parentPath || '/';
        const body = inputs.node || inputs.body || {};
        const res = await fetch(`${baseUrl}/nodes/v1/${workspace}${parentPath}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createNode failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'updateNode': {
        const workspace = inputs.workspace || 'website';
        const path = inputs.path;
        if (!path) return { error: 'path is required' };
        const body = inputs.node || inputs.body || {};
        const res = await fetch(`${baseUrl}/nodes/v1/${workspace}${path}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateNode failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteNode': {
        const workspace = inputs.workspace || 'website';
        const path = inputs.path;
        if (!path) return { error: 'path is required' };
        const res = await fetch(`${baseUrl}/nodes/v1/${workspace}${path}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteNode failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, path } };
      }

      case 'moveNode': {
        const workspace = inputs.workspace || 'website';
        const srcPath = inputs.srcPath;
        const destPath = inputs.destPath;
        if (!srcPath || !destPath) return { error: 'srcPath and destPath are required' };
        const res = await fetch(`${baseUrl}/nodes/v1/${workspace}${srcPath}?moveTo=${encodeURIComponent(destPath)}`, {
          method: 'POST',
          headers,
        });
        if (!res.ok) return { error: `moveNode failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, srcPath, destPath } };
      }

      case 'copyNode': {
        const workspace = inputs.workspace || 'website';
        const srcPath = inputs.srcPath;
        const destPath = inputs.destPath;
        if (!srcPath || !destPath) return { error: 'srcPath and destPath are required' };
        const res = await fetch(`${baseUrl}/nodes/v1/${workspace}${srcPath}?copyTo=${encodeURIComponent(destPath)}`, {
          method: 'POST',
          headers,
        });
        if (!res.ok) return { error: `copyNode failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, srcPath, destPath } };
      }

      case 'activateNode': {
        const workspace = inputs.workspace || 'website';
        const path = inputs.path;
        if (!path) return { error: 'path is required' };
        const res = await fetch(`${baseUrl}/activation/v0/activate?workspace=${workspace}&path=${encodeURIComponent(path)}`, {
          method: 'POST',
          headers,
        });
        if (!res.ok) return { error: `activateNode failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, activated: path } };
      }

      case 'deactivateNode': {
        const workspace = inputs.workspace || 'website';
        const path = inputs.path;
        if (!path) return { error: 'path is required' };
        const res = await fetch(`${baseUrl}/activation/v0/deactivate?workspace=${workspace}&path=${encodeURIComponent(path)}`, {
          method: 'POST',
          headers,
        });
        if (!res.ok) return { error: `deactivateNode failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, deactivated: path } };
      }

      case 'listPages': {
        const res = await fetch(`${baseUrl}/delivery/pages/v1`, { headers });
        if (!res.ok) return { error: `listPages failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getPage': {
        const path = inputs.path;
        if (!path) return { error: 'path is required' };
        const res = await fetch(`${baseUrl}/delivery/pages/v1${path}`, { headers });
        if (!res.ok) return { error: `getPage failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createPage': {
        const body = inputs.page || inputs.body || {};
        const res = await fetch(`${baseUrl}/delivery/pages/v1`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createPage failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'updatePage': {
        const path = inputs.path;
        if (!path) return { error: 'path is required' };
        const body = inputs.page || inputs.body || {};
        const res = await fetch(`${baseUrl}/delivery/pages/v1${path}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updatePage failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listAssets': {
        const workspace = inputs.workspace || 'dam';
        const path = inputs.path || '/';
        const res = await fetch(`${baseUrl}/nodes/v1/${workspace}${path}`, { headers });
        if (!res.ok) return { error: `listAssets failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getAsset': {
        const workspace = inputs.workspace || 'dam';
        const path = inputs.path;
        if (!path) return { error: 'path is required' };
        const res = await fetch(`${baseUrl}/nodes/v1/${workspace}${path}`, { headers });
        if (!res.ok) return { error: `getAsset failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Magnolia CMS action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executeMagnoliaCMSAction error: ${err.message}`);
    return { error: err.message };
  }
}
