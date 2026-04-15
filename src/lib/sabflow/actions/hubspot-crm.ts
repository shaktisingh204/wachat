'use server';

export async function executeHubSpotCrmAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const accessToken = inputs.accessToken;
    const baseUrl = 'https://api.hubapi.com';
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listContacts': {
        const limit = inputs.limit || 20;
        const after = inputs.after ? `&after=${inputs.after}` : '';
        const res = await fetch(`${baseUrl}/crm/v3/objects/contacts?limit=${limit}${after}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to list contacts' };
        return { output: data };
      }

      case 'getContact': {
        const contactId = inputs.contactId;
        const res = await fetch(`${baseUrl}/crm/v3/objects/contacts/${contactId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to get contact' };
        return { output: data };
      }

      case 'createContact': {
        const body = { properties: inputs.properties || {} };
        const res = await fetch(`${baseUrl}/crm/v3/objects/contacts`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to create contact' };
        return { output: data };
      }

      case 'updateContact': {
        const contactId = inputs.contactId;
        const body = { properties: inputs.properties || {} };
        const res = await fetch(`${baseUrl}/crm/v3/objects/contacts/${contactId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to update contact' };
        return { output: data };
      }

      case 'deleteContact': {
        const contactId = inputs.contactId;
        const res = await fetch(`${baseUrl}/crm/v3/objects/contacts/${contactId}`, { method: 'DELETE', headers });
        if (res.status === 204) return { output: { success: true } };
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to delete contact' };
        return { output: data };
      }

      case 'listCompanies': {
        const limit = inputs.limit || 20;
        const after = inputs.after ? `&after=${inputs.after}` : '';
        const res = await fetch(`${baseUrl}/crm/v3/objects/companies?limit=${limit}${after}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to list companies' };
        return { output: data };
      }

      case 'getCompany': {
        const companyId = inputs.companyId;
        const res = await fetch(`${baseUrl}/crm/v3/objects/companies/${companyId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to get company' };
        return { output: data };
      }

      case 'createCompany': {
        const body = { properties: inputs.properties || {} };
        const res = await fetch(`${baseUrl}/crm/v3/objects/companies`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to create company' };
        return { output: data };
      }

      case 'listDeals': {
        const limit = inputs.limit || 20;
        const after = inputs.after ? `&after=${inputs.after}` : '';
        const res = await fetch(`${baseUrl}/crm/v3/objects/deals?limit=${limit}${after}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to list deals' };
        return { output: data };
      }

      case 'getDeal': {
        const dealId = inputs.dealId;
        const res = await fetch(`${baseUrl}/crm/v3/objects/deals/${dealId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to get deal' };
        return { output: data };
      }

      case 'createDeal': {
        const body = { properties: inputs.properties || {} };
        const res = await fetch(`${baseUrl}/crm/v3/objects/deals`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to create deal' };
        return { output: data };
      }

      case 'updateDeal': {
        const dealId = inputs.dealId;
        const body = { properties: inputs.properties || {} };
        const res = await fetch(`${baseUrl}/crm/v3/objects/deals/${dealId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to update deal' };
        return { output: data };
      }

      case 'listPipelines': {
        const objectType = inputs.objectType || 'deals';
        const res = await fetch(`${baseUrl}/crm/v3/pipelines/${objectType}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to list pipelines' };
        return { output: data };
      }

      case 'createNote': {
        const body = {
          properties: {
            hs_note_body: inputs.noteBody || '',
            hs_timestamp: inputs.timestamp || new Date().toISOString(),
            ...inputs.properties,
          },
        };
        const res = await fetch(`${baseUrl}/crm/v3/objects/notes`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to create note' };
        return { output: data };
      }

      case 'listActivities': {
        const limit = inputs.limit || 20;
        const after = inputs.after ? `&after=${inputs.after}` : '';
        const objectType = inputs.objectType || 'calls';
        const res = await fetch(`${baseUrl}/crm/v3/objects/${objectType}?limit=${limit}${after}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to list activities' };
        return { output: data };
      }

      default:
        return { error: `Unknown HubSpot CRM action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`HubSpot CRM action error: ${err.message}`);
    return { error: err.message || 'HubSpot CRM action failed' };
  }
}
