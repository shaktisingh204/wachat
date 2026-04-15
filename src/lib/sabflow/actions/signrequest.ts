'use server';

export async function executeSignRequestAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiToken = inputs.apiToken;
    const baseUrl = 'https://signrequest.com/api/v1';

    const headers: Record<string, string> = {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listDocuments': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(`${baseUrl}/documents/?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'getDocument': {
                const res = await fetch(`${baseUrl}/documents/${inputs.documentUuid}/`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'createDocument': {
                const res = await fetch(`${baseUrl}/documents/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        file_from_url: inputs.fileFromUrl,
                        file_from_content: inputs.fileFromContent,
                        file_from_content_name: inputs.fileFromContentName,
                        name: inputs.name,
                        external_id: inputs.externalId,
                        prefill_tags: inputs.prefillTags || [],
                        team: inputs.team,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'createSignRequest': {
                const res = await fetch(`${baseUrl}/signrequests/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        document: inputs.document,
                        from_email: inputs.fromEmail,
                        from_email_name: inputs.fromEmailName,
                        message: inputs.message,
                        subject: inputs.subject,
                        signers: inputs.signers || [],
                        redirect_url: inputs.redirectUrl,
                        redirect_url_declined: inputs.redirectUrlDeclined,
                        require_attachment: inputs.requireAttachment || false,
                        send_reminders: inputs.sendReminders || false,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'getSignRequest': {
                const res = await fetch(`${baseUrl}/signrequests/${inputs.signRequestUuid}/`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'listSignRequests': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.document) params.set('document', inputs.document);
                const res = await fetch(`${baseUrl}/signrequests/?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'cancelSignRequest': {
                const res = await fetch(`${baseUrl}/signrequests/${inputs.signRequestUuid}/cancel_signrequest/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: { cancelled: true, ...data } };
            }
            case 'resendSignRequest': {
                const res = await fetch(`${baseUrl}/signrequests/${inputs.signRequestUuid}/resend_signrequest_email/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: { resent: true, ...data } };
            }
            case 'downloadSignedDocument': {
                const res = await fetch(`${baseUrl}/documents/${inputs.documentUuid}/`, { headers });
                const doc = await res.json();
                if (!res.ok) return { error: doc.detail || JSON.stringify(doc) };
                const downloadUrl = doc.pdf || doc.file;
                if (!downloadUrl) return { error: 'No download URL available for this document' };
                const dlRes = await fetch(downloadUrl, { headers: { 'Authorization': `Token ${apiToken}` } });
                if (!dlRes.ok) return { error: `Failed to download document: HTTP ${dlRes.status}` };
                const buffer = await dlRes.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { base64, contentType: 'application/pdf', size: buffer.byteLength, downloadUrl } };
            }
            case 'listTeams': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/teams/?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'getTeam': {
                const res = await fetch(`${baseUrl}/teams/${inputs.teamSubdomain}/`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'listMembers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.team) params.set('team', inputs.team);
                const res = await fetch(`${baseUrl}/teammembers/?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'addMember': {
                const res = await fetch(`${baseUrl}/teammembers/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        team: inputs.team,
                        user: { email: inputs.email, first_name: inputs.firstName, last_name: inputs.lastName },
                        is_admin: inputs.isAdmin || false,
                        is_owner: inputs.isOwner || false,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            case 'removeMember': {
                const res = await fetch(`${baseUrl}/teammembers/${inputs.memberId}/`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { removed: true, memberId: inputs.memberId } };
                const data = await res.json().catch(() => ({}));
                return { error: data.detail || `HTTP ${res.status}` };
            }
            case 'createWebhook': {
                const res = await fetch(`${baseUrl}/webhooks/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        url: inputs.url,
                        event_types: inputs.eventTypes || ['convert_error', 'signed', 'declined', 'cancelled', 'viewed'],
                        name: inputs.name,
                        team: inputs.team,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || JSON.stringify(data) };
                return { output: data };
            }
            default:
                return { error: `Unknown SignRequest action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`SignRequest action error: ${err.message}`);
        return { error: err.message || 'Unknown error in SignRequest action' };
    }
}
