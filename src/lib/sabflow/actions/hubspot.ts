
'use server';

import type { WithId, User } from '@/lib/definitions';
import axios from 'axios';

const HUBSPOT_BASE = 'https://api.hubapi.com';

function getHubSpotToken(user: WithId<User>): string {
    const settings = (user as any).sabFlowConnections?.find((c: any) => c.appName === 'HubSpot');
    const token = settings?.credentials?.accessToken;
    if (!token) throw new Error('HubSpot is not connected.');
    return String(token);
}

async function hsRequest(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    token: string,
    body?: any,
    query?: Record<string, any>
) {
    const res = await axios({
        method,
        url: `${HUBSPOT_BASE}${path}`,
        data: body,
        params: query,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    return res.data;
}

function cleanProperties(obj: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined && v !== null && v !== '') out[k] = String(v);
    }
    return out;
}

export async function executeHubSpotAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        const token = getHubSpotToken(user);

        switch (actionName) {
            case 'createContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const properties = cleanProperties({
                    email,
                    firstname: inputs.firstname,
                    lastname: inputs.lastname,
                    phone: inputs.phone,
                    company: inputs.company,
                });
                const data = await hsRequest('POST', '/crm/v3/objects/contacts', token, { properties });
                logger.log(`[HubSpot] Created contact ${data.id}`);
                return { output: { contactId: String(data.id) } };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const properties = cleanProperties({
                    firstname: inputs.firstname,
                    lastname: inputs.lastname,
                    phone: inputs.phone,
                });
                if (Object.keys(properties).length === 0) {
                    throw new Error('At least one property to update is required.');
                }
                const data = await hsRequest('PATCH', `/crm/v3/objects/contacts/${contactId}`, token, { properties });
                return { output: { contactId: String(data.id) } };
            }

            case 'getContactByEmail': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await hsRequest('POST', '/crm/v3/objects/contacts/search', token, {
                    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
                    limit: 1,
                });
                const contact = data.results?.[0] || null;
                return { output: { contact, found: String(Boolean(contact)) } };
            }

            case 'createDeal': {
                const dealname = String(inputs.dealname ?? '').trim();
                if (!dealname) throw new Error('dealname is required.');
                const properties: Record<string, any> = { dealname };
                if (inputs.amount !== undefined && inputs.amount !== '') {
                    const amt = Number(inputs.amount);
                    if (Number.isFinite(amt)) properties.amount = String(amt);
                }
                if (inputs.pipeline) properties.pipeline = String(inputs.pipeline);
                if (inputs.dealstage) properties.dealstage = String(inputs.dealstage);
                const data = await hsRequest('POST', '/crm/v3/objects/deals', token, { properties });
                return { output: { dealId: String(data.id) } };
            }

            case 'addNote': {
                const contactId = String(inputs.contactId ?? '').trim();
                const noteContent = String(inputs.note ?? '').trim();
                if (!contactId || !noteContent) throw new Error('contactId and note are required.');
                // Create a note engagement and associate with the contact
                const data = await hsRequest('POST', '/crm/v3/objects/notes', token, {
                    properties: {
                        hs_note_body: noteContent,
                        hs_timestamp: String(Date.now()),
                    },
                    associations: [
                        {
                            to: { id: contactId },
                            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 /* note→contact */ }],
                        },
                    ],
                });
                return { output: { noteId: String(data.id) } };
            }

            default:
                return { error: `HubSpot action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const hs = e?.response?.data;
        const msg = hs?.message || hs?.errors?.[0]?.message || e.message || 'HubSpot action failed.';
        return { error: msg };
    }
}
