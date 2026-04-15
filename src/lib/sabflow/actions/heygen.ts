'use server';

export async function executeHeyGenAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const apiKey = inputs.apiKey;
    const baseURL = 'https://api.heygen.com/v2';
    const headers: Record<string, string> = {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'createVideo': {
        const res = await fetch(`${baseURL}/video/generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getVideo': {
        const res = await fetch(`${baseURL}/video/${inputs.videoId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'deleteVideo': {
        const res = await fetch(`${baseURL}/video/${inputs.videoId}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listVideos': {
        const params = new URLSearchParams();
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseURL}/videos?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'createAvatar': {
        const res = await fetch(`${baseURL}/avatar`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getAvatar': {
        const res = await fetch(`${baseURL}/avatar/${inputs.avatarId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listAvatars': {
        const params = new URLSearchParams();
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseURL}/avatars?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'createVoice': {
        const res = await fetch(`${baseURL}/voice`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getVoice': {
        const res = await fetch(`${baseURL}/voice/${inputs.voiceId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listVoices': {
        const params = new URLSearchParams();
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseURL}/voices?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'createTemplate': {
        const res = await fetch(`${baseURL}/template`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getTemplate': {
        const res = await fetch(`${baseURL}/template/${inputs.templateId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listTemplates': {
        const params = new URLSearchParams();
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseURL}/templates?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'generateFromTemplate': {
        const res = await fetch(`${baseURL}/template/${inputs.templateId}/generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getVideoStatus': {
        const res = await fetch(`${baseURL}/video/${inputs.videoId}/status`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      default:
        return { error: `HeyGen action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`HeyGen action error: ${err?.message}`);
    return { error: err?.message ?? 'Unknown error in HeyGen action' };
  }
}
