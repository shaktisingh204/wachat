'use server';

export async function executeFormstackDocumentsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const secret = String(inputs.secret ?? '').trim();
        const baseUrl = 'https://www.webmerge.me/api';
        const authParams = `key=${encodeURIComponent(apiKey)}&secret=${encodeURIComponent(secret)}`;

        switch (actionName) {
            case 'listDocuments': {
                const params = new URLSearchParams({ key: apiKey, secret });
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/documents?${params.toString()}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { documents: data } };
            }

            case 'getDocument': {
                const documentId = String(inputs.documentId ?? '').trim();
                const res = await fetch(`${baseUrl}/documents/${documentId}?${authParams}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { document: data } };
            }

            case 'createDocument': {
                const params = new URLSearchParams({ key: apiKey, secret });
                const res = await fetch(`${baseUrl}/documents?${params.toString()}`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: inputs.name ?? 'New Document',
                        type: inputs.type ?? 'pdf',
                        ...(inputs.html ? { html: inputs.html } : {}),
                        ...(inputs.size ? { size: inputs.size } : {}),
                        ...(inputs.output_name ? { output_name: inputs.output_name } : {}),
                        ...(inputs.store_merged ? { store_merged: inputs.store_merged } : {}),
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { document: data } };
            }

            case 'updateDocument': {
                const documentId = String(inputs.documentId ?? '').trim();
                const params = new URLSearchParams({ key: apiKey, secret });
                const res = await fetch(`${baseUrl}/documents/${documentId}?${params.toString()}`, {
                    method: 'PUT',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...(inputs.name ? { name: inputs.name } : {}),
                        ...(inputs.html ? { html: inputs.html } : {}),
                        ...(inputs.output_name ? { output_name: inputs.output_name } : {}),
                        ...(inputs.store_merged !== undefined ? { store_merged: inputs.store_merged } : {}),
                        ...(inputs.active !== undefined ? { active: inputs.active } : {}),
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { document: data } };
            }

            case 'deleteDocument': {
                const documentId = String(inputs.documentId ?? '').trim();
                const res = await fetch(`${baseUrl}/documents/${documentId}?${authParams}`, {
                    method: 'DELETE',
                    headers: { 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { success: true, result: data } };
            }

            case 'mergeDocument': {
                const documentId = String(inputs.documentId ?? '').trim();
                const params = new URLSearchParams({ key: apiKey, secret });
                if (inputs.test) params.set('test', '1');
                if (inputs.download) params.set('download', '1');
                const mergeData = inputs.data ?? {};
                const res = await fetch(`${baseUrl}/merge/${documentId}?${params.toString()}`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(mergeData),
                });
                if (inputs.download) {
                    const buffer = await res.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString('base64');
                    return { output: { fileBase64: base64, contentType: res.headers.get('content-type') ?? 'application/pdf' } };
                }
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'getDocumentFields': {
                const documentId = String(inputs.documentId ?? '').trim();
                const res = await fetch(`${baseUrl}/documents/${documentId}/fields?${authParams}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { fields: data } };
            }

            case 'listDeliveries': {
                const documentId = String(inputs.documentId ?? '').trim();
                const res = await fetch(`${baseUrl}/documents/${documentId}/deliveries?${authParams}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { deliveries: data } };
            }

            case 'getDelivery': {
                const documentId = String(inputs.documentId ?? '').trim();
                const deliveryId = String(inputs.deliveryId ?? '').trim();
                const res = await fetch(`${baseUrl}/documents/${documentId}/deliveries/${deliveryId}?${authParams}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { delivery: data } };
            }

            case 'createDelivery': {
                const documentId = String(inputs.documentId ?? '').trim();
                const params = new URLSearchParams({ key: apiKey, secret });
                const res = await fetch(`${baseUrl}/documents/${documentId}/deliveries?${params.toString()}`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        type: inputs.type ?? 'email',
                        ...(inputs.to ? { to: inputs.to } : {}),
                        ...(inputs.subject ? { subject: inputs.subject } : {}),
                        ...(inputs.message ? { message: inputs.message } : {}),
                        ...(inputs.active !== undefined ? { active: inputs.active } : {}),
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { delivery: data } };
            }

            case 'updateDelivery': {
                const documentId = String(inputs.documentId ?? '').trim();
                const deliveryId = String(inputs.deliveryId ?? '').trim();
                const params = new URLSearchParams({ key: apiKey, secret });
                const res = await fetch(`${baseUrl}/documents/${documentId}/deliveries/${deliveryId}?${params.toString()}`, {
                    method: 'PUT',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...(inputs.to ? { to: inputs.to } : {}),
                        ...(inputs.subject ? { subject: inputs.subject } : {}),
                        ...(inputs.message ? { message: inputs.message } : {}),
                        ...(inputs.active !== undefined ? { active: inputs.active } : {}),
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { delivery: data } };
            }

            case 'deleteDelivery': {
                const documentId = String(inputs.documentId ?? '').trim();
                const deliveryId = String(inputs.deliveryId ?? '').trim();
                const res = await fetch(`${baseUrl}/documents/${documentId}/deliveries/${deliveryId}?${authParams}`, {
                    method: 'DELETE',
                    headers: { 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { success: true, result: data } };
            }

            case 'sendMergedDocument': {
                const documentId = String(inputs.documentId ?? '').trim();
                const params = new URLSearchParams({ key: apiKey, secret });
                if (inputs.test) params.set('test', '1');
                const res = await fetch(`${baseUrl}/merge/${documentId}?${params.toString()}`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(inputs.data ?? {}),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { sent: true, result: data } };
            }

            case 'listDataRoutes': {
                const res = await fetch(`${baseUrl}/routes?${authParams}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { routes: data } };
            }

            case 'getMergeHistory': {
                const documentId = String(inputs.documentId ?? '').trim();
                const params = new URLSearchParams({ key: apiKey, secret });
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/documents/${documentId}/history?${params.toString()}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `Formstack Documents API error: ${res.status}`);
                return { output: { history: data } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
