'use server';

export async function executeTavusAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseURL = 'https://tavusapi.com/v2';
    const headers: Record<string, string> = {
      'x-api-key': inputs.apiKey,
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

      case 'deleteVideo': {
        const res = await fetch(`${baseURL}/videos/${inputs.videoId}`, { method: 'DELETE', headers });
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

      case 'createReplica': {
        const res = await fetch(`${baseURL}/replicas`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getReplica': {
        const res = await fetch(`${baseURL}/replicas/${inputs.replicaId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'deleteReplica': {
        const res = await fetch(`${baseURL}/replicas/${inputs.replicaId}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listReplicas': {
        const params = new URLSearchParams();
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseURL}/replicas?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'trainReplica': {
        const res = await fetch(`${baseURL}/replicas/${inputs.replicaId}/train`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'createConversation': {
        const res = await fetch(`${baseURL}/conversations`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'getConversation': {
        const res = await fetch(`${baseURL}/conversations/${inputs.conversationId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'endConversation': {
        const res = await fetch(`${baseURL}/conversations/${inputs.conversationId}/end`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listConversations': {
        const params = new URLSearchParams();
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseURL}/conversations?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'createPersona': {
        const res = await fetch(`${baseURL}/personas`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      case 'listPersonas': {
        const params = new URLSearchParams();
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseURL}/personas?${params.toString()}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
        return { output: data };
      }

      default:
        return { error: `Tavus action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`Tavus action error: ${err?.message}`);
    return { error: err?.message ?? 'Unknown error in Tavus action' };
  }
}
