'use server';

export async function executePlaidAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { clientId, secret, env } = inputs;
        if (!clientId || !secret) return { error: 'Plaid clientId and secret are required.' };

        const BASE = env === 'sandbox'
            ? 'https://sandbox.plaid.com'
            : 'https://production.plaid.com';

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'PLAID-CLIENT-ID': clientId,
            'PLAID-SECRET': secret,
        };

        const post = async (path: string, body: any) => {
            const res = await fetch(`${BASE}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) {
                const errMsg = json.error_message || json.display_message || 'Plaid API error';
                throw new Error(errMsg);
            }
            return json;
        };

        switch (actionName) {
            case 'createLinkToken': {
                const { userId, clientName, products, countryCodes, language, webhook, redirectUri } = inputs;
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
                const result = await post('/item/public_token/exchange', { public_token: publicToken });
                return { output: result };
            }
            case 'getItem': {
                const { accessToken } = inputs;
                const result = await post('/item/get', { access_token: accessToken });
                return { output: result };
            }
            case 'getAccounts': {
                const { accessToken } = inputs;
                const result = await post('/accounts/get', { access_token: accessToken });
                return { output: result };
            }
            case 'getBalance': {
                const { accessToken, accountIds } = inputs;
                const body: any = { access_token: accessToken };
                if (accountIds) body.options = { account_ids: accountIds };
                const result = await post('/accounts/balance/get', body);
                return { output: result };
            }
            case 'getTransactions': {
                const { accessToken, startDate, endDate, accountIds, count, offset } = inputs;
                const body: any = {
                    access_token: accessToken,
                    start_date: startDate,
                    end_date: endDate,
                };
                const options: any = {};
                if (accountIds) options.account_ids = accountIds;
                if (count) options.count = count;
                if (offset) options.offset = offset;
                if (Object.keys(options).length) body.options = options;
                const result = await post('/transactions/get', body);
                return { output: result };
            }
            case 'getIdentity': {
                const { accessToken } = inputs;
                const result = await post('/identity/get', { access_token: accessToken });
                return { output: result };
            }
            case 'getInstitution': {
                const { institutionId, countryCodes } = inputs;
                const result = await post('/institutions/get_by_id', {
                    institution_id: institutionId,
                    country_codes: countryCodes || ['US'],
                    options: { include_optional_metadata: true },
                });
                return { output: result };
            }
            case 'searchInstitutions': {
                const { query, products, countryCodes } = inputs;
                const result = await post('/institutions/search', {
                    query,
                    products: products || ['transactions'],
                    country_codes: countryCodes || ['US'],
                });
                return { output: result };
            }
            case 'getCategories': {
                const result = await post('/categories/get', {});
                return { output: result };
            }
            case 'getInvestmentHoldings': {
                const { accessToken, accountIds } = inputs;
                const body: any = { access_token: accessToken };
                if (accountIds) body.options = { account_ids: accountIds };
                const result = await post('/investments/holdings/get', body);
                return { output: result };
            }
            case 'getInvestmentTransactions': {
                const { accessToken, startDate, endDate, accountIds, count, offset } = inputs;
                const body: any = {
                    access_token: accessToken,
                    start_date: startDate,
                    end_date: endDate,
                };
                const options: any = {};
                if (accountIds) options.account_ids = accountIds;
                if (count) options.count = count;
                if (offset) options.offset = offset;
                if (Object.keys(options).length) body.options = options;
                const result = await post('/investments/transactions/get', body);
                return { output: result };
            }
            case 'sandboxPublicTokenCreate': {
                const { institutionId, initialProducts, webhook } = inputs;
                const body: any = {
                    institution_id: institutionId || 'ins_109508',
                    initial_products: initialProducts || ['transactions'],
                };
                if (webhook) body.options = { webhook };
                const result = await post('/sandbox/public_token/create', body);
                return { output: result };
            }
            default:
                return { error: `Plaid action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        return { error: err.message || 'An unexpected error occurred in Plaid action.' };
    }
}
