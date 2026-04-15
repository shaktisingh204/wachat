'use server';

export async function executeADPApiAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.adp.com';
    const accessToken = inputs.accessToken;

    if (!accessToken) {
        return { error: 'ADP API: accessToken is required.' };
    }

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listWorkers': {
                const params = new URLSearchParams();
                if (inputs.top) params.set('$top', String(inputs.top));
                if (inputs.skip) params.set('$skip', String(inputs.skip));
                if (inputs.filter) params.set('$filter', inputs.filter);
                const url = `${BASE_URL}/hr/v2/workers${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { workers: data.workers, totalCount: data.totalCount } };
            }
            case 'getWorker': {
                const res = await fetch(`${BASE_URL}/hr/v2/workers/${inputs.workerId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { worker: data.workers?.[0] || data } };
            }
            case 'listOrganizations': {
                const res = await fetch(`${BASE_URL}/core/v1/organization-departments`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { organizations: data } };
            }
            case 'getOrganization': {
                const res = await fetch(`${BASE_URL}/core/v1/organization-departments/${inputs.orgId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { organization: data } };
            }
            case 'listPaySchedules': {
                const res = await fetch(`${BASE_URL}/payroll/v1/pay-schedules`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { paySchedules: data.paySchedules || data } };
            }
            case 'getPayStatement': {
                const res = await fetch(`${BASE_URL}/payroll/v1/workers/${inputs.workerId}/pay-statements/${inputs.payStatementId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { payStatement: data } };
            }
            case 'listDeductions': {
                const res = await fetch(`${BASE_URL}/payroll/v1/workers/${inputs.workerId}/deductions`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { deductions: data.deductions || data } };
            }
            case 'listEarnings': {
                const res = await fetch(`${BASE_URL}/payroll/v1/workers/${inputs.workerId}/earnings`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { earnings: data.earnings || data } };
            }
            case 'listPayCodes': {
                const res = await fetch(`${BASE_URL}/payroll/v1/pay-codes`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { payCodes: data.payCodes || data } };
            }
            case 'getDirectDeposit': {
                const res = await fetch(`${BASE_URL}/payroll/v1/workers/${inputs.workerId}/direct-deposits/${inputs.depositId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { directDeposit: data } };
            }
            case 'listDirectDeposits': {
                const res = await fetch(`${BASE_URL}/payroll/v1/workers/${inputs.workerId}/direct-deposits`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { directDeposits: data.directDeposits || data } };
            }
            case 'updateDirectDeposit': {
                const body = {
                    ...(inputs.bankAccountNumber && { bankAccountNumber: inputs.bankAccountNumber }),
                    ...(inputs.bankRoutingTransitNumber && { bankRoutingTransitNumber: inputs.bankRoutingTransitNumber }),
                    ...(inputs.depositAmount && { depositAmount: inputs.depositAmount }),
                    ...(inputs.depositPercentage && { depositPercentage: inputs.depositPercentage }),
                    ...(inputs.depositAccountTypeCodes && { depositAccountTypeCodes: inputs.depositAccountTypeCodes }),
                };
                const res = await fetch(`${BASE_URL}/payroll/v1/workers/${inputs.workerId}/direct-deposits/${inputs.depositId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { updated: true, directDeposit: data } };
            }
            case 'listTaxFilings': {
                const params = new URLSearchParams();
                if (inputs.year) params.set('$filter', `taxYear eq '${inputs.year}'`);
                const url = `${BASE_URL}/payroll/v1/tax-filings${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { taxFilings: data.taxFilings || data } };
            }
            case 'getYearEndForms': {
                const params = new URLSearchParams();
                if (inputs.year) params.set('$filter', `taxYear eq '${inputs.year}'`);
                if (inputs.workerId) params.set('$filter', `workerId eq '${inputs.workerId}'`);
                const url = `${BASE_URL}/payroll/v1/workers/${inputs.workerId}/year-end-tax-documents${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { yearEndForms: data.yearEndTaxDocuments || data } };
            }
            case 'listBenefitEnrollments': {
                const res = await fetch(`${BASE_URL}/benefits/v1/workers/${inputs.workerId}/benefit-enrollments`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { benefitEnrollments: data.benefitEnrollments || data } };
            }
            default:
                return { error: `ADP API: Unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err.message || String(err) };
    }
}
