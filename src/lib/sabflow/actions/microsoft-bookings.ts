'use server';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0/solutions/bookingBusinesses';

async function bookingsFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Microsoft Bookings] ${method} ${path}`);
    const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (res.status === 204) return { success: true };
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        const msg = data?.error?.message || data?.message || `HTTP ${res.status}: ${text}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeMicrosoftBookingsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = inputs.accessToken;
        if (!token) return { error: 'Missing accessToken' };

        switch (actionName) {
            case 'listBusinesses': {
                const data = await bookingsFetch(token, 'GET', '', undefined, logger);
                return { output: data };
            }
            case 'getBusiness': {
                const id = inputs.businessId;
                if (!id) return { error: 'Missing businessId' };
                const data = await bookingsFetch(token, 'GET', `/${id}`, undefined, logger);
                return { output: data };
            }
            case 'createBusiness': {
                const body = {
                    displayName: inputs.displayName,
                    businessType: inputs.businessType || 'other',
                    ...(inputs.phone ? { phone: inputs.phone } : {}),
                    ...(inputs.email ? { email: inputs.email } : {}),
                    ...(inputs.webSiteUrl ? { webSiteUrl: inputs.webSiteUrl } : {}),
                    ...(inputs.address ? { address: inputs.address } : {}),
                    ...(inputs.businessHours ? { businessHours: inputs.businessHours } : {}),
                    ...(inputs.defaultCurrencyIso ? { defaultCurrencyIso: inputs.defaultCurrencyIso } : {}),
                };
                if (!body.displayName) return { error: 'Missing displayName' };
                const data = await bookingsFetch(token, 'POST', '', body, logger);
                return { output: data };
            }
            case 'updateBusiness': {
                const id = inputs.businessId;
                if (!id) return { error: 'Missing businessId' };
                const body: any = {};
                if (inputs.displayName) body.displayName = inputs.displayName;
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.email) body.email = inputs.email;
                if (inputs.webSiteUrl) body.webSiteUrl = inputs.webSiteUrl;
                if (inputs.address) body.address = inputs.address;
                if (inputs.businessHours) body.businessHours = inputs.businessHours;
                if (inputs.schedulingPolicy) body.schedulingPolicy = inputs.schedulingPolicy;
                const data = await bookingsFetch(token, 'PATCH', `/${id}`, body, logger);
                return { output: data };
            }
            case 'publishBusiness': {
                const id = inputs.businessId;
                if (!id) return { error: 'Missing businessId' };
                const data = await bookingsFetch(token, 'POST', `/${id}/publish`, {}, logger);
                return { output: { success: true, data } };
            }
            case 'unpublishBusiness': {
                const id = inputs.businessId;
                if (!id) return { error: 'Missing businessId' };
                const data = await bookingsFetch(token, 'POST', `/${id}/unpublish`, {}, logger);
                return { output: { success: true, data } };
            }
            case 'listServices': {
                const id = inputs.businessId;
                if (!id) return { error: 'Missing businessId' };
                const data = await bookingsFetch(token, 'GET', `/${id}/services`, undefined, logger);
                return { output: data };
            }
            case 'getService': {
                const businessId = inputs.businessId;
                const serviceId = inputs.serviceId;
                if (!businessId || !serviceId) return { error: 'Missing businessId or serviceId' };
                const data = await bookingsFetch(token, 'GET', `/${businessId}/services/${serviceId}`, undefined, logger);
                return { output: data };
            }
            case 'createService': {
                const id = inputs.businessId;
                if (!id) return { error: 'Missing businessId' };
                const body = {
                    displayName: inputs.displayName,
                    defaultDuration: inputs.defaultDuration || 'PT1H',
                    ...(inputs.description ? { description: inputs.description } : {}),
                    ...(inputs.defaultPrice ? { defaultPrice: inputs.defaultPrice } : {}),
                    ...(inputs.defaultPriceType ? { defaultPriceType: inputs.defaultPriceType } : {}),
                    ...(inputs.isHiddenFromCustomers ? { isHiddenFromCustomers: inputs.isHiddenFromCustomers } : {}),
                    ...(inputs.notes ? { notes: inputs.notes } : {}),
                    ...(inputs.staffMemberIds ? { staffMemberIds: inputs.staffMemberIds } : {}),
                };
                if (!body.displayName) return { error: 'Missing displayName' };
                const data = await bookingsFetch(token, 'POST', `/${id}/services`, body, logger);
                return { output: data };
            }
            case 'updateService': {
                const businessId = inputs.businessId;
                const serviceId = inputs.serviceId;
                if (!businessId || !serviceId) return { error: 'Missing businessId or serviceId' };
                const body: any = {};
                if (inputs.displayName) body.displayName = inputs.displayName;
                if (inputs.description) body.description = inputs.description;
                if (inputs.defaultDuration) body.defaultDuration = inputs.defaultDuration;
                if (inputs.defaultPrice !== undefined) body.defaultPrice = inputs.defaultPrice;
                if (inputs.notes) body.notes = inputs.notes;
                if (inputs.staffMemberIds) body.staffMemberIds = inputs.staffMemberIds;
                const data = await bookingsFetch(token, 'PATCH', `/${businessId}/services/${serviceId}`, body, logger);
                return { output: data };
            }
            case 'deleteService': {
                const businessId = inputs.businessId;
                const serviceId = inputs.serviceId;
                if (!businessId || !serviceId) return { error: 'Missing businessId or serviceId' };
                const data = await bookingsFetch(token, 'DELETE', `/${businessId}/services/${serviceId}`, undefined, logger);
                return { output: { success: true, data } };
            }
            case 'listStaff': {
                const id = inputs.businessId;
                if (!id) return { error: 'Missing businessId' };
                const data = await bookingsFetch(token, 'GET', `/${id}/staffMembers`, undefined, logger);
                return { output: data };
            }
            case 'addStaff': {
                const id = inputs.businessId;
                if (!id) return { error: 'Missing businessId' };
                const body = {
                    displayName: inputs.displayName,
                    emailAddress: inputs.emailAddress,
                    role: inputs.role || 'bookingStaff',
                    ...(inputs.availabilityIsAffectedByPersonalCalendar !== undefined
                        ? { availabilityIsAffectedByPersonalCalendar: inputs.availabilityIsAffectedByPersonalCalendar }
                        : {}),
                    ...(inputs.sendConfirmationToOwner !== undefined
                        ? { sendConfirmationToOwner: inputs.sendConfirmationToOwner }
                        : {}),
                    ...(inputs.workingHours ? { workingHours: inputs.workingHours } : {}),
                };
                if (!body.displayName || !body.emailAddress) return { error: 'Missing displayName or emailAddress' };
                const data = await bookingsFetch(token, 'POST', `/${id}/staffMembers`, body, logger);
                return { output: data };
            }
            case 'deleteStaff': {
                const businessId = inputs.businessId;
                const staffId = inputs.staffId;
                if (!businessId || !staffId) return { error: 'Missing businessId or staffId' };
                const data = await bookingsFetch(token, 'DELETE', `/${businessId}/staffMembers/${staffId}`, undefined, logger);
                return { output: { success: true, data } };
            }
            case 'listAppointments': {
                const id = inputs.businessId;
                if (!id) return { error: 'Missing businessId' };
                const params = new URLSearchParams();
                if (inputs.top) params.set('$top', String(inputs.top));
                if (inputs.skip) params.set('$skip', String(inputs.skip));
                if (inputs.filter) params.set('$filter', inputs.filter);
                const query = params.toString() ? `?${params}` : '';
                const data = await bookingsFetch(token, 'GET', `/${id}/appointments${query}`, undefined, logger);
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Microsoft Bookings] Error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
