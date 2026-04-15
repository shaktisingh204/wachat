'use server';

export async function executeLoomEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
  const BASE_URL = 'https://www.loom.com/v1';
  const token = inputs.apiKey;

  if (!token) return { error: 'Missing required credential: apiKey' };

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    switch (actionName) {
      case 'listVideos': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.folderId) params.set('folder_id', inputs.folderId);
        const res = await fetch(`${BASE_URL}/videos?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listVideos failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getVideo': {
        const { videoId } = inputs;
        if (!videoId) return { error: 'Missing required input: videoId' };
        const res = await fetch(`${BASE_URL}/videos/${videoId}`, { headers });
        if (!res.ok) return { error: `getVideo failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createVideo': {
        const body: any = {};
        if (inputs.title) body.title = inputs.title;
        if (inputs.folderId) body.folder_id = inputs.folderId;
        const res = await fetch(`${BASE_URL}/videos`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createVideo failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'updateVideo': {
        const { videoId } = inputs;
        if (!videoId) return { error: 'Missing required input: videoId' };
        const body: any = {};
        if (inputs.title) body.title = inputs.title;
        if (inputs.description) body.description = inputs.description;
        if (inputs.privacy) body.privacy = inputs.privacy;
        const res = await fetch(`${BASE_URL}/videos/${videoId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateVideo failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteVideo': {
        const { videoId } = inputs;
        if (!videoId) return { error: 'Missing required input: videoId' };
        const res = await fetch(`${BASE_URL}/videos/${videoId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteVideo failed: ${res.status} ${await res.text()}` };
        return { output: { deleted: true, videoId } };
      }

      case 'getUploadUrl': {
        const body: any = {};
        if (inputs.title) body.title = inputs.title;
        const res = await fetch(`${BASE_URL}/videos/upload`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `getUploadUrl failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'trimVideo': {
        const { videoId, startTime, endTime } = inputs;
        if (!videoId) return { error: 'Missing required input: videoId' };
        const body: any = {};
        if (startTime !== undefined) body.start_time = startTime;
        if (endTime !== undefined) body.end_time = endTime;
        const res = await fetch(`${BASE_URL}/videos/${videoId}/trim`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `trimVideo failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'generateTranscript': {
        const { videoId } = inputs;
        if (!videoId) return { error: 'Missing required input: videoId' };
        const body: any = {};
        if (inputs.language) body.language = inputs.language;
        const res = await fetch(`${BASE_URL}/videos/${videoId}/transcript/generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `generateTranscript failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getTranscript': {
        const { videoId } = inputs;
        if (!videoId) return { error: 'Missing required input: videoId' };
        const res = await fetch(`${BASE_URL}/videos/${videoId}/transcript`, { headers });
        if (!res.ok) return { error: `getTranscript failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createLink': {
        const { videoId } = inputs;
        if (!videoId) return { error: 'Missing required input: videoId' };
        const body: any = { video_id: videoId };
        if (inputs.expiresAt) body.expires_at = inputs.expiresAt;
        if (inputs.password) body.password = inputs.password;
        const res = await fetch(`${BASE_URL}/links`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createLink failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listSpaces': {
        const res = await fetch(`${BASE_URL}/spaces`, { headers });
        if (!res.ok) return { error: `listSpaces failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getSpace': {
        const { spaceId } = inputs;
        if (!spaceId) return { error: 'Missing required input: spaceId' };
        const res = await fetch(`${BASE_URL}/spaces/${spaceId}`, { headers });
        if (!res.ok) return { error: `getSpace failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listFolders': {
        const params = new URLSearchParams();
        if (inputs.spaceId) params.set('space_id', inputs.spaceId);
        const res = await fetch(`${BASE_URL}/folders?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listFolders failed: ${res.status} ${await res.text()}` };
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
        if (inputs.spaceId) body.space_id = inputs.spaceId;
        if (inputs.parentFolderId) body.parent_folder_id = inputs.parentFolderId;
        const res = await fetch(`${BASE_URL}/folders`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createFolder failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Loom Enhanced action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executeLoomEnhancedAction error: ${err.message}`);
    return { error: err.message || 'Unknown error in executeLoomEnhancedAction' };
  }
}
