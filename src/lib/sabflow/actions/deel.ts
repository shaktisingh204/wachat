'use server';

export async function executeDeelAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const baseUrl = 'https://api.letsdeel.com/rest/v2';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listContracts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/contracts?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getContract': {
                const contractId = inputs.contractId;
                const res = await fetch(`${baseUrl}/contracts/${contractId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'createContract': {
                const res = await fetch(`${baseUrl}/contracts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.contract || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listPeople': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/people?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getPerson': {
                const personId = inputs.personId;
                const res = await fetch(`${baseUrl}/people/${personId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listPayments': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/payments?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getPayment': {
                const paymentId = inputs.paymentId;
                const res = await fetch(`${baseUrl}/payments/${paymentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listInvoices': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/invoices?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getInvoice': {
                const invoiceId = inputs.invoiceId;
                const res = await fetch(`${baseUrl}/invoices/${invoiceId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listOrganizations': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/organizations?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getOrganization': {
                const organizationId = inputs.organizationId;
                const res = await fetch(`${baseUrl}/organizations/${organizationId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listTeams': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/teams?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getTeam': {
                const teamId = inputs.teamId;
                const res = await fetch(`${baseUrl}/teams/${teamId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listEntities': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/entities?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getEntity': {
                const entityId = inputs.entityId;
                const res = await fetch(`${baseUrl}/entities/${entityId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            default:
                return { error: `Unknown Deel action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Deel action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in Deel action' };
    }
}
