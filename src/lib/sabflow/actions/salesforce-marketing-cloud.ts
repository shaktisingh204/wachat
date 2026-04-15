'use server';

export async function executeSalesforceMarketingCloudAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const subdomain = inputs.subdomain;
        const clientId = inputs.clientId;
        const clientSecret = inputs.clientSecret;
        const baseUrl = `https://${subdomain}.rest.marketingcloudapis.com`;

        // Fetch OAuth2 token
        const tokenRes = await fetch(`https://${subdomain}.auth.marketingcloudapis.com/v2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData?.message || `Token error: ${tokenRes.status}`);
        const token: string = tokenData.access_token;

        switch (actionName) {
            case 'getToken': {
                return { output: { access_token: token, token_type: tokenData.token_type, expires_in: tokenData.expires_in } };
            }

            case 'listDataExtensions': {
                const res = await fetch(`${baseUrl}/data/v1/customobjects?$page=${inputs.page || 1}&$pagesize=${inputs.pageSize || 50}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { dataExtensions: data } };
            }

            case 'getDataExtensionRows': {
                const key = inputs.key;
                const filter = inputs.filter ? `?$filter=${encodeURIComponent(inputs.filter)}` : '';
                const res = await fetch(`${baseUrl}/data/v1/customobjectdata/key/${key}/rowset${filter}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { rows: data } };
            }

            case 'insertDataExtensionRow': {
                const key = inputs.key;
                const res = await fetch(`${baseUrl}/hub/v1/dataevents/key:${key}/rows`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: [inputs.row] }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'upsertDataExtensionRow': {
                const key = inputs.key;
                const res = await fetch(`${baseUrl}/hub/v1/dataevents/key:${key}/rows`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: [inputs.row] }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'deleteDataExtensionRow': {
                const key = inputs.key;
                const res = await fetch(`${baseUrl}/data/v1/customobjectdata/key/${key}/rows`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keys: inputs.keys }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'sendTriggeredEmail': {
                const res = await fetch(`${baseUrl}/messaging/v1/messageDefinitionSends/key:${inputs.definitionKey}/send`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        To: { Address: inputs.toAddress, SubscriberKey: inputs.subscriberKey, ContactAttributes: { SubscriberAttributes: inputs.attributes || {} } },
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'listEmails': {
                const res = await fetch(`${baseUrl}/asset/v1/content/assets?$filter=assetType.name%20eq%20'htmlemail'&$page=${inputs.page || 1}&$pagesize=${inputs.pageSize || 50}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { emails: data.items, count: data.count } };
            }

            case 'getEmailContent': {
                const res = await fetch(`${baseUrl}/asset/v1/content/assets/${inputs.assetId}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { email: data } };
            }

            case 'createEmail': {
                const res = await fetch(`${baseUrl}/asset/v1/content/assets`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: inputs.name,
                        assetType: { name: 'htmlemail', id: 208 },
                        views: { html: { content: inputs.htmlContent }, text: { content: inputs.textContent || '' } },
                        channels: { email: true },
                        subject: inputs.subject,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { email: data } };
            }

            case 'listLists': {
                const res = await fetch(`${baseUrl}/email/v1/lists?$page=${inputs.page || 1}&$pagesize=${inputs.pageSize || 50}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { lists: data.items, count: data.count } };
            }

            case 'getListSubscribers': {
                const res = await fetch(`${baseUrl}/email/v1/lists/${inputs.listId}/subscribers?$page=${inputs.page || 1}&$pagesize=${inputs.pageSize || 50}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { subscribers: data.items, count: data.count } };
            }

            case 'addSubscriber': {
                const res = await fetch(`${baseUrl}/contacts/v1/contacts`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contactKey: inputs.subscriberKey,
                        attributeSets: [{ name: 'Email Addresses', items: [{ values: [{ name: 'Email Address', value: inputs.email }, { name: 'HTML Enabled', value: true }] }] }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'removeSubscriber': {
                const res = await fetch(`${baseUrl}/contacts/v1/contacts/actions/delete`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ values: [inputs.subscriberKey], deleteOperationType: 'ContactAndAttributes' }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'listJourneys': {
                const res = await fetch(`${baseUrl}/interaction/v1/interactions?$page=${inputs.page || 1}&$pagesize=${inputs.pageSize || 50}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { journeys: data.items, count: data.count } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
