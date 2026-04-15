'use server';

export async function executeMailchimpEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const dc = (inputs.apiKey as string).split('-').pop();
        const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;
        const authHeader = 'Basic ' + Buffer.from('anystring:' + inputs.apiKey).toString('base64');

        const headers: Record<string, string> = {
            Authorization: authHeader,
            'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: string | undefined;

        switch (actionName) {
            case 'listLists': {
                const count = inputs.count ?? 10;
                const offset = inputs.offset ?? 0;
                url = `${baseUrl}/lists?count=${count}&offset=${offset}`;
                break;
            }
            case 'getList': {
                url = `${baseUrl}/lists/${inputs.listId}`;
                break;
            }
            case 'createList': {
                method = 'POST';
                url = `${baseUrl}/lists`;
                body = JSON.stringify({
                    name: inputs.name,
                    contact: inputs.contact,
                    permission_reminder: inputs.permissionReminder ?? 'You are receiving this email because you opted in.',
                    email_type_option: inputs.emailTypeOption ?? false,
                    campaign_defaults: inputs.campaignDefaults ?? {
                        from_name: inputs.fromName,
                        from_email: inputs.fromEmail,
                        subject: inputs.subject ?? '',
                        language: inputs.language ?? 'en',
                    },
                });
                break;
            }
            case 'listMembers': {
                const count = inputs.count ?? 10;
                const offset = inputs.offset ?? 0;
                url = `${baseUrl}/lists/${inputs.listId}/members?count=${count}&offset=${offset}`;
                break;
            }
            case 'getMember': {
                const emailHash = Buffer.from((inputs.email as string).toLowerCase()).toString('hex');
                url = `${baseUrl}/lists/${inputs.listId}/members/${emailHash}`;
                break;
            }
            case 'addMember': {
                method = 'POST';
                url = `${baseUrl}/lists/${inputs.listId}/members`;
                body = JSON.stringify({
                    email_address: inputs.email,
                    status: inputs.status ?? 'subscribed',
                    merge_fields: inputs.mergeFields ?? {},
                    tags: inputs.tags ?? [],
                });
                break;
            }
            case 'updateMember': {
                method = 'PATCH';
                const emailHash = Buffer.from((inputs.email as string).toLowerCase()).toString('hex');
                url = `${baseUrl}/lists/${inputs.listId}/members/${emailHash}`;
                body = JSON.stringify({
                    status: inputs.status,
                    merge_fields: inputs.mergeFields,
                    tags: inputs.tags,
                });
                break;
            }
            case 'removeMember': {
                method = 'DELETE';
                const emailHash = Buffer.from((inputs.email as string).toLowerCase()).toString('hex');
                url = `${baseUrl}/lists/${inputs.listId}/members/${emailHash}`;
                break;
            }
            case 'listCampaigns': {
                const count = inputs.count ?? 10;
                const offset = inputs.offset ?? 0;
                url = `${baseUrl}/campaigns?count=${count}&offset=${offset}`;
                break;
            }
            case 'getCampaign': {
                url = `${baseUrl}/campaigns/${inputs.campaignId}`;
                break;
            }
            case 'createCampaign': {
                method = 'POST';
                url = `${baseUrl}/campaigns`;
                body = JSON.stringify({
                    type: inputs.type ?? 'regular',
                    recipients: { list_id: inputs.listId },
                    settings: {
                        subject_line: inputs.subjectLine,
                        from_name: inputs.fromName,
                        reply_to: inputs.replyTo,
                        title: inputs.title,
                    },
                });
                break;
            }
            case 'sendCampaign': {
                method = 'POST';
                url = `${baseUrl}/campaigns/${inputs.campaignId}/actions/send`;
                body = JSON.stringify({});
                break;
            }
            case 'listTemplates': {
                const count = inputs.count ?? 10;
                const offset = inputs.offset ?? 0;
                url = `${baseUrl}/templates?count=${count}&offset=${offset}`;
                break;
            }
            case 'getTemplate': {
                url = `${baseUrl}/templates/${inputs.templateId}`;
                break;
            }
            case 'getStats': {
                url = `${baseUrl}/campaigns/${inputs.campaignId}/send-checklist`;
                break;
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }

        const response = await fetch(url, {
            method,
            headers,
            body,
        });

        if (method === 'DELETE' && response.status === 204) {
            return { output: { success: true } };
        }

        const data = await response.json();

        if (!response.ok) {
            return { error: data.detail ?? data.title ?? JSON.stringify(data) };
        }

        return { output: data };
    } catch (err: any) {
        logger?.error?.('executeMailchimpEnhancedAction error', err);
        return { error: err?.message ?? 'Unknown error' };
    }
}
