'use server';

export async function executeEmmaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accountId = inputs.accountId;
        const baseUrl = `https://api.e2ma.net/${accountId}`;
        const secret = inputs.privateKey ?? inputs.publicKey;
        const authHeader = 'Basic ' + Buffer.from(inputs.accountId + ':' + secret).toString('base64');

        const headers: Record<string, string> = {
            Authorization: authHeader,
            'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: string | undefined;

        switch (actionName) {
            case 'listGroups': {
                url = `${baseUrl}/groups`;
                break;
            }
            case 'getGroup': {
                url = `${baseUrl}/groups/${inputs.groupId}`;
                break;
            }
            case 'createGroup': {
                method = 'POST';
                url = `${baseUrl}/groups`;
                body = JSON.stringify([{ group_name: inputs.groupName }]);
                break;
            }
            case 'listMembers': {
                const start = inputs.start ?? 0;
                const end = inputs.end ?? 500;
                url = `${baseUrl}/members?start=${start}&end=${end}`;
                break;
            }
            case 'getMember': {
                url = `${baseUrl}/members/${inputs.memberId}`;
                break;
            }
            case 'addMember': {
                method = 'POST';
                url = `${baseUrl}/members/add`;
                body = JSON.stringify({
                    members: [{
                        email: inputs.email,
                        fields: inputs.fields ?? {},
                        group_ids: inputs.groupIds ?? [],
                    }],
                    source_filename: inputs.sourceFilename ?? 'API Add',
                    add_only: inputs.addOnly ?? false,
                    group_ids: inputs.groupIds ?? [],
                });
                break;
            }
            case 'updateMember': {
                method = 'PUT';
                url = `${baseUrl}/members/${inputs.memberId}`;
                body = JSON.stringify({
                    fields: inputs.fields ?? {},
                    status_to: inputs.status ?? 'active',
                });
                break;
            }
            case 'deleteMembers': {
                method = 'PUT';
                url = `${baseUrl}/members/delete`;
                body = JSON.stringify({ member_ids: inputs.memberIds });
                break;
            }
            case 'listMailings': {
                url = `${baseUrl}/mailings`;
                break;
            }
            case 'getMailing': {
                url = `${baseUrl}/mailings/${inputs.mailingId}`;
                break;
            }
            case 'createMailing': {
                method = 'POST';
                url = `${baseUrl}/mailings`;
                body = JSON.stringify({
                    name: inputs.name,
                    public_name: inputs.publicName ?? inputs.name,
                    subject: inputs.subject,
                    from_name: inputs.fromName,
                    from_email: inputs.fromEmail,
                    reply_to: inputs.replyTo ?? inputs.fromEmail,
                    body: {
                        html: inputs.htmlBody ?? '',
                        plaintext: inputs.plaintextBody ?? '',
                    },
                });
                break;
            }
            case 'sendMailing': {
                method = 'POST';
                url = `${baseUrl}/mailings/${inputs.mailingId}/send`;
                body = JSON.stringify({
                    recipients: {
                        groups: inputs.groupIds ? inputs.groupIds.map((id: string) => ({ group_id: id })) : [],
                        searches: inputs.searchIds ? inputs.searchIds.map((id: string) => ({ search_id: id })) : [],
                    },
                    heads_up_emails: inputs.headsUpEmails ?? [],
                    sender: inputs.sender ?? null,
                    schedule_time: inputs.scheduleTime ?? null,
                });
                break;
            }
            case 'listFields': {
                url = `${baseUrl}/fields`;
                break;
            }
            case 'createField': {
                method = 'POST';
                url = `${baseUrl}/fields`;
                body = JSON.stringify({
                    shortcut_name: inputs.shortcutName,
                    display_name: inputs.displayName,
                    field_type: inputs.fieldType ?? 'text',
                    required: inputs.required ?? false,
                    column_order: inputs.columnOrder ?? 0,
                });
                break;
            }
            case 'searchMembers': {
                method = 'POST';
                url = `${baseUrl}/members/search`;
                body = JSON.stringify({
                    criteria: inputs.criteria ?? [],
                    include_deleted: inputs.includeDeleted ?? false,
                });
                break;
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }

        const response = await fetch(url, {
            method,
            headers,
            body,
        });

        let data: any;
        const text = await response.text();
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = { raw: text };
        }

        if (!response.ok) {
            return { error: data?.error ?? data?.message ?? JSON.stringify(data) };
        }

        return { output: data };
    } catch (err: any) {
        logger?.error?.('executeEmmaAction error', err);
        return { error: err?.message ?? 'Unknown error' };
    }
}
