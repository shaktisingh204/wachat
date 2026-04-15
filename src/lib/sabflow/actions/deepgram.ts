'use server';

export async function executeDeepgramAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = 'https://api.deepgram.com/v1';
        const headers: Record<string, string> = {
            'Authorization': `Token ${inputs.apiKey}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'transcribeUrl': {
                const params = new URLSearchParams({
                    model: inputs.model || 'nova-2',
                    language: inputs.language || 'en',
                });
                const res = await fetch(`${baseUrl}/listen?${params.toString()}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ url: inputs.url }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.err_msg || 'Failed to transcribe URL' };
                return { output: data };
            }

            case 'transcribeAudio': {
                // Fetch audio from URL then POST to Deepgram
                const audioRes = await fetch(inputs.audioUrl);
                if (!audioRes.ok) return { error: 'Failed to fetch audio from provided URL' };
                const audioBuffer = await audioRes.arrayBuffer();
                const params = new URLSearchParams({
                    model: inputs.model || 'nova-2',
                    language: inputs.language || 'en',
                });
                const res = await fetch(`${baseUrl}/listen?${params.toString()}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${inputs.apiKey}`,
                        'Content-Type': audioRes.headers.get('content-type') || 'audio/wav',
                    },
                    body: audioBuffer,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.err_msg || 'Failed to transcribe audio' };
                return { output: data };
            }

            case 'transcribeFile': {
                // Accept base64 encoded file content
                const buffer = Buffer.from(inputs.fileBase64, 'base64');
                const params = new URLSearchParams({
                    model: inputs.model || 'nova-2',
                    language: inputs.language || 'en',
                });
                const res = await fetch(`${baseUrl}/listen?${params.toString()}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${inputs.apiKey}`,
                        'Content-Type': inputs.mimeType || 'audio/wav',
                    },
                    body: buffer,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.err_msg || 'Failed to transcribe file' };
                return { output: data };
            }

            case 'getTranscription': {
                const res = await fetch(`${baseUrl}/listen/${inputs.requestId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.err_msg || 'Failed to get transcription' };
                return { output: data };
            }

            case 'startPrerecorded': {
                const params = new URLSearchParams({
                    model: inputs.model || 'nova-2',
                    language: inputs.language || 'en',
                });
                if (inputs.callback) params.set('callback', inputs.callback);
                const res = await fetch(`${baseUrl}/listen?${params.toString()}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ url: inputs.url }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.err_msg || 'Failed to start prerecorded transcription' };
                return { output: data };
            }

            case 'startLive': {
                return { error: 'Live streaming transcription requires a WebSocket connection and cannot be handled via a standard HTTP action. Use a WebSocket client to connect to wss://api.deepgram.com/v1/listen.' };
            }

            case 'listProjects': {
                const res = await fetch(`${baseUrl}/projects`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.err_msg || 'Failed to list projects' };
                return { output: data };
            }

            case 'getProject': {
                const res = await fetch(`${baseUrl}/projects/${inputs.projectId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.err_msg || 'Failed to get project' };
                return { output: data };
            }

            case 'listKeys': {
                const res = await fetch(`${baseUrl}/projects/${inputs.projectId}/keys`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.err_msg || 'Failed to list keys' };
                return { output: data };
            }

            case 'createKey': {
                const res = await fetch(`${baseUrl}/projects/${inputs.projectId}/keys`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        comment: inputs.comment,
                        scopes: inputs.scopes || ['usage:write'],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.err_msg || 'Failed to create key' };
                return { output: data };
            }

            case 'deleteKey': {
                const res = await fetch(`${baseUrl}/projects/${inputs.projectId}/keys/${inputs.keyId}`, { method: 'DELETE', headers });
                if (res.status === 200 || res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.err_msg || 'Failed to delete key' };
            }

            case 'listMembers': {
                const res = await fetch(`${baseUrl}/projects/${inputs.projectId}/members`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.err_msg || 'Failed to list members' };
                return { output: data };
            }

            case 'listUsage': {
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.end) params.set('end', inputs.end);
                const res = await fetch(`${baseUrl}/projects/${inputs.projectId}/requests?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.err_msg || 'Failed to list usage' };
                return { output: data };
            }

            default:
                return { error: `Unknown Deepgram action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Deepgram action error: ${err.message}`);
        return { error: err.message || 'Deepgram action failed' };
    }
}
