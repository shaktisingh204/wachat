'use server';

export async function executeDIDAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const basicAuth = Buffer.from(inputs.apiKey + ':' + inputs.apiKey).toString('base64');
    const baseURL = 'https://api.d-id.com';
    const headers: Record<string, string> = {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'createTalk': {
        const res = await fetch(`${baseURL}/talks`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getTalk': {
        const res = await fetch(`${baseURL}/talks/${inputs.talkId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'deleteTalk': {
        const res = await fetch(`${baseURL}/talks/${inputs.talkId}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listTalks': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseURL}/talks?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'createClip': {
        const res = await fetch(`${baseURL}/clips`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getClip': {
        const res = await fetch(`${baseURL}/clips/${inputs.clipId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listClips': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseURL}/clips?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'createPresenter': {
        const res = await fetch(`${baseURL}/presenters`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getPresenter': {
        const res = await fetch(`${baseURL}/presenters/${inputs.presenterId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listPresenters': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseURL}/presenters?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listVoices': {
        const res = await fetch(`${baseURL}/voices`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'createStream': {
        const res = await fetch(`${baseURL}/streams`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getStream': {
        const res = await fetch(`${baseURL}/streams/${inputs.streamId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'deleteStream': {
        const res = await fetch(`${baseURL}/streams/${inputs.streamId}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getCredits': {
        const res = await fetch(`${baseURL}/credits`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.description ?? `HTTP ${res.status}` };
        return { output: data };
      }

      default:
        return { error: `D-ID action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`D-ID action error: ${err?.message}`);
    return { error: err?.message ?? 'Unknown error in D-ID action' };
  }
}
