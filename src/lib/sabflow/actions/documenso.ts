'use server';

export async function executeDocumensoAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://app.documenso.com/api/v1';
    const apiKey = inputs.apiKey;

    if (!apiKey) {
        return { error: 'Missing required credential: apiKey' };
    }

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listDocuments': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('perPage', String(inputs.perPage));
                if (inputs.status) params.set('status', String(inputs.status));
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
                if (inputs.title) body.title = inputs.title;
                if (inputs.externalId) body.externalId = inputs.externalId;
                if (inputs.visibility) body.visibility = inputs.visibility;
                if (inputs.recipients) body.recipients = inputs.recipients;
                if (inputs.meta) body.meta = inputs.meta;
                const res = await fetch(`${baseUrl}/documents`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createDocument failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteDocument': {
                if (!inputs.documentId) return { error: 'Missing required field: documentId' };
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteDocument failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'sendDocument': {
                if (!inputs.documentId) return { error: 'Missing required field: documentId' };
                const body: any = {};
                if (inputs.sendEmail !== undefined) body.sendEmail = inputs.sendEmail;
                if (inputs.message) body.message = inputs.message;
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/send`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `sendDocument failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'voidDocument': {
                if (!inputs.documentId) return { error: 'Missing required field: documentId' };
                const body: any = {};
                if (inputs.voidReason) body.voidReason = inputs.voidReason;
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/void`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `voidDocument failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listRecipients': {
                if (!inputs.documentId) return { error: 'Missing required field: documentId' };
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/recipients`, { headers });
                if (!res.ok) return { error: `listRecipients failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getRecipient': {
                if (!inputs.documentId) return { error: 'Missing required field: documentId' };
                if (!inputs.recipientId) return { error: 'Missing required field: recipientId' };
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/recipients/${inputs.recipientId}`, { headers });
                if (!res.ok) return { error: `getRecipient failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createRecipient': {
                if (!inputs.documentId) return { error: 'Missing required field: documentId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.email) body.email = inputs.email;
                if (inputs.role) body.role = inputs.role;
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/recipients`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createRecipient failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateRecipient': {
                if (!inputs.documentId) return { error: 'Missing required field: documentId' };
                if (!inputs.recipientId) return { error: 'Missing required field: recipientId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.email) body.email = inputs.email;
                if (inputs.role) body.role = inputs.role;
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/recipients/${inputs.recipientId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `updateRecipient failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listFields': {
                if (!inputs.documentId) return { error: 'Missing required field: documentId' };
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/fields`, { headers });
                if (!res.ok) return { error: `listFields failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createField': {
                if (!inputs.documentId) return { error: 'Missing required field: documentId' };
                const body: any = {};
                if (inputs.recipientId) body.recipientId = inputs.recipientId;
                if (inputs.type) body.type = inputs.type;
                if (inputs.pageNumber) body.pageNumber = inputs.pageNumber;
                if (inputs.pageX) body.pageX = inputs.pageX;
                if (inputs.pageY) body.pageY = inputs.pageY;
                if (inputs.pageWidth) body.pageWidth = inputs.pageWidth;
                if (inputs.pageHeight) body.pageHeight = inputs.pageHeight;
                const res = await fetch(`${baseUrl}/documents/${inputs.documentId}/fields`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createField failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('perPage', String(inputs.perPage));
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
            case 'useTemplate': {
                if (!inputs.templateId) return { error: 'Missing required field: templateId' };
                const body: any = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.externalId) body.externalId = inputs.externalId;
                if (inputs.recipients) body.recipients = inputs.recipients;
                const res = await fetch(`${baseUrl}/templates/${inputs.templateId}/use`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `useTemplate failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                logger.log(`Error: Documenso action "${actionName}" is not implemented.`);
                return { error: `Documenso action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        const message = err?.message || String(err);
        logger.log(`Documenso action error: ${message}`);
        return { error: message };
    }
}
