'use server';

export async function executePlaidEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { clientId, secret } = inputs;
        if (!clientId || !secret) return { error: 'Plaid clientId and secret are required.' };

        const BASE = 'https://production.plaid.com';

        const post = async (path: string, body: any) => {
            const res = await fetch(`${BASE}${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'PLAID-CLIENT-ID': clientId,
                    'PLAID-SECRET': secret,
                },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error_message || json.display_message || 'Plaid API error');
            }
            return json;
        };

        switch (actionName) {
            case 'createLinkToken': {
                const { userId, clientName, products, countryCodes, language, webhook, redirectUri } = inputs;
                if (!userId || !clientName) return { error: 'userId and clientName are required.' };
                const body: any = {
                    user: { client_user_id: userId },
                    client_name: clientName,
                    products: products || ['transactions'],
                    country_codes: countryCodes || ['US'],
                    language: language || 'en',
                };
                if (webhook) body.webhook = webhook;
                if (redirectUri) body.redirect_uri = redirectUri;
                const result = await post('/link/token/create', body);
                return { output: result };
            }
            case 'exchangePublicToken': {
                const { publicToken } = inputs;
                if (!publicToken) return { error: 'publicToken is required.' };
                const result = await post('/item/public_token/exchange', { public_token: publicToken });
                return { output: result };
            }
            case 'getAccounts': {
                const { accessToken } = inputs;
                if (!accessToken) return { error: 'accessToken is required.' };
                const result = await post('/accounts/get', { access_token: accessToken });
                return { output: result };
            }
            case 'getBalance': {
                const { accessToken, accountIds } = inputs;
                if (!accessToken) return { error: 'accessToken is required.' };
                const body: any = { access_token: accessToken };
                if (accountIds) body.options = { account_ids: Array.isArray(accountIds) ? accountIds : [accountIds] };
                const result = await post('/accounts/balance/get', body);
                return { output: result };
            }
            case 'getTransactions': {
                const { accessToken, startDate, endDate, accountIds, count, offset } = inputs;
                if (!accessToken || !startDate || !endDate) return { error: 'accessToken, startDate, and endDate are required.' };
                const body: any = {
                    access_token: accessToken,
                    start_date: startDate,
                    end_date: endDate,
                    options: {},
                };
                if (accountIds) body.options.account_ids = Array.isArray(accountIds) ? accountIds : [accountIds];
                if (count) body.options.count = count;
                if (offset) body.options.offset = offset;
                const result = await post('/transactions/get', body);
                return { output: result };
            }
            case 'syncTransactions': {
                const { accessToken, cursor, count } = inputs;
                if (!accessToken) return { error: 'accessToken is required.' };
                const body: any = { access_token: accessToken };
                if (cursor) body.cursor = cursor;
                if (count) body.count = count;
                const result = await post('/transactions/sync', body);
                return { output: result };
            }
            case 'getIdentity': {
                const { accessToken, accountIds } = inputs;
                if (!accessToken) return { error: 'accessToken is required.' };
                const body: any = { access_token: accessToken };
                if (accountIds) body.options = { account_ids: Array.isArray(accountIds) ? accountIds : [accountIds] };
                const result = await post('/identity/get', body);
                return { output: result };
            }
            case 'getAuth': {
                const { accessToken, accountIds } = inputs;
                if (!accessToken) return { error: 'accessToken is required.' };
                const body: any = { access_token: accessToken };
                if (accountIds) body.options = { account_ids: Array.isArray(accountIds) ? accountIds : [accountIds] };
                const result = await post('/auth/get', body);
                return { output: result };
            }
            case 'getItem': {
                const { accessToken } = inputs;
                if (!accessToken) return { error: 'accessToken is required.' };
                const result = await post('/item/get', { access_token: accessToken });
                return { output: result };
            }
            case 'removeItem': {
                const { accessToken } = inputs;
                if (!accessToken) return { error: 'accessToken is required.' };
                const result = await post('/item/remove', { access_token: accessToken });
                return { output: result };
            }
            case 'createProcessorToken': {
                const { accessToken, accountId, processor } = inputs;
                if (!accessToken || !accountId || !processor) return { error: 'accessToken, accountId, and processor are required.' };
                const result = await post('/processor/token/create', {
                    access_token: accessToken,
                    account_id: accountId,
                    processor,
                });
                return { output: result };
            }
            case 'getInstitution': {
                const { institutionId, countryCodes } = inputs;
                if (!institutionId) return { error: 'institutionId is required.' };
                const result = await post('/institutions/get_by_id', {
                    institution_id: institutionId,
                    country_codes: countryCodes || ['US'],
                });
                return { output: result };
            }
            case 'searchInstitutions': {
                const { query, countryCodes, products } = inputs;
                if (!query) return { error: 'query is required.' };
                const body: any = {
                    query,
                    country_codes: countryCodes || ['US'],
                };
                if (products) body.products = Array.isArray(products) ? products : [products];
                const result = await post('/institutions/search', body);
                return { output: result };
            }
            case 'getInvestments': {
                const { accessToken, accountIds, startDate, endDate } = inputs;
                if (!accessToken) return { error: 'accessToken is required.' };
                const body: any = { access_token: accessToken, options: {} };
                if (accountIds) body.options.account_ids = Array.isArray(accountIds) ? accountIds : [accountIds];
                if (startDate) body.options.start_date = startDate;
                if (endDate) body.options.end_date = endDate;
                const result = await post('/investments/transactions/get', body);
                return { output: result };
            }
            case 'getLiabilities': {
                const { accessToken, accountIds } = inputs;
                if (!accessToken) return { error: 'accessToken is required.' };
                const body: any = { access_token: accessToken };
                if (accountIds) body.options = { account_ids: Array.isArray(accountIds) ? accountIds : [accountIds] };
                const result = await post('/liabilities/get', body);
                return { output: result };
            }
            default:
                logger.log(`Error: Plaid Enhanced action "${actionName}" is not implemented.`);
                return { error: `Plaid Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Plaid Enhanced action error: ${err.message}`);
        return { error: err.message || 'Unknown Plaid Enhanced error.' };
    }
}
