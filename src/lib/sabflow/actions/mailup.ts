
'use server';

const MAILUP_BASE = 'https://services.mailup.com/API/v1.1/Rest/ConsoleService.svc';
const MAILUP_TOKEN_URL = 'https://services.mailup.com/Authorization/OAuth/Token';

async function getMailupToken(inputs: any): Promise<string> {
    const clientId = String(inputs.clientId ?? '').trim();
    const clientSecret = String(inputs.clientSecret ?? '').trim();
    const username = String(inputs.username ?? '').trim();
    const password = String(inputs.password ?? '').trim();
    if (!clientId) throw new Error('clientId is required.');
    if (!clientSecret) throw new Error('clientSecret is required.');
    if (!username) throw new Error('username is required.');
    if (!password) throw new Error('password is required.');

    const body = new URLSearchParams({
        grant_type: 'password',
        client_id: clientId,
        client_secret: clientSecret,
        username,
        password,
    });

    const res = await fetch(MAILUP_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
        throw new Error(data?.error_description || data?.error || `MailUp auth error ${res.status}`);
    }
    return String(data.access_token);
}

async function mailupFetch(
    method: string,
    path: string,
    token: string,
    body?: any
): Promise<any> {
    const res = await fetch(`${MAILUP_BASE}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return { success: true };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.Message || data?.message || `MailUp API error ${res.status}`);
    }
    return data;
}

export async function executeMailupAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const token = await getMailupToken(inputs);

        switch (actionName) {
            case 'getLists': {
                const data = await mailupFetch('GET', '/Console/User/Lists', token);
                logger.log(`[MailUp] getLists`);
                return { output: data };
            }

            case 'getList': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const data = await mailupFetch('GET', `/Console/User/List/${listId}`, token);
                logger.log(`[MailUp] getList ${listId}`);
                return { output: data };
            }

            case 'getGroups': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const data = await mailupFetch('GET', `/Console/List/${listId}/Groups`, token);
                logger.log(`[MailUp] getGroups for list ${listId}`);
                return { output: data };
            }

            case 'addGroupToList': {
                const listId = String(inputs.listId ?? '').trim();
                const groupName = String(inputs.groupName ?? '').trim();
                const notes = String(inputs.notes ?? '');
                if (!listId) throw new Error('listId is required.');
                if (!groupName) throw new Error('groupName is required.');
                const data = await mailupFetch('POST', `/Console/List/${listId}/Group`, token, {
                    Name: groupName,
                    Notes: notes,
                });
                logger.log(`[MailUp] addGroupToList "${groupName}" to list ${listId}`);
                return { output: data };
            }

            case 'getRecipients': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const status = inputs.status || 'Subscribed';
                const data = await mailupFetch('GET', `/Console/List/${listId}/Recipients/${status}`, token);
                logger.log(`[MailUp] getRecipients from list ${listId}`);
                return { output: data };
            }

            case 'addRecipient': {
                const listId = String(inputs.listId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                if (!email) throw new Error('email is required.');
                const recipientBody: any = { Email: email };
                if (inputs.name) recipientBody.Name = String(inputs.name);
                if (inputs.fields) recipientBody.Fields = inputs.fields;
                const data = await mailupFetch('POST', `/Console/List/${listId}/Recipient`, token, recipientBody);
                logger.log(`[MailUp] addRecipient ${email} to list ${listId}`);
                return { output: data };
            }

            case 'deleteRecipient': {
                const listId = String(inputs.listId ?? '').trim();
                const recipientId = String(inputs.recipientId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                if (!recipientId) throw new Error('recipientId is required.');
                const data = await mailupFetch('DELETE', `/Console/List/${listId}/Unsubscribe/${recipientId}`, token);
                logger.log(`[MailUp] deleteRecipient ${recipientId} from list ${listId}`);
                return { output: { deleted: true, recipientId } };
            }

            case 'getMessages': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const data = await mailupFetch('GET', `/Console/List/${listId}/Emails`, token);
                logger.log(`[MailUp] getMessages for list ${listId}`);
                return { output: data };
            }

            case 'createMessage': {
                const listId = String(inputs.listId ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                if (!subject) throw new Error('subject is required.');
                const data = await mailupFetch('POST', `/Console/List/${listId}/Email`, token, {
                    Subject: subject,
                    Body: body,
                    Notes: inputs.notes || '',
                    Tags: inputs.tags || [],
                });
                logger.log(`[MailUp] createMessage "${subject}" for list ${listId}`);
                return { output: data };
            }

            case 'sendMessage': {
                const listId = String(inputs.listId ?? '').trim();
                const msgId = String(inputs.messageId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                if (!msgId) throw new Error('messageId is required.');
                const data = await mailupFetch('POST', `/Console/List/${listId}/Email/${msgId}/Send`, token);
                logger.log(`[MailUp] sendMessage ${msgId} for list ${listId}`);
                return { output: data };
            }

            case 'scheduleMessage': {
                const listId = String(inputs.listId ?? '').trim();
                const msgId = String(inputs.messageId ?? '').trim();
                const sendDate = String(inputs.sendDate ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                if (!msgId) throw new Error('messageId is required.');
                if (!sendDate) throw new Error('sendDate is required.');
                const data = await mailupFetch('POST', `/Console/List/${listId}/Email/${msgId}/Send`, token, {
                    Datetime: sendDate,
                });
                logger.log(`[MailUp] scheduleMessage ${msgId} at ${sendDate}`);
                return { output: data };
            }

            case 'getStatistics': {
                const listId = String(inputs.listId ?? '').trim();
                const msgId = String(inputs.messageId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                if (!msgId) throw new Error('messageId is required.');
                const data = await mailupFetch('GET', `/Console/List/${listId}/Email/${msgId}/Count/Sending/Delivered`, token);
                logger.log(`[MailUp] getStatistics for message ${msgId}`);
                return { output: data };
            }

            case 'getDeliveryReport': {
                const listId = String(inputs.listId ?? '').trim();
                const msgId = String(inputs.messageId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                if (!msgId) throw new Error('messageId is required.');
                const data = await mailupFetch('GET', `/Console/List/${listId}/Email/${msgId}/Sending/Existing`, token);
                logger.log(`[MailUp] getDeliveryReport for message ${msgId}`);
                return { output: data };
            }

            case 'updateRecipient': {
                const listId = String(inputs.listId ?? '').trim();
                const recipientId = String(inputs.recipientId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                if (!recipientId) throw new Error('recipientId is required.');
                const updateBody: any = { idRecipient: recipientId };
                if (inputs.email) updateBody.Email = String(inputs.email);
                if (inputs.name) updateBody.Name = String(inputs.name);
                if (inputs.fields) updateBody.Fields = inputs.fields;
                const data = await mailupFetch('PUT', `/Console/List/${listId}/Recipient`, token, updateBody);
                logger.log(`[MailUp] updateRecipient ${recipientId}`);
                return { output: data };
            }

            default:
                throw new Error(`MailUp action "${actionName}" is not implemented.`);
        }
    } catch (err: any) {
        const message = err?.message || 'Unknown MailUp error';
        logger.log(`[MailUp] Error: ${message}`);
        return { error: message };
    }
}
