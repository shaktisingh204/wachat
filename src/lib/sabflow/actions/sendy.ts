
'use server';

async function sendyFetch(serverUrl: string, path: string, fields: Record<string, string>, logger?: any) {
    const url = `${serverUrl.replace(/\/$/, '')}${path}`;
    logger?.log(`[Sendy] POST ${url}`);
    const body = new URLSearchParams(fields).toString();
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body,
    });
    const text = await res.text();
    // Sendy returns plain text responses (1, true, Already subscribed, etc.)
    return text.trim();
}

export async function executeSendyAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!serverUrl) throw new Error('serverUrl is required.');
        if (!apiKey) throw new Error('apiKey is required.');
        const sendy = (path: string, fields: Record<string, string>) => sendyFetch(serverUrl, path, { api_key: apiKey, ...fields }, logger);

        switch (actionName) {
            case 'subscribe': {
                const email = String(inputs.email ?? '').trim();
                const listId = String(inputs.listId ?? '').trim();
                if (!email || !listId) throw new Error('email and listId are required.');
                const fields: Record<string, string> = { email, list: listId };
                if (inputs.name) fields.name = String(inputs.name);
                if (inputs.country) fields.country = String(inputs.country);
                if (inputs.ipaddress) fields.ipaddress = String(inputs.ipaddress);
                if (inputs.referrer) fields.referrer = String(inputs.referrer);
                if (inputs.gdpr !== undefined) fields.gdpr = inputs.gdpr ? 'true' : 'false';
                const result = await sendy('/subscribe', fields);
                const success = result === '1' || result.toLowerCase() === 'true';
                if (!success && result !== 'Already subscribed.') {
                    throw new Error(result || 'Subscribe failed.');
                }
                return { output: { success: true, status: result } };
            }

            case 'unsubscribe': {
                const email = String(inputs.email ?? '').trim();
                const listId = String(inputs.listId ?? '').trim();
                if (!email || !listId) throw new Error('email and listId are required.');
                const result = await sendy('/unsubscribe', { email, list: listId });
                const success = result === '1' || result.toLowerCase() === 'true';
                if (!success) throw new Error(result || 'Unsubscribe failed.');
                return { output: { success: true, status: result } };
            }

            case 'deleteSubscriber': {
                const email = String(inputs.email ?? '').trim();
                const listId = String(inputs.listId ?? '').trim();
                if (!email || !listId) throw new Error('email and listId are required.');
                const result = await sendy('/api/subscribers/delete.php', { email, list_id: listId });
                const success = result === '1' || result.toLowerCase() === 'true';
                if (!success) throw new Error(result || 'Delete subscriber failed.');
                return { output: { success: true, status: result } };
            }

            case 'getSubscriberCount': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const result = await sendy('/api/subscribers/active-subscriber-count.php', { list_id: listId });
                const count = parseInt(result, 10);
                if (isNaN(count)) throw new Error(result || 'Failed to get subscriber count.');
                return { output: { count } };
            }

            case 'getSubscriberStatus': {
                const email = String(inputs.email ?? '').trim();
                const listId = String(inputs.listId ?? '').trim();
                if (!email || !listId) throw new Error('email and listId are required.');
                const result = await sendy('/api/subscribers/subscription-status.php', { email, list_id: listId });
                return { output: { status: result } };
            }

            case 'createCampaign': {
                const fromName = String(inputs.fromName ?? '').trim();
                const fromEmail = String(inputs.fromEmail ?? '').trim();
                const replyTo = String(inputs.replyTo ?? inputs.fromEmail ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const htmlText = String(inputs.htmlText ?? inputs.html ?? '').trim();
                const listIds = String(inputs.listIds ?? inputs.listId ?? '').trim();
                if (!fromName || !fromEmail || !subject || !htmlText || !listIds) {
                    throw new Error('fromName, fromEmail, subject, htmlText, and listIds are required.');
                }
                const fields: Record<string, string> = {
                    from_name: fromName,
                    from_email: fromEmail,
                    reply_to: replyTo,
                    subject,
                    html_text: htmlText,
                    list_ids: listIds,
                    send_campaign: '0',
                };
                if (inputs.plainText) fields.plain_text = String(inputs.plainText);
                if (inputs.title) fields.title = String(inputs.title);
                if (inputs.queryString) fields.query_string = String(inputs.queryString);
                const result = await sendy('/api/campaigns/create.php', fields);
                const campaignId = parseInt(result, 10);
                if (isNaN(campaignId)) throw new Error(result || 'Create campaign failed.');
                return { output: { campaignId: String(campaignId), success: true } };
            }

            case 'sendCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const result = await sendy('/api/campaigns/send.php', { campaign_id: campaignId });
                const success = result === '1' || result.toLowerCase() === 'campaign sent';
                if (!success) throw new Error(result || 'Send campaign failed.');
                return { output: { success: true, status: result } };
            }

            case 'getBrands': {
                const result = await sendy('/api/brands/get-brands.php', {});
                // Sendy returns CSV or JSON depending on version; attempt JSON parse
                let brands: any = result;
                try { brands = JSON.parse(result); } catch { /* plain text */ }
                return { output: { brands } };
            }

            case 'getLists': {
                const brandId = String(inputs.brandId ?? inputs.brand_id ?? '').trim();
                if (!brandId) throw new Error('brandId is required.');
                const result = await sendy('/api/lists/get-lists.php', { brand_id: brandId });
                let lists: any = result;
                try { lists = JSON.parse(result); } catch { /* plain text */ }
                return { output: { lists } };
            }

            default:
                return { error: `Sendy action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Sendy action failed.' };
    }
}
