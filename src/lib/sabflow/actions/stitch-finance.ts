'use server';

export async function executeStitchFinanceAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.stitch.money';
        const clientId = inputs.clientId as string;
        const clientSecret = inputs.clientSecret as string;

        // OAuth2 client credentials token
        const tokenRes = await fetch(`${baseUrl}/connect/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
                audience: 'https://secure.stitch.money/connect/token',
                scope: inputs.scope ?? 'client_paymentrequest',
            }).toString(),
        });
        if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            return { error: `Stitch Finance auth failed: ${tokenRes.status} ${errText}` };
        }
        const tokenData = await tokenRes.json();
        const accessToken: string = tokenData.access_token;

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        switch (actionName) {
            case 'getClientToken': {
                return { output: { accessToken, tokenType: tokenData.token_type, expiresIn: tokenData.expires_in } };
            }

            case 'listPaymentInitiationRequests': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `query ListPaymentRequests($first: Int, $after: String) {
                            client { paymentInitiationRequests(first: $first, after: $after) {
                                edges { node { id status amount { quantity currency } beneficiaryReference created } }
                                pageInfo { hasNextPage endCursor }
                            }}
                        }`,
                        variables: { first: inputs.first ?? 20, after: inputs.after },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `listPaymentInitiationRequests failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getPaymentInitiation': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `query GetPaymentRequest($id: ID!) {
                            node(id: $id) { ... on PaymentInitiationRequest {
                                id status amount { quantity currency } beneficiaryReference created updated
                            }}
                        }`,
                        variables: { id: inputs.paymentId },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `getPaymentInitiation failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'initiatePayment': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `mutation CreatePaymentRequest($input: CreatePaymentInitiationRequestInput!) {
                            clientPaymentInitiationRequestCreate(input: $input) {
                                paymentInitiationRequest { id url }
                            }
                        }`,
                        variables: {
                            input: {
                                amount: inputs.amount,
                                payerReference: inputs.payerReference,
                                beneficiaryReference: inputs.beneficiaryReference,
                                externalReference: inputs.externalReference,
                                beneficiary: inputs.beneficiary,
                            },
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `initiatePayment failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'listBankAccounts': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `query ListBankAccounts {
                            user { bankAccounts { id accountNumber name accountType bank { id name } } }
                        }`,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `listBankAccounts failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'listUserInfo': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `query UserInfo {
                            user { id fullName email phoneNumber }
                        }`,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `listUserInfo failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'createRefund': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `mutation CreateRefund($input: CreateRefundInput!) {
                            refundCreate(input: $input) {
                                refund { id status amount { quantity currency } created }
                            }
                        }`,
                        variables: {
                            input: {
                                paymentInitiationRequestId: inputs.paymentId,
                                amount: inputs.amount,
                                reason: inputs.reason,
                                beneficiary: inputs.beneficiary,
                                externalReference: inputs.externalReference,
                            },
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `createRefund failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getRefund': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `query GetRefund($id: ID!) {
                            node(id: $id) { ... on Refund { id status amount { quantity currency } created updated } }
                        }`,
                        variables: { id: inputs.refundId },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `getRefund failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'listSubscriptions': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `query ListSubscriptions($first: Int, $after: String) {
                            client { subscriptions(first: $first, after: $after) {
                                edges { node { id status created } }
                                pageInfo { hasNextPage endCursor }
                            }}
                        }`,
                        variables: { first: inputs.first ?? 20, after: inputs.after },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `listSubscriptions failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'createSubscription': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `mutation CreateSubscription($input: CreateSubscriptionInput!) {
                            subscriptionCreate(input: $input) {
                                subscription { id status created }
                            }
                        }`,
                        variables: { input: inputs.subscriptionInput },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `createSubscription failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'cancelSubscription': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `mutation CancelSubscription($subscriptionId: ID!) {
                            subscriptionCancel(subscriptionId: $subscriptionId) {
                                subscription { id status }
                            }
                        }`,
                        variables: { subscriptionId: inputs.subscriptionId },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `cancelSubscription failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getPaymentLink': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `query GetPaymentLink($id: ID!) {
                            node(id: $id) { ... on PaymentInitiationRequest { id url status } }
                        }`,
                        variables: { id: inputs.paymentLinkId },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `getPaymentLink failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'createPaymentLink': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `mutation CreatePaymentLink($input: CreatePaymentInitiationRequestInput!) {
                            clientPaymentInitiationRequestCreate(input: $input) {
                                paymentInitiationRequest { id url }
                            }
                        }`,
                        variables: {
                            input: {
                                amount: inputs.amount,
                                payerReference: inputs.payerReference,
                                beneficiaryReference: inputs.beneficiaryReference,
                                externalReference: inputs.externalReference,
                                beneficiary: inputs.beneficiary,
                                redirectUrl: inputs.redirectUrl,
                            },
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `createPaymentLink failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'listTransfers': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `query ListTransfers($first: Int, $after: String) {
                            client { transfers(first: $first, after: $after) {
                                edges { node { id status amount { quantity currency } created } }
                                pageInfo { hasNextPage endCursor }
                            }}
                        }`,
                        variables: { first: inputs.first ?? 20, after: inputs.after },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `listTransfers failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            case 'getTransfer': {
                const res = await fetch(`${baseUrl}/graphql`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: `query GetTransfer($id: ID!) {
                            node(id: $id) { ... on Transfer { id status amount { quantity currency } created updated } }
                        }`,
                        variables: { id: inputs.transferId },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: `getTransfer failed: ${res.status} ${JSON.stringify(data)}` };
                return { output: data };
            }

            default:
                return { error: `Unknown Stitch Finance action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Stitch Finance action error: ${err?.message}`);
        return { error: err?.message ?? 'Unknown error in executeStitchFinanceAction' };
    }
}
