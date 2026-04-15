'use server';

export async function executeBonsaiAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const base = 'https://app.hellobonsai.com/api/public/v1';
        const headers = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        const bFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[Bonsai] ${method} ${path}`);
            const res = await fetch(`${base}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.message || data?.error || `Bonsai API error: ${res.status}`);
            }
            return data;
        };

        switch (actionName) {
            case 'listClients': {
                const data = await bFetch('GET', '/contacts');
                return { output: { clients: data?.data ?? data ?? [] } };
            }

            case 'getClient': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const data = await bFetch('GET', `/contacts/${clientId}`);
                return { output: { client: data } };
            }

            case 'createClient': {
                const body: Record<string, any> = {};
                if (inputs.name !== undefined) body.name = inputs.name;
                if (inputs.email !== undefined) body.email = inputs.email;
                if (inputs.company !== undefined) body.company = inputs.company;
                const data = await bFetch('POST', '/contacts', body);
                return { output: { client: data } };
            }

            case 'updateClient': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const body: Record<string, any> = {};
                if (inputs.name !== undefined) body.name = inputs.name;
                if (inputs.email !== undefined) body.email = inputs.email;
                if (inputs.company !== undefined) body.company = inputs.company;
                const data = await bFetch('PUT', `/contacts/${clientId}`, body);
                return { output: { client: data } };
            }

            case 'listContracts': {
                const data = await bFetch('GET', '/contracts');
                return { output: { contracts: data?.data ?? data ?? [] } };
            }

            case 'getContract': {
                const contractId = String(inputs.contractId ?? '').trim();
                if (!contractId) throw new Error('contractId is required.');
                const data = await bFetch('GET', `/contracts/${contractId}`);
                return { output: { contract: data } };
            }

            case 'createContract': {
                const body: Record<string, any> = {};
                if (inputs.clientId !== undefined) body.client_id = inputs.clientId;
                if (inputs.title !== undefined) body.title = inputs.title;
                if (inputs.content !== undefined) body.content = inputs.content;
                const data = await bFetch('POST', '/contracts', body);
                return { output: { contract: data } };
            }

            case 'sendContract': {
                const contractId = String(inputs.contractId ?? '').trim();
                if (!contractId) throw new Error('contractId is required.');
                const data = await bFetch('POST', `/contracts/${contractId}/send`);
                return { output: { success: true, contract: data } };
            }

            case 'voidContract': {
                const contractId = String(inputs.contractId ?? '').trim();
                if (!contractId) throw new Error('contractId is required.');
                const data = await bFetch('POST', `/contracts/${contractId}/void`);
                return { output: { success: true, contract: data } };
            }

            case 'listProposals': {
                const data = await bFetch('GET', '/proposals');
                return { output: { proposals: data?.data ?? data ?? [] } };
            }

            case 'getProposal': {
                const proposalId = String(inputs.proposalId ?? '').trim();
                if (!proposalId) throw new Error('proposalId is required.');
                const data = await bFetch('GET', `/proposals/${proposalId}`);
                return { output: { proposal: data } };
            }

            case 'createProposal': {
                const body: Record<string, any> = {};
                if (inputs.clientId !== undefined) body.client_id = inputs.clientId;
                if (inputs.title !== undefined) body.title = inputs.title;
                if (inputs.content !== undefined) body.content = inputs.content;
                const data = await bFetch('POST', '/proposals', body);
                return { output: { proposal: data } };
            }

            case 'listInvoices': {
                const data = await bFetch('GET', '/invoices');
                return { output: { invoices: data?.data ?? data ?? [] } };
            }

            case 'getInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await bFetch('GET', `/invoices/${invoiceId}`);
                return { output: { invoice: data } };
            }

            case 'createInvoice': {
                const body: Record<string, any> = {};
                if (inputs.clientId !== undefined) body.client_id = inputs.clientId;
                if (inputs.lineItems !== undefined) body.line_items = inputs.lineItems;
                if (inputs.dueDate !== undefined) body.due_date = inputs.dueDate;
                const data = await bFetch('POST', '/invoices', body);
                return { output: { invoice: data } };
            }

            case 'sendInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await bFetch('POST', `/invoices/${invoiceId}/send`);
                return { output: { success: true, invoice: data } };
            }

            case 'listPayments': {
                const data = await bFetch('GET', '/payments');
                return { output: { payments: data?.data ?? data ?? [] } };
            }

            case 'getPayment': {
                const paymentId = String(inputs.paymentId ?? '').trim();
                if (!paymentId) throw new Error('paymentId is required.');
                const data = await bFetch('GET', `/payments/${paymentId}`);
                return { output: { payment: data } };
            }

            case 'listProjects': {
                const data = await bFetch('GET', '/projects');
                return { output: { projects: data?.data ?? data ?? [] } };
            }

            case 'getProject': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await bFetch('GET', `/projects/${projectId}`);
                return { output: { project: data } };
            }

            default:
                throw new Error(`Unknown Bonsai action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Bonsai] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown Bonsai error' };
    }
}
