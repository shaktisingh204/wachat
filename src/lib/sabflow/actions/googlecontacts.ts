'use server';

export async function executeGoogleContactsAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = inputs.accessToken;
        const baseUrl = 'https://people.googleapis.com/v1';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listContacts': {
                const url = `${baseUrl}/people/me/connections?personFields=names,emailAddresses,phoneNumbers,addresses&pageSize=100`;
                const res = await fetch(url, { headers });
                if (!res.ok) return { error: `listContacts failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getContact': {
                const resourceName = inputs.resourceName;
                const url = `${baseUrl}/${resourceName}?personFields=names,emailAddresses,phoneNumbers`;
                const res = await fetch(url, { headers });
                if (!res.ok) return { error: `getContact failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createContact': {
                const person = {
                    names: [{ givenName: inputs.givenName, familyName: inputs.familyName }],
                    emailAddresses: inputs.email ? [{ value: inputs.email }] : undefined,
                    phoneNumbers: inputs.phone ? [{ value: inputs.phone }] : undefined,
                };
                const res = await fetch(`${baseUrl}/people:createContact`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(person),
                });
                if (!res.ok) return { error: `createContact failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateContact': {
                const resourceName = inputs.resourceName;
                const updatePersonFields = inputs.updatePersonFields;
                const url = `${baseUrl}/${resourceName}:updateContact?updatePersonFields=${updatePersonFields}`;
                const res = await fetch(url, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.person || {}),
                });
                if (!res.ok) return { error: `updateContact failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteContact': {
                const resourceName = inputs.resourceName;
                const res = await fetch(`${baseUrl}/${resourceName}:deleteContact`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteContact failed: ${res.status} ${await res.text()}` };
                return { output: { success: true } };
            }
            case 'searchContacts': {
                const q = encodeURIComponent(inputs.q || '');
                const url = `${baseUrl}/people:searchContacts?query=${q}&readMask=names,emailAddresses,phoneNumbers`;
                const res = await fetch(url, { headers });
                if (!res.ok) return { error: `searchContacts failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listContactGroups': {
                const res = await fetch(`${baseUrl}/contactGroups`, { headers });
                if (!res.ok) return { error: `listContactGroups failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getContactGroup': {
                const resourceName = inputs.resourceName;
                const res = await fetch(`${baseUrl}/contactGroups/${resourceName}`, { headers });
                if (!res.ok) return { error: `getContactGroup failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createContactGroup': {
                const res = await fetch(`${baseUrl}/contactGroups`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ contactGroup: { name: inputs.name } }),
                });
                if (!res.ok) return { error: `createContactGroup failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateContactGroup': {
                const resourceName = inputs.resourceName;
                const res = await fetch(`${baseUrl}/contactGroups/${resourceName}`, {
                    method: 'UPDATE',
                    headers,
                    body: JSON.stringify({ contactGroup: inputs.contactGroup || {} }),
                });
                if (!res.ok) return { error: `updateContactGroup failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteContactGroup': {
                const resourceName = inputs.resourceName;
                const res = await fetch(`${baseUrl}/contactGroups/${resourceName}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteContactGroup failed: ${res.status} ${await res.text()}` };
                return { output: { success: true } };
            }
            case 'addContactsToGroup': {
                const resourceName = inputs.resourceName;
                const res = await fetch(`${baseUrl}/contactGroups/${resourceName}/members:modify`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ resourceNamesToAdd: inputs.resourceNamesToAdd || [] }),
                });
                if (!res.ok) return { error: `addContactsToGroup failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Unknown Google Contacts action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeGoogleContactsAction error: ${err.message}`);
        return { error: err.message || 'Google Contacts action failed' };
    }
}
