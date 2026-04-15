'use server';

export async function executeQuickbooksAction(
  action: string,
  inputs: Record<string, any>
): Promise<{ output: Record<string, any> } | { error: string }> {
  const { accessToken, companyId, environment = 'production', ...params } = inputs;

  if (!accessToken || !companyId) {
    return { error: 'accessToken and companyId are required' };
  }

  const base =
    environment === 'sandbox'
      ? `https://sandbox-quickbooks.api.intuit.com/v3/company/${companyId}`
      : `https://quickbooks.api.intuit.com/v3/company/${companyId}`;

  function buildUrl(path: string, extraQuery?: Record<string, string>): string {
    const q = new URLSearchParams({ minorversion: '65', ...extraQuery });
    return `${base}${path}?${q.toString()}`;
  }

  async function req(
    method: string,
    path: string,
    body?: Record<string, any>,
    extraQuery?: Record<string, string>
  ) {
    const fullUrl = buildUrl(path, extraQuery);
    const res = await fetch(fullUrl, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`QuickBooks ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  try {
    switch (action) {
      case 'getCompanyInfo': {
        const data = await req('GET', `/companyinfo/${companyId}`);
        return { output: data };
      }

      case 'createCustomer': {
        const { displayName, email, phone, billingAddr } = params;
        if (!displayName) return { error: 'displayName is required' };
        const body: Record<string, any> = { DisplayName: displayName };
        if (email) body.PrimaryEmailAddr = { Address: email };
        if (phone) body.PrimaryPhone = { FreeFormNumber: phone };
        if (billingAddr) {
          body.BillAddr =
            typeof billingAddr === 'string' ? JSON.parse(billingAddr) : billingAddr;
        }
        const data = await req('POST', '/customer', body);
        return { output: data };
      }

      case 'getCustomer': {
        const { customerId } = params;
        if (!customerId) return { error: 'customerId is required' };
        const data = await req('GET', `/customer/${customerId}`);
        return { output: data };
      }

      case 'queryCustomers': {
        const { searchTerm } = params;
        let query = 'SELECT * FROM Customer';
        if (searchTerm) query += ` WHERE DisplayName LIKE '%${searchTerm}%'`;
        const data = await req('GET', '/query', undefined, { query });
        return { output: data };
      }

      case 'createInvoice': {
        const { customerId, lineItems, dueDate } = params;
        if (!customerId || !lineItems) {
          return { error: 'customerId and lineItems are required' };
        }
        const parsedLines =
          typeof lineItems === 'string' ? JSON.parse(lineItems) : lineItems;
        const body: Record<string, any> = {
          CustomerRef: { value: String(customerId) },
          Line: parsedLines,
        };
        if (dueDate) body.DueDate = dueDate;
        const data = await req('POST', '/invoice', body);
        return { output: data };
      }

      case 'getInvoice': {
        const { invoiceId } = params;
        if (!invoiceId) return { error: 'invoiceId is required' };
        const data = await req('GET', `/invoice/${invoiceId}`);
        return { output: data };
      }

      case 'sendInvoice': {
        const { invoiceId, email } = params;
        if (!invoiceId || !email) return { error: 'invoiceId and email are required' };
        const data = await req('POST', `/invoice/${invoiceId}/send`, undefined, {
          sendTo: email,
        });
        return { output: data };
      }

      case 'createPayment': {
        const { customerId, amount, invoiceRef } = params;
        if (!customerId || amount === undefined) {
          return { error: 'customerId and amount are required' };
        }
        const body: Record<string, any> = {
          CustomerRef: { value: String(customerId) },
          TotalAmt: Number(amount),
        };
        if (invoiceRef) {
          body.Line = [
            {
              Amount: Number(amount),
              LinkedTxn: [{ TxnId: String(invoiceRef), TxnType: 'Invoice' }],
            },
          ];
        }
        const data = await req('POST', '/payment', body);
        return { output: data };
      }

      case 'createExpense': {
        const { amount, accountId, vendorId, description } = params;
        if (amount === undefined || !accountId) {
          return { error: 'amount and accountId are required' };
        }
        const body: Record<string, any> = {
          AccountRef: { value: String(accountId) },
          TotalAmt: Number(amount),
          Line: [
            {
              Amount: Number(amount),
              DetailType: 'AccountBasedExpenseLineDetail',
              AccountBasedExpenseLineDetail: {
                AccountRef: { value: String(accountId) },
              },
              ...(description ? { Description: description } : {}),
            },
          ],
        };
        if (vendorId) body.EntityRef = { value: String(vendorId), type: 'Vendor' };
        const data = await req('POST', '/purchase', body);
        return { output: data };
      }

      case 'getAccounts': {
        const data = await req('GET', '/query', undefined, {
          query: 'SELECT * FROM Account',
        });
        return { output: data };
      }

      case 'createBill': {
        const { vendorId, lineItems, dueDate } = params;
        if (!vendorId || !lineItems) {
          return { error: 'vendorId and lineItems are required' };
        }
        const parsedLines =
          typeof lineItems === 'string' ? JSON.parse(lineItems) : lineItems;
        const body: Record<string, any> = {
          VendorRef: { value: String(vendorId) },
          Line: parsedLines,
        };
        if (dueDate) body.DueDate = dueDate;
        const data = await req('POST', '/bill', body);
        return { output: data };
      }

      case 'getReport': {
        const { reportType, startDate, endDate } = params;
        if (!reportType || !startDate || !endDate) {
          return { error: 'reportType, startDate, and endDate are required' };
        }
        const data = await req('GET', `/reports/${reportType}`, undefined, {
          start_date: startDate,
          end_date: endDate,
        });
        return { output: data };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  } catch (err: any) {
    return { error: err.message ?? String(err) };
  }
}
