
'use server';

async function haloPsaGetToken(serverUrl: string, clientId: string, clientSecret: string, logger?: any): Promise<string> {
    logger?.log('[HaloPSA] Fetching OAuth token');
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'all',
    });
    const res = await fetch(`${serverUrl}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HaloPSA auth failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    if (!data.access_token) throw new Error('HaloPSA auth response missing access_token.');
    return data.access_token;
}

async function haloPsaFetch(
    serverUrl: string,
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any,
): Promise<any> {
    logger?.log(`[HaloPSA] ${method} ${path}`);
    const url = `${serverUrl}/api${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    let data: any;
    try {
        data = await res.json();
    } catch {
        if (!res.ok) throw new Error(`HaloPSA API error: ${res.status}`);
        return {};
    }
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `HaloPSA API error: ${res.status}`);
    }
    return data;
}

export async function executeHaloPsaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim().replace(/\/$/, '');
        if (!serverUrl) return { error: 'serverUrl is required.' };

        let accessToken: string;
        if (inputs.accessToken) {
            accessToken = String(inputs.accessToken).trim();
        } else {
            const clientId = String(inputs.clientId ?? '').trim();
            const clientSecret = String(inputs.clientSecret ?? '').trim();
            if (!clientId || !clientSecret) return { error: 'clientId and clientSecret are required when accessToken is not provided.' };
            accessToken = await haloPsaGetToken(serverUrl, clientId, clientSecret, logger);
        }

        const halo = (method: string, path: string, body?: any) =>
            haloPsaFetch(serverUrl, accessToken, method, path, body, logger);

        switch (actionName) {
            case 'listTickets': {
                const pageSize = inputs.pageSize ?? 25;
                const page = inputs.page ?? 1;
                const search = inputs.search ?? '';
                const statusId = inputs.statusId ?? '';
                const data = await halo('GET', `/Tickets?pagesize=${pageSize}&page_no=${page}&search=${encodeURIComponent(search)}&status_id=${statusId}`);
                return {
                    output: {
                        tickets: (data.tickets ?? []).map((t: any) => ({
                            id: t.id,
                            summary: t.summary,
                            status: t.status,
                            client: t.client,
                            dateoccurred: t.dateoccurred,
                        })),
                    },
                };
            }

            case 'getTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) return { error: 'ticketId is required.' };
                const data = await halo('GET', `/Tickets/${ticketId}`);
                return {
                    output: {
                        id: data.id,
                        summary: data.summary,
                        detail: data.detail,
                        status: data.status,
                        client: data.client,
                        site: data.site,
                        agent: data.agent,
                        dateoccurred: data.dateoccurred,
                        datetargetdate: data.datetargetdate,
                    },
                };
            }

            case 'createTicket': {
                const summary = String(inputs.summary ?? '').trim();
                const details = String(inputs.details ?? '').trim();
                const clientId = inputs.clientId;
                if (!summary || !details || !clientId) return { error: 'summary, details, and clientId are required.' };
                const body = [{
                    summary,
                    details,
                    client_id: clientId,
                    site_id: inputs.siteId,
                    agent_id: inputs.agentId,
                    tickettype_id: inputs.ticketTypeId ?? 1,
                    priority_id: inputs.priorityId ?? 3,
                    status_id: inputs.statusId ?? 1,
                }];
                const data = await halo('POST', '/Tickets', body);
                return { output: { tickets: data.tickets ?? [] } };
            }

            case 'updateTicket': {
                const ticketId = inputs.ticketId;
                if (!ticketId) return { error: 'ticketId is required.' };
                const updateData = inputs.data ?? {};
                const body = [{ id: ticketId, ...updateData }];
                const data = await halo('PATCH', '/Tickets', body);
                return { output: { tickets: data.tickets ?? [] } };
            }

            case 'deleteTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) return { error: 'ticketId is required.' };
                await halo('DELETE', `/Tickets/${ticketId}`);
                return { output: { deleted: true } };
            }

            case 'addAction': {
                const ticketId = inputs.ticketId;
                const note = String(inputs.note ?? '').trim();
                if (!ticketId || !note) return { error: 'ticketId and note are required.' };
                const body = [{
                    ticket_id: ticketId,
                    note,
                    actiontype_id: inputs.actionType ?? 1,
                    emailtoClient: inputs.emailtoClient ?? false,
                    sendEmail: inputs.sendEmail ?? false,
                }];
                const data = await halo('POST', '/Actions', body);
                return { output: { actions: data.actions ?? [] } };
            }

            case 'listClients': {
                const pageSize = inputs.pageSize ?? 25;
                const search = inputs.search ?? '';
                const data = await halo('GET', `/Client?pagesize=${pageSize}&search=${encodeURIComponent(search)}`);
                return {
                    output: {
                        clients: (data.clients ?? []).map((c: any) => ({
                            id: c.id,
                            name: c.name,
                            website: c.website,
                            toplevel_id: c.toplevel_id,
                        })),
                    },
                };
            }

            case 'getClient': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) return { error: 'clientId is required.' };
                const data = await halo('GET', `/Client/${clientId}`);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        website: data.website,
                        emailaddress: data.emailaddress,
                    },
                };
            }

            case 'createClient': {
                const name = String(inputs.name ?? '').trim();
                if (!name) return { error: 'name is required.' };
                const body = [{ name, website: inputs.website, emailaddress: inputs.email }];
                const data = await halo('POST', '/Client', body);
                return { output: { clients: data.clients ?? [] } };
            }

            case 'listAgents': {
                const pageSize = inputs.pageSize ?? 50;
                const data = await halo('GET', `/agent?pagesize=${pageSize}`);
                return {
                    output: {
                        agents: (data.agents ?? []).map((a: any) => ({
                            id: a.id,
                            name: a.name,
                            email: a.email,
                            isService: a.isService,
                        })),
                    },
                };
            }

            case 'listSites': {
                const clientId = inputs.clientId ?? '';
                const data = await halo('GET', `/Site?client_id=${clientId}`);
                return {
                    output: {
                        sites: (data.sites ?? []).map((s: any) => ({
                            id: s.id,
                            name: s.name,
                            client_id: s.client_id,
                        })),
                    },
                };
            }

            case 'listContracts': {
                const clientId = inputs.clientId ?? '';
                const data = await halo('GET', `/Contract?client_id=${clientId}`);
                return {
                    output: {
                        contracts: (data.contracts ?? []).map((c: any) => ({
                            id: c.id,
                            ref: c.ref,
                            client: c.client,
                            status: c.status,
                        })),
                    },
                };
            }

            case 'getTimesheets': {
                const agentId = inputs.agentId ?? '';
                const startDate = inputs.startDate ?? '';
                const endDate = inputs.endDate ?? '';
                const data = await halo('GET', `/Timesheets?agent_id=${agentId}&startDate=${startDate}&endDate=${endDate}`);
                return {
                    output: {
                        timesheets: (data.timesheets ?? []).map((t: any) => ({
                            id: t.id,
                            actionid: t.actionid,
                            timeworked: t.timeworked,
                            invoiceable: t.invoiceable,
                        })),
                    },
                };
            }

            default:
                return { error: `Unknown HaloPSA action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[HaloPSA] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown HaloPSA error.' };
    }
}
