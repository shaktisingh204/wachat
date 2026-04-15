'use server';

import { createHmac, createHash } from 'crypto';

function signAwsRequest(method: string, url: string, service: string, region: string, accessKeyId: string, secretAccessKey: string, body: string) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').substring(0, 15) + 'Z';
    const dateStamp = amzDate.substring(0, 8);
    const urlObj = new URL(url);
    const payloadHash = createHash('sha256').update(body).digest('hex');
    const canonicalHeaders = `content-type:application/json\nhost:${urlObj.host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-date';
    const canonicalRequest = [method, urlObj.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`;
    const signingKey = [dateStamp, region, service, 'aws4_request'].reduce((key: any, data) => createHmac('sha256', key).update(data).digest(), `AWS4${secretAccessKey}` as any);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    return { amzDate, authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}` };
}

export async function executeAmazonSESV2Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        const BASE = `https://email.${region}.amazonaws.com/v2`;

        async function sesRequest(method: string, path: string, body?: any) {
            const url = `${BASE}${path}`;
            const bodyStr = body ? JSON.stringify(body) : '';
            const { amzDate, authorization } = signAwsRequest(method, url, 'ses', region, accessKeyId, secretAccessKey, bodyStr);
            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': authorization,
                    'Content-Type': 'application/json',
                    'X-Amz-Date': amzDate,
                },
                body: bodyStr || undefined,
            });
            const text = await res.text();
            const data = text ? JSON.parse(text) : {};
            if (!res.ok) throw new Error(data?.message || data?.Message || `SES v2 error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'sendEmail': {
                const body: any = {
                    FromEmailAddress: String(inputs.from ?? ''),
                    Destination: {
                        ToAddresses: Array.isArray(inputs.to) ? inputs.to : [String(inputs.to ?? '')],
                    },
                    Content: {},
                };
                if (inputs.replyTo) body.ReplyToAddresses = Array.isArray(inputs.replyTo) ? inputs.replyTo : [inputs.replyTo];
                if (inputs.subject || inputs.bodyHtml || inputs.bodyText) {
                    body.Content.Simple = {
                        Subject: { Data: String(inputs.subject ?? ''), Charset: 'UTF-8' },
                        Body: {},
                    };
                    if (inputs.bodyText) body.Content.Simple.Body.Text = { Data: String(inputs.bodyText), Charset: 'UTF-8' };
                    if (inputs.bodyHtml) body.Content.Simple.Body.Html = { Data: String(inputs.bodyHtml), Charset: 'UTF-8' };
                }
                const data = await sesRequest('POST', '/email/outbound-emails', body);
                return { output: { MessageId: data.MessageId } };
            }

            case 'sendBulkEmail': {
                const body = {
                    FromEmailAddress: String(inputs.from ?? ''),
                    BulkEmailEntries: inputs.entries ?? [],
                    DefaultContent: inputs.defaultContent ?? {},
                };
                const data = await sesRequest('POST', '/email/outbound-bulk-emails', body);
                return { output: { BulkEmailEntryResults: data.BulkEmailEntryResults } };
            }

            case 'createEmailIdentity': {
                const body: any = { EmailIdentity: String(inputs.emailIdentity ?? '') };
                if (inputs.tags) body.Tags = inputs.tags;
                if (inputs.dkimSigningAttributes) body.DkimSigningAttributes = inputs.dkimSigningAttributes;
                const data = await sesRequest('POST', '/email/identities', body);
                return { output: { IdentityType: data.IdentityType, VerifiedForSendingStatus: data.VerifiedForSendingStatus, DkimAttributes: data.DkimAttributes } };
            }

            case 'getEmailIdentity': {
                const identity = encodeURIComponent(String(inputs.emailIdentity ?? ''));
                const data = await sesRequest('GET', `/email/identities/${identity}`);
                return { output: data };
            }

            case 'listEmailIdentities': {
                const pageSize = inputs.pageSize ?? 100;
                const params = new URLSearchParams({ PageSize: String(pageSize) });
                if (inputs.nextToken) params.set('NextToken', String(inputs.nextToken));
                const data = await sesRequest('GET', `/email/identities?${params.toString()}`);
                return { output: { EmailIdentities: data.EmailIdentities, NextToken: data.NextToken } };
            }

            case 'deleteEmailIdentity': {
                const identity = encodeURIComponent(String(inputs.emailIdentity ?? ''));
                await sesRequest('DELETE', `/email/identities/${identity}`);
                return { output: { success: true } };
            }

            case 'createEmailTemplate': {
                const body = {
                    TemplateName: String(inputs.templateName ?? ''),
                    TemplateContent: {
                        Subject: String(inputs.subject ?? ''),
                        Text: inputs.bodyText ? String(inputs.bodyText) : undefined,
                        Html: inputs.bodyHtml ? String(inputs.bodyHtml) : undefined,
                    },
                };
                await sesRequest('POST', '/email/templates', body);
                return { output: { success: true, templateName: inputs.templateName } };
            }

            case 'getEmailTemplate': {
                const templateName = encodeURIComponent(String(inputs.templateName ?? ''));
                const data = await sesRequest('GET', `/email/templates/${templateName}`);
                return { output: data };
            }

            case 'updateEmailTemplate': {
                const templateName = encodeURIComponent(String(inputs.templateName ?? ''));
                const body = {
                    TemplateContent: {
                        Subject: String(inputs.subject ?? ''),
                        Text: inputs.bodyText ? String(inputs.bodyText) : undefined,
                        Html: inputs.bodyHtml ? String(inputs.bodyHtml) : undefined,
                    },
                };
                await sesRequest('PUT', `/email/templates/${templateName}`, body);
                return { output: { success: true } };
            }

            case 'deleteEmailTemplate': {
                const templateName = encodeURIComponent(String(inputs.templateName ?? ''));
                await sesRequest('DELETE', `/email/templates/${templateName}`);
                return { output: { success: true } };
            }

            case 'listEmailTemplates': {
                const pageSize = inputs.pageSize ?? 100;
                const params = new URLSearchParams({ PageSize: String(pageSize) });
                if (inputs.nextToken) params.set('NextToken', String(inputs.nextToken));
                const data = await sesRequest('GET', `/email/templates?${params.toString()}`);
                return { output: { TemplatesMetadata: data.TemplatesMetadata, NextToken: data.NextToken } };
            }

            case 'getSendQuota': {
                const data = await sesRequest('GET', '/email/account/sending-quota');
                return { output: { Max24HourSend: data.Max24HourSend, MaxSendRate: data.MaxSendRate, SentLast24Hours: data.SentLast24Hours } };
            }

            case 'listConfigurationSets': {
                const pageSize = inputs.pageSize ?? 100;
                const params = new URLSearchParams({ PageSize: String(pageSize) });
                if (inputs.nextToken) params.set('NextToken', String(inputs.nextToken));
                const data = await sesRequest('GET', `/email/configuration-sets?${params.toString()}`);
                return { output: { ConfigurationSets: data.ConfigurationSets, NextToken: data.NextToken } };
            }

            case 'createConfigurationSet': {
                const body: any = { ConfigurationSetName: String(inputs.configurationSetName ?? '') };
                if (inputs.tags) body.Tags = inputs.tags;
                if (inputs.trackingOptions) body.TrackingOptions = inputs.trackingOptions;
                await sesRequest('POST', '/email/configuration-sets', body);
                return { output: { success: true, configurationSetName: inputs.configurationSetName } };
            }

            case 'getAccount': {
                const data = await sesRequest('GET', '/email/account');
                return { output: data };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Amazon SES v2 action failed.' };
    }
}
