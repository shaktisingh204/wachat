'use server';

export async function executeKayakoAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = String(inputs.baseUrl ?? '').trim().replace(/\/$/, '');
        const sessionToken = String(inputs.sessionToken ?? '').trim();
        const email = String(inputs.email ?? '').trim();
        const password = String(inputs.password ?? '').trim();

        const authHeaders: Record<string, string> = sessionToken
            ? { 'X-Session-Token': sessionToken }
            : { 'Authorization': 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64') };

        const headers = { ...authHeaders, 'Content-Type': 'application/json', 'Accept': 'application/json' };

        switch (actionName) {
            case 'listCases': {
                const status = inputs.status ? `?status=${encodeURIComponent(inputs.status)}` : '';
                const res = await fetch(`${baseUrl}/api/v1/cases${status}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { cases: data.data ?? data } };
            }
            case 'getCase': {
                const caseId = String(inputs.caseId ?? '').trim();
                const res = await fetch(`${baseUrl}/api/v1/cases/${caseId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { case: data.data ?? data } };
            }
            case 'createCase': {
                const res = await fetch(`${baseUrl}/api/v1/cases`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        subject: inputs.subject,
                        contents: inputs.contents,
                        channel: inputs.channel ?? 'MAIL',
                        status: inputs.status ?? 'NEW',
                        requester_id: inputs.requesterId,
                        assignee_id: inputs.assigneeId,
                        team_id: inputs.teamId,
                        tags: inputs.tags ?? [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { case: data.data ?? data } };
            }
            case 'updateCase': {
                const caseId = String(inputs.caseId ?? '').trim();
                const res = await fetch(`${baseUrl}/api/v1/cases/${caseId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        subject: inputs.subject,
                        status: inputs.status,
                        assignee_id: inputs.assigneeId,
                        team_id: inputs.teamId,
                        priority: inputs.priority,
                        tags: inputs.tags,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { case: data.data ?? data } };
            }
            case 'deleteCase': {
                const caseId = String(inputs.caseId ?? '').trim();
                const res = await fetch(`${baseUrl}/api/v1/cases/${caseId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.message || `API error: ${res.status}`);
                }
                return { output: { success: true, caseId } };
            }
            case 'addNote': {
                const caseId = String(inputs.caseId ?? '').trim();
                const res = await fetch(`${baseUrl}/api/v1/cases/${caseId}/notes`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        contents: inputs.contents,
                        is_private: inputs.isPrivate ?? true,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { note: data.data ?? data } };
            }
            case 'listNotes': {
                const caseId = String(inputs.caseId ?? '').trim();
                const res = await fetch(`${baseUrl}/api/v1/cases/${caseId}/notes`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { notes: data.data ?? data } };
            }
            case 'listContacts': {
                const search = inputs.search ? `?query=${encodeURIComponent(inputs.search)}` : '';
                const res = await fetch(`${baseUrl}/api/v1/contacts${search}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contacts: data.data ?? data } };
            }
            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                const res = await fetch(`${baseUrl}/api/v1/contacts/${contactId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data.data ?? data } };
            }
            case 'createContact': {
                const res = await fetch(`${baseUrl}/api/v1/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        email: inputs.email,
                        phone: inputs.phone,
                        organization_id: inputs.organizationId,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data.data ?? data } };
            }
            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                const res = await fetch(`${baseUrl}/api/v1/contacts/${contactId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        email: inputs.email,
                        phone: inputs.phone,
                        organization_id: inputs.organizationId,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data.data ?? data } };
            }
            case 'listTeams': {
                const res = await fetch(`${baseUrl}/api/v1/teams`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { teams: data.data ?? data } };
            }
            case 'getTeam': {
                const teamId = String(inputs.teamId ?? '').trim();
                const res = await fetch(`${baseUrl}/api/v1/teams/${teamId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { team: data.data ?? data } };
            }
            case 'listUsers': {
                const role = inputs.role ? `?role=${encodeURIComponent(inputs.role)}` : '';
                const res = await fetch(`${baseUrl}/api/v1/users${role}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { users: data.data ?? data } };
            }
            case 'assignCase': {
                const caseId = String(inputs.caseId ?? '').trim();
                const res = await fetch(`${baseUrl}/api/v1/cases/${caseId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        assignee_id: inputs.assigneeId,
                        team_id: inputs.teamId,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { case: data.data ?? data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
