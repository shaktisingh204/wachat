'use server';

function getZohoBase(region: string): string {
  const subdomain =
    region === 'eu' ? 'eu' :
    region === 'in' ? 'in' :
    region === 'au' ? 'au' :
    region === 'jp' ? 'jp' :
    'www';
  return `https://${subdomain}.zohoapis.com/crm/v3`;
}

export async function executeZohoCrmAction(
  action: string,
  inputs: Record<string, any>
): Promise<{ output: Record<string, any> } | { error: string }> {
  const { accessToken, region = 'us', ...params } = inputs;

  if (!accessToken) return { error: 'accessToken is required' };

  const base = getZohoBase(region);

  async function req(
    method: string,
    path: string,
    body?: Record<string, any>,
    query?: Record<string, string>
  ) {
    let fullUrl = `${base}${path}`;
    if (query) {
      const q = new URLSearchParams(query);
      fullUrl += `?${q.toString()}`;
    }
    const res = await fetch(fullUrl, {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Zoho CRM ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  try {
    switch (action) {
      case 'getRecords': {
        const { module, page = 1, perPage = 20 } = params;
        if (!module) return { error: 'module is required' };
        const data = await req('GET', `/${module}`, undefined, {
          page: String(page),
          per_page: String(perPage),
        });
        return { output: data };
      }

      case 'getRecord': {
        const { module, recordId } = params;
        if (!module || !recordId) return { error: 'module and recordId are required' };
        const data = await req('GET', `/${module}/${recordId}`);
        return { output: data };
      }

      case 'createRecord': {
        const { module, data: recordData } = params;
        if (!module) return { error: 'module is required' };
        const parsed = typeof recordData === 'string' ? JSON.parse(recordData) : recordData;
        const body = { data: Array.isArray(parsed) ? parsed : [parsed] };
        const result = await req('POST', `/${module}`, body);
        return { output: result };
      }

      case 'updateRecord': {
        const { module, recordId, data: recordData } = params;
        if (!module || !recordId) return { error: 'module and recordId are required' };
        const parsed = typeof recordData === 'string' ? JSON.parse(recordData) : recordData;
        const body = { data: Array.isArray(parsed) ? parsed : [parsed] };
        const result = await req('PUT', `/${module}/${recordId}`, body);
        return { output: result };
      }

      case 'deleteRecord': {
        const { module, recordId } = params;
        if (!module || !recordId) return { error: 'module and recordId are required' };
        const data = await req('DELETE', `/${module}/${recordId}`);
        return { output: data };
      }

      case 'searchRecords': {
        const { module, criteria } = params;
        if (!module || !criteria) return { error: 'module and criteria are required' };
        const data = await req('GET', `/${module}/search`, undefined, { criteria });
        return { output: data };
      }

      case 'createLead': {
        const { lastName, email, company, phone } = params;
        if (!lastName || !company) return { error: 'lastName and company are required' };
        const record: Record<string, any> = { Last_Name: lastName, Company: company };
        if (email) record.Email = email;
        if (phone) record.Phone = phone;
        const result = await req('POST', '/Leads', { data: [record] });
        return { output: result };
      }

      case 'convertLead': {
        const { leadId, accountName, dealName, contactOverwrite } = params;
        if (!leadId) return { error: 'leadId is required' };
        const body: Record<string, any> = { data: [{}] };
        if (accountName) body.data[0].Accounts = { Account_Name: accountName };
        if (dealName) body.data[0].Deals = { Deal_Name: dealName };
        if (contactOverwrite !== undefined) body.data[0].overwrite = contactOverwrite;
        const result = await req('POST', `/Leads/${leadId}/actions/convert`, body);
        return { output: result };
      }

      case 'getContacts': {
        const { page = 1, perPage = 20 } = params;
        const data = await req('GET', '/Contacts', undefined, {
          page: String(page),
          per_page: String(perPage),
        });
        return { output: data };
      }

      case 'createContact': {
        const { lastName, email, phone, accountName } = params;
        if (!lastName) return { error: 'lastName is required' };
        const record: Record<string, any> = { Last_Name: lastName };
        if (email) record.Email = email;
        if (phone) record.Phone = phone;
        if (accountName) record.Account_Name = accountName;
        const result = await req('POST', '/Contacts', { data: [record] });
        return { output: result };
      }

      case 'getDeals': {
        const { page = 1, perPage = 20 } = params;
        const data = await req('GET', '/Deals', undefined, {
          page: String(page),
          per_page: String(perPage),
        });
        return { output: data };
      }

      case 'createDeal': {
        const { dealName, stageName, closingDate, accountName } = params;
        if (!dealName || !stageName || !closingDate) {
          return { error: 'dealName, stageName, and closingDate are required' };
        }
        const record: Record<string, any> = {
          Deal_Name: dealName,
          Stage: stageName,
          Closing_Date: closingDate,
        };
        if (accountName) record.Account_Name = accountName;
        const result = await req('POST', '/Deals', { data: [record] });
        return { output: result };
      }

      case 'uploadAttachment': {
        const { module, recordId, fileUrl, fileName } = params;
        if (!module || !recordId || !fileUrl || !fileName) {
          return { error: 'module, recordId, fileUrl, and fileName are required' };
        }
        const result = await req(
          'POST',
          `/${module}/${recordId}/Attachments`,
          undefined,
          { attachmentUrl: fileUrl, fileName }
        );
        return { output: result };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  } catch (err: any) {
    return { error: err.message ?? String(err) };
  }
}
