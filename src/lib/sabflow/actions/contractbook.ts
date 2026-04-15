'use server';

export async function executeContractbookAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.contractbook.com/v1';
    const apiKey = inputs.apiKey;

    if (!apiKey) {
        return { error: 'Missing required credential: apiKey' };
    }

    const headers: Record<string, string> = {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listContracts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.status) params.set('status', String(inputs.status));
                const res = await fetch(`${baseUrl}/contracts?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listContracts failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getContract': {
                if (!inputs.contractId) return { error: 'Missing required field: contractId' };
                const res = await fetch(`${baseUrl}/contracts/${inputs.contractId}`, { headers });
                if (!res.ok) return { error: `getContract failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createContract': {
                const body: any = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.template_id) body.template_id = inputs.template_id;
                if (inputs.data) body.data = inputs.data;
                if (inputs.parties) body.parties = inputs.parties;
                const res = await fetch(`${baseUrl}/contracts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createContract failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateContract': {
                if (!inputs.contractId) return { error: 'Missing required field: contractId' };
                const body: any = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.data) body.data = inputs.data;
                if (inputs.status) body.status = inputs.status;
                const res = await fetch(`${baseUrl}/contracts/${inputs.contractId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `updateContract failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteContract': {
                if (!inputs.contractId) return { error: 'Missing required field: contractId' };
                const res = await fetch(`${baseUrl}/contracts/${inputs.contractId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteContract failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, contractId: inputs.contractId } };
            }
            case 'signContract': {
                if (!inputs.contractId) return { error: 'Missing required field: contractId' };
                const body: any = {};
                if (inputs.partyId) body.party_id = inputs.partyId;
                if (inputs.signature) body.signature = inputs.signature;
                const res = await fetch(`${baseUrl}/contracts/${inputs.contractId}/sign`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `signContract failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listParties': {
                if (!inputs.contractId) return { error: 'Missing required field: contractId' };
                const res = await fetch(`${baseUrl}/contracts/${inputs.contractId}/parties`, { headers });
                if (!res.ok) return { error: `listParties failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getParty': {
                if (!inputs.contractId) return { error: 'Missing required field: contractId' };
                if (!inputs.partyId) return { error: 'Missing required field: partyId' };
                const res = await fetch(`${baseUrl}/contracts/${inputs.contractId}/parties/${inputs.partyId}`, { headers });
                if (!res.ok) return { error: `getParty failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'addParty': {
                if (!inputs.contractId) return { error: 'Missing required field: contractId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.email) body.email = inputs.email;
                if (inputs.role) body.role = inputs.role;
                if (inputs.company) body.company = inputs.company;
                const res = await fetch(`${baseUrl}/contracts/${inputs.contractId}/parties`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `addParty failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'removeParty': {
                if (!inputs.contractId) return { error: 'Missing required field: contractId' };
                if (!inputs.partyId) return { error: 'Missing required field: partyId' };
                const res = await fetch(`${baseUrl}/contracts/${inputs.contractId}/parties/${inputs.partyId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `removeParty failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, partyId: inputs.partyId } };
            }
            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/templates?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listTemplates failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getTemplate': {
                if (!inputs.templateId) return { error: 'Missing required field: templateId' };
                const res = await fetch(`${baseUrl}/templates/${inputs.templateId}`, { headers });
                if (!res.ok) return { error: `getTemplate failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createFromTemplate': {
                if (!inputs.templateId) return { error: 'Missing required field: templateId' };
                const body: any = { template_id: inputs.templateId };
                if (inputs.title) body.title = inputs.title;
                if (inputs.data) body.data = inputs.data;
                if (inputs.parties) body.parties = inputs.parties;
                const res = await fetch(`${baseUrl}/contracts/from-template`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createFromTemplate failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listDrafts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/drafts?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listDrafts failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getDraft': {
                if (!inputs.draftId) return { error: 'Missing required field: draftId' };
                const res = await fetch(`${baseUrl}/drafts/${inputs.draftId}`, { headers });
                if (!res.ok) return { error: `getDraft failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                logger.log(`Error: Contractbook action "${actionName}" is not implemented.`);
                return { error: `Contractbook action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        const message = err?.message || String(err);
        logger.log(`Contractbook action error: ${message}`);
        return { error: message };
    }
}
