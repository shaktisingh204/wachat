'use server';

export async function executeQuadernoAction(actionName: string, inputs: any, user: any, logger: any) {
  const { apiKey, account, ...params } = inputs;
  const baseUrl = `https://${account}.quadernoapp.com/api/v1`;

  try {
    const credentials = Buffer.from(apiKey + ':x').toString('base64');
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
        throw new Error(`Quaderno ${method} ${path} failed (${res.status}): ${text}`);
      }
      if (res.status === 204) return { success: true };
      return res.json();
    }

    switch (actionName) {
      case 'listInvoices': {
        const query = new URLSearchParams();
        if (params.page) query.set('page', String(params.page));
        if (params.contact) query.set('contact', String(params.contact));
        if (params.state) query.set('state', params.state);
        const qs = query.toString() ? `?${query.toString()}` : '';
        const data = await req('GET', `/invoices.json${qs}`);
        return { output: data };
      }

      case 'getInvoice': {
        const { invoiceId } = params;
        const data = await req('GET', `/invoices/${encodeURIComponent(invoiceId)}.json`);
        return { output: data };
      }

      case 'createInvoice': {
        const data = await req('POST', '/invoices.json', params);
        return { output: data };
      }

      case 'updateInvoice': {
        const { invoiceId, ...body } = params;
        const data = await req('PUT', `/invoices/${encodeURIComponent(invoiceId)}.json`, body);
        return { output: data };
      }

      case 'deleteInvoice': {
        const { invoiceId } = params;
        const data = await req('DELETE', `/invoices/${encodeURIComponent(invoiceId)}.json`);
        return { output: data };
      }

      case 'deliverInvoice': {
        const { invoiceId } = params;
        const data = await req('GET', `/invoices/${encodeURIComponent(invoiceId)}/deliver.json`);
        return { output: data };
      }

      case 'listCreditNotes': {
        const query = new URLSearchParams();
        if (params.page) query.set('page', String(params.page));
        if (params.contact) query.set('contact', String(params.contact));
        const qs = query.toString() ? `?${query.toString()}` : '';
        const data = await req('GET', `/credit_notes.json${qs}`);
        return { output: data };
      }

      case 'createCreditNote': {
        const data = await req('POST', '/credit_notes.json', params);
        return { output: data };
      }

      case 'listExpenses': {
        const query = new URLSearchParams();
        if (params.page) query.set('page', String(params.page));
        if (params.contact) query.set('contact', String(params.contact));
        const qs = query.toString() ? `?${query.toString()}` : '';
        const data = await req('GET', `/expenses.json${qs}`);
        return { output: data };
      }

      case 'createExpense': {
        const data = await req('POST', '/expenses.json', params);
        return { output: data };
      }

      case 'listTaxes': {
        const query = new URLSearchParams();
        if (params.page) query.set('page', String(params.page));
        const qs = query.toString() ? `?${query.toString()}` : '';
        const data = await req('GET', `/taxes.json${qs}`);
        return { output: data };
      }

      case 'calculateTax': {
        const { country, postal_code, tax_id, transaction_type } = params;
        const query = new URLSearchParams();
        if (country) query.set('country', country);
        if (postal_code) query.set('postal_code', postal_code);
        if (tax_id) query.set('tax_id', tax_id);
        if (transaction_type) query.set('transaction_type', transaction_type);
        const data = await req('GET', `/taxes/calculate.json?${query.toString()}`);
        return { output: data };
      }

      case 'listContacts': {
        const query = new URLSearchParams();
        if (params.page) query.set('page', String(params.page));
        if (params.kind) query.set('kind', params.kind);
        const qs = query.toString() ? `?${query.toString()}` : '';
        const data = await req('GET', `/contacts.json${qs}`);
        return { output: data };
      }

      case 'getContact': {
        const { contactId } = params;
        const data = await req('GET', `/contacts/${encodeURIComponent(contactId)}.json`);
        return { output: data };
      }

      case 'createContact': {
        const data = await req('POST', '/contacts.json', params);
        return { output: data };
      }

      default:
        return { error: `Quaderno action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`Quaderno error: ${err.message}`);
    return { error: err.message };
  }
}
