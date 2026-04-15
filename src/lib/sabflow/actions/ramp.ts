'use server';

export async function executeRampAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { accessToken } = inputs;
        if (!accessToken) return { error: 'Ramp accessToken is required.' };

        const BASE = 'https://api.ramp.com/developer/v1';

        const req = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || json.error || 'Ramp API error');
            }
            return json;
        };

        switch (actionName) {
            case 'listCards': {
                const { pageSize, start } = inputs;
                const params = new URLSearchParams();
                if (pageSize) params.set('page_size', String(pageSize));
                if (start) params.set('start', start);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/cards${qs}`);
                return { output: result };
            }
            case 'getCard': {
                const { cardId } = inputs;
                if (!cardId) return { error: 'cardId is required.' };
                const result = await req('GET', `/cards/${cardId}`);
                return { output: result };
            }
            case 'createCard': {
                const { userId, cardType, displayName, spendingRestrictions } = inputs;
                if (!userId || !cardType) return { error: 'userId and cardType are required.' };
                const body: any = { user_id: userId, card_type: cardType };
                if (displayName) body.display_name = displayName;
                if (spendingRestrictions) body.spending_restrictions = spendingRestrictions;
                const result = await req('POST', '/cards', body);
                return { output: result };
            }
            case 'updateCard': {
                const { cardId, displayName, spendingRestrictions } = inputs;
                if (!cardId) return { error: 'cardId is required.' };
                const body: any = {};
                if (displayName) body.display_name = displayName;
                if (spendingRestrictions) body.spending_restrictions = spendingRestrictions;
                const result = await req('PATCH', `/cards/${cardId}`, body);
                return { output: result };
            }
            case 'suspendCard': {
                const { cardId } = inputs;
                if (!cardId) return { error: 'cardId is required.' };
                const result = await req('POST', `/cards/${cardId}/deferred/suspension`, {});
                return { output: result };
            }
            case 'terminateCard': {
                const { cardId, reason } = inputs;
                if (!cardId) return { error: 'cardId is required.' };
                const result = await req('POST', `/cards/${cardId}/deferred/termination`, { reason: reason || 'CARD_LOST' });
                return { output: result };
            }
            case 'listTransactions': {
                const { pageSize, start, cardId, userId, fromDate, toDate } = inputs;
                const params = new URLSearchParams();
                if (pageSize) params.set('page_size', String(pageSize));
                if (start) params.set('start', start);
                if (cardId) params.set('card_id', cardId);
                if (userId) params.set('user_id', userId);
                if (fromDate) params.set('from_date', fromDate);
                if (toDate) params.set('to_date', toDate);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/transactions${qs}`);
                return { output: result };
            }
            case 'getTransaction': {
                const { transactionId } = inputs;
                if (!transactionId) return { error: 'transactionId is required.' };
                const result = await req('GET', `/transactions/${transactionId}`);
                return { output: result };
            }
            case 'listUsers': {
                const { pageSize, start, departmentId, locationId } = inputs;
                const params = new URLSearchParams();
                if (pageSize) params.set('page_size', String(pageSize));
                if (start) params.set('start', start);
                if (departmentId) params.set('department_id', departmentId);
                if (locationId) params.set('location_id', locationId);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/users${qs}`);
                return { output: result };
            }
            case 'getUser': {
                const { userId } = inputs;
                if (!userId) return { error: 'userId is required.' };
                const result = await req('GET', `/users/${userId}`);
                return { output: result };
            }
            case 'createUser': {
                const { firstName, lastName, email, role, departmentId, locationId, managerId } = inputs;
                if (!firstName || !lastName || !email || !role) return { error: 'firstName, lastName, email, and role are required.' };
                const body: any = { first_name: firstName, last_name: lastName, email, role };
                if (departmentId) body.department_id = departmentId;
                if (locationId) body.location_id = locationId;
                if (managerId) body.direct_manager_id = managerId;
                const result = await req('POST', '/users/deferred', body);
                return { output: result };
            }
            case 'updateUser': {
                const { userId, departmentId, locationId, managerId, role } = inputs;
                if (!userId) return { error: 'userId is required.' };
                const body: any = {};
                if (departmentId) body.department_id = departmentId;
                if (locationId) body.location_id = locationId;
                if (managerId) body.direct_manager_id = managerId;
                if (role) body.role = role;
                const result = await req('PATCH', `/users/${userId}/deferred`, body);
                return { output: result };
            }
            case 'listDepartments': {
                const { pageSize, start } = inputs;
                const params = new URLSearchParams();
                if (pageSize) params.set('page_size', String(pageSize));
                if (start) params.set('start', start);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await req('GET', `/departments${qs}`);
                return { output: result };
            }
            case 'getDepartment': {
                const { departmentId } = inputs;
                if (!departmentId) return { error: 'departmentId is required.' };
                const result = await req('GET', `/departments/${departmentId}`);
                return { output: result };
            }
            case 'createDepartment': {
                const { name } = inputs;
                if (!name) return { error: 'Department name is required.' };
                const result = await req('POST', '/departments', { name });
                return { output: result };
            }
            default:
                logger.log(`Error: Ramp action "${actionName}" is not implemented.`);
                return { error: `Ramp action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Ramp action error: ${err.message}`);
        return { error: err.message || 'Unknown Ramp error.' };
    }
}
