'use server';

export async function executeGoogleGmailEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const userId = String(inputs.userId ?? 'me').trim() || 'me';
        const BASE = `https://gmail.googleapis.com/gmail/v1/users/${userId}`;

        switch (actionName) {
            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.q) params.set('q', String(inputs.q));
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                if (inputs.pageToken) params.set('pageToken', String(inputs.pageToken));
                if (inputs.labelIds) {
                    const ids = Array.isArray(inputs.labelIds) ? inputs.labelIds : [inputs.labelIds];
                    ids.forEach((id: string) => params.append('labelIds', id));
                }
                if (inputs.includeSpamTrash) params.set('includeSpamTrash', String(inputs.includeSpamTrash));
                const res = await fetch(`${BASE}/messages?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { messages: data.messages ?? [], nextPageToken: data.nextPageToken, resultSizeEstimate: data.resultSizeEstimate } };
            }

            case 'getMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required');
                const format = inputs.format ? `?format=${inputs.format}` : '';
                const res = await fetch(`${BASE}/messages/${messageId}${format}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }

            case 'sendMessage': {
                const raw = String(inputs.raw ?? '').trim();
                if (!raw) throw new Error('raw (base64url-encoded RFC 2822 message) is required');
                const body: any = { raw };
                if (inputs.threadId) body.threadId = String(inputs.threadId);
                const res = await fetch(`${BASE}/messages/send`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }

            case 'trashMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required');
                const res = await fetch(`${BASE}/messages/${messageId}/trash`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }

            case 'untrashMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required');
                const res = await fetch(`${BASE}/messages/${messageId}/untrash`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }

            case 'deleteMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required');
                const res = await fetch(`${BASE}/messages/${messageId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (res.status === 204 || res.status === 200) return { output: { success: true, messageId } };
                const data = await res.json();
                throw new Error(data?.error?.message || `API error: ${res.status}`);
            }

            case 'listLabels': {
                const res = await fetch(`${BASE}/labels`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { labels: data.labels ?? [] } };
            }

            case 'createLabel': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required');
                const body: any = { name };
                if (inputs.messageListVisibility) body.messageListVisibility = inputs.messageListVisibility;
                if (inputs.labelListVisibility) body.labelListVisibility = inputs.labelListVisibility;
                if (inputs.color) body.color = inputs.color;
                const res = await fetch(`${BASE}/labels`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { label: data } };
            }

            case 'updateLabel': {
                const labelId = String(inputs.labelId ?? '').trim();
                if (!labelId) throw new Error('labelId is required');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.messageListVisibility) body.messageListVisibility = inputs.messageListVisibility;
                if (inputs.labelListVisibility) body.labelListVisibility = inputs.labelListVisibility;
                if (inputs.color) body.color = inputs.color;
                const res = await fetch(`${BASE}/labels/${labelId}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { label: data } };
            }

            case 'deleteLabel': {
                const labelId = String(inputs.labelId ?? '').trim();
                if (!labelId) throw new Error('labelId is required');
                const res = await fetch(`${BASE}/labels/${labelId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (res.status === 204 || res.status === 200) return { output: { success: true, labelId } };
                const data = await res.json();
                throw new Error(data?.error?.message || `API error: ${res.status}`);
            }

            case 'listDrafts': {
                const params = new URLSearchParams();
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                if (inputs.pageToken) params.set('pageToken', String(inputs.pageToken));
                if (inputs.q) params.set('q', String(inputs.q));
                const res = await fetch(`${BASE}/drafts?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { drafts: data.drafts ?? [], nextPageToken: data.nextPageToken, resultSizeEstimate: data.resultSizeEstimate } };
            }

            case 'createDraft': {
                const raw = String(inputs.raw ?? '').trim();
                if (!raw) throw new Error('raw (base64url-encoded RFC 2822 message) is required');
                const body: any = { message: { raw } };
                if (inputs.threadId) body.message.threadId = String(inputs.threadId);
                const res = await fetch(`${BASE}/drafts`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { draft: data } };
            }

            case 'sendDraft': {
                const draftId = String(inputs.draftId ?? '').trim();
                if (!draftId) throw new Error('draftId is required');
                const res = await fetch(`${BASE}/drafts/send`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: draftId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }

            case 'deleteDraft': {
                const draftId = String(inputs.draftId ?? '').trim();
                if (!draftId) throw new Error('draftId is required');
                const res = await fetch(`${BASE}/drafts/${draftId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (res.status === 204 || res.status === 200) return { output: { success: true, draftId } };
                const data = await res.json();
                throw new Error(data?.error?.message || `API error: ${res.status}`);
            }

            case 'getProfile': {
                const res = await fetch(`${BASE}/profile`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { profile: data } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
