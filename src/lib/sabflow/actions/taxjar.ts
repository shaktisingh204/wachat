'use server';

export async function executeTaxJarAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = 'https://api.taxjar.com/v2';
  const { apiKey, ...params } = inputs;

  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    async function req(method: string, path: string, body?: any) {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`TaxJar ${method} ${path} failed (${res.status}): ${text}`);
      }
      return res.json();
    }

    switch (actionName) {
      case 'getCategories': {
        const data = await req('GET', '/categories');
        return { output: data };
      }

      case 'getRates': {
        const { zip, country, state, city, street } = params;
        const query = new URLSearchParams();
        if (country) query.set('country', country);
        if (state) query.set('state', state);
        if (city) query.set('city', city);
        if (street) query.set('street', street);
        const qs = query.toString() ? `?${query.toString()}` : '';
        const data = await req('GET', `/rates/${encodeURIComponent(zip)}${qs}`);
        return { output: data };
      }

      case 'calculateTax': {
        const data = await req('POST', '/taxes', params);
        return { output: data };
      }

      case 'createTransaction': {
        const data = await req('POST', '/transactions/orders', params);
        return { output: data };
      }

      case 'getTransaction': {
        const { transactionId } = params;
        const data = await req('GET', `/transactions/orders/${encodeURIComponent(transactionId)}`);
        return { output: data };
      }

      case 'updateTransaction': {
        const { transactionId, ...body } = params;
        const data = await req('PUT', `/transactions/orders/${encodeURIComponent(transactionId)}`, body);
        return { output: data };
      }

      case 'deleteTransaction': {
        const { transactionId } = params;
        const data = await req('DELETE', `/transactions/orders/${encodeURIComponent(transactionId)}`);
        return { output: data };
      }

      case 'listTransactions': {
        const query = new URLSearchParams();
        if (params.from_transaction_date) query.set('from_transaction_date', params.from_transaction_date);
        if (params.to_transaction_date) query.set('to_transaction_date', params.to_transaction_date);
        if (params.provider) query.set('provider', params.provider);
        const qs = query.toString() ? `?${query.toString()}` : '';
        const data = await req('GET', `/transactions/orders${qs}`);
        return { output: data };
      }

      case 'createRefund': {
        const data = await req('POST', '/transactions/refunds', params);
        return { output: data };
      }

      case 'getRefund': {
        const { refundId } = params;
        const data = await req('GET', `/transactions/refunds/${encodeURIComponent(refundId)}`);
        return { output: data };
      }

      case 'updateRefund': {
        const { refundId, ...body } = params;
        const data = await req('PUT', `/transactions/refunds/${encodeURIComponent(refundId)}`, body);
        return { output: data };
      }

      case 'deleteRefund': {
        const { refundId } = params;
        const data = await req('DELETE', `/transactions/refunds/${encodeURIComponent(refundId)}`);
        return { output: data };
      }

      case 'listRefunds': {
        const query = new URLSearchParams();
        if (params.from_transaction_date) query.set('from_transaction_date', params.from_transaction_date);
        if (params.to_transaction_date) query.set('to_transaction_date', params.to_transaction_date);
        if (params.provider) query.set('provider', params.provider);
        const qs = query.toString() ? `?${query.toString()}` : '';
        const data = await req('GET', `/transactions/refunds${qs}`);
        return { output: data };
      }

      case 'validateAddress': {
        const data = await req('POST', '/addresses/validate', params);
        return { output: data };
      }

      case 'validateVAT': {
        const { vat } = params;
        const data = await req('GET', `/validation?vat=${encodeURIComponent(vat)}`);
        return { output: data };
      }

      default:
        return { error: `TaxJar action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`TaxJar error: ${err.message}`);
    return { error: err.message };
  }
}
