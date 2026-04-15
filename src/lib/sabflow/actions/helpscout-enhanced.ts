'use server';

const BASE_URL = 'https://api.helpscout.net/v2';

export async function executeHelpScoutEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = inputs.accessToken;
        if (!accessToken) return { error: 'Missing accessToken' };

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        async function apiFetch(path: string, method = 'GET', body?: any) {
            const res = await fetch(`${BASE_URL}${path}`, {
                method,
                headers,
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HelpScout API error ${res.status}: ${text}`);
            }
            if (res.status === 204) return {};
            return res.json();
        }

        switch (actionName) {
            case 'listConversations': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.mailboxId) params.set('mailboxId', inputs.mailboxId);
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await apiFetch(`/conversations?${params.toString()}`);
                return { output: data };
            }
            case 'getConversation': {
                const data = await apiFetch(`/conversations/${inputs.conversationId}`);
                return { output: data };
            }
            case 'createConversation': {
                const data = await apiFetch('/conversations', 'POST', inputs.body);
                return { output: data };
            }
            case 'updateConversation': {
                const data = await apiFetch(`/conversations/${inputs.conversationId}`, 'PATCH', inputs.body);
                return { output: data };
            }
            case 'deleteConversation': {
                await apiFetch(`/conversations/${inputs.conversationId}`, 'DELETE');
                return { output: { success: true } };
            }
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.firstName) params.set('firstName', inputs.firstName);
                if (inputs.lastName) params.set('lastName', inputs.lastName);
                const data = await apiFetch(`/customers?${params.toString()}`);
                return { output: data };
            }
            case 'getCustomer': {
                const data = await apiFetch(`/customers/${inputs.customerId}`);
                return { output: data };
            }
            case 'createCustomer': {
                const data = await apiFetch('/customers', 'POST', inputs.body);
                return { output: data };
            }
            case 'updateCustomer': {
                const data = await apiFetch(`/customers/${inputs.customerId}`, 'PUT', inputs.body);
                return { output: data };
            }
            case 'listMailboxes': {
                const data = await apiFetch('/mailboxes');
                return { output: data };
            }
            case 'getMailbox': {
                const data = await apiFetch(`/mailboxes/${inputs.mailboxId}`);
                return { output: data };
            }
            case 'listFolders': {
                const data = await apiFetch(`/mailboxes/${inputs.mailboxId}/folders`);
                return { output: data };
            }
            case 'getFolder': {
                const data = await apiFetch(`/mailboxes/${inputs.mailboxId}/folders/${inputs.folderId}`);
                return { output: data };
            }
            case 'searchConversations': {
                const params = new URLSearchParams();
                if (inputs.query) params.set('query', inputs.query);
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await apiFetch(`/conversations?${params.toString()}`);
                return { output: data };
            }
            case 'listTags': {
                const data = await apiFetch('/tags');
                return { output: data };
            }
            default:
                return { error: `Unknown HelpScout Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`HelpScout Enhanced action error: ${err.message}`);
        return { error: err.message };
    }
}
