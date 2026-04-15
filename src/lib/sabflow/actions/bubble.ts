'use server';

export async function executeBubbleAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = `https://${inputs.appName}.bubbleapps.io/api/1.1`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.apiKey}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listThings': {
                const params = new URLSearchParams();
                if (inputs.cursor !== undefined) params.set('cursor', String(inputs.cursor));
                if (inputs.limit !== undefined) params.set('limit', String(inputs.limit));
                if (inputs.constraints) params.set('constraints', typeof inputs.constraints === 'string' ? inputs.constraints : JSON.stringify(inputs.constraints));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/obj/${inputs.type}${qs}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list things: ${res.status}` };
                return { output: data };
            }

            case 'getThing': {
                const res = await fetch(`${baseUrl}/obj/${inputs.type}/${inputs.id}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get thing: ${res.status}` };
                return { output: data };
            }

            case 'createThing': {
                const res = await fetch(`${baseUrl}/obj/${inputs.type}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to create thing: ${res.status}` };
                return { output: data };
            }

            case 'updateThing': {
                const res = await fetch(`${baseUrl}/obj/${inputs.type}/${inputs.id}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to update thing: ${res.status}` };
                return { output: data };
            }

            case 'deleteThing': {
                const res = await fetch(`${baseUrl}/obj/${inputs.type}/${inputs.id}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data?.message || `Failed to delete thing: ${res.status}` };
                }
                return { output: { success: true } };
            }

            case 'searchThings': {
                const constraints = inputs.constraints
                    ? (typeof inputs.constraints === 'string' ? inputs.constraints : JSON.stringify(inputs.constraints))
                    : '[]';
                const params = new URLSearchParams({ constraints });
                if (inputs.cursor !== undefined) params.set('cursor', String(inputs.cursor));
                if (inputs.limit !== undefined) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/obj/${inputs.type}?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to search things: ${res.status}` };
                return { output: data };
            }

            case 'bulkCreate': {
                const res = await fetch(`${baseUrl}/obj/${inputs.type}/bulk`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.records || []),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to bulk create: ${res.status}` };
                return { output: data };
            }

            case 'getCount': {
                const res = await fetch(`${baseUrl}/obj/${inputs.type}?count=true`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get count: ${res.status}` };
                return { output: data };
            }

            case 'triggerWorkflow': {
                const res = await fetch(`${baseUrl}/wf/${inputs.endpoint}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to trigger workflow: ${res.status}` };
                return { output: data };
            }

            case 'uploadFile': {
                const formData = new FormData();
                if (inputs.filename) formData.append('filename', inputs.filename);
                if (inputs.fileContent) formData.append('file', inputs.fileContent);
                const uploadHeaders = { 'Authorization': `Bearer ${inputs.apiKey}` };
                const res = await fetch(`${baseUrl}/obj/file_attachment`, {
                    method: 'POST',
                    headers: uploadHeaders,
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to upload file: ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Bubble action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Bubble action error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred in Bubble action.' };
    }
}
