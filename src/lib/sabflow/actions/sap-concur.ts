'use server';

export async function executeSAPConcurAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = 'https://us.api.concursolutions.com';
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${inputs.accessToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  try {
    switch (actionName) {
      case 'listExpenseReports': {
        const params = new URLSearchParams();
        if (inputs.approvalStatusCode) params.set('approvalStatusCode', inputs.approvalStatusCode);
        if (inputs.paymentStatusCode) params.set('paymentStatusCode', inputs.paymentStatusCode);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/api/v3.0/expense/reports?${params}`, { headers });
        if (!res.ok) return { error: `SAP Concur listExpenseReports failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getExpenseReport': {
        const res = await fetch(`${baseUrl}/api/v3.0/expense/reports/${inputs.id}`, { headers });
        if (!res.ok) return { error: `SAP Concur getExpenseReport failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'createExpenseReport': {
        const res = await fetch(`${baseUrl}/api/v3.0/expense/reports`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.report || {}),
        });
        if (!res.ok) return { error: `SAP Concur createExpenseReport failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'updateExpenseReport': {
        const res = await fetch(`${baseUrl}/api/v3.0/expense/reports/${inputs.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(inputs.report || {}),
        });
        if (!res.ok) return { error: `SAP Concur updateExpenseReport failed: ${res.status} ${res.statusText}` };
        return { output: { success: true, status: res.status } };
      }

      case 'submitExpenseReport': {
        const res = await fetch(`${baseUrl}/api/v3.0/expense/reports/${inputs.id}/submit`, {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
        });
        if (!res.ok) return { error: `SAP Concur submitExpenseReport failed: ${res.status} ${res.statusText}` };
        return { output: { success: true, status: res.status } };
      }

      case 'listExpenseEntries': {
        const params = new URLSearchParams();
        if (inputs.reportID) params.set('reportID', inputs.reportID);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/api/v3.0/expense/entries?${params}`, { headers });
        if (!res.ok) return { error: `SAP Concur listExpenseEntries failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'createExpenseEntry': {
        const res = await fetch(`${baseUrl}/api/v3.0/expense/entries`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.entry || {}),
        });
        if (!res.ok) return { error: `SAP Concur createExpenseEntry failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'listTravelRequests': {
        const params = new URLSearchParams();
        if (inputs.status) params.set('status', inputs.status);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/travelrequest/v4/requests?${params}`, { headers });
        if (!res.ok) return { error: `SAP Concur listTravelRequests failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getTravelRequest': {
        const res = await fetch(`${baseUrl}/travelrequest/v4/requests/${inputs.id}`, { headers });
        if (!res.ok) return { error: `SAP Concur getTravelRequest failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'createTravelRequest': {
        const res = await fetch(`${baseUrl}/travelrequest/v4/requests`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.request || {}),
        });
        if (!res.ok) return { error: `SAP Concur createTravelRequest failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'listReceipts': {
        const params = new URLSearchParams();
        if (inputs.userId) params.set('userId', inputs.userId);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/receipts/v4/users/${inputs.userId || 'me'}/receipts?${params}`, { headers });
        if (!res.ok) return { error: `SAP Concur listReceipts failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getReceipt': {
        const res = await fetch(`${baseUrl}/receipts/v4/receipts/${inputs.receiptId}`, { headers });
        if (!res.ok) return { error: `SAP Concur getReceipt failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'addReceipt': {
        const uploadHeaders = {
          ...headers,
          'Content-Type': inputs.contentType || 'image/jpeg',
          'receipt-type': inputs.receiptType || 'general',
        };
        const res = await fetch(`${baseUrl}/receipts/v4/users/${inputs.userId || 'me'}/receipts`, {
          method: 'POST',
          headers: uploadHeaders,
          body: inputs.receiptData,
        });
        if (!res.ok) return { error: `SAP Concur addReceipt failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'listUsers': {
        const params = new URLSearchParams();
        if (inputs.active !== undefined) params.set('active', String(inputs.active));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.startIndex) params.set('startIndex', String(inputs.startIndex));
        const res = await fetch(`${baseUrl}/profile/v1/users?${params}`, { headers });
        if (!res.ok) return { error: `SAP Concur listUsers failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUser': {
        const res = await fetch(`${baseUrl}/profile/v1/users/${inputs.userId}`, { headers });
        if (!res.ok) return { error: `SAP Concur getUser failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown SAP Concur action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`SAPConcur error: ${err.message}`);
    return { error: err.message || 'SAP Concur action failed' };
  }
}
