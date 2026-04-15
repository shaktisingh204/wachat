'use server';

export async function executeZammadAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const { serverUrl, apiToken, username, password } = inputs;

        if (!serverUrl) return { error: 'Zammad: serverUrl is required.' };
        if (!apiToken && !(username && password)) {
            return { error: 'Zammad: Either apiToken or username+password is required.' };
        }

        const baseUrl = `${serverUrl.replace(/\/$/, '')}/api/v1`;

        const authHeader: string = apiToken
            ? `Token token=${apiToken}`
            : `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

        const defaultHeaders: Record<string, string> = {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        async function apiRequest(
            method: string,
            path: string,
            body?: Record<string, any>
        ): Promise<any> {
            const opts: RequestInit = {
                method,
                headers: defaultHeaders,
            };
            if (body !== undefined) opts.body = JSON.stringify(body);

            const res = await fetch(`${baseUrl}${path}`, opts);

            if (res.status === 204) return {};

            const text = await res.text();
            let data: any;
            try {
                data = JSON.parse(text);
            } catch {
                if (!res.ok) throw new Error(`Zammad API error ${res.status}: ${text}`);
                return {};
            }

            if (!res.ok) {
                const msg =
                    data?.error ||
                    data?.error_human ||
                    JSON.stringify(data) ||
                    `Zammad API error: ${res.status}`;
                throw new Error(msg);
            }
            return data;
        }

        logger.log(`Executing Zammad action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'listTickets': {
                const { page, perPage } = inputs;
                const data = await apiRequest(
                    'GET',
                    `/tickets?page=${page ?? 1}&per_page=${perPage ?? 25}`
                );
                return { output: { tickets: Array.isArray(data) ? data : [] } };
            }

            case 'getTicket': {
                const { ticketId } = inputs;
                if (!ticketId) return { error: 'Zammad getTicket: ticketId is required.' };
                const data = await apiRequest('GET', `/tickets/${ticketId}`);
                return {
                    output: {
                        id: data.id,
                        number: data.number,
                        title: data.title,
                        state_id: data.state_id,
                        priority_id: data.priority_id,
                        customer_id: data.customer_id,
                        created_at: data.created_at,
                    },
                };
            }

            case 'createTicket': {
                const { title, groupId, customerId, stateId, priorityId, article } = inputs;
                if (!title) return { error: 'Zammad createTicket: title is required.' };
                if (!groupId) return { error: 'Zammad createTicket: groupId is required.' };
                if (!customerId) return { error: 'Zammad createTicket: customerId is required.' };
                if (!article?.body) return { error: 'Zammad createTicket: article.body is required.' };

                const data = await apiRequest('POST', '/tickets', {
                    title,
                    group_id: groupId,
                    customer_id: customerId,
                    state_id: stateId ?? 2,
                    priority_id: priorityId ?? 2,
                    article: {
                        subject: title,
                        body: article.body,
                        type: article.type ?? 'note',
                        internal: article.internal ?? false,
                    },
                });
                return { output: { id: data.id, number: data.number, title: data.title } };
            }

            case 'updateTicket': {
                const { ticketId, data: updateData } = inputs;
                if (!ticketId) return { error: 'Zammad updateTicket: ticketId is required.' };
                if (!updateData) return { error: 'Zammad updateTicket: data is required.' };
                const result = await apiRequest('PUT', `/tickets/${ticketId}`, updateData);
                return { output: { id: result.id, state_id: result.state_id } };
            }

            case 'deleteTicket': {
                const { ticketId } = inputs;
                if (!ticketId) return { error: 'Zammad deleteTicket: ticketId is required.' };
                await apiRequest('DELETE', `/tickets/${ticketId}`);
                return { output: { deleted: true } };
            }

            case 'getTicketArticles': {
                const { ticketId } = inputs;
                if (!ticketId) return { error: 'Zammad getTicketArticles: ticketId is required.' };
                const data = await apiRequest('GET', `/ticket_articles/by_ticket/${ticketId}`);
                return {
                    output: {
                        articles: (Array.isArray(data) ? data : []).map((a: any) => ({
                            id: a.id,
                            body: a.body,
                            type: a.type,
                            from: a.from,
                            to: a.to,
                            created_at: a.created_at,
                        })),
                    },
                };
            }

            case 'createArticle': {
                const { ticketId, body, type, internal, contentType } = inputs;
                if (!ticketId) return { error: 'Zammad createArticle: ticketId is required.' };
                if (!body) return { error: 'Zammad createArticle: body is required.' };
                const data = await apiRequest('POST', '/ticket_articles', {
                    ticket_id: ticketId,
                    body,
                    type: type ?? 'note',
                    internal: internal ?? false,
                    content_type: contentType ?? 'text/plain',
                });
                return { output: { id: data.id, body: data.body } };
            }

            case 'listUsers': {
                const { page, perPage } = inputs;
                const data = await apiRequest(
                    'GET',
                    `/users?page=${page ?? 1}&per_page=${perPage ?? 25}`
                );
                return { output: { users: Array.isArray(data) ? data : [] } };
            }

            case 'getUser': {
                const { userId } = inputs;
                if (!userId) return { error: 'Zammad getUser: userId is required.' };
                const data = await apiRequest('GET', `/users/${userId}`);
                return {
                    output: {
                        id: data.id,
                        email: data.email,
                        firstname: data.firstname,
                        lastname: data.lastname,
                        role_ids: data.role_ids ?? [],
                    },
                };
            }

            case 'createUser': {
                const { email, firstName, lastName, roleIds, password: userPass } = inputs;
                if (!email) return { error: 'Zammad createUser: email is required.' };
                if (!firstName) return { error: 'Zammad createUser: firstName is required.' };
                if (!lastName) return { error: 'Zammad createUser: lastName is required.' };
                const payload: Record<string, any> = {
                    email,
                    firstname: firstName,
                    lastname: lastName,
                    role_ids: roleIds ?? [],
                };
                if (userPass) payload.password = userPass;
                const data = await apiRequest('POST', '/users', payload);
                return { output: { id: data.id, email: data.email } };
            }

            case 'updateUser': {
                const { userId, data: updateData } = inputs;
                if (!userId) return { error: 'Zammad updateUser: userId is required.' };
                if (!updateData) return { error: 'Zammad updateUser: data is required.' };
                const result = await apiRequest('PUT', `/users/${userId}`, updateData);
                return { output: { id: result.id } };
            }

            case 'listGroups': {
                const data = await apiRequest('GET', '/groups');
                return {
                    output: {
                        groups: (Array.isArray(data) ? data : []).map((g: any) => ({
                            id: g.id,
                            name: g.name,
                            active: g.active,
                        })),
                    },
                };
            }

            case 'searchTickets': {
                const { query } = inputs;
                if (!query) return { error: 'Zammad searchTickets: query is required.' };
                const data = await apiRequest(
                    'GET',
                    `/tickets/search?query=${encodeURIComponent(query)}&limit=25`
                );
                return { output: { assets: data.assets ?? { Ticket: {} } } };
            }

            case 'listTags': {
                const data = await apiRequest('GET', '/tag_list');
                return { output: { tags: Array.isArray(data) ? data : [] } };
            }

            case 'addTag': {
                const { ticketId, tag } = inputs;
                if (!ticketId) return { error: 'Zammad addTag: ticketId is required.' };
                if (!tag) return { error: 'Zammad addTag: tag is required.' };
                await apiRequest('POST', '/tags/add', {
                    object: 'Ticket',
                    o_id: ticketId,
                    item: tag,
                });
                return { output: { added: true } };
            }

            default:
                return { error: `Zammad: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`Zammad action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'Zammad: An unexpected error occurred.' };
    }
}
