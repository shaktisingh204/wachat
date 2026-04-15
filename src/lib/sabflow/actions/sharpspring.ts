'use server';

const SHARPSPRING_ENDPOINT = 'https://api.sharpspring.com/pubapi/v1.2';

async function sharpspringFetch(
    accountID: string,
    secretKey: string,
    method: string,
    params: any = {},
    logger?: any
): Promise<any> {
    logger?.log(`[SharpSpring] method: ${method}`);
    const body = JSON.stringify({
        method,
        params: { where: {}, limit: 500, offset: 0, ...params },
        id: '1',
        accountID,
        secretKey,
    });
    const res = await fetch(SHARPSPRING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? `SharpSpring API error: ${res.status}`);
    if (data?.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
    return data?.result ?? data;
}

export async function executeSharpSpringAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accountID = String(inputs.accountID ?? '').trim();
        const secretKey = String(inputs.secretKey ?? '').trim();
        if (!accountID) throw new Error('accountID is required.');
        if (!secretKey) throw new Error('secretKey is required.');

        const ss = (method: string, params?: any) =>
            sharpspringFetch(accountID, secretKey, method, params, logger);

        switch (actionName) {
            case 'getLeads': {
                const data = await ss('getLeads', { where: inputs.where ?? {}, limit: inputs.limit ?? 500, offset: inputs.offset ?? 0 });
                return { output: { leads: data?.lead ?? data } };
            }

            case 'createLead': {
                const data = await ss('createLeads', { objects: [inputs.lead ?? inputs] });
                return { output: { result: data } };
            }

            case 'updateLead': {
                const data = await ss('updateLeads', { objects: [inputs.lead ?? inputs] });
                return { output: { result: data } };
            }

            case 'deleteLead': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await ss('deleteLeads', { objects: [{ id }] });
                return { output: { result: data } };
            }

            case 'getContacts': {
                const data = await ss('getContacts', { where: inputs.where ?? {}, limit: inputs.limit ?? 500, offset: inputs.offset ?? 0 });
                return { output: { contacts: data?.contact ?? data } };
            }

            case 'createContact': {
                const data = await ss('createContacts', { objects: [inputs.contact ?? inputs] });
                return { output: { result: data } };
            }

            case 'updateContact': {
                const data = await ss('updateContacts', { objects: [inputs.contact ?? inputs] });
                return { output: { result: data } };
            }

            case 'getAccounts': {
                const data = await ss('getAccounts', { where: inputs.where ?? {}, limit: inputs.limit ?? 500, offset: inputs.offset ?? 0 });
                return { output: { accounts: data?.account ?? data } };
            }

            case 'createAccount': {
                const data = await ss('createAccounts', { objects: [inputs.account ?? inputs] });
                return { output: { result: data } };
            }

            case 'getOpportunities': {
                const data = await ss('getOpportunities', { where: inputs.where ?? {}, limit: inputs.limit ?? 500, offset: inputs.offset ?? 0 });
                return { output: { opportunities: data?.opportunity ?? data } };
            }

            case 'createOpportunity': {
                const data = await ss('createOpportunities', { objects: [inputs.opportunity ?? inputs] });
                return { output: { result: data } };
            }

            case 'updateOpportunity': {
                const data = await ss('updateOpportunities', { objects: [inputs.opportunity ?? inputs] });
                return { output: { result: data } };
            }

            case 'getLists': {
                const data = await ss('getLists', { where: inputs.where ?? {}, limit: inputs.limit ?? 500, offset: inputs.offset ?? 0 });
                return { output: { lists: data?.list ?? data } };
            }

            case 'addLeadToList': {
                const listID = String(inputs.listID ?? '').trim();
                const leadID = String(inputs.leadID ?? '').trim();
                if (!listID) throw new Error('listID is required.');
                if (!leadID) throw new Error('leadID is required.');
                const data = await ss('addListMember', { where: { listID, memberID: leadID } });
                return { output: { result: data } };
            }

            case 'removeLeadFromList': {
                const listID = String(inputs.listID ?? '').trim();
                const leadID = String(inputs.leadID ?? '').trim();
                if (!listID) throw new Error('listID is required.');
                if (!leadID) throw new Error('leadID is required.');
                const data = await ss('removeListMember', { where: { listID, memberID: leadID } });
                return { output: { result: data } };
            }

            case 'getCampaigns': {
                const data = await ss('getCampaigns', { where: inputs.where ?? {}, limit: inputs.limit ?? 500, offset: inputs.offset ?? 0 });
                return { output: { campaigns: data?.campaign ?? data } };
            }

            case 'getEmailStats': {
                const data = await ss('getEmailJobStats', { where: inputs.where ?? {}, limit: inputs.limit ?? 500, offset: inputs.offset ?? 0 });
                return { output: { stats: data } };
            }

            default:
                return { error: `Unknown SharpSpring action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[SharpSpring] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown SharpSpring error' };
    }
}
