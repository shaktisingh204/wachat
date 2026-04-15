'use server';

export async function executeMicrosoftMailAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const userId = String(inputs.userId ?? 'me').trim();
        const baseUrl = `https://graph.microsoft.com/v1.0/users/${userId}`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        async function graphRequest(method: string, path: string, body?: any) {
            logger?.log(`[MicrosoftMail] ${method} ${path}`);
            const opts: RequestInit = { method, headers };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(`${baseUrl}${path}`, opts);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error?.message || `Graph error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listMessages': {
                const folder = String(inputs.folder ?? 'inbox');
                const top = Math.max(1, Math.min(100, Number(inputs.top ?? 20)));
                const filter = inputs.filter ? `&$filter=${encodeURIComponent(String(inputs.filter))}` : '';
                const search = inputs.search ? `&$search="${encodeURIComponent(String(inputs.search))}"` : '';
                const data = await graphRequest('GET', `/mailFolders/${folder}/messages?$top=${top}&$orderby=receivedDateTime desc${filter}${search}`);
                return { output: { messages: data.value ?? [], nextLink: data['@odata.nextLink'] ?? null } };
            }

            case 'getMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');
                const data = await graphRequest('GET', `/messages/${messageId}`);
                return { output: data };
            }

            case 'sendMessage': {
                const toEmail = String(inputs.toEmail ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const body = String(inputs.body ?? '');
                if (!toEmail || !subject) throw new Error('toEmail and subject are required.');
                const bodyType = String(inputs.bodyType ?? 'HTML');
                const message: any = {
                    subject,
                    body: { contentType: bodyType, content: body },
                    toRecipients: [{ emailAddress: { address: toEmail } }],
                };
                if (inputs.ccEmail) message.ccRecipients = [{ emailAddress: { address: String(inputs.ccEmail) } }];
                if (inputs.bccEmail) message.bccRecipients = [{ emailAddress: { address: String(inputs.bccEmail) } }];
                await graphRequest('POST', '/sendMail', { message, saveToSentItems: inputs.saveToSentItems !== false });
                return { output: { success: true, to: toEmail, subject } };
            }

            case 'replyMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                const replyBody = String(inputs.body ?? '');
                if (!messageId) throw new Error('messageId is required.');
                await graphRequest('POST', `/messages/${messageId}/reply`, {
                    message: { body: { contentType: String(inputs.bodyType ?? 'HTML'), content: replyBody } },
                    comment: replyBody,
                });
                return { output: { success: true, repliedTo: messageId } };
            }

            case 'forwardMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                const toEmail = String(inputs.toEmail ?? '').trim();
                if (!messageId || !toEmail) throw new Error('messageId and toEmail are required.');
                await graphRequest('POST', `/messages/${messageId}/forward`, {
                    toRecipients: [{ emailAddress: { address: toEmail } }],
                    comment: inputs.comment ? String(inputs.comment) : undefined,
                });
                return { output: { success: true, forwardedTo: toEmail } };
            }

            case 'deleteMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');
                await graphRequest('DELETE', `/messages/${messageId}`);
                return { output: { success: true, deleted: messageId } };
            }

            case 'moveMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                const destinationId = String(inputs.destinationId ?? '').trim();
                if (!messageId || !destinationId) throw new Error('messageId and destinationId are required.');
                const data = await graphRequest('POST', `/messages/${messageId}/move`, { destinationId });
                return { output: { success: true, movedMessage: data } };
            }

            case 'listMailFolders': {
                const top = Math.max(1, Math.min(100, Number(inputs.top ?? 20)));
                const data = await graphRequest('GET', `/mailFolders?$top=${top}`);
                return { output: { folders: data.value ?? [] } };
            }

            case 'createMailFolder': {
                const displayName = String(inputs.displayName ?? '').trim();
                if (!displayName) throw new Error('displayName is required.');
                const data = await graphRequest('POST', '/mailFolders', { displayName });
                return { output: data };
            }

            case 'listAttachments': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');
                const data = await graphRequest('GET', `/messages/${messageId}/attachments`);
                return { output: { attachments: data.value ?? [] } };
            }

            case 'addAttachment': {
                const messageId = String(inputs.messageId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const contentBytes = String(inputs.contentBytes ?? '').trim();
                if (!messageId || !name || !contentBytes) throw new Error('messageId, name, and contentBytes are required.');
                const data = await graphRequest('POST', `/messages/${messageId}/attachments`, {
                    '@odata.type': '#microsoft.graph.fileAttachment',
                    name,
                    contentBytes,
                    contentType: String(inputs.contentType ?? 'application/octet-stream'),
                });
                return { output: data };
            }

            case 'createDraft': {
                const subject = String(inputs.subject ?? '').trim();
                if (!subject) throw new Error('subject is required.');
                const draft: any = {
                    subject,
                    body: { contentType: String(inputs.bodyType ?? 'HTML'), content: String(inputs.body ?? '') },
                };
                if (inputs.toEmail) draft.toRecipients = [{ emailAddress: { address: String(inputs.toEmail) } }];
                const data = await graphRequest('POST', '/messages', draft);
                return { output: data };
            }

            case 'updateDraft': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');
                const patch: any = {};
                if (inputs.subject) patch.subject = String(inputs.subject);
                if (inputs.body) patch.body = { contentType: String(inputs.bodyType ?? 'HTML'), content: String(inputs.body) };
                if (inputs.toEmail) patch.toRecipients = [{ emailAddress: { address: String(inputs.toEmail) } }];
                const data = await graphRequest('PATCH', `/messages/${messageId}`, patch);
                return { output: data };
            }

            case 'sendDraft': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');
                await graphRequest('POST', `/messages/${messageId}/send`);
                return { output: { success: true, sent: messageId } };
            }

            case 'listCategories': {
                const data = await graphRequest('GET', '/outlook/masterCategories');
                return { output: { categories: data.value ?? [] } };
            }

            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
