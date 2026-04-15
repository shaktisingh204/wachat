'use server';

export async function executeMangopayAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const clientId = inputs.clientId;
        const apiKey = inputs.apiKey;
        const credentials = Buffer.from(`${clientId}:${apiKey}`).toString('base64');
        const baseUrl = `https://api.mangopay.com/v2.01/${clientId}`;

        const headers: Record<string, string> = {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'createUser': {
                const body: Record<string, any> = {
                    FirstName: inputs.firstName,
                    LastName: inputs.lastName,
                    Email: inputs.email,
                    Birthday: inputs.birthday,
                    Nationality: inputs.nationality,
                    CountryOfResidence: inputs.countryOfResidence,
                };
                if (inputs.tag) body.Tag = inputs.tag;
                const res = await fetch(`${baseUrl}/users/natural`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createUser failed: ${res.status} ${await res.text()}` };
                return { output: { user: await res.json() } };
            }

            case 'getUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, { headers });
                if (!res.ok) return { error: `getUser failed: ${res.status} ${await res.text()}` };
                return { output: { user: await res.json() } };
            }

            case 'createWallet': {
                const body: Record<string, any> = {
                    Owners: inputs.owners,
                    Description: inputs.description,
                    Currency: inputs.currency,
                };
                if (inputs.tag) body.Tag = inputs.tag;
                const res = await fetch(`${baseUrl}/wallets`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createWallet failed: ${res.status} ${await res.text()}` };
                return { output: { wallet: await res.json() } };
            }

            case 'getWallet': {
                const res = await fetch(`${baseUrl}/wallets/${inputs.walletId}`, { headers });
                if (!res.ok) return { error: `getWallet failed: ${res.status} ${await res.text()}` };
                return { output: { wallet: await res.json() } };
            }

            case 'createPayIn': {
                const body: Record<string, any> = {
                    AuthorId: inputs.authorId,
                    CreditedWalletId: inputs.creditedWalletId,
                    DebitedFunds: { Currency: inputs.currency, Amount: inputs.amount },
                    Fees: { Currency: inputs.currency, Amount: inputs.fees || 0 },
                    ReturnURL: inputs.returnUrl,
                    CardType: inputs.cardType || 'CB_VISA_MASTERCARD',
                    SecureMode: inputs.secureMode || 'DEFAULT',
                    Culture: inputs.culture || 'EN',
                };
                const res = await fetch(`${baseUrl}/payins/card/web`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createPayIn failed: ${res.status} ${await res.text()}` };
                return { output: { payIn: await res.json() } };
            }

            case 'getPayIn': {
                const res = await fetch(`${baseUrl}/payins/${inputs.payInId}`, { headers });
                if (!res.ok) return { error: `getPayIn failed: ${res.status} ${await res.text()}` };
                return { output: { payIn: await res.json() } };
            }

            case 'createTransfer': {
                const body: Record<string, any> = {
                    AuthorId: inputs.authorId,
                    DebitedWalletId: inputs.debitedWalletId,
                    CreditedWalletId: inputs.creditedWalletId,
                    DebitedFunds: { Currency: inputs.currency, Amount: inputs.amount },
                    Fees: { Currency: inputs.currency, Amount: inputs.fees || 0 },
                };
                if (inputs.creditedUserId) body.CreditedUserId = inputs.creditedUserId;
                const res = await fetch(`${baseUrl}/transfers`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createTransfer failed: ${res.status} ${await res.text()}` };
                return { output: { transfer: await res.json() } };
            }

            case 'getTransfer': {
                const res = await fetch(`${baseUrl}/transfers/${inputs.transferId}`, { headers });
                if (!res.ok) return { error: `getTransfer failed: ${res.status} ${await res.text()}` };
                return { output: { transfer: await res.json() } };
            }

            case 'createPayOut': {
                const body: Record<string, any> = {
                    AuthorId: inputs.authorId,
                    DebitedWalletId: inputs.debitedWalletId,
                    DebitedFunds: { Currency: inputs.currency, Amount: inputs.amount },
                    Fees: { Currency: inputs.currency, Amount: inputs.fees || 0 },
                    BankAccountId: inputs.bankAccountId,
                    BankWireRef: inputs.bankWireRef,
                };
                const res = await fetch(`${baseUrl}/payouts/bankwire`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createPayOut failed: ${res.status} ${await res.text()}` };
                return { output: { payOut: await res.json() } };
            }

            case 'getPayOut': {
                const res = await fetch(`${baseUrl}/payouts/${inputs.payOutId}`, { headers });
                if (!res.ok) return { error: `getPayOut failed: ${res.status} ${await res.text()}` };
                return { output: { payOut: await res.json() } };
            }

            case 'createRefund': {
                const body: Record<string, any> = {
                    AuthorId: inputs.authorId,
                };
                if (inputs.debitedFundsAmount) {
                    body.DebitedFunds = { Currency: inputs.currency, Amount: inputs.debitedFundsAmount };
                    body.Fees = { Currency: inputs.currency, Amount: inputs.fees || 0 };
                }
                const res = await fetch(`${baseUrl}/payins/${inputs.payInId}/refunds`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createRefund failed: ${res.status} ${await res.text()}` };
                return { output: { refund: await res.json() } };
            }

            case 'getRefund': {
                const res = await fetch(`${baseUrl}/refunds/${inputs.refundId}`, { headers });
                if (!res.ok) return { error: `getRefund failed: ${res.status} ${await res.text()}` };
                return { output: { refund: await res.json() } };
            }

            case 'listTransactions': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.sort) params.set('sort', inputs.sort);
                const res = await fetch(`${baseUrl}/users/${inputs.userId}/transactions?${params}`, { headers });
                if (!res.ok) return { error: `listTransactions failed: ${res.status} ${await res.text()}` };
                return { output: { transactions: await res.json() } };
            }

            case 'getBalance': {
                const res = await fetch(`${baseUrl}/wallets/${inputs.walletId}`, { headers });
                if (!res.ok) return { error: `getBalance failed: ${res.status} ${await res.text()}` };
                const wallet = await res.json();
                return { output: { balance: wallet.Balance, currency: wallet.Currency } };
            }

            case 'createKycDocument': {
                const body: Record<string, any> = {
                    Type: inputs.type,
                };
                if (inputs.tag) body.Tag = inputs.tag;
                const res = await fetch(`${baseUrl}/users/${inputs.userId}/kyc/documents`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createKycDocument failed: ${res.status} ${await res.text()}` };
                return { output: { kycDocument: await res.json() } };
            }

            default:
                return { error: `Unknown Mangopay action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Mangopay action error: ${err.message}`);
        return { error: err.message || 'Mangopay action failed' };
    }
}
