'use server';

export async function executeNeverBounceAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.neverbounce.com/v4.2';
    const headers = {
        'Authorization': `Bearer ${inputs.apiKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'singleCheck': {
                const res = await fetch(`${BASE}/single/check`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ email: inputs.email, ...(inputs.addressInfo !== undefined ? { address_info: inputs.addressInfo } : {}), ...(inputs.creditsInfo !== undefined ? { credits_info: inputs.creditsInfo } : {}) }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'bulkCreate': {
                const res = await fetch(`${BASE}/jobs/create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ input: inputs.input, input_location: inputs.inputLocation || 'supplied', ...(inputs.filename ? { filename: inputs.filename } : {}), ...(inputs.autoStart !== undefined ? { auto_start: inputs.autoStart } : {}), ...(inputs.autoDelete !== undefined ? { auto_delete: inputs.autoDelete } : {}), ...(inputs.runSample !== undefined ? { run_sample: inputs.runSample } : {}) }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'bulkSearch': {
                const params = new URLSearchParams({ ...(inputs.jobStatus ? { job_status: inputs.jobStatus } : {}), ...(inputs.page ? { page: String(inputs.page) } : {}), ...(inputs.itemsPerPage ? { items_per_page: String(inputs.itemsPerPage) } : {}) });
                const res = await fetch(`${BASE}/jobs/search?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'bulkStatus': {
                const res = await fetch(`${BASE}/jobs/status`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ job_id: inputs.jobId }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'bulkDownload': {
                const res = await fetch(`${BASE}/jobs/download`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ job_id: inputs.jobId, ...(inputs.valids !== undefined ? { valids: inputs.valids } : {}), ...(inputs.invalids !== undefined ? { invalids: inputs.invalids } : {}), ...(inputs.disposables !== undefined ? { disposables: inputs.disposables } : {}), ...(inputs.catchalls !== undefined ? { catchalls: inputs.catchalls } : {}), ...(inputs.unknowns !== undefined ? { unknowns: inputs.unknowns } : {}) }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'bulkParse': {
                const res = await fetch(`${BASE}/jobs/parse`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ job_id: inputs.jobId, ...(inputs.autoStart !== undefined ? { auto_start: inputs.autoStart } : {}) }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'bulkDelete': {
                const res = await fetch(`${BASE}/jobs/delete`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ job_id: inputs.jobId }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getAccountInfo': {
                const res = await fetch(`${BASE}/account/info`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listJobs': {
                const params = new URLSearchParams({ ...(inputs.page ? { page: String(inputs.page) } : {}), ...(inputs.itemsPerPage ? { items_per_page: String(inputs.itemsPerPage) } : {}) });
                const res = await fetch(`${BASE}/jobs/search?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getJob': {
                const res = await fetch(`${BASE}/jobs/status`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ job_id: inputs.jobId }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteJob': {
                const res = await fetch(`${BASE}/jobs/delete`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ job_id: inputs.jobId }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'verifyEmail': {
                const res = await fetch(`${BASE}/single/check`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ email: inputs.email }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getResults': {
                const res = await fetch(`${BASE}/jobs/results`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ job_id: inputs.jobId, ...(inputs.page ? { page: inputs.page } : {}), ...(inputs.itemsPerPage ? { items_per_page: inputs.itemsPerPage } : {}) }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getStats': {
                const res = await fetch(`${BASE}/jobs/results`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ job_id: inputs.jobId }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'checkCredits': {
                const res = await fetch(`${BASE}/account/info`, { headers });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown NeverBounce action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`NeverBounce action error: ${err.message}`);
        return { error: err.message || 'NeverBounce action failed' };
    }
}
