'use server';

export async function executeSynthesiaAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseURL = 'https://api.synthesia.io/v2';
    const headers: Record<string, string> = {
      'Authorization': inputs.apiKey,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'createVideo': {
        const res = await fetch(`${baseURL}/videos`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getVideo': {
        const res = await fetch(`${baseURL}/videos/${inputs.videoId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'updateVideo': {
        const res = await fetch(`${baseURL}/videos/${inputs.videoId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'deleteVideo': {
        const res = await fetch(`${baseURL}/videos/${inputs.videoId}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listVideos': {
        const params = new URLSearchParams();
        if (inputs.offset) params.set('offset', String(inputs.offset));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseURL}/videos?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'downloadVideo': {
        const res = await fetch(`${baseURL}/videos/${inputs.videoId}/download`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'createAvatarVideo': {
        const res = await fetch(`${baseURL}/videos/avatar`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getAvatarVideo': {
        const res = await fetch(`${baseURL}/videos/avatar/${inputs.videoId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listAvatars': {
        const params = new URLSearchParams();
        if (inputs.offset) params.set('offset', String(inputs.offset));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseURL}/avatars?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getAvatar': {
        const res = await fetch(`${baseURL}/avatars/${inputs.avatarId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listVoices': {
        const params = new URLSearchParams();
        if (inputs.offset) params.set('offset', String(inputs.offset));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseURL}/voices?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'createTemplate': {
        const res = await fetch(`${baseURL}/templates`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getTemplate': {
        const res = await fetch(`${baseURL}/templates/${inputs.templateId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listTemplates': {
        const params = new URLSearchParams();
        if (inputs.offset) params.set('offset', String(inputs.offset));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseURL}/templates?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'generateFromTemplate': {
        const res = await fetch(`${baseURL}/templates/${inputs.templateId}/generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      default:
        return { error: `Synthesia action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`Synthesia action error: ${err?.message}`);
    return { error: err?.message ?? 'Unknown error in Synthesia action' };
  }
}
