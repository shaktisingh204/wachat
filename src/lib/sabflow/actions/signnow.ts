'use server';

export async function executeSignnowAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.signnow.com';
    const accessToken = inputs.accessToken;

    const authHeaders: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'getToken': {
                const clientId = inputs.clientId;
                const clientSecret = inputs.clientSecret;
                const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
                const res = await fetch(`${baseUrl}/oauth2/token`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${basicAuth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        grant_type: inputs.grantType || 'password',
                        username: inputs.username || '',
                        password: inputs.password || '',
                        scope: inputs.scope || '*',
                    }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'createDocument': {
                const res = await fetch(`${baseUrl}/document`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({
                        document_name: inputs.documentName,
                        ...(inputs.fields && { fields: inputs.fields }),
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'getDocument': {
                const res = await fetch(`${baseUrl}/document/${inputs.documentId}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'listDocuments': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${baseUrl}/user/documents?${params.toString()}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'uploadDocument': {
                const formData = new FormData();
                if (inputs.fileUrl) {
                    const fileRes = await fetch(inputs.fileUrl);
                    const fileBuffer = await fileRes.arrayBuffer();
                    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
                    formData.append('file', blob, inputs.fileName || 'document.pdf');
                }
                const uploadHeaders = {
                    'Authorization': `Bearer ${accessToken}`,
                };
                const res = await fetch(`${baseUrl}/document`, {
                    method: 'POST',
                    headers: uploadHeaders,
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'inviteToSign': {
                const res = await fetch(`${baseUrl}/document/${inputs.documentId}/invite`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({
                        to: inputs.to || [],
                        from: inputs.from,
                        cc: inputs.cc || [],
                        subject: inputs.subject,
                        message: inputs.message,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'getSigningLink': {
                const res = await fetch(`${baseUrl}/link`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({ document_id: inputs.documentId }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'cancelInvite': {
                const res = await fetch(`${baseUrl}/document/${inputs.documentId}/fieldinvitecancel`, {
                    method: 'PUT',
                    headers: authHeaders,
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'downloadDocument': {
                const res = await fetch(`${baseUrl}/document/${inputs.documentId}/download`, { headers: authHeaders });
                if (!res.ok) return { error: `Failed to download document: ${res.status}` };
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { base64, contentType: res.headers.get('content-type') } };
            }
            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${baseUrl}/user/documents?type=template&${params.toString()}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'getTemplate': {
                const res = await fetch(`${baseUrl}/template/${inputs.templateId}`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'createFromTemplate': {
                const res = await fetch(`${baseUrl}/template/${inputs.templateId}/copy`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({ document_name: inputs.documentName }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'listUsers': {
                const res = await fetch(`${baseUrl}/user/teammates`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'getUser': {
                const res = await fetch(`${baseUrl}/user`, { headers: authHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            case 'createFolder': {
                const res = await fetch(`${baseUrl}/folder`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({ name: inputs.name }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || JSON.stringify(data) };
                return { output: data };
            }
            default:
                return { error: `SignNow action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`SignNow action error: ${err.message}`);
        return { error: err.message };
    }
}
