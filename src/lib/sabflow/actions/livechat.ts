'use server';

const LIVECHAT_BASE = 'https://api.livechatinc.com/v3.5';

async function livechatFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[LiveChat] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${LIVECHAT_BASE}${path}`, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `LiveChat API error: ${res.status}`);
    }
    return data;
}

export async function executeLiveChatAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const lc = (method: string, path: string, body?: any) => livechatFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'listChats': {
                const sortOrder = String(inputs.sortOrder ?? 'desc').trim();
                const limit = Number(inputs.limit ?? 20);
                const body: any = { sort_order: sortOrder, limit };
                if (inputs.pageId) body.page_id = String(inputs.pageId);
                const data = await lc('POST', '/agent/action/list_chats', body);
                return { output: { chats: data?.chats_summary ?? [], nextPageId: data?.next_page_id } };
            }

            case 'getChat': {
                const chatId = String(inputs.chatId ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                const data = await lc('POST', '/agent/action/get_chat', { chat_id: chatId });
                return { output: data };
            }

            case 'sendMessage': {
                const chatId = String(inputs.chatId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!text) throw new Error('text is required.');
                const event: any = { type: 'message', text };
                if (inputs.visibility) event.visibility = String(inputs.visibility);
                const data = await lc('POST', '/agent/action/send_event', { chat_id: chatId, event });
                return { output: data };
            }

            case 'listAgents': {
                const params = new URLSearchParams();
                if (inputs.groupId) params.set('group_id', String(inputs.groupId));
                if (inputs.fields) params.set('fields', String(inputs.fields));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await lc('GET', `/configuration/action/list_agents${qs}`);
                return { output: { agents: Array.isArray(data) ? data : [] } };
            }

            case 'getAgent': {
                const login = String(inputs.login ?? '').trim();
                if (!login) throw new Error('login (agent email) is required.');
                const data = await lc('GET', `/configuration/action/get_agent?login=${encodeURIComponent(login)}`);
                return { output: data };
            }

            case 'createAgent': {
                const agentLogin = String(inputs.login ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!agentLogin) throw new Error('login is required.');
                if (!name) throw new Error('name is required.');
                const body: any = { login: agentLogin, name };
                if (inputs.role) body.role = String(inputs.role);
                if (inputs.groupIds) body.groups = inputs.groupIds;
                const data = await lc('POST', '/configuration/action/create_agent', body);
                return { output: data };
            }

            case 'updateAgent': {
                const agentLogin = String(inputs.login ?? '').trim();
                if (!agentLogin) throw new Error('login is required.');
                const body: any = { login: agentLogin };
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.role) body.role = String(inputs.role);
                if (inputs.maxChatsCount !== undefined) body.max_chats_count = Number(inputs.maxChatsCount);
                const data = await lc('POST', '/configuration/action/update_agent', body);
                return { output: { login: agentLogin, updated: true, ...data } };
            }

            case 'deleteAgent': {
                const agentLogin = String(inputs.login ?? '').trim();
                if (!agentLogin) throw new Error('login is required.');
                await lc('POST', '/configuration/action/delete_agent', { login: agentLogin });
                return { output: { login: agentLogin, deleted: true } };
            }

            case 'listCustomers': {
                const body: any = {};
                if (inputs.pageId) body.page_id = String(inputs.pageId);
                if (inputs.limit) body.limit = Number(inputs.limit);
                if (inputs.sortOrder) body.sort_order = String(inputs.sortOrder);
                const data = await lc('POST', '/agent/action/list_customers', body);
                return { output: { customers: data?.customers ?? [], nextPageId: data?.next_page_id } };
            }

            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await lc('POST', '/agent/action/get_customer', { id: customerId });
                return { output: data };
            }

            case 'updateCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const body: any = { id: customerId };
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.email) body.email = String(inputs.email);
                if (inputs.fields) body.fields = inputs.fields;
                const data = await lc('POST', '/agent/action/update_customer', body);
                return { output: { customerId, updated: true, ...data } };
            }

            case 'listGroups': {
                const data = await lc('GET', '/configuration/action/list_groups');
                return { output: { groups: Array.isArray(data) ? data : [] } };
            }

            case 'getGroup': {
                const groupId = Number(inputs.groupId ?? 0);
                if (!groupId) throw new Error('groupId is required.');
                const data = await lc('GET', `/configuration/action/get_group?id=${groupId}`);
                return { output: data };
            }

            case 'createGroup': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.agentPriorities) body.agent_priorities = inputs.agentPriorities;
                const data = await lc('POST', '/configuration/action/create_group', body);
                return { output: data };
            }

            case 'getReports': {
                const reportType = String(inputs.reportType ?? 'chats').trim();
                const from = String(inputs.from ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                if (!from) throw new Error('from date is required.');
                if (!to) throw new Error('to date is required.');
                const params = new URLSearchParams({ filters: JSON.stringify({ from, to }) });
                if (inputs.groupBy) params.set('group_by', String(inputs.groupBy));
                const data = await lc('GET', `/reports/action/${reportType}?${params.toString()}`);
                return { output: { reportType, data } };
            }

            default:
                return { error: `Unknown LiveChat action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
