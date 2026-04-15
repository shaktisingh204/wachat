'use server';

export async function executeDropboxSignAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');
    const baseUrl = 'https://api.hellosign.com/v3';

    const headers: Record<string, string> = {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'createSignatureRequest': {
                const res = await fetch(`${baseUrl}/signature_request/send`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        title: inputs.title,
                        subject: inputs.subject,
                        message: inputs.message,
                        signers: inputs.signers || [],
                        cc_email_addresses: inputs.ccEmailAddresses || [],
                        file_url: inputs.fileUrl ? [inputs.fileUrl] : undefined,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'getSignatureRequest': {
                const res = await fetch(`${baseUrl}/signature_request/${inputs.signatureRequestId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'listSignatureRequests': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/signature_request/list?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'cancelSignatureRequest': {
                const res = await fetch(`${baseUrl}/signature_request/cancel/${inputs.signatureRequestId}`, {
                    method: 'POST',
                    headers,
                });
                if (res.status === 200 || res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.error?.error_msg || JSON.stringify(data) };
            }
            case 'sendReminder': {
                const res = await fetch(`${baseUrl}/signature_request/remind/${inputs.signatureRequestId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ email_address: inputs.emailAddress }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'createEmbeddedSignUrl': {
                const res = await fetch(`${baseUrl}/embedded/sign_url/${inputs.signatureId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'getTemplate': {
                const res = await fetch(`${baseUrl}/template/${inputs.templateId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/template/list?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'createSignatureRequestWithTemplate': {
                const res = await fetch(`${baseUrl}/signature_request/send_with_template`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        template_id: inputs.templateId,
                        subject: inputs.subject,
                        message: inputs.message,
                        signers: inputs.signers || [],
                        ccs: inputs.ccs || [],
                        custom_fields: inputs.customFields || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'downloadFiles': {
                const params = new URLSearchParams();
                params.set('file_type', inputs.fileType || 'pdf');
                const res = await fetch(`${baseUrl}/signature_request/files/${inputs.signatureRequestId}?${params.toString()}`, { headers });
                if (!res.ok) return { error: `Failed to download files: ${res.status}` };
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { base64, contentType: res.headers.get('content-type') } };
            }
            case 'addUserToTeam': {
                const res = await fetch(`${baseUrl}/team/add_member`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        email_address: inputs.emailAddress,
                        role: inputs.role,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'createTeam': {
                const res = await fetch(`${baseUrl}/team/create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: inputs.name }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'getTeam': {
                const res = await fetch(`${baseUrl}/team`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'listTeamMembers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/team/members/${inputs.teamId || ''}?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'getAccount': {
                const res = await fetch(`${baseUrl}/account`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            default:
                return { error: `Dropbox Sign action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Dropbox Sign action error: ${err.message}`);
        return { error: err.message };
    }
}
