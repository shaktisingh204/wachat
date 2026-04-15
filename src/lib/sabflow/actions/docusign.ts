'use server';

export async function executeDocusignAction(actionName: string, inputs: any, user: any, logger: any) {
    const accessToken = inputs.accessToken;
    const accountBaseUrl = inputs.accountBaseUrl || 'https://na4.docusign.net';
    const accountId = inputs.accountId;
    const baseUrl = `${accountBaseUrl}/restapi/v2.1/accounts/${accountId}`;

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'createEnvelope': {
                const res = await fetch(`${baseUrl}/envelopes`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.envelopeDefinition || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getEnvelope': {
                const res = await fetch(`${baseUrl}/envelopes/${inputs.envelopeId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listEnvelopes': {
                const params = new URLSearchParams();
                if (inputs.fromDate) params.set('from_date', inputs.fromDate);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.count) params.set('count', String(inputs.count));
                const res = await fetch(`${baseUrl}/envelopes?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'sendEnvelope': {
                const res = await fetch(`${baseUrl}/envelopes/${inputs.envelopeId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ status: 'sent' }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'voidEnvelope': {
                const res = await fetch(`${baseUrl}/envelopes/${inputs.envelopeId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ status: 'voided', voidedReason: inputs.voidedReason || 'Voided via SabFlow' }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'resendEnvelope': {
                const res = await fetch(`${baseUrl}/envelopes/${inputs.envelopeId}/recipients?resend_envelope=true`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.recipients || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getEnvelopeDocuments': {
                const res = await fetch(`${baseUrl}/envelopes/${inputs.envelopeId}/documents`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'downloadDocument': {
                const res = await fetch(`${baseUrl}/envelopes/${inputs.envelopeId}/documents/${inputs.documentId}`, { headers });
                if (!res.ok) return { error: `Failed to download document: ${res.status}` };
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { base64, contentType: res.headers.get('content-type') } };
            }
            case 'listRecipients': {
                const res = await fetch(`${baseUrl}/envelopes/${inputs.envelopeId}/recipients`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'addRecipient': {
                const res = await fetch(`${baseUrl}/envelopes/${inputs.envelopeId}/recipients`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.recipients || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getSigningUrl': {
                const res = await fetch(`${baseUrl}/envelopes/${inputs.envelopeId}/views/recipient`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        returnUrl: inputs.returnUrl || 'https://example.com',
                        authenticationMethod: inputs.authenticationMethod || 'none',
                        email: inputs.email,
                        userName: inputs.userName,
                        recipientId: inputs.recipientId,
                        clientUserId: inputs.clientUserId,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createTemplate': {
                const res = await fetch(`${baseUrl}/templates`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.templateDefinition || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.searchText) params.set('search_text', inputs.searchText);
                const res = await fetch(`${baseUrl}/templates?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getTemplate': {
                const res = await fetch(`${baseUrl}/templates/${inputs.templateId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createEnvelopeFromTemplate': {
                const body = {
                    templateId: inputs.templateId,
                    templateRoles: inputs.templateRoles || [],
                    status: inputs.status || 'sent',
                    ...(inputs.emailSubject && { emailSubject: inputs.emailSubject }),
                };
                const res = await fetch(`${baseUrl}/envelopes`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            default:
                return { error: `DocuSign action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`DocuSign action error: ${err.message}`);
        return { error: err.message };
    }
}
