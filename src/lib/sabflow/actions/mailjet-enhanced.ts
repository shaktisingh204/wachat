'use server';

export async function executeMailjetEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.mailjet.com/v3.1';
        const baseUrlV3 = 'https://api.mailjet.com/v3/REST';
        const authHeader = 'Basic ' + Buffer.from(inputs.apiKey + ':' + inputs.apiSecret).toString('base64');

        const headers: Record<string, string> = {
            Authorization: authHeader,
            'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: string | undefined;

        switch (actionName) {
            case 'sendEmail': {
                method = 'POST';
                url = `${baseUrl}/send`;
                body = JSON.stringify({
                    Messages: [{
                        From: { Email: inputs.fromEmail, Name: inputs.fromName ?? '' },
                        To: [{ Email: inputs.toEmail, Name: inputs.toName ?? '' }],
                        Subject: inputs.subject,
                        TextPart: inputs.textPart ?? '',
                        HTMLPart: inputs.htmlPart ?? '',
                        CustomID: inputs.customId ?? '',
                    }],
                });
                break;
            }
            case 'sendBulkEmail': {
                method = 'POST';
                url = `${baseUrl}/send`;
                const messages = (inputs.messages as any[]).map((msg: any) => ({
                    From: { Email: msg.fromEmail ?? inputs.fromEmail, Name: msg.fromName ?? inputs.fromName ?? '' },
                    To: msg.to,
                    Subject: msg.subject,
                    TextPart: msg.textPart ?? '',
                    HTMLPart: msg.htmlPart ?? '',
                    CustomID: msg.customId ?? '',
                }));
                body = JSON.stringify({ Messages: messages });
                break;
            }
            case 'listContacts': {
                const limit = inputs.limit ?? 10;
                const offset = inputs.offset ?? 0;
                url = `${baseUrlV3}/contact?Limit=${limit}&Offset=${offset}`;
                break;
            }
            case 'getContact': {
                url = `${baseUrlV3}/contact/${inputs.contactId}`;
                break;
            }
            case 'createContact': {
                method = 'POST';
                url = `${baseUrlV3}/contact`;
                body = JSON.stringify({
                    Email: inputs.email,
                    Name: inputs.name ?? '',
                    IsExcludedFromCampaigns: inputs.isExcludedFromCampaigns ?? false,
                });
                break;
            }
            case 'updateContact': {
                method = 'PUT';
                url = `${baseUrlV3}/contact/${inputs.contactId}`;
                body = JSON.stringify({
                    Name: inputs.name,
                    IsExcludedFromCampaigns: inputs.isExcludedFromCampaigns,
                });
                break;
            }
            case 'deleteContact': {
                method = 'DELETE';
                url = `${baseUrlV3}/contact/${inputs.contactId}`;
                break;
            }
            case 'listContactLists': {
                const limit = inputs.limit ?? 10;
                const offset = inputs.offset ?? 0;
                url = `${baseUrlV3}/contactslist?Limit=${limit}&Offset=${offset}`;
                break;
            }
            case 'createContactList': {
                method = 'POST';
                url = `${baseUrlV3}/contactslist`;
                body = JSON.stringify({
                    Name: inputs.name,
                    IsDeleted: false,
                });
                break;
            }
            case 'addContactToList': {
                method = 'POST';
                url = `${baseUrlV3}/contactslist/${inputs.listId}/managecontact`;
                body = JSON.stringify({
                    Email: inputs.email,
                    Name: inputs.name ?? '',
                    Action: 'addnoforce',
                    Properties: inputs.properties ?? {},
                });
                break;
            }
            case 'removeContactFromList': {
                method = 'POST';
                url = `${baseUrlV3}/contactslist/${inputs.listId}/managecontact`;
                body = JSON.stringify({
                    Email: inputs.email,
                    Action: 'remove',
                });
                break;
            }
            case 'listTransactionalEmails': {
                const limit = inputs.limit ?? 10;
                const offset = inputs.offset ?? 0;
                url = `${baseUrlV3}/message?Limit=${limit}&Offset=${offset}`;
                break;
            }
            case 'getTemplate': {
                url = `${baseUrlV3}/template/${inputs.templateId}`;
                break;
            }
            case 'createTemplate': {
                method = 'POST';
                url = `${baseUrlV3}/template`;
                body = JSON.stringify({
                    Name: inputs.name,
                    Author: inputs.author ?? '',
                    EditMode: inputs.editMode ?? 1,
                    Purposes: inputs.purposes ?? ['transactional'],
                });
                break;
            }
            case 'listTemplates': {
                const limit = inputs.limit ?? 10;
                const offset = inputs.offset ?? 0;
                url = `${baseUrlV3}/template?Limit=${limit}&Offset=${offset}`;
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

        if (method === 'DELETE' && response.status === 204) {
            return { output: { success: true } };
        }

        let data: any;
        const text = await response.text();
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = { raw: text };
        }

        if (!response.ok) {
            return { error: data?.ErrorMessage ?? data?.StatusCode ?? JSON.stringify(data) };
        }

        return { output: data };
    } catch (err: any) {
        logger?.error?.('executeMailjetEnhancedAction error', err);
        return { error: err?.message ?? 'Unknown error' };
    }
}
