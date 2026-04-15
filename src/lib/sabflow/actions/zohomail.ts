'use server';

export async function executeZohoMailAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    const base = 'https://mail.zoho.com/api';
    const { accessToken, accountId } = inputs;

    if (!accessToken) return { error: 'accessToken is required' };
    if (!accountId) return { error: 'accountId is required' };

    const headers: Record<string, string> = {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
    };

    async function req(method: string, url: string, body?: any, query?: Record<string, string>) {
        let fullUrl = url;
        if (query) fullUrl += `?${new URLSearchParams(query).toString()}`;
        const res = await fetch(fullUrl, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`ZohoMail ${method} ${url} failed (${res.status}): ${text}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : { success: true };
    }

    try {
        switch (actionName) {
            case 'listFolders': {
                const data = await req('GET', `${base}/accounts/${accountId}/folders`);
                return { output: data };
            }

            case 'getFolder': {
                const { folderId } = inputs;
                if (!folderId) return { error: 'folderId is required' };
                const data = await req('GET', `${base}/accounts/${accountId}/folders/${folderId}`);
                return { output: data };
            }

            case 'createFolder': {
                const { folderName, parentFolderId } = inputs;
                if (!folderName) return { error: 'folderName is required' };
                const body: any = { folderName };
                if (parentFolderId) body.parentFolderId = parentFolderId;
                const data = await req('POST', `${base}/accounts/${accountId}/folders`, body);
                return { output: data };
            }

            case 'listMessages': {
                const { folderId, limit, start } = inputs;
                if (!folderId) return { error: 'folderId is required' };
                const query: Record<string, string> = { folderId: String(folderId) };
                if (limit) query.limit = String(limit);
                if (start) query.start = String(start);
                const data = await req('GET', `${base}/accounts/${accountId}/messages/view`, undefined, query);
                return { output: data };
            }

            case 'getMessage': {
                const { messageId } = inputs;
                if (!messageId) return { error: 'messageId is required' };
                const data = await req('GET', `${base}/accounts/${accountId}/messages/${messageId}/content`);
                return { output: data };
            }

            case 'sendMessage': {
                const { fromAddress, toAddress, subject, content, mailFormat } = inputs;
                if (!fromAddress || !toAddress || !subject || !content) {
                    return { error: 'fromAddress, toAddress, subject, and content are required' };
                }
                const body: any = {
                    fromAddress,
                    toAddress,
                    subject,
                    content,
                    mailFormat: mailFormat || 'html',
                };
                const data = await req('POST', `${base}/accounts/${accountId}/messages`, body);
                return { output: data };
            }

            case 'replyMessage': {
                const { messageId, content, mailFormat } = inputs;
                if (!messageId || !content) return { error: 'messageId and content are required' };
                const body: any = { content, mailFormat: mailFormat || 'html', mode: 'reply' };
                const data = await req('POST', `${base}/accounts/${accountId}/messages/${messageId}`, body);
                return { output: data };
            }

            case 'forwardMessage': {
                const { messageId, toAddress, content } = inputs;
                if (!messageId || !toAddress) return { error: 'messageId and toAddress are required' };
                const body: any = { toAddress, mode: 'forward' };
                if (content) body.content = content;
                const data = await req('POST', `${base}/accounts/${accountId}/messages/${messageId}`, body);
                return { output: data };
            }

            case 'moveMessage': {
                const { messageId, folderId } = inputs;
                if (!messageId || !folderId) return { error: 'messageId and folderId are required' };
                const data = await req('PUT', `${base}/accounts/${accountId}/messages/${messageId}`, { folderId });
                return { output: data };
            }

            case 'deleteMessage': {
                const { messageId } = inputs;
                if (!messageId) return { error: 'messageId is required' };
                const data = await req('DELETE', `${base}/accounts/${accountId}/messages/${messageId}`);
                return { output: data };
            }

            case 'searchMessages': {
                const { searchKey, folderId, limit } = inputs;
                if (!searchKey) return { error: 'searchKey is required' };
                const query: Record<string, string> = { searchKey: String(searchKey) };
                if (folderId) query.folderId = String(folderId);
                if (limit) query.limit = String(limit);
                const data = await req('GET', `${base}/accounts/${accountId}/messages/search`, undefined, query);
                return { output: data };
            }

            case 'listContacts': {
                const { limit, start } = inputs;
                const query: Record<string, string> = {};
                if (limit) query.limit = String(limit);
                if (start) query.start = String(start);
                const data = await req('GET', `${base}/accounts/${accountId}/contacts`, undefined, Object.keys(query).length ? query : undefined);
                return { output: data };
            }

            case 'getContact': {
                const { contactId } = inputs;
                if (!contactId) return { error: 'contactId is required' };
                const data = await req('GET', `${base}/accounts/${accountId}/contacts/${contactId}`);
                return { output: data };
            }

            case 'createContact': {
                const { email, firstName, lastName, phone } = inputs;
                if (!email) return { error: 'email is required' };
                const body: any = { email };
                if (firstName) body.firstName = firstName;
                if (lastName) body.lastName = lastName;
                if (phone) body.phone = phone;
                const data = await req('POST', `${base}/accounts/${accountId}/contacts`, body);
                return { output: data };
            }

            case 'updateContact': {
                const { contactId, email, firstName, lastName, phone } = inputs;
                if (!contactId) return { error: 'contactId is required' };
                const body: any = {};
                if (email) body.email = email;
                if (firstName) body.firstName = firstName;
                if (lastName) body.lastName = lastName;
                if (phone) body.phone = phone;
                const data = await req('PUT', `${base}/accounts/${accountId}/contacts/${contactId}`, body);
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
