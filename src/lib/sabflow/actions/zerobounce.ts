'use server';

export async function executeZeroBounceAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.zerobounce.net/v2';
    const key = inputs.apiKey;

    try {
        switch (actionName) {
            case 'validateEmail': {
                const params = new URLSearchParams({ api_key: key, email: inputs.email, ...(inputs.ipAddress ? { ip_address: inputs.ipAddress } : {}) });
                const res = await fetch(`${BASE}/validate?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'validateEmailBatch': {
                const res = await fetch(`${BASE}/validatebatch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_key: key, email_batch: inputs.emailBatch }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getCredits': {
                const params = new URLSearchParams({ api_key: key });
                const res = await fetch(`${BASE}/getcredits?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'getApiUsage': {
                const params = new URLSearchParams({ api_key: key, start_date: inputs.startDate, end_date: inputs.endDate });
                const res = await fetch(`${BASE}/getapiusage?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'validateEmailInFile': {
                const body = new FormData();
                body.append('api_key', key);
                body.append('file', inputs.file);
                if (inputs.emailAddressColumn) body.append('email_address_column', inputs.emailAddressColumn);
                if (inputs.returnUrl) body.append('return_url', inputs.returnUrl);
                const res = await fetch(`${BASE}/sendfile`, { method: 'POST', body });
                const data = await res.json();
                return { output: data };
            }
            case 'getValidationResultFromFile': {
                const params = new URLSearchParams({ api_key: key, file_id: inputs.fileId });
                const res = await fetch(`${BASE}/getfile?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'scoringValidate': {
                const params = new URLSearchParams({ api_key: key, email: inputs.email });
                const res = await fetch(`${BASE}/scoring/validate?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'scoringBatch': {
                const res = await fetch(`${BASE}/scoring/validatebatch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_key: key, email_batch: inputs.emailBatch }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getActivityData': {
                const params = new URLSearchParams({ api_key: key, email: inputs.email });
                const res = await fetch(`${BASE}/activity?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'findEmail': {
                const params = new URLSearchParams({ api_key: key, domain: inputs.domain, first_name: inputs.firstName, last_name: inputs.lastName });
                const res = await fetch(`${BASE}/guessformat?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'getDomainSearchResult': {
                const params = new URLSearchParams({ api_key: key, domain: inputs.domain });
                const res = await fetch(`${BASE}/domain-search?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'listFilesUploaded': {
                const params = new URLSearchParams({ api_key: key });
                const res = await fetch(`${BASE}/getfiles?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'deleteFile': {
                const params = new URLSearchParams({ api_key: key, file_id: inputs.fileId });
                const res = await fetch(`${BASE}/deletefile?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'getFile': {
                const params = new URLSearchParams({ api_key: key, file_id: inputs.fileId });
                const res = await fetch(`${BASE}/getfile?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'sendFeedback': {
                const res = await fetch(`${BASE}/feedback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_key: key, email: inputs.email, feedback: inputs.feedback }),
                });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown ZeroBounce action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`ZeroBounce action error: ${err.message}`);
        return { error: err.message || 'ZeroBounce action failed' };
    }
}
