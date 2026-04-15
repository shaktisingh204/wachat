
'use server';

const MINDEE_BASE = 'https://api.mindee.net/v1';

async function mindeeFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Mindee] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Token ${apiKey}`,
            Accept: 'application/json',
        },
    };
    if (body !== undefined) {
        options.headers = { ...(options.headers as Record<string, string>), 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
    }
    const res = await fetch(`${MINDEE_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.api_request?.error?.message || data?.message || `Mindee API error: ${res.status}`);
    }
    return data;
}

async function mindeeParseUrl(apiKey: string, endpoint: string, documentUrl: string, logger?: any) {
    return mindeeFetch(apiKey, 'POST', endpoint, { document: documentUrl }, logger);
}

export async function executeMindeeAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const documentUrl = String(inputs.documentUrl ?? inputs.document ?? '').trim();
        const accountName = String(inputs.accountName ?? '').trim();

        switch (actionName) {
            case 'parsePassport': {
                if (!documentUrl) throw new Error('documentUrl is required.');
                const data = await mindeeParseUrl(apiKey, `/products/mindee/passport/v1/predict`, documentUrl, logger);
                return { output: { document: data.document ?? data } };
            }

            case 'parseInvoice': {
                if (!documentUrl) throw new Error('documentUrl is required.');
                const data = await mindeeParseUrl(apiKey, `/products/mindee/invoices/v4/predict`, documentUrl, logger);
                return { output: { document: data.document ?? data } };
            }

            case 'parseReceipt': {
                if (!documentUrl) throw new Error('documentUrl is required.');
                const data = await mindeeParseUrl(apiKey, `/products/mindee/expense_receipts/v5/predict`, documentUrl, logger);
                return { output: { document: data.document ?? data } };
            }

            case 'parseIdCard': {
                if (!documentUrl) throw new Error('documentUrl is required.');
                const data = await mindeeParseUrl(apiKey, `/products/mindee/idcard_fr/v2/predict`, documentUrl, logger);
                return { output: { document: data.document ?? data } };
            }

            case 'parseBankCheck': {
                if (!documentUrl) throw new Error('documentUrl is required.');
                const data = await mindeeParseUrl(apiKey, `/products/mindee/bank_check/v1/predict`, documentUrl, logger);
                return { output: { document: data.document ?? data } };
            }

            case 'parseW9': {
                if (!documentUrl) throw new Error('documentUrl is required.');
                const data = await mindeeParseUrl(apiKey, `/products/mindee/us_w9/v1/predict`, documentUrl, logger);
                return { output: { document: data.document ?? data } };
            }

            case 'parseDriverLicense': {
                if (!documentUrl) throw new Error('documentUrl is required.');
                const data = await mindeeParseUrl(apiKey, `/products/mindee/us_driver_license/v1/predict`, documentUrl, logger);
                return { output: { document: data.document ?? data } };
            }

            case 'parseMultiReceipts': {
                if (!documentUrl) throw new Error('documentUrl is required.');
                const data = await mindeeParseUrl(apiKey, `/products/mindee/multi_receipts_detector/v1/predict`, documentUrl, logger);
                return { output: { document: data.document ?? data } };
            }

            case 'parsePaySlip': {
                if (!documentUrl) throw new Error('documentUrl is required.');
                const data = await mindeeParseUrl(apiKey, `/products/mindee/payslip_fra/v3/predict`, documentUrl, logger);
                return { output: { document: data.document ?? data } };
            }

            case 'parseCustomDocument': {
                if (!accountName) throw new Error('accountName is required.');
                const endpointName = String(inputs.endpointName ?? '').trim();
                const version = String(inputs.version ?? '1').trim();
                if (!endpointName) throw new Error('endpointName is required.');
                if (!documentUrl) throw new Error('documentUrl is required.');
                const data = await mindeeParseUrl(apiKey, `/products/${accountName}/${endpointName}/v${version}/predict`, documentUrl, logger);
                return { output: { document: data.document ?? data } };
            }

            default:
                return { error: `Mindee action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Mindee action failed.' };
    }
}
