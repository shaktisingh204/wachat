'use server';

export async function executeCampaignMonitorAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.createsend.com/api/v3.3';
        const authHeader = 'Basic ' + Buffer.from(inputs.apiKey + ':x').toString('base64');

        const headers: Record<string, string> = {
            Authorization: authHeader,
            'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: string | undefined;

        switch (actionName) {
            case 'listClients': {
                url = `${baseUrl}/clients.json`;
                break;
            }
            case 'getClient': {
                url = `${baseUrl}/clients/${inputs.clientId}.json`;
                break;
            }
            case 'createClient': {
                method = 'POST';
                url = `${baseUrl}/clients.json`;
                body = JSON.stringify({
                    CompanyName: inputs.companyName,
                    Country: inputs.country,
                    TimeZone: inputs.timeZone ?? '(GMT+00:00) UTC',
                });
                break;
            }
            case 'listCampaigns': {
                url = `${baseUrl}/clients/${inputs.clientId}/campaigns.json`;
                break;
            }
            case 'getCampaign': {
                url = `${baseUrl}/campaigns/${inputs.campaignId}/summary.json`;
                break;
            }
            case 'createCampaign': {
                method = 'POST';
                url = `${baseUrl}/campaigns/${inputs.clientId}.json`;
                body = JSON.stringify({
                    Name: inputs.name,
                    Subject: inputs.subject,
                    FromName: inputs.fromName,
                    FromEmail: inputs.fromEmail,
                    ReplyTo: inputs.replyTo,
                    HtmlUrl: inputs.htmlUrl,
                    TextUrl: inputs.textUrl,
                    ListIDs: inputs.listIds ?? [],
                    SegmentIDs: inputs.segmentIds ?? [],
                });
                break;
            }
            case 'sendCampaign': {
                method = 'POST';
                url = `${baseUrl}/campaigns/${inputs.campaignId}/send.json`;
                body = JSON.stringify({
                    ConfirmationEmail: inputs.confirmationEmail,
                    SendDate: inputs.sendDate ?? 'immediately',
                });
                break;
            }
            case 'listSubscriberLists': {
                url = `${baseUrl}/clients/${inputs.clientId}/lists.json`;
                break;
            }
            case 'getSubscriberList': {
                url = `${baseUrl}/lists/${inputs.listId}.json`;
                break;
            }
            case 'createList': {
                method = 'POST';
                url = `${baseUrl}/lists/${inputs.clientId}.json`;
                body = JSON.stringify({
                    Title: inputs.title,
                    UnsubscribePage: inputs.unsubscribePage ?? '',
                    ConfirmedOptIn: inputs.confirmedOptIn ?? false,
                    ConfirmationSuccessPage: inputs.confirmationSuccessPage ?? '',
                    UnsubscribeSetting: inputs.unsubscribeSetting ?? 'AllClientLists',
                });
                break;
            }
            case 'addSubscriber': {
                method = 'POST';
                url = `${baseUrl}/subscribers/${inputs.listId}.json`;
                body = JSON.stringify({
                    EmailAddress: inputs.email,
                    Name: inputs.name ?? '',
                    CustomFields: inputs.customFields ?? [],
                    Resubscribe: inputs.resubscribe ?? true,
                    ConsentToTrack: inputs.consentToTrack ?? 'Unchanged',
                });
                break;
            }
            case 'updateSubscriber': {
                method = 'PUT';
                url = `${baseUrl}/subscribers/${inputs.listId}.json?email=${encodeURIComponent(inputs.email)}`;
                body = JSON.stringify({
                    EmailAddress: inputs.newEmail ?? inputs.email,
                    Name: inputs.name,
                    CustomFields: inputs.customFields ?? [],
                    Resubscribe: inputs.resubscribe ?? false,
                    ConsentToTrack: inputs.consentToTrack ?? 'Unchanged',
                });
                break;
            }
            case 'unsubscribe': {
                method = 'POST';
                url = `${baseUrl}/subscribers/${inputs.listId}/unsubscribe.json`;
                body = JSON.stringify({ EmailAddress: inputs.email });
                break;
            }
            case 'listSegments': {
                url = `${baseUrl}/lists/${inputs.listId}/segments.json`;
                break;
            }
            case 'createSegment': {
                method = 'POST';
                url = `${baseUrl}/segments/${inputs.listId}.json`;
                body = JSON.stringify({
                    Title: inputs.title,
                    RuleGroups: inputs.ruleGroups ?? [],
                });
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

        if (response.status === 200 && method === 'DELETE') {
            return { output: { success: true } };
        }

        let data: any;
        const text = await response.text();
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = { raw: text };
        }

        if (!response.ok) {
            return { error: data?.Message ?? data?.Code ?? JSON.stringify(data) };
        }

        return { output: data };
    } catch (err: any) {
        logger?.error?.('executeCampaignMonitorAction error', err);
        return { error: err?.message ?? 'Unknown error' };
    }
}
