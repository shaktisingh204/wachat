'use server';

export async function executeAuthorizeNetAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiLoginId = String(inputs.apiLoginId ?? '').trim();
        const transactionKey = String(inputs.transactionKey ?? '').trim();
        if (!apiLoginId || !transactionKey) throw new Error('apiLoginId and transactionKey are required.');

        const isSandbox = inputs.sandbox !== false && inputs.sandbox !== 'false';
        const baseUrl = isSandbox
            ? 'https://apitest.authorize.net/xml/v1/request.api'
            : 'https://api.authorize.net/xml/v1/request.api';

        const merchantAuth = { name: apiLoginId, transactionKey };

        async function anetPost(requestKey: string, requestBody: Record<string, any>) {
            logger?.log(`[AuthorizeNet] ${requestKey}`);
            const payload = { [requestKey]: { merchantAuthentication: merchantAuth, ...requestBody } };
            const res = await fetch(baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const text = await res.text();
            // Authorize.Net returns BOM-prefixed JSON sometimes
            const cleaned = text.replace(/^\uFEFF/, '');
            const json = JSON.parse(cleaned);
            const messages = json?.messages;
            if (messages?.resultCode === 'Error') {
                throw new Error(messages?.message?.[0]?.text || 'Authorize.Net error');
            }
            return json;
        }

        switch (actionName) {
            case 'chargeCard': {
                const amount = String(inputs.amount ?? '').trim();
                const cardNumber = String(inputs.cardNumber ?? '').trim();
                const expirationDate = String(inputs.expirationDate ?? '').trim();
                if (!amount || !cardNumber || !expirationDate) throw new Error('amount, cardNumber, and expirationDate are required.');
                const data = await anetPost('createTransactionRequest', {
                    transactionRequest: {
                        transactionType: 'authCaptureTransaction',
                        amount,
                        payment: { creditCard: { cardNumber, expirationDate, cardCode: inputs.cardCode ?? '' } },
                    },
                });
                const tx = data?.transactionResponse;
                return { output: { transId: tx?.transId, responseCode: tx?.responseCode, authCode: tx?.authCode, messages: tx?.messages } };
            }

            case 'authorizeCard': {
                const amount = String(inputs.amount ?? '').trim();
                const cardNumber = String(inputs.cardNumber ?? '').trim();
                const expirationDate = String(inputs.expirationDate ?? '').trim();
                if (!amount || !cardNumber || !expirationDate) throw new Error('amount, cardNumber, and expirationDate are required.');
                const data = await anetPost('createTransactionRequest', {
                    transactionRequest: {
                        transactionType: 'authOnlyTransaction',
                        amount,
                        payment: { creditCard: { cardNumber, expirationDate, cardCode: inputs.cardCode ?? '' } },
                    },
                });
                const tx = data?.transactionResponse;
                return { output: { transId: tx?.transId, responseCode: tx?.responseCode, authCode: tx?.authCode } };
            }

            case 'captureTransaction': {
                const transId = String(inputs.transId ?? '').trim();
                const amount = String(inputs.amount ?? '').trim();
                if (!transId || !amount) throw new Error('transId and amount are required.');
                const data = await anetPost('createTransactionRequest', {
                    transactionRequest: { transactionType: 'priorAuthCaptureTransaction', amount, refTransId: transId },
                });
                const tx = data?.transactionResponse;
                return { output: { transId: tx?.transId, responseCode: tx?.responseCode } };
            }

            case 'refundTransaction': {
                const transId = String(inputs.transId ?? '').trim();
                const amount = String(inputs.amount ?? '').trim();
                const cardNumber = String(inputs.cardNumber ?? '').trim();
                const expirationDate = String(inputs.expirationDate ?? 'XXXX').trim();
                if (!transId || !amount || !cardNumber) throw new Error('transId, amount, and cardNumber are required.');
                const data = await anetPost('createTransactionRequest', {
                    transactionRequest: {
                        transactionType: 'refundTransaction',
                        amount,
                        payment: { creditCard: { cardNumber, expirationDate } },
                        refTransId: transId,
                    },
                });
                const tx = data?.transactionResponse;
                return { output: { transId: tx?.transId, responseCode: tx?.responseCode } };
            }

            case 'voidTransaction': {
                const transId = String(inputs.transId ?? '').trim();
                if (!transId) throw new Error('transId is required.');
                const data = await anetPost('createTransactionRequest', {
                    transactionRequest: { transactionType: 'voidTransaction', refTransId: transId },
                });
                const tx = data?.transactionResponse;
                return { output: { transId: tx?.transId, responseCode: tx?.responseCode } };
            }

            case 'getTransaction': {
                const transId = String(inputs.transId ?? '').trim();
                if (!transId) throw new Error('transId is required.');
                const data = await anetPost('getTransactionDetailsRequest', { transId });
                const tx = data?.transaction;
                return { output: { transId: tx?.transId, transactionStatus: tx?.transactionStatus, settleAmount: tx?.settleAmount, submitTimeUTC: tx?.submitTimeUTC } };
            }

            case 'listTransactions': {
                const batchId = String(inputs.batchId ?? '').trim();
                if (!batchId) throw new Error('batchId is required.');
                const data = await anetPost('getTransactionListRequest', { batchId });
                const transactions = data?.transactions?.transaction ?? [];
                return { output: { transactions: Array.isArray(transactions) ? transactions : [transactions] } };
            }

            case 'createCustomerProfile': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const profile: any = { email };
                if (inputs.description) profile.description = String(inputs.description);
                if (inputs.merchantCustomerId) profile.merchantCustomerId = String(inputs.merchantCustomerId);
                const data = await anetPost('createCustomerProfileRequest', { profile, validationMode: inputs.validationMode ?? 'none' });
                return { output: { customerProfileId: data?.customerProfileId } };
            }

            case 'getCustomerProfile': {
                const customerProfileId = String(inputs.customerProfileId ?? '').trim();
                if (!customerProfileId) throw new Error('customerProfileId is required.');
                const data = await anetPost('getCustomerProfileRequest', { customerProfileId });
                const profile = data?.profile;
                return { output: { customerProfileId: profile?.customerProfileId, email: profile?.email, description: profile?.description, merchantCustomerId: profile?.merchantCustomerId } };
            }

            case 'updateCustomerProfile': {
                const customerProfileId = String(inputs.customerProfileId ?? '').trim();
                if (!customerProfileId) throw new Error('customerProfileId is required.');
                const profile: any = { customerProfileId };
                if (inputs.email) profile.email = String(inputs.email);
                if (inputs.description) profile.description = String(inputs.description);
                if (inputs.merchantCustomerId) profile.merchantCustomerId = String(inputs.merchantCustomerId);
                const data = await anetPost('updateCustomerProfileRequest', { profile });
                return { output: { success: true, resultCode: data?.messages?.resultCode } };
            }

            case 'deleteCustomerProfile': {
                const customerProfileId = String(inputs.customerProfileId ?? '').trim();
                if (!customerProfileId) throw new Error('customerProfileId is required.');
                const data = await anetPost('deleteCustomerProfileRequest', { customerProfileId });
                return { output: { success: true, resultCode: data?.messages?.resultCode } };
            }

            case 'createPaymentProfile': {
                const customerProfileId = String(inputs.customerProfileId ?? '').trim();
                const cardNumber = String(inputs.cardNumber ?? '').trim();
                const expirationDate = String(inputs.expirationDate ?? '').trim();
                if (!customerProfileId || !cardNumber || !expirationDate) throw new Error('customerProfileId, cardNumber, and expirationDate are required.');
                const data = await anetPost('createCustomerPaymentProfileRequest', {
                    customerProfileId,
                    paymentProfile: {
                        payment: { creditCard: { cardNumber, expirationDate } },
                    },
                    validationMode: inputs.validationMode ?? 'none',
                });
                return { output: { customerPaymentProfileId: data?.customerPaymentProfileId } };
            }

            case 'getPaymentProfile': {
                const customerProfileId = String(inputs.customerProfileId ?? '').trim();
                const customerPaymentProfileId = String(inputs.customerPaymentProfileId ?? '').trim();
                if (!customerProfileId || !customerPaymentProfileId) throw new Error('customerProfileId and customerPaymentProfileId are required.');
                const data = await anetPost('getCustomerPaymentProfileRequest', { customerProfileId, customerPaymentProfileId });
                const pp = data?.paymentProfile;
                return { output: { customerPaymentProfileId: pp?.customerPaymentProfileId, customerProfileId: pp?.customerProfileId } };
            }

            case 'chargeCustomerProfile': {
                const customerProfileId = String(inputs.customerProfileId ?? '').trim();
                const customerPaymentProfileId = String(inputs.customerPaymentProfileId ?? '').trim();
                const amount = String(inputs.amount ?? '').trim();
                if (!customerProfileId || !customerPaymentProfileId || !amount) throw new Error('customerProfileId, customerPaymentProfileId, and amount are required.');
                const data = await anetPost('createTransactionRequest', {
                    transactionRequest: {
                        transactionType: 'authCaptureTransaction',
                        amount,
                        profile: { customerProfileId, paymentProfile: { paymentProfileId: customerPaymentProfileId } },
                    },
                });
                const tx = data?.transactionResponse;
                return { output: { transId: tx?.transId, responseCode: tx?.responseCode, authCode: tx?.authCode } };
            }

            case 'createRecurringSubscription': {
                const name = String(inputs.name ?? 'Subscription').trim();
                const amount = String(inputs.amount ?? '').trim();
                const cardNumber = String(inputs.cardNumber ?? '').trim();
                const expirationDate = String(inputs.expirationDate ?? '').trim();
                const intervalLength = Number(inputs.intervalLength ?? 1);
                const intervalUnit = String(inputs.intervalUnit ?? 'months').trim();
                const startDate = String(inputs.startDate ?? new Date().toISOString().split('T')[0]).trim();
                const totalOccurrences = Number(inputs.totalOccurrences ?? 9999);
                if (!amount || !cardNumber || !expirationDate) throw new Error('amount, cardNumber, and expirationDate are required.');
                const data = await anetPost('ARBCreateSubscriptionRequest', {
                    subscription: {
                        name,
                        paymentSchedule: { interval: { length: intervalLength, unit: intervalUnit }, startDate, totalOccurrences },
                        amount,
                        payment: { creditCard: { cardNumber, expirationDate } },
                    },
                });
                return { output: { subscriptionId: data?.subscriptionId } };
            }

            default:
                return { error: `Authorize.Net action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Authorize.Net action failed.' };
    }
}
