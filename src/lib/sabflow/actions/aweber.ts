'use server';

export async function executeAWeberAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.aweber.com/1.0';
        const accessToken = inputs.accessToken;

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listAccounts': {
                url = `${baseUrl}/accounts`;
                break;
            }
            case 'getAccount': {
                url = `${baseUrl}/accounts/${inputs.accountId}`;
                break;
            }
            case 'listLists': {
                url = `${baseUrl}/accounts/${inputs.accountId}/lists`;
                break;
            }
            case 'getList': {
                url = `${baseUrl}/accounts/${inputs.accountId}/lists/${inputs.listId}`;
                break;
            }
            case 'createList': {
                method = 'POST';
                url = `${baseUrl}/accounts/${inputs.accountId}/lists`;
                body = JSON.stringify({
                    name: inputs.name,
                    email_address: inputs.emailAddress,
                    from_name: inputs.fromName,
                    landing_page_url: inputs.landingPageUrl,
                });
                break;
            }
            case 'listSubscribers': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.ws_size) params.set('ws.size', String(inputs.ws_size));
                if (inputs.ws_start) params.set('ws.start', String(inputs.ws_start));
                url = `${baseUrl}/accounts/${inputs.accountId}/lists/${inputs.listId}/subscribers?${params.toString()}`;
                break;
            }
            case 'getSubscriber': {
                url = `${baseUrl}/accounts/${inputs.accountId}/lists/${inputs.listId}/subscribers/${inputs.subscriberId}`;
                break;
            }
            case 'createSubscriber': {
                method = 'POST';
                url = `${baseUrl}/accounts/${inputs.accountId}/lists/${inputs.listId}/subscribers`;
                body = JSON.stringify({
                    email: inputs.email,
                    name: inputs.name,
                    ad_tracking: inputs.adTracking,
                    misc_notes: inputs.miscNotes,
                    custom_fields: inputs.customFields || {},
                    tags: inputs.tags || [],
                    status: inputs.status || 'subscribed',
                    update_existing: inputs.updateExisting || false,
                    ip_address: inputs.ipAddress,
                });
                break;
            }
            case 'updateSubscriber': {
                method = 'PATCH';
                url = `${baseUrl}/accounts/${inputs.accountId}/lists/${inputs.listId}/subscribers/${inputs.subscriberId}`;
                body = JSON.stringify({
                    name: inputs.name,
                    custom_fields: inputs.customFields,
                    tags: inputs.tags,
                    status: inputs.status,
                });
                break;
            }
            case 'deleteSubscriber': {
                method = 'DELETE';
                url = `${baseUrl}/accounts/${inputs.accountId}/lists/${inputs.listId}/subscribers/${inputs.subscriberId}`;
                break;
            }
            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.msgType) params.set('msg_type', inputs.msgType);
                url = `${baseUrl}/accounts/${inputs.accountId}/lists/${inputs.listId}/messages?${params.toString()}`;
                break;
            }
            case 'getMessage': {
                url = `${baseUrl}/accounts/${inputs.accountId}/lists/${inputs.listId}/messages/${inputs.messageId}`;
                break;
            }
            case 'sendBroadcast': {
                method = 'POST';
                url = `${baseUrl}/accounts/${inputs.accountId}/lists/${inputs.listId}/messages/broadcasts`;
                body = JSON.stringify({
                    subject: inputs.subject,
                    body_html: inputs.bodyHtml,
                    body_text: inputs.bodyText,
                    from_name: inputs.fromName,
                    is_archived: inputs.isArchived || false,
                    click_tracking_enabled: inputs.clickTrackingEnabled !== false,
                    open_tracking_enabled: inputs.openTrackingEnabled !== false,
                });
                break;
            }
            case 'listCampaigns': {
                url = `${baseUrl}/accounts/${inputs.accountId}/lists/${inputs.listId}/campaigns`;
                break;
            }
            case 'getStats': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('start_date', inputs.startDate);
                if (inputs.endDate) params.set('end_date', inputs.endDate);
                url = `${baseUrl}/accounts/${inputs.accountId}/lists/${inputs.listId}/stats?${params.toString()}`;
                break;
            }
            default:
                return { error: `Unknown AWeber action: ${actionName}` };
        }

        const fetchOptions: RequestInit = { method, headers };
        if (body !== undefined) fetchOptions.body = body;

        const response = await fetch(url, fetchOptions);
        const text = await response.text();
        let data: any;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }

        if (!response.ok) {
            return { error: `AWeber API error ${response.status}: ${text}` };
        }

        return { output: data };
    } catch (err: any) {
        logger.log(`AWeber action error: ${err.message}`);
        return { error: err.message || 'Unknown error in AWeber action' };
    }
}
