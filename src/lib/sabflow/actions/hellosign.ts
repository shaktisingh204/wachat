'use server';

export async function executeHelloSignAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const baseUrl = 'https://api.hellosign.com/v3';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listSignatureRequests': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.accountId) params.set('account_id', inputs.accountId);
                const res = await fetch(`${baseUrl}/signature_request/list?${params.toString()}`, { headers });
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
            case 'sendSignatureRequest': {
                const res = await fetch(`${baseUrl}/signature_request/send`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        title: inputs.title,
                        subject: inputs.subject,
                        message: inputs.message,
                        signers: inputs.signers || [],
                        file_url: inputs.fileUrls || [],
                        file: inputs.files || [],
                        cc_email_addresses: inputs.ccEmailAddresses || [],
                        use_text_tags: inputs.useTextTags || false,
                        hide_text_tags: inputs.hideTextTags || false,
                        test_mode: inputs.testMode || 0,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'sendFromTemplate': {
                const res = await fetch(`${baseUrl}/signature_request/send_with_template`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        template_id: inputs.templateId,
                        template_ids: inputs.templateIds || [],
                        title: inputs.title,
                        subject: inputs.subject,
                        message: inputs.message,
                        signers: inputs.signers || [],
                        ccs: inputs.ccs || [],
                        custom_fields: inputs.customFields || [],
                        test_mode: inputs.testMode || 0,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'cancelSignatureRequest': {
                const res = await fetch(`${baseUrl}/signature_request/cancel/${inputs.signatureRequestId}`, {
                    method: 'POST',
                    headers,
                });
                if (res.status === 200 || res.status === 204) return { output: { cancelled: true, signatureRequestId: inputs.signatureRequestId } };
                const data = await res.json();
                return { error: data.error?.error_msg || JSON.stringify(data) };
            }
            case 'resendSignatureRequest': {
                const res = await fetch(`${baseUrl}/signature_request/remind/${inputs.signatureRequestId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ email_address: inputs.emailAddress }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.accountId) params.set('account_id', inputs.accountId);
                const res = await fetch(`${baseUrl}/template/list?${params.toString()}`, { headers });
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
            case 'getSignedDocument': {
                const res = await fetch(`${baseUrl}/signature_request/files/${inputs.signatureRequestId}?file_type=pdf`, { headers });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: err.error?.error_msg || `HTTP ${res.status}` };
                }
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { base64, contentType: 'application/pdf', size: buffer.byteLength } };
            }
            case 'downloadSignatureRequest': {
                const fileType = inputs.fileType || 'pdf';
                const res = await fetch(`${baseUrl}/signature_request/files/${inputs.signatureRequestId}?file_type=${fileType}&get_url=1`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'createEmbeddedSignatureRequest': {
                const res = await fetch(`${baseUrl}/signature_request/create_embedded`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        client_id: inputs.clientId,
                        title: inputs.title,
                        subject: inputs.subject,
                        message: inputs.message,
                        signers: inputs.signers || [],
                        file_url: inputs.fileUrls || [],
                        test_mode: inputs.testMode || 0,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'getEmbeddedSignUrl': {
                const res = await fetch(`${baseUrl}/embedded/sign_url/${inputs.signatureId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'listTeam': {
                const res = await fetch(`${baseUrl}/team`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'addTeamMember': {
                const res = await fetch(`${baseUrl}/team/add_member`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ email_address: inputs.emailAddress, account_id: inputs.accountId }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            case 'listApiApps': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/api_app/list?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.error_msg || JSON.stringify(data) };
                return { output: data };
            }
            default:
                return { error: `Unknown HelloSign action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`HelloSign action error: ${err.message}`);
        return { error: err.message || 'Unknown error in HelloSign action' };
    }
}
