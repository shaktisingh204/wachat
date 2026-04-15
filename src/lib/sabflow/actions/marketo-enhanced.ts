'use server';

export async function executeMarketoEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const munchkinId = inputs.munchkinId;
        const clientId = inputs.clientId;
        const clientSecret = inputs.clientSecret;
        const baseUrl = `https://${munchkinId}.mktorest.com`;

        // Fetch OAuth2 token via GET
        const tokenRes = await fetch(
            `${baseUrl}/identity/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`
        );
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || tokenData.error) throw new Error(tokenData?.error_description || `Token error: ${tokenRes.status}`);
        const token: string = tokenData.access_token;

        switch (actionName) {
            case 'getLead': {
                const res = await fetch(`${baseUrl}/rest/v1/lead/${inputs.leadId}.json`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { lead: data.result?.[0] } };
            }

            case 'getLeadsByFilter': {
                const params = new URLSearchParams({
                    filterType: inputs.filterType,
                    filterValues: Array.isArray(inputs.filterValues) ? inputs.filterValues.join(',') : inputs.filterValues,
                    ...(inputs.fields ? { fields: inputs.fields } : {}),
                    ...(inputs.nextPageToken ? { nextPageToken: inputs.nextPageToken } : {}),
                });
                const res = await fetch(`${baseUrl}/rest/v1/leads.json?${params.toString()}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { leads: data.result, nextPageToken: data.nextPageToken } };
            }

            case 'createOrUpdateLeads': {
                const res = await fetch(`${baseUrl}/rest/v1/leads.json`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: inputs.action || 'createOrUpdate', lookupField: inputs.lookupField || 'email', input: inputs.leads }),
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { result: data.result } };
            }

            case 'deleteLead': {
                const res = await fetch(`${baseUrl}/rest/v1/leads/delete.json`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ input: [{ id: inputs.leadId }] }),
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { result: data.result } };
            }

            case 'listLeadFields': {
                const res = await fetch(`${baseUrl}/rest/v1/leads/describe.json`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { fields: data.result } };
            }

            case 'listActivities': {
                const params = new URLSearchParams({
                    nextPageToken: inputs.nextPageToken || '',
                    activityTypeIds: inputs.activityTypeIds || '',
                    ...(inputs.leadIds ? { leadIds: inputs.leadIds } : {}),
                });
                const res = await fetch(`${baseUrl}/rest/v1/activities.json?${params.toString()}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { activities: data.result, moreResult: data.moreResult, nextPageToken: data.nextPageToken } };
            }

            case 'getActivityTypes': {
                const res = await fetch(`${baseUrl}/rest/v1/activities/types.json`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { activityTypes: data.result } };
            }

            case 'listSmartLists': {
                const res = await fetch(`${baseUrl}/rest/asset/v1/smartLists.json?maxReturn=${inputs.maxReturn || 200}&offset=${inputs.offset || 0}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { smartLists: data.result } };
            }

            case 'getSmartList': {
                const res = await fetch(`${baseUrl}/rest/asset/v1/smartList/${inputs.smartListId}.json`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { smartList: data.result?.[0] } };
            }

            case 'listPrograms': {
                const res = await fetch(`${baseUrl}/rest/asset/v1/programs.json?maxReturn=${inputs.maxReturn || 200}&offset=${inputs.offset || 0}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { programs: data.result } };
            }

            case 'getProgram': {
                const res = await fetch(`${baseUrl}/rest/asset/v1/program/${inputs.programId}.json`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { program: data.result?.[0] } };
            }

            case 'approveLandingPage': {
                const res = await fetch(`${baseUrl}/rest/asset/v1/landingPage/${inputs.landingPageId}/approveDraft.json`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { result: data.result } };
            }

            case 'sendSampleEmail': {
                const res = await fetch(`${baseUrl}/rest/asset/v1/email/${inputs.emailId}/sendSample.json`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ emailAddress: inputs.emailAddress, ...(inputs.leadId ? { leadId: String(inputs.leadId) } : {}) }).toString(),
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { result: data.result } };
            }

            case 'listStaticLists': {
                const res = await fetch(`${baseUrl}/rest/asset/v1/staticLists.json?maxReturn=${inputs.maxReturn || 200}&offset=${inputs.offset || 0}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { staticLists: data.result } };
            }

            case 'addLeadToList': {
                const res = await fetch(`${baseUrl}/rest/v1/lists/${inputs.listId}/leads.json`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ input: Array.isArray(inputs.leadIds) ? inputs.leadIds.map((id: any) => ({ id })) : [{ id: inputs.leadId }] }),
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { result: data.result } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
