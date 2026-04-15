'use server';

export async function executeVertexTaxAction(actionName: string, inputs: any, user: any, logger: any) {
  const { baseUrl, clientId, clientSecret, tokenUrl, ...params } = inputs;

  try {
    // OAuth2 client credentials token fetch
    async function getAccessToken(): Promise<string> {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Vertex OAuth token request failed (${res.status}): ${text}`);
      }
      const json = await res.json();
      return json.access_token;
    }

    const accessToken = await getAccessToken();

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
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
        throw new Error(`Vertex Tax ${method} ${path} failed (${res.status}): ${text}`);
      }
      return res.json();
    }

    switch (actionName) {
      case 'calculateTax': {
        const data = await req('POST', '/vertex-restapi/v1/sale', params);
        return { output: data };
      }

      case 'quoteTax': {
        const data = await req('POST', '/vertex-restapi/v1/quotation', params);
        return { output: data };
      }

      case 'distributeTransaction': {
        const data = await req('POST', '/vertex-restapi/v1/distribute', params);
        return { output: data };
      }

      case 'lookupTaxArea': {
        const { postalCode, country, mainDivision, city } = params;
        const query = new URLSearchParams();
        if (postalCode) query.set('postalCode', postalCode);
        if (country) query.set('country', country);
        if (mainDivision) query.set('mainDivision', mainDivision);
        if (city) query.set('city', city);
        const data = await req('GET', `/vertex-restapi/v1/taxAreaLookup?${query.toString()}`);
        return { output: data };
      }

      case 'listTaxAreas': {
        const query = new URLSearchParams();
        if (params.pageNumber) query.set('pageNumber', String(params.pageNumber));
        if (params.pageSize) query.set('pageSize', String(params.pageSize));
        const qs = query.toString() ? `?${query.toString()}` : '';
        const data = await req('GET', `/vertex-restapi/v1/taxAreas${qs}`);
        return { output: data };
      }

      case 'lookupCommodity': {
        const { commodityCode } = params;
        const data = await req('GET', `/vertex-restapi/v1/commodities/${encodeURIComponent(commodityCode)}`);
        return { output: data };
      }

      case 'listCompanies': {
        const query = new URLSearchParams();
        if (params.pageNumber) query.set('pageNumber', String(params.pageNumber));
        if (params.pageSize) query.set('pageSize', String(params.pageSize));
        const qs = query.toString() ? `?${query.toString()}` : '';
        const data = await req('GET', `/vertex-restapi/v1/companies${qs}`);
        return { output: data };
      }

      case 'getCompany': {
        const { companyId } = params;
        const data = await req('GET', `/vertex-restapi/v1/companies/${encodeURIComponent(companyId)}`);
        return { output: data };
      }

      case 'listRegistrations': {
        const { companyId } = params;
        const data = await req('GET', `/vertex-restapi/v1/companies/${encodeURIComponent(companyId)}/registrations`);
        return { output: data };
      }

      case 'getRegistration': {
        const { companyId, registrationId } = params;
        const data = await req('GET', `/vertex-restapi/v1/companies/${encodeURIComponent(companyId)}/registrations/${encodeURIComponent(registrationId)}`);
        return { output: data };
      }

      case 'listExemptions': {
        const query = new URLSearchParams();
        if (params.pageNumber) query.set('pageNumber', String(params.pageNumber));
        if (params.pageSize) query.set('pageSize', String(params.pageSize));
        const qs = query.toString() ? `?${query.toString()}` : '';
        const data = await req('GET', `/vertex-restapi/v1/exemptions${qs}`);
        return { output: data };
      }

      case 'getExemption': {
        const { exemptionId } = params;
        const data = await req('GET', `/vertex-restapi/v1/exemptions/${encodeURIComponent(exemptionId)}`);
        return { output: data };
      }

      case 'createExemption': {
        const data = await req('POST', '/vertex-restapi/v1/exemptions', params);
        return { output: data };
      }

      case 'listRates': {
        const query = new URLSearchParams();
        if (params.postalCode) query.set('postalCode', params.postalCode);
        if (params.country) query.set('country', params.country);
        const qs = query.toString() ? `?${query.toString()}` : '';
        const data = await req('GET', `/vertex-restapi/v1/rates${qs}`);
        return { output: data };
      }

      case 'getTaxAreaByAddress': {
        const data = await req('POST', '/vertex-restapi/v1/taxAreaLookup', params);
        return { output: data };
      }

      default:
        return { error: `Vertex Tax action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`Vertex Tax error: ${err.message}`);
    return { error: err.message };
  }
}
