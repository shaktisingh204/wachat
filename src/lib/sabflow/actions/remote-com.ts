'use server';

export async function executeRemoteComAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const baseUrl = 'https://gateway.remote.com/v1';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listEmployments': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.pageSize) params.set('page_size', inputs.pageSize);
                const res = await fetch(`${baseUrl}/employments?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getEmployment': {
                const employmentId = inputs.employmentId;
                const res = await fetch(`${baseUrl}/employments/${employmentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'createEmployment': {
                const res = await fetch(`${baseUrl}/employments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.employment || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'updateEmployment': {
                const employmentId = inputs.employmentId;
                const res = await fetch(`${baseUrl}/employments/${employmentId}`, {
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
            case 'listCompanies': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.pageSize) params.set('page_size', inputs.pageSize);
                const res = await fetch(`${baseUrl}/companies?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getCompany': {
                const companyId = inputs.companyId;
                const res = await fetch(`${baseUrl}/companies/${companyId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listOnboardingTasks': {
                const employmentId = inputs.employmentId;
                const res = await fetch(`${baseUrl}/employments/${employmentId}/onboarding-tasks`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getOnboardingTask': {
                const employmentId = inputs.employmentId;
                const taskId = inputs.taskId;
                const res = await fetch(`${baseUrl}/employments/${employmentId}/onboarding-tasks/${taskId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listBenefits': {
                const params = new URLSearchParams();
                if (inputs.countryCode) params.set('country_code', inputs.countryCode);
                const res = await fetch(`${baseUrl}/benefits?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listPayslips': {
                const employmentId = inputs.employmentId;
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.pageSize) params.set('page_size', inputs.pageSize);
                const res = await fetch(`${baseUrl}/employments/${employmentId}/payslips?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getPayslip': {
                const employmentId = inputs.employmentId;
                const payslipId = inputs.payslipId;
                const res = await fetch(`${baseUrl}/employments/${employmentId}/payslips/${payslipId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listTimeoffs': {
                const employmentId = inputs.employmentId;
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                const res = await fetch(`${baseUrl}/employments/${employmentId}/timeoffs?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getTimeoff': {
                const employmentId = inputs.employmentId;
                const timeoffId = inputs.timeoffId;
                const res = await fetch(`${baseUrl}/employments/${employmentId}/timeoffs/${timeoffId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            default:
                return { error: `Unknown Remote.com action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Remote.com action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in Remote.com action' };
    }
}
