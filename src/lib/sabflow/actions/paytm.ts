'use server';

import crypto from 'crypto';

function generatePaytmChecksum(params: Record<string, string>, merchantKey: string): string {
    const sortedKeys = Object.keys(params).sort();
    const str = sortedKeys.map(k => params[k]).join('|');
    return crypto.createHmac('sha256', merchantKey).update(str).digest('hex');
}

export async function executePaytmAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://securegw.paytm.in';
    const merchantKey = inputs.merchantKey;
    const merchantId = inputs.merchantId;

    if (!merchantKey) return { error: 'Missing inputs.merchantKey' };
    if (!merchantId) return { error: 'Missing inputs.merchantId' };

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };

    try {
        switch (actionName) {
            case 'initiateTransaction': {
                const orderId = inputs.orderId ?? `ORDER-${Date.now()}`;
                const txnAmount = inputs.txnAmount;
                if (!txnAmount) return { error: 'Missing inputs.txnAmount' };

                const body = {
                    body: {
                        requestType: inputs.requestType ?? 'Payment',
                        mid: merchantId,
                        websiteName: inputs.websiteName ?? 'WEBSTAGING',
                        orderId,
                        txnAmount: { value: String(txnAmount), currency: inputs.currency ?? 'INR' },
                        userInfo: { custId: inputs.custId ?? 'CUST_001' },
                        callbackUrl: inputs.callbackUrl,
                    },
                };

                const checksum = generatePaytmChecksum(
                    { mid: merchantId, orderId, txnAmount: String(txnAmount) },
                    merchantKey
                );
                (body.body as any).checksumhash = checksum;

                const res = await fetch(`${BASE_URL}/theia/api/v1/initiateTransaction?mid=${merchantId}&orderId=${orderId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.body?.resultInfo?.resultMsg ?? `Paytm error: ${res.status}` };
                return { output: data };
            }

            case 'verifyTransaction': {
                const orderId = inputs.orderId;
                if (!orderId) return { error: 'Missing inputs.orderId' };
                const checksum = generatePaytmChecksum({ mid: merchantId, orderId }, merchantKey);
                const body = {
                    body: { mid: merchantId, orderId },
                    head: { signature: checksum },
                };
                const res = await fetch(`${BASE_URL}/v3/order/status`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.body?.resultInfo?.resultMsg ?? `Paytm error: ${res.status}` };
                return { output: data };
            }

            case 'refundTransaction': {
                const orderId = inputs.orderId;
                const refId = inputs.refId ?? `REFUND-${Date.now()}`;
                const txnId = inputs.txnId;
                const refundAmount = inputs.refundAmount;
                if (!orderId) return { error: 'Missing inputs.orderId' };
                if (!txnId) return { error: 'Missing inputs.txnId' };
                if (!refundAmount) return { error: 'Missing inputs.refundAmount' };
                const checksum = generatePaytmChecksum(
                    { mid: merchantId, orderId, refId, txnId, refundAmount: String(refundAmount) },
                    merchantKey
                );
                const body = {
                    body: { mid: merchantId, orderId, refId, txnId, refundAmount: String(refundAmount) },
                    head: { signature: checksum },
                };
                const res = await fetch(`${BASE_URL}/v2/refund/apply`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.body?.resultInfo?.resultMsg ?? `Paytm error: ${res.status}` };
                return { output: data };
            }

            case 'fetchTransactionStatus': {
                const orderId = inputs.orderId;
                if (!orderId) return { error: 'Missing inputs.orderId' };
                const checksum = generatePaytmChecksum({ mid: merchantId, orderId }, merchantKey);
                const body = {
                    body: { mid: merchantId, orderId },
                    head: { signature: checksum },
                };
                const res = await fetch(`${BASE_URL}/v3/order/status`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.body?.resultInfo?.resultMsg ?? `Paytm error: ${res.status}` };
                return { output: data };
            }

            case 'fetchRefundStatus': {
                const orderId = inputs.orderId;
                const refId = inputs.refId;
                if (!orderId) return { error: 'Missing inputs.orderId' };
                if (!refId) return { error: 'Missing inputs.refId' };
                const checksum = generatePaytmChecksum({ mid: merchantId, orderId, refId }, merchantKey);
                const body = {
                    body: { mid: merchantId, orderId, refId },
                    head: { signature: checksum },
                };
                const res = await fetch(`${BASE_URL}/v2/refund/status`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.body?.resultInfo?.resultMsg ?? `Paytm error: ${res.status}` };
                return { output: data };
            }

            case 'fetchBalance': {
                const checksum = generatePaytmChecksum({ mid: merchantId }, merchantKey);
                const body = {
                    body: { mid: merchantId },
                    head: { signature: checksum },
                };
                const res = await fetch(`${BASE_URL}/v1/wallet/balance`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.body?.resultInfo?.resultMsg ?? `Paytm error: ${res.status}` };
                return { output: data };
            }

            case 'createOrder': {
                const orderId = inputs.orderId ?? `ORDER-${Date.now()}`;
                const txnAmount = inputs.txnAmount;
                if (!txnAmount) return { error: 'Missing inputs.txnAmount' };
                const checksum = generatePaytmChecksum(
                    { mid: merchantId, orderId, txnAmount: String(txnAmount) },
                    merchantKey
                );
                const body = {
                    body: {
                        mid: merchantId,
                        orderId,
                        txnAmount: { value: String(txnAmount), currency: inputs.currency ?? 'INR' },
                        userInfo: { custId: inputs.custId ?? 'CUST_001' },
                    },
                    head: { signature: checksum },
                };
                const res = await fetch(`${BASE_URL}/theia/api/v1/createOrder`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.body?.resultInfo?.resultMsg ?? `Paytm error: ${res.status}` };
                return { output: data };
            }

            case 'getOrderStatus': {
                const orderId = inputs.orderId;
                if (!orderId) return { error: 'Missing inputs.orderId' };
                const checksum = generatePaytmChecksum({ mid: merchantId, orderId }, merchantKey);
                const body = {
                    body: { mid: merchantId, orderId },
                    head: { signature: checksum },
                };
                const res = await fetch(`${BASE_URL}/v3/order/status`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.body?.resultInfo?.resultMsg ?? `Paytm error: ${res.status}` };
                return { output: data };
            }

            case 'listTransactions': {
                const checksum = generatePaytmChecksum({ mid: merchantId }, merchantKey);
                const body = {
                    body: {
                        mid: merchantId,
                        startDate: inputs.startDate,
                        endDate: inputs.endDate,
                        pageNumber: inputs.pageNumber ?? 1,
                        pageSize: inputs.pageSize ?? 10,
                    },
                    head: { signature: checksum },
                };
                const res = await fetch(`${BASE_URL}/v2/merchant/transaction/list`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.body?.resultInfo?.resultMsg ?? `Paytm error: ${res.status}` };
                return { output: data };
            }

            case 'generateChecksum': {
                const params = inputs.params ?? {};
                const checksum = generatePaytmChecksum(params, merchantKey);
                return { output: { checksum } };
            }

            case 'verifyChecksum': {
                const params = inputs.params ?? {};
                const providedChecksum = inputs.checksum;
                if (!providedChecksum) return { error: 'Missing inputs.checksum' };
                const generated = generatePaytmChecksum(params, merchantKey);
                return { output: { valid: generated === providedChecksum, generatedChecksum: generated } };
            }

            case 'fetchBankOffers': {
                const res = await fetch(`${BASE_URL}/v1/payment/offers?mid=${merchantId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.body?.resultInfo?.resultMsg ?? `Paytm error: ${res.status}` };
                return { output: data };
            }

            case 'listSavedCards': {
                const custId = inputs.custId;
                if (!custId) return { error: 'Missing inputs.custId' };
                const checksum = generatePaytmChecksum({ mid: merchantId, custId }, merchantKey);
                const body = {
                    body: { mid: merchantId, custId },
                    head: { signature: checksum },
                };
                const res = await fetch(`${BASE_URL}/v1/payment/savedCards`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.body?.resultInfo?.resultMsg ?? `Paytm error: ${res.status}` };
                return { output: data };
            }

            case 'deleteSavedCard': {
                const custId = inputs.custId;
                const cardIndex = inputs.cardIndex;
                if (!custId) return { error: 'Missing inputs.custId' };
                if (cardIndex === undefined) return { error: 'Missing inputs.cardIndex' };
                const checksum = generatePaytmChecksum({ mid: merchantId, custId, cardIndex: String(cardIndex) }, merchantKey);
                const body = {
                    body: { mid: merchantId, custId, cardIndex },
                    head: { signature: checksum },
                };
                const res = await fetch(`${BASE_URL}/v1/payment/deleteSavedCard`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.body?.resultInfo?.resultMsg ?? `Paytm error: ${res.status}` };
                return { output: data };
            }

            case 'getWalletBalance': {
                const custId = inputs.custId;
                if (!custId) return { error: 'Missing inputs.custId' };
                const checksum = generatePaytmChecksum({ mid: merchantId, custId }, merchantKey);
                const body = {
                    body: { mid: merchantId, custId },
                    head: { signature: checksum },
                };
                const res = await fetch(`${BASE_URL}/v1/wallet/fetchBalance`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.body?.resultInfo?.resultMsg ?? `Paytm error: ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Unknown Paytm action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Paytm action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in executePaytmAction' };
    }
}
