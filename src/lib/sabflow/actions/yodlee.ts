'use server';

export async function executeYodleeAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { accessToken } = inputs;
        if (!accessToken) return { error: 'Yodlee accessToken is required.' };

        const BASE = 'https://production.api.yodlee.com/ysl';

        const req = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Api-Version': '1.1',
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.errorMessage || json.message || 'Yodlee API error');
            }
            return json;
        };

        switch (actionName) {
            case 'getAccounts': {
                const { accountId, status, container, providerAccountId } = inputs;
                const params = new URLSearchParams();
                if (accountId) params.set('accountId', accountId);
                if (status) params.set('status', status);
                if (container) params.set('container', container);
                if (providerAccountId) params.set('providerAccountId', providerAccountId);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/accounts${qs}`);
                return { output: result };
            }
            case 'getAccount': {
                const { accountId } = inputs;
                if (!accountId) return { error: 'accountId is required.' };
                const result = await req('GET', `/accounts/${accountId}`);
                return { output: result };
            }
            case 'addAccount': {
                const { providerAccountId, accountParam } = inputs;
                if (!providerAccountId) return { error: 'providerAccountId is required.' };
                const body: any = { providerAccountId };
                if (accountParam) body.accountParam = accountParam;
                const result = await req('POST', '/accounts', body);
                return { output: result };
            }
            case 'getTransactions': {
                const { accountId, fromDate, toDate, baseType, categoryId, categoryType, container, skip, top } = inputs;
                const params = new URLSearchParams();
                if (accountId) params.set('accountId', accountId);
                if (fromDate) params.set('fromDate', fromDate);
                if (toDate) params.set('toDate', toDate);
                if (baseType) params.set('baseType', baseType);
                if (categoryId) params.set('categoryId', categoryId);
                if (categoryType) params.set('categoryType', categoryType);
                if (container) params.set('container', container);
                if (skip) params.set('skip', String(skip));
                if (top) params.set('top', String(top));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/transactions${qs}`);
                return { output: result };
            }
            case 'getTransactionSummary': {
                const { groupBy, accountId, fromDate, toDate, categoryType } = inputs;
                if (!groupBy) return { error: 'groupBy is required.' };
                const params = new URLSearchParams();
                params.set('groupBy', groupBy);
                if (accountId) params.set('accountId', accountId);
                if (fromDate) params.set('fromDate', fromDate);
                if (toDate) params.set('toDate', toDate);
                if (categoryType) params.set('categoryType', categoryType);
                const result = await req('GET', `/transactions/summary?${params.toString()}`);
                return { output: result };
            }
            case 'getHoldings': {
                const { accountId, assetClassification } = inputs;
                const params = new URLSearchParams();
                if (accountId) params.set('accountId', accountId);
                if (assetClassification) params.set('assetClassification', assetClassification);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/holdings${qs}`);
                return { output: result };
            }
            case 'getProviders': {
                const { name, priority, skip, top } = inputs;
                const params = new URLSearchParams();
                if (name) params.set('name', name);
                if (priority) params.set('priority', priority);
                if (skip) params.set('skip', String(skip));
                if (top) params.set('top', String(top));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/providers${qs}`);
                return { output: result };
            }
            case 'getProvider': {
                const { providerId } = inputs;
                if (!providerId) return { error: 'providerId is required.' };
                const result = await req('GET', `/providers/${providerId}`);
                return { output: result };
            }
            case 'getUser': {
                const result = await req('GET', '/user');
                return { output: result };
            }
            case 'registerUser': {
                const { loginName, email, firstName, lastName, currency, timeZone, dateFormat } = inputs;
                if (!loginName || !email) return { error: 'loginName and email are required.' };
                const body: any = {
                    user: {
                        loginName,
                        email,
                        name: {},
                        preferences: {},
                    },
                };
                if (firstName) body.user.name.first = firstName;
                if (lastName) body.user.name.last = lastName;
                if (currency) body.user.preferences.currency = currency;
                if (timeZone) body.user.preferences.timeZone = timeZone;
                if (dateFormat) body.user.preferences.dateFormat = dateFormat;
                const result = await req('POST', '/user/register', body);
                return { output: result };
            }
            case 'updateUser': {
                const { email, firstName, lastName, currency, timeZone } = inputs;
                const body: any = { user: { name: {}, preferences: {} } };
                if (email) body.user.email = email;
                if (firstName) body.user.name.first = firstName;
                if (lastName) body.user.name.last = lastName;
                if (currency) body.user.preferences.currency = currency;
                if (timeZone) body.user.preferences.timeZone = timeZone;
                const result = await req('PUT', '/user', body);
                return { output: result };
            }
            case 'deleteUser': {
                const result = await req('DELETE', '/user/unregister');
                return { output: result };
            }
            case 'getStatements': {
                const { accountId, fromDate, toDate, isLatest, status } = inputs;
                const params = new URLSearchParams();
                if (accountId) params.set('accountId', accountId);
                if (fromDate) params.set('fromDate', fromDate);
                if (toDate) params.set('toDate', toDate);
                if (isLatest !== undefined) params.set('isLatest', String(isLatest));
                if (status) params.set('status', status);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/statements${qs}`);
                return { output: result };
            }
            case 'getDocuments': {
                const { keyword, accountId, docType, fromDate, toDate } = inputs;
                const params = new URLSearchParams();
                if (keyword) params.set('keyword', keyword);
                if (accountId) params.set('accountId', accountId);
                if (docType) params.set('docType', docType);
                if (fromDate) params.set('fromDate', fromDate);
                if (toDate) params.set('toDate', toDate);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/documents${qs}`);
                return { output: result };
            }
            case 'getDocument': {
                const { documentId } = inputs;
                if (!documentId) return { error: 'documentId is required.' };
                const result = await req('GET', `/documents/${documentId}`);
                return { output: result };
            }
            default:
                logger.log(`Error: Yodlee action "${actionName}" is not implemented.`);
                return { error: `Yodlee action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Yodlee action error: ${err.message}`);
        return { error: err.message || 'Unknown Yodlee error.' };
    }
}
