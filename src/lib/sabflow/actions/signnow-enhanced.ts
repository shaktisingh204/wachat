'use server';

export async function executeSignNowEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const accessToken = inputs.accessToken;
    const baseUrl = 'https://api.signnow.com';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listDocuments': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.type) params.set('type', inputs.type);
                const res = await fetch(`${baseUrl}/user/documentsv2?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'getDocument': {
                const res = await fetch(`${baseUrl}/document/${inputs.documentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'uploadDocument': {
                const formHeaders: Record<string, string> = {
                    'Authorization': `Bearer ${accessToken}`,
                };
                const res = await fetch(`${baseUrl}/document/fieldextract`, {
                    method: 'POST',
                    headers: formHeaders,
                    body: JSON.stringify({
                        file: inputs.fileBase64,
                        file_name: inputs.fileName,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'deleteDocument': {
                const res = await fetch(`${baseUrl}/document/${inputs.documentId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 200 || res.status === 204) return { output: { deleted: true, documentId: inputs.documentId } };
                const data = await res.json().catch(() => ({}));
                return { error: data.error || `HTTP ${res.status}` };
            }
            case 'createInvite': {
                const res = await fetch(`${baseUrl}/document/${inputs.documentId}/invite`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        to: inputs.to || [],
                        from: inputs.from,
                        cc: inputs.cc || [],
                        cc_step: inputs.ccStep || [],
                        subject: inputs.subject,
                        message: inputs.message,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'getInvite': {
                const res = await fetch(`${baseUrl}/document/${inputs.documentId}/fieldinvite`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'cancelInvite': {
                const res = await fetch(`${baseUrl}/document/${inputs.documentId}/fieldinvitecancel`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: { cancelled: true, ...data } };
            }
            case 'resendInvite': {
                const res = await fetch(`${baseUrl}/document/${inputs.documentId}/resendinvite`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ email: inputs.email }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: { resent: true, ...data } };
            }
            case 'downloadDocument': {
                const res = await fetch(`${baseUrl}/document/${inputs.documentId}/download?type=${inputs.type || 'collapsed'}`, { headers });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: err.error || `HTTP ${res.status}` };
                }
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { base64, contentType: res.headers.get('content-type') || 'application/pdf', size: buffer.byteLength } };
            }
            case 'getDocumentFields': {
                const res = await fetch(`${baseUrl}/document/${inputs.documentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: { fields: data.fields || [], roles: data.roles || [], documentId: inputs.documentId } };
            }
            case 'createTemplate': {
                const res = await fetch(`${baseUrl}/template`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        document_id: inputs.documentId,
                        document_name: inputs.documentName || inputs.templateName,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/user/documents/templates?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'getTemplate': {
                const res = await fetch(`${baseUrl}/document/${inputs.templateId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'createFromTemplate': {
                const res = await fetch(`${baseUrl}/template/${inputs.templateId}/copy`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ document_name: inputs.documentName }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'downloadSigningLog': {
                const res = await fetch(`${baseUrl}/document/${inputs.documentId}/log`, { headers });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: err.error || `HTTP ${res.status}` };
                }
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown SignNow Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`SignNow Enhanced action error: ${err.message}`);
        return { error: err.message || 'Unknown error in SignNow Enhanced action' };
    }
}
