'use server';

export async function executeAdobeSignEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const baseUri = String(inputs.baseUri ?? 'https://api.na4.adobesign.com/api/rest/v6').replace(/\/$/, '');

        switch (actionName) {
            case 'createAgreement': {
                const res = await fetch(`${baseUri}/agreements`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        fileInfos: inputs.fileInfos ?? [],
                        name: inputs.name ?? 'Agreement',
                        participantSetsInfo: inputs.participantSetsInfo ?? [],
                        signatureType: inputs.signatureType ?? 'ESIGN',
                        state: inputs.state ?? 'IN_PROCESS',
                        ...(inputs.message ? { message: inputs.message } : {}),
                        ...(inputs.emailOption ? { emailOption: inputs.emailOption } : {}),
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { agreement: data } };
            }

            case 'getAgreement': {
                const agreementId = String(inputs.agreementId ?? '').trim();
                const res = await fetch(`${baseUri}/agreements/${agreementId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { agreement: data } };
            }

            case 'listAgreements': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.set('cursor', String(inputs.cursor));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.query) params.set('query', String(inputs.query));
                const res = await fetch(`${baseUri}/agreements?${params.toString()}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { agreements: data } };
            }

            case 'sendAgreement': {
                const agreementId = String(inputs.agreementId ?? '').trim();
                const res = await fetch(`${baseUri}/agreements/${agreementId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ state: 'IN_PROCESS' }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'cancelAgreement': {
                const agreementId = String(inputs.agreementId ?? '').trim();
                const res = await fetch(`${baseUri}/agreements/${agreementId}/state`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        state: 'CANCELLED',
                        ...(inputs.comment ? { comment: inputs.comment } : {}),
                    }),
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'deleteAgreement': {
                const agreementId = String(inputs.agreementId ?? '').trim();
                const res = await fetch(`${baseUri}/agreements/${agreementId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'getAgreementDocuments': {
                const agreementId = String(inputs.agreementId ?? '').trim();
                const res = await fetch(`${baseUri}/agreements/${agreementId}/documents`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { documents: data } };
            }

            case 'downloadDocument': {
                const agreementId = String(inputs.agreementId ?? '').trim();
                const documentId = String(inputs.documentId ?? '').trim();
                const url = documentId
                    ? `${baseUri}/agreements/${agreementId}/documents/${documentId}`
                    : `${baseUri}/agreements/${agreementId}/combinedDocument`;
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData?.message || `Adobe Sign API error: ${res.status}`);
                }
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { fileBase64: base64, contentType: res.headers.get('content-type') ?? 'application/pdf' } };
            }

            case 'listSigningUrls': {
                const agreementId = String(inputs.agreementId ?? '').trim();
                const res = await fetch(`${baseUri}/agreements/${agreementId}/signingUrls`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { signingUrls: data } };
            }

            case 'createWidget': {
                const res = await fetch(`${baseUri}/widgets`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        fileInfos: inputs.fileInfos ?? [],
                        name: inputs.name ?? 'Widget',
                        state: inputs.state ?? 'ACTIVE',
                        ...(inputs.widgetParticipantSetInfo ? { widgetParticipantSetInfo: inputs.widgetParticipantSetInfo } : {}),
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { widget: data } };
            }

            case 'getWidget': {
                const widgetId = String(inputs.widgetId ?? '').trim();
                const res = await fetch(`${baseUri}/widgets/${widgetId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { widget: data } };
            }

            case 'listWidgets': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.set('cursor', String(inputs.cursor));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                const res = await fetch(`${baseUri}/widgets?${params.toString()}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { widgets: data } };
            }

            case 'createLibraryDocument': {
                const res = await fetch(`${baseUri}/libraryDocuments`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        fileInfos: inputs.fileInfos ?? [],
                        name: inputs.name ?? 'Library Document',
                        sharingMode: inputs.sharingMode ?? 'USER',
                        templateTypes: inputs.templateTypes ?? ['DOCUMENT'],
                        state: inputs.state ?? 'ACTIVE',
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { libraryDocument: data } };
            }

            case 'listLibraryDocuments': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.set('cursor', String(inputs.cursor));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                const res = await fetch(`${baseUri}/libraryDocuments?${params.toString()}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { libraryDocuments: data } };
            }

            case 'sendReminder': {
                const agreementId = String(inputs.agreementId ?? '').trim();
                const res = await fetch(`${baseUri}/agreements/${agreementId}/reminders`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        recipientParticipantIds: inputs.recipientParticipantIds ?? [],
                        ...(inputs.note ? { note: inputs.note } : {}),
                        status: inputs.status ?? 'ACTIVE',
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Adobe Sign API error: ${res.status}`);
                return { output: { reminder: data } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
