'use server';

export async function executeCloseCrmAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { apiKey } = inputs;
        if (!apiKey) return { error: 'Close CRM apiKey is required.' };

        const BASE = 'https://api.close.com/api/v1';
        const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
        const headers: Record<string, string> = {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        let res: Response;

        switch (actionName) {
            case 'listLeads': {
                const { query, limit, skip } = inputs;
                const params = new URLSearchParams();
                if (query) params.set('query', query);
                if (limit) params.set('_limit', String(limit));
                if (skip) params.set('_skip', String(skip));
                res = await fetch(`${BASE}/lead/?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list leads.' };
                return { output: data };
            }
            case 'getLead': {
                const { leadId } = inputs;
                res = await fetch(`${BASE}/lead/${leadId}/`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get lead.' };
                return { output: data };
            }
            case 'createLead': {
                const { name, url, contacts, status_id, ...rest } = inputs;
                const body: any = { name };
                if (url) body.url = url;
                if (contacts) body.contacts = contacts;
                if (status_id) body.status_id = status_id;
                Object.assign(body, rest);
                res = await fetch(`${BASE}/lead/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create lead.' };
                return { output: data };
            }
            case 'updateLead': {
                const { leadId, ...rest } = inputs;
                res = await fetch(`${BASE}/lead/${leadId}/`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(rest),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to update lead.' };
                return { output: data };
            }
            case 'deleteLead': {
                const { leadId } = inputs;
                res = await fetch(`${BASE}/lead/${leadId}/`, { method: 'DELETE', headers });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.error || 'Failed to delete lead.' };
                }
                return { output: { success: true } };
            }
            case 'listContacts': {
                const { limit, skip } = inputs;
                const params = new URLSearchParams();
                if (limit) params.set('_limit', String(limit));
                if (skip) params.set('_skip', String(skip));
                res = await fetch(`${BASE}/contact/?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list contacts.' };
                return { output: data };
            }
            case 'getContact': {
                const { contactId } = inputs;
                res = await fetch(`${BASE}/contact/${contactId}/`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get contact.' };
                return { output: data };
            }
            case 'createContact': {
                const { leadId, name, ...rest } = inputs;
                const body: any = { lead_id: leadId, name };
                Object.assign(body, rest);
                res = await fetch(`${BASE}/contact/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create contact.' };
                return { output: data };
            }
            case 'updateContact': {
                const { contactId, ...rest } = inputs;
                res = await fetch(`${BASE}/contact/${contactId}/`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(rest),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to update contact.' };
                return { output: data };
            }
            case 'listActivities': {
                const { leadId, type, limit, skip } = inputs;
                const params = new URLSearchParams();
                if (leadId) params.set('lead_id', leadId);
                if (limit) params.set('_limit', String(limit));
                if (skip) params.set('_skip', String(skip));
                const actType = type || 'all';
                res = await fetch(`${BASE}/activity/${actType}/?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list activities.' };
                return { output: data };
            }
            case 'createNote': {
                const { leadId, note } = inputs;
                res = await fetch(`${BASE}/activity/note/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ lead_id: leadId, note }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create note.' };
                return { output: data };
            }
            case 'createCall': {
                const { leadId, status, note, duration, direction } = inputs;
                res = await fetch(`${BASE}/activity/call/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ lead_id: leadId, status, note, duration, direction }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create call.' };
                return { output: data };
            }
            case 'createEmail': {
                const { leadId, status, subject, body_text, body_html, to, from } = inputs;
                res = await fetch(`${BASE}/activity/email/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ lead_id: leadId, status, subject, body_text, body_html, to, from }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create email.' };
                return { output: data };
            }
            case 'listOpportunities': {
                const { leadId, limit, skip } = inputs;
                const params = new URLSearchParams();
                if (leadId) params.set('lead_id', leadId);
                if (limit) params.set('_limit', String(limit));
                if (skip) params.set('_skip', String(skip));
                res = await fetch(`${BASE}/opportunity/?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list opportunities.' };
                return { output: data };
            }
            case 'createOpportunity': {
                const { leadId, status_id, confidence, value, note, ...rest } = inputs;
                const body: any = { lead_id: leadId, status_id };
                if (confidence !== undefined) body.confidence = confidence;
                if (value !== undefined) body.value = value;
                if (note) body.note = note;
                Object.assign(body, rest);
                res = await fetch(`${BASE}/opportunity/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create opportunity.' };
                return { output: data };
            }
            case 'updateOpportunity': {
                const { opportunityId, ...rest } = inputs;
                res = await fetch(`${BASE}/opportunity/${opportunityId}/`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(rest),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to update opportunity.' };
                return { output: data };
            }
            case 'searchLeads': {
                const { query, limit, skip } = inputs;
                const params = new URLSearchParams();
                if (query) params.set('query', query);
                if (limit) params.set('_limit', String(limit));
                if (skip) params.set('_skip', String(skip));
                res = await fetch(`${BASE}/lead/?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to search leads.' };
                return { output: data };
            }
            default:
                return { error: `Close CRM action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        return { error: err.message || 'An unexpected error occurred in Close CRM action.' };
    }
}
