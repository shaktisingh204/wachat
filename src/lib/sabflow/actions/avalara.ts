'use server';

export async function executeAvalaraAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = 'https://sandbox-rest.avatax.com/api/v2';
  const { username, password, ...params } = inputs;

  try {
    const credentials = Buffer.from(username + ':' + password).toString('base64');
    const headers: Record<string, string> = {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    async function req(method: string, path: string, body?: any) {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Avalara ${method} ${path} failed (${res.status}): ${text}`);
      }
      return res.json();
    }

    switch (actionName) {
      case 'createTransaction': {
        const data = await req('POST', '/transactions/create', params);
        return { output: data };
      }

      case 'getTransaction': {
        const { companyCode, transactionCode, documentType } = params;
        const query = new URLSearchParams();
        if (documentType) query.set('$include', documentType);
        const qs = query.toString() ? `?${query.toString()}` : '';
        const data = await req('GET', `/companies/${encodeURIComponent(companyCode)}/transactions/${encodeURIComponent(transactionCode)}${qs}`);
        return { output: data };
      }

      case 'voidTransaction': {
        const { companyCode, transactionCode, code } = params;
        const data = await req('POST', `/companies/${encodeURIComponent(companyCode)}/transactions/${encodeURIComponent(transactionCode)}/void`, { code });
        return { output: data };
      }

      case 'refundTransaction': {
        const { companyCode, transactionCode, ...body } = params;
        const data = await req('POST', `/companies/${encodeURIComponent(companyCode)}/transactions/${encodeURIComponent(transactionCode)}/refund`, body);
        return { output: data };
      }

      case 'listTransactions': {
        const { companyCode, ...query } = params;
        const qs = Object.keys(query).length ? `?${new URLSearchParams(query).toString()}` : '';
        const data = await req('GET', `/companies/${encodeURIComponent(companyCode)}/transactions${qs}`);
        return { output: data };
      }

      case 'validateAddress': {
        const { line1, line2, line3, city, region, postalCode, country } = params;
        const query = new URLSearchParams();
        if (line1) query.set('line1', line1);
        if (line2) query.set('line2', line2);
        if (line3) query.set('line3', line3);
        if (city) query.set('city', city);
        if (region) query.set('region', region);
        if (postalCode) query.set('postalCode', postalCode);
        if (country) query.set('country', country);
        const data = await req('GET', `/addresses/resolve?${query.toString()}`);
        return { output: data };
      }

      case 'resolveAddress': {
        const data = await req('POST', '/addresses/resolve', params);
        return { output: data };
      }

      case 'listTaxCodes': {
        const qs = params.filter ? `?$filter=${encodeURIComponent(params.filter)}` : '';
        const data = await req('GET', `/definitions/taxcodes${qs}`);
        return { output: data };
      }

      case 'getTaxCode': {
        const { companyId, taxCodeId } = params;
        const data = await req('GET', `/companies/${encodeURIComponent(companyId)}/taxcodes/${encodeURIComponent(taxCodeId)}`);
        return { output: data };
      }

      case 'createTaxCode': {
        const { companyId, ...body } = params;
        const data = await req('POST', `/companies/${encodeURIComponent(companyId)}/taxcodes`, [body]);
        return { output: data };
      }

      case 'listAccounts': {
        const qs = params.filter ? `?$filter=${encodeURIComponent(params.filter)}` : '';
        const data = await req('GET', `/accounts${qs}`);
        return { output: data };
      }

      case 'getAccount': {
        const { accountId } = params;
        const data = await req('GET', `/accounts/${encodeURIComponent(accountId)}`);
        return { output: data };
      }

      case 'listCompanies': {
        const qs = params.filter ? `?$filter=${encodeURIComponent(params.filter)}` : '';
        const data = await req('GET', `/companies${qs}`);
        return { output: data };
      }

      case 'getCompany': {
        const { companyId } = params;
        const data = await req('GET', `/companies/${encodeURIComponent(companyId)}`);
        return { output: data };
      }

      case 'createCompany': {
        const data = await req('POST', '/companies', [params]);
        return { output: data };
      }

      default:
        return { error: `Avalara action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`Avalara error: ${err.message}`);
    return { error: err.message };
  }
}
