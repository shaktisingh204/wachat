'use server';

export async function executePandadocEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const baseUrl = 'https://api.pandadoc.com/public/v1';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'createDocument': {
                const res = await fetch(`${baseUrl}/documents`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        url: inputs.url,
                        recipients: inputs.recipients || [],
                        fields: inputs.fields || {},
                        metadata: inputs.metadata || {},
                        tags: inputs.tags || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'createDocumentFromTemplate': {
                const res = await fetch(`${baseUrl}/documents`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        template_uuid: inputs.templateUuid,
                        recipients: inputs.recipients || [],
                        fields: inputs.fields || {},
                        tokens: inputs.tokens || [],
                        metadata: inputs.metadata || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'getDocument': {
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'listDocuments': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.q) params.set('q', inputs.q);
                const res = await fetch(`${baseUrl}/documents?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'sendDocument': {
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/send`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        message: inputs.message,
                        subject: inputs.subject,
                        silent: inputs.silent || false,
                        sender: inputs.sender,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'downloadDocument': {
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/download`, { headers });
                if (!res.ok) return { error: `Failed to download document: ${res.status}` };
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { base64, contentType: res.headers.get('content-type') } };
            }
            case 'deleteDocument': {
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.detail || JSON.stringify(data) };
            }
            case 'shareDocument': {
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/share`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        recipient: inputs.recipient,
                        lifetime: inputs.lifetime,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'addRecipient': {
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/recipients`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        email: inputs.email,
                        first_name: inputs.firstName,
                        last_name: inputs.lastName,
                        role: inputs.role,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.q) params.set('q', inputs.q);
                const res = await fetch(`${baseUrl}/templates?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'getTemplate': {
                const res = await fetch(`${baseUrl}/templates/${inputs.templateUuid}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'createTemplate': {
                const res = await fetch(`${baseUrl}/templates`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        tags: inputs.tags || [],
                        fields: inputs.fields || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'listFolders': {
                const params = new URLSearchParams();
                if (inputs.parentUuid) params.set('parent_uuid', inputs.parentUuid);
                const res = await fetch(`${baseUrl}/documents/folders?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'createFolder': {
                const res = await fetch(`${baseUrl}/documents/folders`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        parent_uuid: inputs.parentUuid,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'getDocumentStatus': {
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/status`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            default:
                return { error: `PandaDoc Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`PandaDoc Enhanced action error: ${err.message}`);
        return { error: err.message };
    }
}
