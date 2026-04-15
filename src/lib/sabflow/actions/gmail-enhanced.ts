'use server';

async function req(accessToken: string, method: string, url: string, body?: any, logger?: any) {
    logger?.log(`[GmailEnhanced] ${method} ${url}`);
    const opts: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Gmail API error ${res.status}`);
    return data;
}

function buildBase64Email(params: { to: string; subject: string; body: string; cc?: string; bcc?: string; from?: string }): string {
    const lines: string[] = [];
    if (params.from) lines.push(`From: ${params.from}`);
    lines.push(`To: ${params.to}`);
    if (params.cc) lines.push(`Cc: ${params.cc}`);
    if (params.bcc) lines.push(`Bcc: ${params.bcc}`);
    lines.push(`Subject: ${params.subject}`);
    lines.push('MIME-Version: 1.0');
    const isHtml = /<[a-z][\s\S]*>/i.test(params.body);
    lines.push(isHtml ? 'Content-Type: text/html; charset="UTF-8"' : 'Content-Type: text/plain; charset="UTF-8"');
    const rfc822 = lines.join('\r\n') + '\r\n\r\n' + params.body;
    return Buffer.from(rfc822).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function executeGmailEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const userId = String(inputs.userId ?? 'me').trim();
        const BASE = `https://gmail.googleapis.com/gmail/v1/users/${userId}`;

        const g = (method: string, path: string, body?: any) => req(accessToken, method, `${BASE}${path}`, body, logger);

        switch (actionName) {
            case 'listMessages': {
                const maxResults = Number(inputs.maxResults ?? 20);
                const query = String(inputs.query ?? '').trim();
                const pageToken = String(inputs.pageToken ?? '').trim();
                let path = `/messages?maxResults=${maxResults}&format=minimal`;
                if (query) path += `&q=${encodeURIComponent(query)}`;
                if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
                const data = await g('GET', path);
                return { output: { messages: data.messages ?? [], resultSizeEstimate: data.resultSizeEstimate ?? 0, nextPageToken: data.nextPageToken ?? '' } };
            }

            case 'getMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');
                const format = String(inputs.format ?? 'full').trim();
                const data = await g('GET', `/messages/${messageId}?format=${format}`);
                return { output: { id: data.id, threadId: data.threadId ?? '', labelIds: data.labelIds ?? [], snippet: data.snippet ?? '', payload: data.payload ?? {}, internalDate: data.internalDate ?? '' } };
            }

            case 'sendMessage': {
                const to = String(inputs.to ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const body = String(inputs.body ?? '');
                if (!to || !subject) throw new Error('to and subject are required.');
                const raw = buildBase64Email({
                    to, subject, body,
                    cc: inputs.cc ? String(inputs.cc) : undefined,
                    bcc: inputs.bcc ? String(inputs.bcc) : undefined,
                    from: inputs.from ? String(inputs.from) : undefined,
                });
                const data = await g('POST', '/messages/send', { raw });
                return { output: { messageId: data.id ?? '', threadId: data.threadId ?? '', labelIds: data.labelIds ?? [] } };
            }

            case 'draftMessage': {
                const to = String(inputs.to ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const body = String(inputs.body ?? '');
                if (!to || !subject) throw new Error('to and subject are required.');
                const raw = buildBase64Email({
                    to, subject, body,
                    cc: inputs.cc ? String(inputs.cc) : undefined,
                    bcc: inputs.bcc ? String(inputs.bcc) : undefined,
                });
                const data = await g('POST', '/drafts', { message: { raw } });
                return { output: { draftId: data.id ?? '', messageId: data.message?.id ?? '' } };
            }

            case 'deleteDraft': {
                const draftId = String(inputs.draftId ?? '').trim();
                if (!draftId) throw new Error('draftId is required.');
                await g('DELETE', `/drafts/${draftId}`);
                return { output: { deleted: true, draftId } };
            }

            case 'listDrafts': {
                const maxResults = Number(inputs.maxResults ?? 20);
                const pageToken = String(inputs.pageToken ?? '').trim();
                let path = `/drafts?maxResults=${maxResults}`;
                if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
                const data = await g('GET', path);
                return { output: { drafts: data.drafts ?? [], resultSizeEstimate: data.resultSizeEstimate ?? 0, nextPageToken: data.nextPageToken ?? '' } };
            }

            case 'getDraft': {
                const draftId = String(inputs.draftId ?? '').trim();
                if (!draftId) throw new Error('draftId is required.');
                const format = String(inputs.format ?? 'full').trim();
                const data = await g('GET', `/drafts/${draftId}?format=${format}`);
                return { output: { id: data.id, message: data.message ?? {} } };
            }

            case 'sendDraft': {
                const draftId = String(inputs.draftId ?? '').trim();
                if (!draftId) throw new Error('draftId is required.');
                const data = await g('POST', '/drafts/send', { id: draftId });
                return { output: { messageId: data.id ?? '', threadId: data.threadId ?? '' } };
            }

            case 'listLabels': {
                const data = await g('GET', '/labels');
                return { output: { labels: data.labels ?? [], count: (data.labels ?? []).length } };
            }

            case 'createLabel': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.messageListVisibility) body.messageListVisibility = String(inputs.messageListVisibility);
                if (inputs.labelListVisibility) body.labelListVisibility = String(inputs.labelListVisibility);
                if (inputs.color) body.color = inputs.color;
                const data = await g('POST', '/labels', body);
                return { output: { id: data.id, name: data.name, type: data.type ?? 'user' } };
            }

            case 'updateLabel': {
                const labelId = String(inputs.labelId ?? '').trim();
                if (!labelId) throw new Error('labelId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name).trim();
                if (inputs.messageListVisibility) body.messageListVisibility = String(inputs.messageListVisibility);
                if (inputs.labelListVisibility) body.labelListVisibility = String(inputs.labelListVisibility);
                if (inputs.color) body.color = inputs.color;
                const data = await g('PATCH', `/labels/${labelId}`, body);
                return { output: { id: data.id, name: data.name ?? '' } };
            }

            case 'deleteLabel': {
                const labelId = String(inputs.labelId ?? '').trim();
                if (!labelId) throw new Error('labelId is required.');
                await g('DELETE', `/labels/${labelId}`);
                return { output: { deleted: true, labelId } };
            }

            case 'modifyMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');
                const addLabelIds: string[] = Array.isArray(inputs.addLabelIds) ? inputs.addLabelIds : [];
                const removeLabelIds: string[] = Array.isArray(inputs.removeLabelIds) ? inputs.removeLabelIds : [];
                const data = await g('POST', `/messages/${messageId}/modify`, { addLabelIds, removeLabelIds });
                return { output: { id: data.id, labelIds: data.labelIds ?? [] } };
            }

            case 'trashMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');
                const data = await g('POST', `/messages/${messageId}/trash`, {});
                return { output: { id: data.id, labelIds: data.labelIds ?? [] } };
            }

            case 'listThreads': {
                const maxResults = Number(inputs.maxResults ?? 20);
                const query = String(inputs.query ?? '').trim();
                const pageToken = String(inputs.pageToken ?? '').trim();
                let path = `/threads?maxResults=${maxResults}`;
                if (query) path += `&q=${encodeURIComponent(query)}`;
                if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
                const data = await g('GET', path);
                return { output: { threads: data.threads ?? [], resultSizeEstimate: data.resultSizeEstimate ?? 0, nextPageToken: data.nextPageToken ?? '' } };
            }

            default:
                return { error: `Gmail Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Gmail Enhanced action failed.' };
    }
}
