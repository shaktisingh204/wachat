'use server';

const BASE = 'https://analytics.churnzero.net/i';

export async function executeChurnZeroAction(actionName: string, inputs: any, user: any, logger: any) {
    const appKey = inputs.appKey;

    function buildUrl(action: string, extra: Record<string, string> = {}) {
        const params = new URLSearchParams({ appKey, action, ...extra });
        return `${BASE}?${params}`;
    }

    try {
        switch (actionName) {
            case 'trackEvent': {
                const res = await fetch(buildUrl('trackEvent'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountExternalId: inputs.accountExternalId,
                        contactExternalId: inputs.contactExternalId,
                        eventName: inputs.eventName,
                        eventDate: inputs.eventDate || new Date().toISOString(),
                        attributes: inputs.attributes || {},
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'trackEvent failed' };
                return { output: data };
            }
            case 'setAttribute': {
                const res = await fetch(buildUrl('setAttribute'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountExternalId: inputs.accountExternalId,
                        contactExternalId: inputs.contactExternalId,
                        attributes: inputs.attributes || {},
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'setAttribute failed' };
                return { output: data };
            }
            case 'setContactAttribute': {
                const res = await fetch(buildUrl('setAttribute'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountExternalId: inputs.accountExternalId,
                        contactExternalId: inputs.contactExternalId,
                        attributes: inputs.attributes || {},
                        entity: 'Contact',
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'setContactAttribute failed' };
                return { output: data };
            }
            case 'setAccountAttribute': {
                const res = await fetch(buildUrl('setAttribute'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountExternalId: inputs.accountExternalId,
                        attributes: inputs.attributes || {},
                        entity: 'Account',
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'setAccountAttribute failed' };
                return { output: data };
            }
            case 'createAccount': {
                const res = await fetch(buildUrl('setAttribute'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountExternalId: inputs.accountExternalId,
                        attributes: { Name: inputs.name, ...inputs.attributes },
                        entity: 'Account',
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'createAccount failed' };
                return { output: data };
            }
            case 'getAccount': {
                const params = new URLSearchParams({ appKey, action: 'getAccount', accountExternalId: inputs.accountExternalId });
                const res = await fetch(`${BASE}?${params}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'getAccount failed' };
                return { output: data };
            }
            case 'createContact': {
                const res = await fetch(buildUrl('setAttribute'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountExternalId: inputs.accountExternalId,
                        contactExternalId: inputs.contactExternalId,
                        attributes: { FirstName: inputs.firstName, LastName: inputs.lastName, Email: inputs.email, ...inputs.attributes },
                        entity: 'Contact',
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'createContact failed' };
                return { output: data };
            }
            case 'getContact': {
                const params = new URLSearchParams({ appKey, action: 'getContact', accountExternalId: inputs.accountExternalId, contactExternalId: inputs.contactExternalId });
                const res = await fetch(`${BASE}?${params}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'getContact failed' };
                return { output: data };
            }
            case 'getAccountScore': {
                const params = new URLSearchParams({ appKey, action: 'getAccountScore', accountExternalId: inputs.accountExternalId });
                const res = await fetch(`${BASE}?${params}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'getAccountScore failed' };
                return { output: data };
            }
            case 'listTimeline': {
                const params = new URLSearchParams({ appKey, action: 'listTimeline', accountExternalId: inputs.accountExternalId });
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${BASE}?${params}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'listTimeline failed' };
                return { output: data };
            }
            case 'addTimeline': {
                const res = await fetch(buildUrl('addTimeline'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountExternalId: inputs.accountExternalId,
                        contactExternalId: inputs.contactExternalId,
                        subject: inputs.subject,
                        type: inputs.type,
                        activityDate: inputs.activityDate || new Date().toISOString(),
                        notes: inputs.notes,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'addTimeline failed' };
                return { output: data };
            }
            case 'listTasks': {
                const params = new URLSearchParams({ appKey, action: 'listTasks' });
                if (inputs.accountExternalId) params.set('accountExternalId', inputs.accountExternalId);
                const res = await fetch(`${BASE}?${params}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'listTasks failed' };
                return { output: data };
            }
            case 'createTask': {
                const res = await fetch(buildUrl('createTask'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountExternalId: inputs.accountExternalId,
                        subject: inputs.subject,
                        dueDate: inputs.dueDate,
                        assignedToEmail: inputs.assignedToEmail,
                        taskType: inputs.taskType,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'createTask failed' };
                return { output: data };
            }
            case 'listSegments': {
                const params = new URLSearchParams({ appKey, action: 'listSegments' });
                const res = await fetch(`${BASE}?${params}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'listSegments failed' };
                return { output: data };
            }
            case 'listAlerts': {
                const params = new URLSearchParams({ appKey, action: 'listAlerts' });
                if (inputs.accountExternalId) params.set('accountExternalId', inputs.accountExternalId);
                const res = await fetch(`${BASE}?${params}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || 'listAlerts failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown ChurnZero action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`ChurnZero action error: ${err.message}`);
        return { error: err.message || 'ChurnZero action failed' };
    }
}
