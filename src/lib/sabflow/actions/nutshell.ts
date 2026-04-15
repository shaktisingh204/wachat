'use server';

export async function executeNutshellAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { username, apiKey } = inputs;
        if (!username || !apiKey) return { error: 'Nutshell username and apiKey are required.' };

        const ENDPOINT = 'https://app.nutshell.com/api/v1/json';
        const authHeader = `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`;
        const headers: Record<string, string> = {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
        };

        const rpc = async (method: string, params: any) => {
            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers,
                body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
            });
            const json = await res.json();
            if (json.error) throw new Error(json.error.message || 'Nutshell RPC error');
            return json.result;
        };

        switch (actionName) {
            case 'getContact': {
                const { contactId, rev } = inputs;
                const result = await rpc('getContact', { contactId, rev });
                return { output: result };
            }
            case 'newContact': {
                const { contact } = inputs;
                const result = await rpc('newContact', { contact });
                return { output: result };
            }
            case 'editContact': {
                const { contactId, rev, contact } = inputs;
                const result = await rpc('editContact', { contactId, rev, contact });
                return { output: result };
            }
            case 'searchContacts': {
                const { query, limit } = inputs;
                const result = await rpc('searchContacts', { query, limit });
                return { output: result };
            }
            case 'getLead': {
                const { leadId, rev } = inputs;
                const result = await rpc('getLead', { leadId, rev });
                return { output: result };
            }
            case 'newLead': {
                const { lead } = inputs;
                const result = await rpc('newLead', { lead });
                return { output: result };
            }
            case 'editLead': {
                const { leadId, rev, lead } = inputs;
                const result = await rpc('editLead', { leadId, rev, lead });
                return { output: result };
            }
            case 'searchLeads': {
                const { query, limit } = inputs;
                const result = await rpc('searchLeads', { query, limit });
                return { output: result };
            }
            case 'getAccount': {
                const { accountId, rev } = inputs;
                const result = await rpc('getAccount', { accountId, rev });
                return { output: result };
            }
            case 'newAccount': {
                const { account } = inputs;
                const result = await rpc('newAccount', { account });
                return { output: result };
            }
            case 'editAccount': {
                const { accountId, rev, account } = inputs;
                const result = await rpc('editAccount', { accountId, rev, account });
                return { output: result };
            }
            case 'searchAccounts': {
                const { query, limit } = inputs;
                const result = await rpc('searchAccounts', { query, limit });
                return { output: result };
            }
            case 'getActivity': {
                const { activityId, rev } = inputs;
                const result = await rpc('getActivity', { activityId, rev });
                return { output: result };
            }
            case 'logActivity': {
                const { activity } = inputs;
                const result = await rpc('logActivity', { activity });
                return { output: result };
            }
            case 'getTags': {
                const result = await rpc('getTags', {});
                return { output: result };
            }
            default:
                return { error: `Nutshell action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        return { error: err.message || 'An unexpected error occurred in Nutshell action.' };
    }
}
