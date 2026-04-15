'use server';

export async function executeTaxCloudAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = 'https://api.taxcloud.net/1.0';
  const { apiLoginId, apiKey, ...params } = inputs;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    async function req(method: string, path: string, body?: any) {
      const payload = {
        apiLoginId,
        apiKey,
        ...body,
      };
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: method !== 'GET' ? JSON.stringify(payload) : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`TaxCloud ${method} ${path} failed (${res.status}): ${text}`);
      }
      return res.json();
    }

    switch (actionName) {
      case 'ping': {
        const data = await req('POST', '/TaxService.asmx/Ping', {});
        return { output: data };
      }

      case 'lookup': {
        const { customerId, cartId, cartItems, origin, destination, deliveredBySeller } = params;
        const data = await req('POST', '/TaxService.asmx/Lookup', {
          customerID: customerId,
          cartID: cartId,
          cartItems,
          origin,
          destination,
          deliveredBySeller,
        });
        return { output: data };
      }

      case 'lookup2': {
        const { customerId, cartId, cartItems, origin, destination } = params;
        const data = await req('POST', '/TaxService.asmx/Lookup2', {
          customerID: customerId,
          cartID: cartId,
          cartItems,
          origin,
          destination,
        });
        return { output: data };
      }

      case 'authorized': {
        const { customerId, cartId, orderId, dateAuthorized } = params;
        const data = await req('POST', '/TaxService.asmx/Authorized', {
          customerID: customerId,
          cartID: cartId,
          orderID: orderId,
          dateAuthorized,
        });
        return { output: data };
      }

      case 'captured': {
        const { orderId, dateCaptured } = params;
        const data = await req('POST', '/TaxService.asmx/Captured', {
          orderID: orderId,
          dateCaptured,
        });
        return { output: data };
      }

      case 'authorizedWithCapture': {
        const { customerId, cartId, orderId, dateAuthorized } = params;
        const data = await req('POST', '/TaxService.asmx/AuthorizedWithCapture', {
          customerID: customerId,
          cartID: cartId,
          orderID: orderId,
          dateAuthorized,
        });
        return { output: data };
      }

      case 'returned': {
        const { orderId, cartItems, returnedDate } = params;
        const data = await req('POST', '/TaxService.asmx/Returned', {
          orderID: orderId,
          cartItems,
          returnedDate,
        });
        return { output: data };
      }

      case 'authorize': {
        const { customerId, cartId, orderId, dateAuthorized } = params;
        const data = await req('POST', '/TaxService.asmx/Authorize', {
          customerID: customerId,
          cartID: cartId,
          orderID: orderId,
          dateAuthorized,
        });
        return { output: data };
      }

      case 'addExemptCertificate': {
        const { customerId, exemptCert } = params;
        const data = await req('POST', '/TaxService.asmx/AddExemptCertificate', {
          customerID: customerId,
          exemptCert,
        });
        return { output: data };
      }

      case 'deleteExemptCertificate': {
        const { customerId, certificateId } = params;
        const data = await req('POST', '/TaxService.asmx/DeleteExemptCertificate', {
          customerID: customerId,
          certificateID: certificateId,
        });
        return { output: data };
      }

      case 'getExemptCertificates': {
        const { customerId } = params;
        const data = await req('POST', '/TaxService.asmx/GetExemptCertificates', {
          customerID: customerId,
        });
        return { output: data };
      }

      case 'getTIC': {
        const { tic } = params;
        const data = await req('POST', '/TaxService.asmx/GetTIC', { tic });
        return { output: data };
      }

      case 'getTaxable': {
        const { destinationState, tic } = params;
        const data = await req('POST', '/TaxService.asmx/GetTaxable', {
          destinationState,
          tic,
        });
        return { output: data };
      }

      case 'getMonthlyFilings': {
        const { year, month } = params;
        const data = await req('POST', '/TaxService.asmx/GetMonthlyFilings', { year, month });
        return { output: data };
      }

      case 'getFilingPeriods': {
        const data = await req('POST', '/TaxService.asmx/GetFilingPeriods', {});
        return { output: data };
      }

      default:
        return { error: `TaxCloud action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`TaxCloud error: ${err.message}`);
    return { error: err.message };
  }
}
