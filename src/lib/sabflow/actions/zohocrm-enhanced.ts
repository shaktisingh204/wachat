'use server';

export async function executeZohoCrmEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        let accessToken = inputs.accessToken;

        // Token refresh via refresh_token grant
        if (!accessToken && inputs.refreshToken && inputs.clientId && inputs.clientSecret) {
            const params = new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: inputs.clientId,
                client_secret: inputs.clientSecret,
                refresh_token: inputs.refreshToken,
            });
            const tokenRes = await fetch(`https://accounts.zoho.com/oauth/v2/token?${params.toString()}`, {
                method: 'POST',
            });
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok || tokenData.error) throw new Error(tokenData.error || 'Zoho token refresh failed');
            accessToken = tokenData.access_token;
        }

        if (!accessToken) throw new Error('Missing accessToken or refresh credentials');

        const apiDomain = inputs.apiDomain || 'https://www.zohoapis.com';
        const base = `${apiDomain}/crm/v6`;
        const headers: Record<string, string> = {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'searchRecords': {
                const { module, criteria, email, phone, word, page, perPage } = inputs;
                const params = new URLSearchParams();
                if (criteria) params.set('criteria', criteria);
                if (email) params.set('email', email);
                if (phone) params.set('phone', phone);
                if (word) params.set('word', word);
                if (page) params.set('page', String(page));
                if (perPage) params.set('per_page', String(perPage));
                const res = await fetch(`${base}/${module}/search?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'getRecord': {
                const { module, recordId } = inputs;
                const res = await fetch(`${base}/${module}/${recordId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data.data?.[0] || data };
            }
            case 'createRecord': {
                const { module, record } = inputs;
                const res = await fetch(`${base}/${module}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ data: [record] }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'updateRecord': {
                const { module, recordId, record } = inputs;
                const res = await fetch(`${base}/${module}/${recordId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ data: [record] }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'deleteRecord': {
                const { module, recordId } = inputs;
                const res = await fetch(`${base}/${module}/${recordId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'upsertRecord': {
                const { module, record, duplicateCheckFields } = inputs;
                const body: any = { data: [record] };
                if (duplicateCheckFields) body.duplicate_check_fields = duplicateCheckFields;
                const res = await fetch(`${base}/${module}/upsert`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'listModules': {
                const res = await fetch(`${base}/settings/modules`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'getFields': {
                const { module } = inputs;
                const res = await fetch(`${base}/settings/fields?module=${module}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'createNote': {
                const { parentModule, parentId, noteTitle, noteContent } = inputs;
                const res = await fetch(`${base}/Notes`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        data: [{
                            Note_Title: noteTitle,
                            Note_Content: noteContent,
                            Parent_Id: { id: parentId },
                            se_module: parentModule,
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'listNotes': {
                const { parentModule, parentId } = inputs;
                const res = await fetch(`${base}/${parentModule}/${parentId}/Notes`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'createTask': {
                const res = await fetch(`${base}/Tasks`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ data: [inputs.task || inputs] }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'createEvent': {
                const res = await fetch(`${base}/Events`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ data: [inputs.event || inputs] }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'sendEmail': {
                const { module, recordId, fromAddress, toAddress, subject, content } = inputs;
                const res = await fetch(`${base}/${module}/${recordId}/actions/send_mail`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        data: [{
                            from: { user_name: fromAddress },
                            to: [{ user_name: toAddress }],
                            subject,
                            content,
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'convertLead': {
                const { leadId, overwrite, notifyLeadOwner, notifyNewEntityOwner, accounts, contacts, deals } = inputs;
                const res = await fetch(`${base}/Leads/${leadId}/actions/convert`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        data: [{
                            overwrite: overwrite ?? true,
                            notify_lead_owner: notifyLeadOwner ?? false,
                            notify_new_entity_owner: notifyNewEntityOwner ?? false,
                            Accounts: accounts,
                            Contacts: contacts,
                            Deals: deals,
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'createDeal': {
                const res = await fetch(`${base}/Deals`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ data: [inputs.deal || inputs] }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            default:
                throw new Error(`Unknown Zoho CRM Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`ZohoCrmEnhanced error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
