'use server';

export async function executeCoupaAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = `https://${inputs.instanceUrl}/api`;
  const headers: Record<string, string> = {
    'AUTHORIZATION': `Bearer ${inputs.accessToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  try {
    switch (actionName) {
      case 'listRequisitions': {
        const params = new URLSearchParams();
        if (inputs.status) params.set('status', inputs.status);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/requisitions?${params}`, { headers });
        if (!res.ok) return { error: `Coupa listRequisitions failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getRequisition': {
        const res = await fetch(`${baseUrl}/requisitions/${inputs.id}`, { headers });
        if (!res.ok) return { error: `Coupa getRequisition failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'createRequisition': {
        const res = await fetch(`${baseUrl}/requisitions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.requisition || {}),
        });
        if (!res.ok) return { error: `Coupa createRequisition failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'listPurchaseOrders': {
        const params = new URLSearchParams();
        if (inputs.status) params.set('status', inputs.status);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/purchase_orders?${params}`, { headers });
        if (!res.ok) return { error: `Coupa listPurchaseOrders failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getPurchaseOrder': {
        const res = await fetch(`${baseUrl}/purchase_orders/${inputs.id}`, { headers });
        if (!res.ok) return { error: `Coupa getPurchaseOrder failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'createPurchaseOrder': {
        const res = await fetch(`${baseUrl}/purchase_orders`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.purchaseOrder || {}),
        });
        if (!res.ok) return { error: `Coupa createPurchaseOrder failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'listSuppliers': {
        const params = new URLSearchParams();
        if (inputs.name) params.set('name', inputs.name);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/suppliers?${params}`, { headers });
        if (!res.ok) return { error: `Coupa listSuppliers failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getSupplier': {
        const res = await fetch(`${baseUrl}/suppliers/${inputs.id}`, { headers });
        if (!res.ok) return { error: `Coupa getSupplier failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'createSupplier': {
        const res = await fetch(`${baseUrl}/suppliers`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.supplier || {}),
        });
        if (!res.ok) return { error: `Coupa createSupplier failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'listInvoices': {
        const params = new URLSearchParams();
        if (inputs.status) params.set('status', inputs.status);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/invoices?${params}`, { headers });
        if (!res.ok) return { error: `Coupa listInvoices failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getInvoice': {
        const res = await fetch(`${baseUrl}/invoices/${inputs.id}`, { headers });
        if (!res.ok) return { error: `Coupa getInvoice failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'approveInvoice': {
        const res = await fetch(`${baseUrl}/invoices/${inputs.id}/approve`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(inputs.approvalData || {}),
        });
        if (!res.ok) return { error: `Coupa approveInvoice failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'listContracts': {
        const params = new URLSearchParams();
        if (inputs.status) params.set('status', inputs.status);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/contracts?${params}`, { headers });
        if (!res.ok) return { error: `Coupa listContracts failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getContract': {
        const res = await fetch(`${baseUrl}/contracts/${inputs.id}`, { headers });
        if (!res.ok) return { error: `Coupa getContract failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'listUsers': {
        const params = new URLSearchParams();
        if (inputs.active !== undefined) params.set('active', String(inputs.active));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/users?${params}`, { headers });
        if (!res.ok) return { error: `Coupa listUsers failed: ${res.status} ${res.statusText}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Coupa action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`Coupa error: ${err.message}`);
    return { error: err.message || 'Coupa action failed' };
  }
}
