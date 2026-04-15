'use server';

// ---------------------------------------------------------------------------
// Wise (TransferWise) – Money transfer & currency exchange API
// Docs: https://docs.wise.com/api-docs
// ---------------------------------------------------------------------------

async function wiseFetch(
    apiKey: string,
    sandbox: boolean,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const base = sandbox
        ? 'https://api.sandbox.transferwise.tech'
        : 'https://api.wise.com';
    const url = `${base}${path}`;
    logger?.log(`[Wise] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    // 204 No Content
    if (res.status === 204) return {};

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }
    if (!res.ok) {
        const msg =
            data?.errors?.[0]?.message ??
            data?.error_description ??
            data?.message ??
            `Wise API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

function buildQuery(params: Record<string, any>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        }
    }
    return parts.length ? `?${parts.join('&')}` : '';
}

export async function executeWiseAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('"apiKey" is required.');
        const sandbox = inputs.sandbox === true || inputs.sandbox === 'true';

        const wise = (method: string, path: string, body?: any) =>
            wiseFetch(apiKey, sandbox, method, path, body, logger);

        switch (actionName) {
            // ── Profiles ──────────────────────────────────────────────────────
            case 'getProfile': {
                const data = await wise('GET', '/v2/profiles');
                const profiles = Array.isArray(data) ? data : [];
                return {
                    output: {
                        profiles: profiles.map((p: any) => ({
                            id: p.id,
                            type: p.type,
                            details: {
                                firstName: p.details?.firstName,
                                lastName: p.details?.lastName,
                                email: p.details?.email ?? p.details?.businessName,
                            },
                        })),
                    },
                };
            }

            // ── Accounts (Borderless) ─────────────────────────────────────────
            case 'listAccounts': {
                const profileId = String(inputs.profileId ?? '').trim();
                if (!profileId) throw new Error('"profileId" is required.');
                const data = await wise('GET', `/v2/borderless-accounts${buildQuery({ profileId })}`);
                const accounts = Array.isArray(data) ? data : [];
                return {
                    output: {
                        accounts: accounts.map((a: any) => ({
                            id: a.id,
                            currency: a.currency,
                            cashAmount: a.cashAmount,
                            totalWorth: a.totalWorth,
                        })),
                    },
                };
            }

            // ── Exchange Rates ────────────────────────────────────────────────
            case 'getExchangeRate': {
                const source = String(inputs.source ?? '').trim().toUpperCase();
                const target = String(inputs.target ?? '').trim().toUpperCase();
                if (!source) throw new Error('"source" currency is required.');
                if (!target) throw new Error('"target" currency is required.');
                const q = buildQuery({ source, target, amount: inputs.amount });
                const data = await wise('GET', `/v1/rates${q}`);
                const rates = Array.isArray(data) ? data : [];
                return {
                    output: {
                        rate: rates[0]?.rate ?? null,
                        source,
                        target,
                    },
                };
            }

            // ── Quotes ────────────────────────────────────────────────────────
            case 'createQuote': {
                const profileId = String(inputs.profileId ?? '').trim();
                const sourceCurrency = String(inputs.sourceCurrency ?? '').trim().toUpperCase();
                const targetCurrency = String(inputs.targetCurrency ?? '').trim().toUpperCase();
                if (!profileId) throw new Error('"profileId" is required.');
                if (!sourceCurrency) throw new Error('"sourceCurrency" is required.');
                if (!targetCurrency) throw new Error('"targetCurrency" is required.');
                const body: any = {
                    sourceCurrency,
                    targetCurrency,
                    payOut: 'BANK_TRANSFER',
                };
                if (inputs.sourceAmount !== undefined) body.sourceAmount = Number(inputs.sourceAmount);
                if (inputs.targetAmount !== undefined) body.targetAmount = Number(inputs.targetAmount);
                const data = await wise('POST', `/v3/profiles/${profileId}/quotes`, body);
                return {
                    output: {
                        id: data.id,
                        rate: data.rate,
                        sourceAmount: data.sourceAmount,
                        targetAmount: data.targetAmount,
                        fee: data.fee,
                    },
                };
            }

            // ── Recipients ────────────────────────────────────────────────────
            case 'createRecipient': {
                const profileId = String(inputs.profileId ?? '').trim();
                const currency = String(inputs.currency ?? '').trim().toUpperCase();
                const type = String(inputs.type ?? '').trim();
                if (!profileId) throw new Error('"profileId" is required.');
                if (!currency) throw new Error('"currency" is required.');
                if (!type) throw new Error('"type" is required.');
                const details =
                    typeof inputs.details === 'string'
                        ? JSON.parse(inputs.details)
                        : inputs.details ?? {};
                const data = await wise('POST', '/v1/accounts', {
                    profile: Number(profileId),
                    currency,
                    type,
                    details,
                });
                return {
                    output: { id: data.id, currency: data.currency, type: data.type },
                };
            }

            case 'listRecipients': {
                const profileId = String(inputs.profileId ?? '').trim();
                if (!profileId) throw new Error('"profileId" is required.');
                const q = buildQuery({ profile: profileId, currency: inputs.currency });
                const data = await wise('GET', `/v1/accounts${q}`);
                const accounts = Array.isArray(data) ? data : [];
                return {
                    output: {
                        accounts: accounts.map((a: any) => ({
                            id: a.id,
                            currency: a.currency,
                            accountSummary: a.accountSummary,
                        })),
                    },
                };
            }

            // ── Transfers ─────────────────────────────────────────────────────
            case 'createTransfer': {
                const targetAccountId = Number(inputs.targetAccountId);
                const quoteUuid = String(inputs.quoteUuid ?? '').trim();
                if (!targetAccountId) throw new Error('"targetAccountId" is required.');
                if (!quoteUuid) throw new Error('"quoteUuid" is required.');
                const body: any = {
                    targetAccount: targetAccountId,
                    quoteUuid,
                    customerTransactionId: `sabflow-${Date.now()}`,
                    details: {
                        reference: inputs.reference ?? '',
                        transferPurpose: inputs.transferPurpose,
                    },
                };
                const data = await wise('POST', '/v1/transfers', body);
                return {
                    output: {
                        id: data.id,
                        status: data.status,
                        rate: data.rate,
                        fee: data.sourceFee,
                    },
                };
            }

            case 'fundTransfer': {
                const profileId = String(inputs.profileId ?? '').trim();
                const transferId = String(inputs.transferId ?? '').trim();
                if (!profileId) throw new Error('"profileId" is required.');
                if (!transferId) throw new Error('"transferId" is required.');
                const data = await wise(
                    'POST',
                    `/v3/profiles/${profileId}/transfers/${transferId}/payments`,
                    { type: 'BALANCE' }
                );
                return {
                    output: {
                        status: data.status,
                        balanceTransactionId: data.balanceTransactionId,
                    },
                };
            }

            case 'getTransfer': {
                const transferId = String(inputs.transferId ?? '').trim();
                if (!transferId) throw new Error('"transferId" is required.');
                const data = await wise('GET', `/v1/transfers/${transferId}`);
                return {
                    output: {
                        id: data.id,
                        status: data.status,
                        targetAccount: data.targetAccount,
                        targetValue: data.targetValue,
                        targetCurrency: data.targetCurrency,
                    },
                };
            }

            case 'listTransfers': {
                const profileId = String(inputs.profileId ?? '').trim();
                if (!profileId) throw new Error('"profileId" is required.');
                const q = buildQuery({
                    profile: profileId,
                    status: inputs.status,
                    limit: inputs.limit,
                    offset: inputs.offset,
                });
                const data = await wise('GET', `/v1/transfers${q}`);
                return { output: { transfers: Array.isArray(data) ? data : [] } };
            }

            // ── Balances ──────────────────────────────────────────────────────
            case 'getBalance': {
                const profileId = String(inputs.profileId ?? '').trim();
                if (!profileId) throw new Error('"profileId" is required.');
                const data = await wise(
                    'GET',
                    `/v4/profiles/${profileId}/balances?types=STANDARD`
                );
                const balances = Array.isArray(data) ? data : [];
                return {
                    output: {
                        balances: balances.map((b: any) => ({
                            currency: b.currency,
                            amount: b.amount,
                        })),
                    },
                };
            }

            // ── Currencies ────────────────────────────────────────────────────
            case 'listCurrencies': {
                const data = await wise('GET', '/v1/currencies');
                const currencies = Array.isArray(data) ? data : [];
                return {
                    output: {
                        currencies: currencies.map((c: any) => ({
                            code: c.code,
                            name: c.name,
                            symbol: c.symbol,
                        })),
                    },
                };
            }

            default:
                return { error: `Wise action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e.message || 'Wise action failed.';
        logger?.log(`[Wise] Error in "${actionName}": ${msg}`);
        return { error: msg };
    }
}
