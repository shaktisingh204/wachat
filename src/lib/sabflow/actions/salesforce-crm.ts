'use server';

export async function executeSalesforceCrmAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const accessToken = inputs.accessToken;
    const instanceUrl = inputs.instanceUrl;
    const baseUrl = `${instanceUrl}/services/data/v58.0`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listObjects': {
        const res = await fetch(`${baseUrl}/sobjects`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to list objects' };
        return { output: data };
      }

      case 'describeObject': {
        const objectName = inputs.objectName;
        const res = await fetch(`${baseUrl}/sobjects/${objectName}/describe`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to describe object' };
        return { output: data };
      }

      case 'createRecord': {
        const objectName = inputs.objectName;
        const body = inputs.record || {};
        const res = await fetch(`${baseUrl}/sobjects/${objectName}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to create record' };
        return { output: data };
      }

      case 'getRecord': {
        const objectName = inputs.objectName;
        const recordId = inputs.recordId;
        const fields = inputs.fields ? `?fields=${inputs.fields}` : '';
        const res = await fetch(`${baseUrl}/sobjects/${objectName}/${recordId}${fields}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to get record' };
        return { output: data };
      }

      case 'updateRecord': {
        const objectName = inputs.objectName;
        const recordId = inputs.recordId;
        const body = inputs.record || {};
        const res = await fetch(`${baseUrl}/sobjects/${objectName}/${recordId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        });
        if (res.status === 204) return { output: { success: true } };
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to update record' };
        return { output: data };
      }

      case 'deleteRecord': {
        const objectName = inputs.objectName;
        const recordId = inputs.recordId;
        const res = await fetch(`${baseUrl}/sobjects/${objectName}/${recordId}`, { method: 'DELETE', headers });
        if (res.status === 204) return { output: { success: true } };
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to delete record' };
        return { output: data };
      }

      case 'queryRecords': {
        const query = encodeURIComponent(inputs.query);
        const res = await fetch(`${baseUrl}/query?q=${query}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to query records' };
        return { output: data };
      }

      case 'searchRecords': {
        const searchString = encodeURIComponent(inputs.searchString);
        const res = await fetch(`${baseUrl}/search?q=${searchString}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to search records' };
        return { output: data };
      }

      case 'listAccounts': {
        const limit = inputs.limit || 20;
        const query = encodeURIComponent(`SELECT Id, Name, Phone, Website, Industry FROM Account LIMIT ${limit}`);
        const res = await fetch(`${baseUrl}/query?q=${query}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to list accounts' };
        return { output: data };
      }

      case 'createAccount': {
        const body = inputs.account || {};
        const res = await fetch(`${baseUrl}/sobjects/Account`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to create account' };
        return { output: data };
      }

      case 'getAccount': {
        const accountId = inputs.accountId;
        const res = await fetch(`${baseUrl}/sobjects/Account/${accountId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to get account' };
        return { output: data };
      }

      case 'listContacts': {
        const limit = inputs.limit || 20;
        const query = encodeURIComponent(`SELECT Id, FirstName, LastName, Email, Phone FROM Contact LIMIT ${limit}`);
        const res = await fetch(`${baseUrl}/query?q=${query}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to list contacts' };
        return { output: data };
      }

      case 'createContact': {
        const body = inputs.contact || {};
        const res = await fetch(`${baseUrl}/sobjects/Contact`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to create contact' };
        return { output: data };
      }

      case 'listLeads': {
        const limit = inputs.limit || 20;
        const query = encodeURIComponent(`SELECT Id, FirstName, LastName, Email, Company, Status FROM Lead LIMIT ${limit}`);
        const res = await fetch(`${baseUrl}/query?q=${query}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to list leads' };
        return { output: data };
      }

      case 'createLead': {
        const body = inputs.lead || {};
        const res = await fetch(`${baseUrl}/sobjects/Lead`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: (data[0] && data[0].message) || 'Failed to create lead' };
        return { output: data };
      }

      default:
        return { error: `Unknown Salesforce CRM action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`Salesforce CRM action error: ${err.message}`);
    return { error: err.message || 'Salesforce CRM action failed' };
  }
}
