'use server';

export async function executeOysterHRAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const baseUrl = 'https://api.oysterhr.com/v1';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listTeamMembers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.perPage) params.set('per_page', inputs.perPage);
                const res = await fetch(`${baseUrl}/team_members?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getTeamMember': {
                const memberId = inputs.memberId;
                const res = await fetch(`${baseUrl}/team_members/${memberId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'createTeamMember': {
                const res = await fetch(`${baseUrl}/team_members`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.teamMember || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'updateTeamMember': {
                const memberId = inputs.memberId;
                const res = await fetch(`${baseUrl}/team_members/${memberId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.updates || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listCountries': {
                const res = await fetch(`${baseUrl}/countries`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getCountry': {
                const countryCode = inputs.countryCode;
                const res = await fetch(`${baseUrl}/countries/${countryCode}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listCompensation': {
                const memberId = inputs.memberId;
                const res = await fetch(`${baseUrl}/team_members/${memberId}/compensation`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getCompensation': {
                const memberId = inputs.memberId;
                const compensationId = inputs.compensationId;
                const res = await fetch(`${baseUrl}/team_members/${memberId}/compensation/${compensationId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listPayroll': {
                const params = new URLSearchParams();
                if (inputs.year) params.set('year', inputs.year);
                if (inputs.month) params.set('month', inputs.month);
                const res = await fetch(`${baseUrl}/payroll?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getPayroll': {
                const payrollId = inputs.payrollId;
                const res = await fetch(`${baseUrl}/payroll/${payrollId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listTimeOff': {
                const memberId = inputs.memberId;
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                const res = await fetch(`${baseUrl}/team_members/${memberId}/time_off?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'requestTimeOff': {
                const memberId = inputs.memberId;
                const res = await fetch(`${baseUrl}/team_members/${memberId}/time_off`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.timeOffRequest || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'approveTimeOff': {
                const memberId = inputs.memberId;
                const requestId = inputs.requestId;
                const res = await fetch(`${baseUrl}/team_members/${memberId}/time_off/${requestId}/approve`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listDocuments': {
                const memberId = inputs.memberId;
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                const res = await fetch(`${baseUrl}/team_members/${memberId}/documents?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getDocument': {
                const memberId = inputs.memberId;
                const documentId = inputs.documentId;
                const res = await fetch(`${baseUrl}/team_members/${memberId}/documents/${documentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            default:
                return { error: `Unknown OysterHR action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`OysterHR action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in OysterHR action' };
    }
}
