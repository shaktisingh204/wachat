'use server';

export async function executeDocusignEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const accessToken = inputs.accessToken;
    const accountId = inputs.accountId;
    const baseUrl = `https://na4.docusign.net/restapi/v2.1/accounts/${accountId}`;

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listEnvelopes': {
                const params = new URLSearchParams();
                if (inputs.fromDate) params.set('from_date', inputs.fromDate);
                if (inputs.toDate) params.set('to_date', inputs.toDate);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.startPosition) params.set('start_position', String(inputs.startPosition));
                const res = await fetch(`${baseUrl}/envelopes?${params.toString()}`, { headers });
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
            case 'getEnvelopeStatus': {
                const res = await fetch(`${baseUrl}/envelopes/${inputs.envelopeId}?include=recipients,documents`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { envelopeId: data.envelopeId, status: data.status, statusDateTime: data.statusChangedDateTime, recipients: data.recipients } };
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
            case 'listDocuments': {
                const res = await fetch(`${baseUrl}/envelopes/${inputs.envelopeId}/documents`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getDocument': {
                const res = await fetch(`${baseUrl}/envelopes/${inputs.envelopeId}/documents/${inputs.documentId}`, { headers });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: err.message || `HTTP ${res.status}` };
                }
                const buffer = await res.arrayBuffer();
                return { output: { documentId: inputs.documentId, size: buffer.byteLength, contentType: res.headers.get('content-type') } };
            }
            case 'downloadDocument': {
                const res = await fetch(`${baseUrl}/envelopes/${inputs.envelopeId}/documents/${inputs.documentId || 'combined'}`, { headers });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: err.message || `HTTP ${res.status}` };
                }
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { base64, contentType: res.headers.get('content-type'), size: buffer.byteLength } };
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
                if (inputs.startPosition) params.set('start_position', String(inputs.startPosition));
                if (inputs.searchText) params.set('search_text', inputs.searchText);
                const res = await fetch(`${baseUrl}/templates?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'sendFromTemplate': {
                const body: any = {
                    templateId: inputs.templateId,
                    templateRoles: inputs.templateRoles || [],
                    status: inputs.status || 'sent',
                };
                if (inputs.emailSubject) body.emailSubject = inputs.emailSubject;
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
                return { error: `Unknown DocuSign Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`DocuSign Enhanced action error: ${err.message}`);
        return { error: err.message || 'Unknown error in DocuSign Enhanced action' };
    }
}
