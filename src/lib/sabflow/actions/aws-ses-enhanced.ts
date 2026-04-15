'use server';

import { createHmac, createHash } from 'crypto';

function sha256(d: string): string { return createHash('sha256').update(d).digest('hex'); }
function hmac(k: Buffer | string, d: string): Buffer { return createHmac('sha256', k).update(d).digest(); }
function signingKey(secret: string, date: string, region: string, svc: string): Buffer {
    return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), svc), 'aws4_request');
}
function awsFetch(method: string, url: string, region: string, svc: string, keyId: string, secret: string, body: string, extraHeaders: Record<string, string> = {}) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const ds = amzDate.slice(0, 8);
    const u = new URL(url);
    const allHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        'Host': u.host,
        ...extraHeaders,
    };
    const sh = Object.keys(allHeaders).map(k => k.toLowerCase()).sort().join(';');
    const ch = Object.entries(allHeaders).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
    const cr = [method, u.pathname, u.search.slice(1), ch, sh, sha256(body)].join('\n');
    const scope = `${ds}/${region}/${svc}/aws4_request`;
    const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(cr)}`;
    const sig = hmac(signingKey(secret, ds, region, svc), sts).toString('hex');
    allHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope},SignedHeaders=${sh},Signature=${sig}`;
    return fetch(url, { method, headers: allHeaders, body: body || undefined });
}

export async function executeAwsSesEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const base = `https://email.${region}.amazonaws.com/v2`;

        const callPost = async (path: string, payload: object) => {
            const body = JSON.stringify(payload);
            const res = await awsFetch('POST', `${base}${path}`, region, 'ses', accessKeyId, secretAccessKey, body);
            const json = await res.json() as any;
            if (!res.ok) throw new Error(json.message || json.Message || JSON.stringify(json));
            return json;
        };

        const callGet = async (path: string) => {
            const res = await awsFetch('GET', `${base}${path}`, region, 'ses', accessKeyId, secretAccessKey, '');
            const json = await res.json() as any;
            if (!res.ok) throw new Error(json.message || json.Message || JSON.stringify(json));
            return json;
        };

        const callDelete = async (path: string) => {
            const res = await awsFetch('DELETE', `${base}${path}`, region, 'ses', accessKeyId, secretAccessKey, '');
            if (!res.ok) {
                const json = await res.json() as any;
                throw new Error(json.message || json.Message || JSON.stringify(json));
            }
            return true;
        };

        const callPut = async (path: string, payload: object) => {
            const body = JSON.stringify(payload);
            const res = await awsFetch('PUT', `${base}${path}`, region, 'ses', accessKeyId, secretAccessKey, body);
            const json = await res.json() as any;
            if (!res.ok) throw new Error(json.message || json.Message || JSON.stringify(json));
            return json;
        };

        switch (actionName) {
            case 'sendEmail': {
                const fromAddress = String(inputs.fromAddress ?? '').trim();
                const toAddress = String(inputs.toAddress ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const bodyText = String(inputs.bodyText ?? '').trim();
                const bodyHtml = String(inputs.bodyHtml ?? '').trim();
                if (!fromAddress || !toAddress || !subject) throw new Error('fromAddress, toAddress, and subject are required.');
                logger.log(`[SES] Sending email to ${toAddress}`);
                const payload: any = {
                    FromEmailAddress: fromAddress,
                    Destination: { ToAddresses: [toAddress] },
                    Content: {
                        Simple: {
                            Subject: { Data: subject, Charset: 'UTF-8' },
                            Body: {
                                ...(bodyText ? { Text: { Data: bodyText, Charset: 'UTF-8' } } : {}),
                                ...(bodyHtml ? { Html: { Data: bodyHtml, Charset: 'UTF-8' } } : { Text: { Data: bodyText || subject, Charset: 'UTF-8' } }),
                            },
                        },
                    },
                };
                const data = await callPost('/email/outbound-emails', payload);
                return { output: { messageId: data.MessageId ?? '', sent: 'true', toAddress } };
            }
            case 'sendTemplatedEmail': {
                const fromAddress = String(inputs.fromAddress ?? '').trim();
                const toAddress = String(inputs.toAddress ?? '').trim();
                const templateName = String(inputs.templateName ?? '').trim();
                const templateData = inputs.templateData ?? {};
                if (!fromAddress || !toAddress || !templateName) throw new Error('fromAddress, toAddress, and templateName are required.');
                logger.log(`[SES] Sending templated email to ${toAddress}`);
                const data = await callPost('/email/outbound-emails', {
                    FromEmailAddress: fromAddress,
                    Destination: { ToAddresses: [toAddress] },
                    Content: {
                        Template: {
                            TemplateName: templateName,
                            TemplateData: JSON.stringify(templateData),
                        },
                    },
                });
                return { output: { messageId: data.MessageId ?? '', sent: 'true', toAddress, templateName } };
            }
            case 'sendBulkTemplatedEmail': {
                const fromAddress = String(inputs.fromAddress ?? '').trim();
                const templateName = String(inputs.templateName ?? '').trim();
                const toAddresses = Array.isArray(inputs.toAddresses) ? inputs.toAddresses : (inputs.toAddresses ? [inputs.toAddresses] : []);
                if (!fromAddress || !templateName || toAddresses.length === 0) throw new Error('fromAddress, templateName, and toAddresses are required.');
                logger.log(`[SES] Sending bulk templated email to ${toAddresses.length} recipients`);
                const bulkEmailEntries = toAddresses.map((addr: string) => ({
                    Destination: { ToAddresses: [addr] },
                    ReplacementTemplateData: JSON.stringify(inputs.templateData ?? {}),
                }));
                const data = await callPost('/email/outbound-bulk-emails', {
                    FromEmailAddress: fromAddress,
                    DefaultContent: { Template: { TemplateName: templateName, TemplateData: JSON.stringify(inputs.defaultTemplateData ?? {}) } },
                    BulkEmailEntries: bulkEmailEntries,
                });
                const results = data.BulkEmailEntryResults ?? [];
                return { output: { results, totalCount: String(toAddresses.length), successCount: String(results.filter((r: any) => r.Status === 'SUCCESS').length) } };
            }
            case 'createTemplate': {
                const templateName = String(inputs.templateName ?? '').trim();
                const subjectPart = String(inputs.subjectPart ?? '').trim();
                const htmlPart = String(inputs.htmlPart ?? '').trim();
                const textPart = String(inputs.textPart ?? '').trim();
                if (!templateName || !subjectPart) throw new Error('templateName and subjectPart are required.');
                logger.log(`[SES] Creating template ${templateName}`);
                await callPost('/email/templates', {
                    TemplateName: templateName,
                    TemplateContent: {
                        Subject: subjectPart,
                        ...(htmlPart ? { Html: htmlPart } : {}),
                        ...(textPart ? { Text: textPart } : {}),
                    },
                });
                return { output: { created: 'true', templateName } };
            }
            case 'getTemplate': {
                const templateName = String(inputs.templateName ?? '').trim();
                if (!templateName) throw new Error('templateName is required.');
                logger.log(`[SES] Getting template ${templateName}`);
                const data = await callGet(`/email/templates/${encodeURIComponent(templateName)}`);
                return { output: { templateName: data.TemplateName ?? templateName, subject: data.TemplateContent?.Subject ?? '', hasHtml: String(!!data.TemplateContent?.Html), hasText: String(!!data.TemplateContent?.Text) } };
            }
            case 'updateTemplate': {
                const templateName = String(inputs.templateName ?? '').trim();
                const subjectPart = String(inputs.subjectPart ?? '').trim();
                const htmlPart = String(inputs.htmlPart ?? '').trim();
                const textPart = String(inputs.textPart ?? '').trim();
                if (!templateName) throw new Error('templateName is required.');
                logger.log(`[SES] Updating template ${templateName}`);
                await callPut(`/email/templates/${encodeURIComponent(templateName)}`, {
                    TemplateContent: {
                        ...(subjectPart ? { Subject: subjectPart } : {}),
                        ...(htmlPart ? { Html: htmlPart } : {}),
                        ...(textPart ? { Text: textPart } : {}),
                    },
                });
                return { output: { updated: 'true', templateName } };
            }
            case 'deleteTemplate': {
                const templateName = String(inputs.templateName ?? '').trim();
                if (!templateName) throw new Error('templateName is required.');
                logger.log(`[SES] Deleting template ${templateName}`);
                await callDelete(`/email/templates/${encodeURIComponent(templateName)}`);
                return { output: { deleted: 'true', templateName } };
            }
            case 'listTemplates': {
                logger.log('[SES] Listing templates');
                const data = await callGet('/email/templates');
                const templates = (data.TemplatesMetadata ?? []).map((t: any) => ({ templateName: t.TemplateName, createdTimestamp: t.CreatedTimestamp }));
                return { output: { templates, count: String(templates.length) } };
            }
            case 'createEmailIdentity': {
                const emailIdentity = String(inputs.emailIdentity ?? '').trim();
                if (!emailIdentity) throw new Error('emailIdentity (email address or domain) is required.');
                logger.log(`[SES] Creating email identity ${emailIdentity}`);
                const data = await callPost('/email/identities', { EmailIdentity: emailIdentity });
                return { output: { emailIdentity, identityType: data.IdentityType ?? '', verifiedForSendingStatus: String(data.VerifiedForSendingStatus ?? false) } };
            }
            case 'getEmailIdentity': {
                const emailIdentity = String(inputs.emailIdentity ?? '').trim();
                if (!emailIdentity) throw new Error('emailIdentity is required.');
                logger.log(`[SES] Getting email identity ${emailIdentity}`);
                const data = await callGet(`/email/identities/${encodeURIComponent(emailIdentity)}`);
                return { output: { emailIdentity, identityType: data.IdentityType ?? '', verifiedForSendingStatus: String(data.VerifiedForSendingStatus ?? false), sendingEnabled: String(data.SendingAttributes?.SendingEnabled ?? false) } };
            }
            case 'deleteEmailIdentity': {
                const emailIdentity = String(inputs.emailIdentity ?? '').trim();
                if (!emailIdentity) throw new Error('emailIdentity is required.');
                logger.log(`[SES] Deleting email identity ${emailIdentity}`);
                await callDelete(`/email/identities/${encodeURIComponent(emailIdentity)}`);
                return { output: { deleted: 'true', emailIdentity } };
            }
            case 'listEmailIdentities': {
                logger.log('[SES] Listing email identities');
                const data = await callGet('/email/identities');
                const identities = (data.EmailIdentities ?? []).map((id: any) => ({ emailIdentity: id.IdentityName, identityType: id.IdentityType, sendingEnabled: String(id.SendingEnabled ?? false) }));
                return { output: { identities, count: String(identities.length) } };
            }
            case 'createContactList': {
                const contactListName = String(inputs.contactListName ?? '').trim();
                if (!contactListName) throw new Error('contactListName is required.');
                const description = String(inputs.description ?? '');
                logger.log(`[SES] Creating contact list ${contactListName}`);
                const payload: any = { ContactListName: contactListName };
                if (description) payload.Description = description;
                await callPost('/email/contact-lists', payload);
                return { output: { created: 'true', contactListName } };
            }
            case 'listContacts': {
                const contactListName = String(inputs.contactListName ?? '').trim();
                if (!contactListName) throw new Error('contactListName is required.');
                logger.log(`[SES] Listing contacts in ${contactListName}`);
                const data = await callGet(`/email/contact-lists/${encodeURIComponent(contactListName)}/contacts`);
                const contacts = (data.Contacts ?? []).map((c: any) => ({ emailAddress: c.EmailAddress, unsubscribeAll: String(c.UnsubscribeAll ?? false), lastUpdatedTimestamp: c.LastUpdatedTimestamp ?? '' }));
                return { output: { contacts, count: String(contacts.length), contactListName } };
            }
            case 'createContact': {
                const contactListName = String(inputs.contactListName ?? '').trim();
                const emailAddress = String(inputs.emailAddress ?? '').trim();
                if (!contactListName || !emailAddress) throw new Error('contactListName and emailAddress are required.');
                logger.log(`[SES] Creating contact ${emailAddress} in list ${contactListName}`);
                const payload: any = { EmailAddress: emailAddress };
                if (inputs.unsubscribeAll !== undefined) payload.UnsubscribeAll = Boolean(inputs.unsubscribeAll);
                if (inputs.attributesData) payload.AttributesData = JSON.stringify(inputs.attributesData);
                await callPost(`/email/contact-lists/${encodeURIComponent(contactListName)}/contacts`, payload);
                return { output: { created: 'true', emailAddress, contactListName } };
            }
            default:
                return { error: `Unknown SES Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`[SES Enhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
