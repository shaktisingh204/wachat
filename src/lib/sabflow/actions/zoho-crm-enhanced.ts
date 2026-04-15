'use server';

export async function executeZohoCRMEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const baseUrl = 'https://www.zohoapis.com/crm/v7';
        const headers: Record<string, string> = {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listRecords': {
                const moduleName = String(inputs.moduleName ?? 'Leads').trim();
                const page = inputs.page ?? 1;
                const perPage = inputs.perPage ?? 200;
                const fields = inputs.fields ? `&fields=${encodeURIComponent(inputs.fields)}` : '';
                const res = await fetch(`${baseUrl}/${moduleName}?page=${page}&per_page=${perPage}${fields}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { records: data.data, info: data.info } };
            }
            case 'getRecord': {
                const moduleName = String(inputs.moduleName ?? 'Leads').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!recordId) throw new Error('recordId is required.');
                const res = await fetch(`${baseUrl}/${moduleName}/${recordId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { record: data.data?.[0] ?? data } };
            }
            case 'createRecord': {
                const moduleName = String(inputs.moduleName ?? 'Leads').trim();
                const record = inputs.record ?? {};
                const res = await fetch(`${baseUrl}/${moduleName}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ data: [record] }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data.data?.[0] } };
            }
            case 'updateRecord': {
                const moduleName = String(inputs.moduleName ?? 'Leads').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!recordId) throw new Error('recordId is required.');
                const record = inputs.record ?? {};
                const res = await fetch(`${baseUrl}/${moduleName}/${recordId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ data: [{ id: recordId, ...record }] }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data.data?.[0] } };
            }
            case 'deleteRecord': {
                const moduleName = String(inputs.moduleName ?? 'Leads').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!recordId) throw new Error('recordId is required.');
                const res = await fetch(`${baseUrl}/${moduleName}/${recordId}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { deleted: true, result: data.data?.[0] } };
            }
            case 'searchRecords': {
                const moduleName = String(inputs.moduleName ?? 'Leads').trim();
                const criteria = String(inputs.criteria ?? '').trim();
                const email = inputs.email ? `&email=${encodeURIComponent(inputs.email)}` : '';
                const phone = inputs.phone ? `&phone=${encodeURIComponent(inputs.phone)}` : '';
                const word = inputs.word ? `&word=${encodeURIComponent(inputs.word)}` : '';
                const criteriaParam = criteria ? `&criteria=${encodeURIComponent(criteria)}` : '';
                const res = await fetch(`${baseUrl}/${moduleName}/search?page=1&per_page=200${criteriaParam}${email}${phone}${word}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { records: data.data, info: data.info } };
            }
            case 'listModules': {
                const res = await fetch(`${baseUrl}/settings/modules`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { modules: data.modules } };
            }
            case 'getModule': {
                const moduleName = String(inputs.moduleName ?? '').trim();
                if (!moduleName) throw new Error('moduleName is required.');
                const res = await fetch(`${baseUrl}/settings/modules/${moduleName}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { module: data.modules?.[0] ?? data } };
            }
            case 'convertLead': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                const convertData = inputs.convertData ?? {};
                const res = await fetch(`${baseUrl}/Leads/${leadId}/actions/convert`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ data: [convertData] }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data.data?.[0] } };
            }
            case 'listNotes': {
                const moduleName = String(inputs.moduleName ?? 'Leads').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!recordId) throw new Error('recordId is required.');
                const res = await fetch(`${baseUrl}/${moduleName}/${recordId}/Notes`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { notes: data.data, info: data.info } };
            }
            case 'createNote': {
                const moduleName = String(inputs.moduleName ?? 'Leads').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!recordId) throw new Error('recordId is required.');
                const noteTitle = String(inputs.noteTitle ?? '').trim();
                const noteContent = String(inputs.noteContent ?? '').trim();
                const res = await fetch(`${baseUrl}/Notes`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        data: [{
                            Note_Title: noteTitle,
                            Note_Content: noteContent,
                            Parent_Id: { id: recordId },
                            se_module: moduleName,
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { note: data.data?.[0] } };
            }
            case 'sendEmail': {
                const moduleName = String(inputs.moduleName ?? 'Leads').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!recordId) throw new Error('recordId is required.');
                const from = inputs.from ?? {};
                const to = inputs.to ?? [];
                const subject = String(inputs.subject ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                const res = await fetch(`${baseUrl}/${moduleName}/${recordId}/actions/send_mail`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ data: [{ from, to, subject, content }] }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data.data } };
            }
            case 'listActivities': {
                const activityType = String(inputs.activityType ?? 'Tasks').trim();
                const page = inputs.page ?? 1;
                const perPage = inputs.perPage ?? 200;
                const res = await fetch(`${baseUrl}/${activityType}?page=${page}&per_page=${perPage}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { activities: data.data, info: data.info } };
            }
            case 'createActivity': {
                const activityType = String(inputs.activityType ?? 'Tasks').trim();
                const activity = inputs.activity ?? {};
                const res = await fetch(`${baseUrl}/${activityType}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ data: [activity] }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { activity: data.data?.[0] } };
            }
            case 'getRelatedRecords': {
                const moduleName = String(inputs.moduleName ?? 'Contacts').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                const relatedModule = String(inputs.relatedModule ?? '').trim();
                if (!recordId || !relatedModule) throw new Error('recordId and relatedModule are required.');
                const res = await fetch(`${baseUrl}/${moduleName}/${recordId}/${relatedModule}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { records: data.data, info: data.info } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
