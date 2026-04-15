'use server';

export async function executeGetAcceptAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.getaccept.com/v1';
    const accessToken = inputs.accessToken;

    if (!accessToken) {
        return { error: 'Missing required credential: accessToken' };
    }

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listDocuments': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', String(inputs.status));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/documents?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listDocuments failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getDocument': {
                if (!inputs.documentId) return { error: 'Missing required field: documentId' };
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}`, { headers });
                if (!res.ok) return { error: `getDocument failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createDocument': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.file_url) body.file_url = inputs.file_url;
                if (inputs.file_content) body.file_content = inputs.file_content;
                if (inputs.type) body.type = inputs.type;
                if (inputs.recipients) body.recipients = inputs.recipients;
                if (inputs.value) body.value = inputs.value;
                const res = await fetch(`${baseUrl}/documents`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createDocument failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'sendDocument': {
                if (!inputs.documentId) return { error: 'Missing required field: documentId' };
                const body: any = {};
                if (inputs.recipients) body.recipients = inputs.recipients;
                if (inputs.message) body.message = inputs.message;
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/send`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `sendDocument failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteDocument': {
                if (!inputs.documentId) return { error: 'Missing required field: documentId' };
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteDocument failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, documentId: inputs.documentId } };
            }
            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.q) params.set('q', String(inputs.q));
                const res = await fetch(`${baseUrl}/contacts?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listContacts failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getContact': {
                if (!inputs.contactId) return { error: 'Missing required field: contactId' };
                const res = await fetch(`${baseUrl}/contacts/${inputs.contactId}`, { headers });
                if (!res.ok) return { error: `getContact failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createContact': {
                const body: any = {};
                if (inputs.first_name) body.first_name = inputs.first_name;
                if (inputs.last_name) body.last_name = inputs.last_name;
                if (inputs.email) body.email = inputs.email;
                if (inputs.company_name) body.company_name = inputs.company_name;
                if (inputs.phone_number) body.phone_number = inputs.phone_number;
                if (inputs.title) body.title = inputs.title;
                const res = await fetch(`${baseUrl}/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createContact failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateContact': {
                if (!inputs.contactId) return { error: 'Missing required field: contactId' };
                const body: any = {};
                if (inputs.first_name) body.first_name = inputs.first_name;
                if (inputs.last_name) body.last_name = inputs.last_name;
                if (inputs.email) body.email = inputs.email;
                if (inputs.company_name) body.company_name = inputs.company_name;
                if (inputs.phone_number) body.phone_number = inputs.phone_number;
                if (inputs.title) body.title = inputs.title;
                const res = await fetch(`${baseUrl}/contacts/${inputs.contactId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `updateContact failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteContact': {
                if (!inputs.contactId) return { error: 'Missing required field: contactId' };
                const res = await fetch(`${baseUrl}/contacts/${inputs.contactId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteContact failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, contactId: inputs.contactId } };
            }
            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/templates?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listTemplates failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getTemplate': {
                if (!inputs.templateId) return { error: 'Missing required field: templateId' };
                const res = await fetch(`${baseUrl}/templates/${inputs.templateId}`, { headers });
                if (!res.ok) return { error: `getTemplate failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listEntities': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/entities?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listEntities failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getEntityStatus': {
                if (!inputs.entityId) return { error: 'Missing required field: entityId' };
                const res = await fetch(`${baseUrl}/entities/${inputs.entityId}/status`, { headers });
                if (!res.ok) return { error: `getEntityStatus failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getStats': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', String(inputs.from));
                if (inputs.to) params.set('to', String(inputs.to));
                const res = await fetch(`${baseUrl}/stats?${params.toString()}`, { headers });
                if (!res.ok) return { error: `getStats failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                logger.log(`Error: GetAccept action "${actionName}" is not implemented.`);
                return { error: `GetAccept action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        const message = err?.message || String(err);
        logger.log(`GetAccept action error: ${message}`);
        return { error: message };
    }
}
