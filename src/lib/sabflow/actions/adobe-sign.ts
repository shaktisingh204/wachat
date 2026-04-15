'use server';

export async function executeAdobeSignAction(actionName: string, inputs: any, user: any, logger: any) {
    const accessToken = inputs.accessToken;
    const baseUrl = inputs.baseUrl || 'https://api.na1.adobesign.com/api/rest/v6';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'createAgreement': {
                const res = await fetch(`${baseUrl}/agreements`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        fileInfos: inputs.fileInfos || [],
                        name: inputs.name,
                        participantSetsInfo: inputs.participantSetsInfo || [],
                        signatureType: inputs.signatureType || 'ESIGN',
                        state: inputs.state || 'IN_PROCESS',
                        emailOption: inputs.emailOption,
                        reminderFrequency: inputs.reminderFrequency,
                        message: inputs.message,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getAgreement': {
                const res = await fetch(`${baseUrl}/agreements/${inputs.agreementId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listAgreements': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(`${baseUrl}/agreements?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'sendReminder': {
                const res = await fetch(`${baseUrl}/agreements/${inputs.agreementId}/reminders`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        recipientParticipantIds: inputs.recipientParticipantIds || [],
                        note: inputs.note,
                        status: inputs.status || 'ACTIVE',
                        firstReminderDelay: inputs.firstReminderDelay,
                        frequency: inputs.frequency,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'cancelAgreement': {
                const res = await fetch(`${baseUrl}/agreements/${inputs.agreementId}/state`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        state: 'CANCELLED',
                        agreementCancellationInfo: {
                            comment: inputs.comment || 'Cancelled via SabFlow',
                            notifyOtherParticipants: inputs.notifyOtherParticipants || false,
                        },
                    }),
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'deleteAgreement': {
                const res = await fetch(`${baseUrl}/agreements/${inputs.agreementId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.message || JSON.stringify(data) };
            }
            case 'downloadAgreement': {
                const res = await fetch(`${baseUrl}/agreements/${inputs.agreementId}/combinedDocument`, { headers });
                if (!res.ok) return { error: `Failed to download agreement: ${res.status}` };
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { base64, contentType: res.headers.get('content-type') } };
            }
            case 'getSigningUrl': {
                const res = await fetch(`${baseUrl}/agreements/${inputs.agreementId}/signingUrls`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createTransientDocument': {
                const formData = new FormData();
                if (inputs.fileUrl) {
                    const fileRes = await fetch(inputs.fileUrl);
                    const fileBuffer = await fileRes.arrayBuffer();
                    const blob = new Blob([fileBuffer], { type: inputs.mimeType || 'application/pdf' });
                    formData.append('File', blob, inputs.fileName || 'document.pdf');
                    formData.append('File-Name', inputs.fileName || 'document.pdf');
                    formData.append('Mime-Type', inputs.mimeType || 'application/pdf');
                }
                const uploadHeaders = { 'Authorization': `Bearer ${accessToken}` };
                const res = await fetch(`${baseUrl}/transientDocuments`, {
                    method: 'POST',
                    headers: uploadHeaders,
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listLibraryDocuments': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/libraryDocuments?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getLibraryDocument': {
                const res = await fetch(`${baseUrl}/libraryDocuments/${inputs.libraryDocumentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'createWebForm': {
                const res = await fetch(`${baseUrl}/widgets`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        fileInfos: inputs.fileInfos || [],
                        name: inputs.name,
                        widgetParticipantSetInfo: inputs.widgetParticipantSetInfo || {},
                        state: inputs.state || 'ACTIVE',
                        signatureType: inputs.signatureType || 'ESIGN',
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getWebForm': {
                const res = await fetch(`${baseUrl}/widgets/${inputs.widgetId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'listWebForms': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/widgets?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'getFormFields': {
                const res = await fetch(`${baseUrl}/agreements/${inputs.agreementId}/formFields`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            default:
                return { error: `Adobe Sign action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Adobe Sign action error: ${err.message}`);
        return { error: err.message };
    }
}
