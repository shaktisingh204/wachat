
'use server';

const JASPER_BASE = 'https://api.jasper.ai/v1';

export async function executeJasperAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const req = async (method: string, path: string, body?: any) => {
            logger?.log(`[Jasper] ${method} ${JASPER_BASE}${path}`);
            const opts: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(`${JASPER_BASE}${path}`, opts);
            if (res.status === 204) return {};
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error?.message || data?.message || `Jasper API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'generateContent': {
                const command = String(inputs.command ?? '').trim();
                if (!command) throw new Error('command is required.');
                const body: any = {
                    command,
                    inputs: {
                        tone: inputs.tone ?? 'professional',
                        outputLanguage: inputs.outputLanguage ?? 'en-US',
                    },
                    n: Number(inputs.n ?? 1),
                };
                const data = await req('POST', '/commands/run', body);
                return { output: { outputs: data.data ?? data.outputs ?? [], usage: data.usage ?? {} } };
            }

            case 'createDocument': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const body: any = { title };
                if (inputs.content) body.content = String(inputs.content);
                if (inputs.folderId) body.folderId = String(inputs.folderId);
                const data = await req('POST', '/documents', body);
                return { output: { document: data.data ?? data, id: data.data?.id ?? data.id ?? '' } };
            }

            case 'getDocument': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await req('GET', `/documents/${id}`);
                return { output: { document: data.data ?? data } };
            }

            case 'updateDocument': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const body: any = {};
                if (inputs.title) body.title = String(inputs.title);
                if (inputs.content) body.content = String(inputs.content);
                const data = await req('PATCH', `/documents/${id}`, body);
                return { output: { document: data.data ?? data } };
            }

            case 'listDocuments': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/documents${qs}`);
                return { output: { documents: data.data ?? [], meta: data.meta ?? {} } };
            }

            case 'deleteDocument': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                await req('DELETE', `/documents/${id}`);
                return { output: { success: true, id } };
            }

            case 'generateIdea': {
                const topic = String(inputs.topic ?? '').trim();
                if (!topic) throw new Error('topic is required.');
                const body: any = { topic };
                if (inputs.tone) body.tone = String(inputs.tone);
                if (inputs.n) body.n = Number(inputs.n);
                const data = await req('POST', '/ideas', body);
                return { output: { ideas: data.data ?? data.outputs ?? [] } };
            }

            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/templates${qs}`);
                return { output: { templates: data.data ?? [] } };
            }

            case 'runTemplate': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const body: any = {};
                if (inputs.inputs) body.inputs = typeof inputs.inputs === 'object' ? inputs.inputs : {};
                if (inputs.n) body.n = Number(inputs.n);
                const data = await req('POST', `/templates/${id}/run`, body);
                return { output: { outputs: data.data ?? data.outputs ?? [] } };
            }

            case 'generateAd': {
                const body: any = {};
                if (inputs.productName) body.productName = String(inputs.productName);
                if (inputs.productDescription) body.productDescription = String(inputs.productDescription);
                if (inputs.tone) body.tone = String(inputs.tone);
                if (inputs.n) body.n = Number(inputs.n);
                const data = await req('POST', '/ads/run', body);
                return { output: { ads: data.data ?? data.outputs ?? [] } };
            }

            case 'rewrite': {
                const content = String(inputs.content ?? '').trim();
                if (!content) throw new Error('content is required.');
                const body: any = { content };
                if (inputs.tone) body.tone = String(inputs.tone);
                if (inputs.n) body.n = Number(inputs.n);
                const data = await req('POST', '/rewrite', body);
                return { output: { outputs: data.data ?? data.outputs ?? [] } };
            }

            case 'summarize': {
                const content = String(inputs.content ?? '').trim();
                if (!content) throw new Error('content is required.');
                const body: any = { content };
                if (inputs.tone) body.tone = String(inputs.tone);
                if (inputs.n) body.n = Number(inputs.n);
                const data = await req('POST', '/summarize', body);
                return { output: { summaries: data.data ?? data.outputs ?? [] } };
            }

            case 'expandText': {
                const content = String(inputs.content ?? '').trim();
                if (!content) throw new Error('content is required.');
                const body: any = { content };
                if (inputs.tone) body.tone = String(inputs.tone);
                if (inputs.n) body.n = Number(inputs.n);
                const data = await req('POST', '/expand', body);
                return { output: { outputs: data.data ?? data.outputs ?? [] } };
            }

            default:
                return { error: `Jasper action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Jasper action failed.' };
    }
}
