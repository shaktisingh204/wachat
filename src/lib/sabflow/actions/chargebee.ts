'use server';

export async function executeChargebeeAction(
  action: string,
  inputs: Record<string, any>
): Promise<{ output: Record<string, any> } | { error: string }> {
  const { apiKey, site, ...params } = inputs;

  if (!apiKey || !site) return { error: 'apiKey and site are required' };

  const base = `https://${site}.chargebee.com/api/v2`;
  const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;

  async function req(
    method: string,
    path: string,
    body?: Record<string, any>,
    isFormEncoded = true
  ) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: authHeader,
        ...(body && isFormEncoded
          ? { 'Content-Type': 'application/x-www-form-urlencoded' }
          : body
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body: body && isFormEncoded
        ? new URLSearchParams(
            Object.entries(body).reduce<Record<string, string>>((acc, [k, v]) => {
              acc[k] = String(v);
              return acc;
            }, {})
          ).toString()
        : body
        ? JSON.stringify(body)
        : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Chargebee ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  async function get(path: string, query?: Record<string, string>) {
    let fullPath = path;
    if (query) fullPath += `?${new URLSearchParams(query).toString()}`;
    const res = await fetch(`${base}${fullPath}`, {
      headers: { Authorization: authHeader },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Chargebee GET ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  try {
    switch (action) {
      case 'createCustomer': {
        const { email, firstName, lastName, phone } = params;
        if (!email || !firstName || !lastName) {
          return { error: 'email, firstName, and lastName are required' };
        }
        const body: Record<string, any> = { email, first_name: firstName, last_name: lastName };
        if (phone) body.phone = phone;
        const data = await req('POST', '/customers', body);
        return { output: data };
      }

      case 'getCustomer': {
        const { customerId } = params;
        if (!customerId) return { error: 'customerId is required' };
        const data = await get(`/customers/${customerId}`);
        return { output: data };
      }

      case 'updateCustomer': {
        const { customerId, email, firstName, lastName } = params;
        if (!customerId) return { error: 'customerId is required' };
        const body: Record<string, any> = {};
        if (email) body.email = email;
        if (firstName) body.first_name = firstName;
        if (lastName) body.last_name = lastName;
        const data = await req('POST', `/customers/${customerId}`, body);
        return { output: data };
      }

      case 'listCustomers': {
        const { limit = 10 } = params;
        const data = await get('/customers', { limit: String(limit) });
        return { output: data };
      }

      case 'createSubscription': {
        const { planId, customerId, planQuantity = 1 } = params;
        if (!planId) return { error: 'planId is required' };
        const body: Record<string, any> = {
          'plan_id': planId,
          'plan_quantity': planQuantity,
        };
        if (customerId) body['customer[id]'] = customerId;
        const data = await req('POST', '/subscriptions', body);
        return { output: data };
      }

      case 'getSubscription': {
        const { subscriptionId } = params;
        if (!subscriptionId) return { error: 'subscriptionId is required' };
        const data = await get(`/subscriptions/${subscriptionId}`);
        return { output: data };
      }

      case 'updateSubscription': {
        const { subscriptionId, planId, planQuantity } = params;
        if (!subscriptionId) return { error: 'subscriptionId is required' };
        const body: Record<string, any> = {};
        if (planId) body.plan_id = planId;
        if (planQuantity !== undefined) body.plan_quantity = planQuantity;
        const data = await req('POST', `/subscriptions/${subscriptionId}`, body);
        return { output: data };
      }

      case 'cancelSubscription': {
        const { subscriptionId, endOfTerm = true } = params;
        if (!subscriptionId) return { error: 'subscriptionId is required' };
        const data = await req('POST', `/subscriptions/${subscriptionId}/cancel`, {
          end_of_term: endOfTerm,
        });
        return { output: data };
      }

      case 'reactivateSubscription': {
        const { subscriptionId } = params;
        if (!subscriptionId) return { error: 'subscriptionId is required' };
        const data = await req('POST', `/subscriptions/${subscriptionId}/reactivate`);
        return { output: data };
      }

      case 'createInvoice': {
        const { customerId, charges } = params;
        if (!customerId || !charges) return { error: 'customerId and charges are required' };
        const parsedCharges = typeof charges === 'string' ? JSON.parse(charges) : charges;
        const body: Record<string, any> = { 'customer_id': customerId };
        if (Array.isArray(parsedCharges)) {
          parsedCharges.forEach((charge: any, i: number) => {
            Object.entries(charge).forEach(([k, v]) => {
              body[`charges[${i}][${k}]`] = String(v);
            });
          });
        }
        const data = await req('POST', '/invoices/charge', body);
        return { output: data };
      }

      case 'getInvoice': {
        const { invoiceId } = params;
        if (!invoiceId) return { error: 'invoiceId is required' };
        const data = await get(`/invoices/${invoiceId}`);
        return { output: data };
      }

      case 'listInvoices': {
        const { customerId, limit = 10 } = params;
        const query: Record<string, string> = { limit: String(limit) };
        if (customerId) query['customer_id[is]'] = customerId;
        const data = await get('/invoices', query);
        return { output: data };
      }

      case 'recordPayment': {
        const { invoiceId, amount, paymentMethod } = params;
        if (!invoiceId || amount === undefined) {
          return { error: 'invoiceId and amount are required' };
        }
        const body: Record<string, any> = { amount };
        if (paymentMethod) body.payment_method = paymentMethod;
        const data = await req('POST', `/invoices/${invoiceId}/record_payment`, body);
        return { output: data };
      }

      case 'createCoupon': {
        const { couponId, name, discountType, discountAmount } = params;
        if (!couponId || !name || !discountType || discountAmount === undefined) {
          return { error: 'couponId, name, discountType, and discountAmount are required' };
        }
        const data = await req('POST', '/coupons', {
          id: couponId,
          name,
          discount_type: discountType,
          discount_amount: discountAmount,
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
