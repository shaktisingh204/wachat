
'use server';

import { createHmac, createHash } from 'crypto';

function sign(key: Buffer, msg: string): Buffer {
    return createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(secret: string, date: string, region: string, service: string): Buffer {
    return sign(sign(sign(sign(Buffer.from('AWS4' + secret), date), region), service), 'aws4_request');
}

function buildSigV4Headers(method: string, url: string, body: string, service: string, region: string, accessKeyId: string, secretAccessKey: string, sessionToken?: string, extraHeaders?: Record<string, string>): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);
    const parsedUrl = new URL(url);
    const host = parsedUrl.host;
    const canonicalUri = parsedUrl.pathname;
    const canonicalQuerystring = parsedUrl.searchParams.toString();
    const payloadHash = createHash('sha256').update(body).digest('hex');
    const headersObj: Record<string, string> = { host, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash, ...(sessionToken ? { 'x-amz-security-token': sessionToken } : {}), ...extraHeaders };
    const signedHeaders = Object.keys(headersObj).sort().join(';');
    const canonicalHeaders = Object.keys(headersObj).sort().map(k => `${k}:${headersObj[k]}\n`).join('');
    const canonicalRequest = [method, canonicalUri, canonicalQuerystring, canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
    const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    return { ...headersObj, 'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`, 'Content-Type': 'application/json' };
}

export async function executeAwsSesAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const region = String(inputs.region ?? 'us-east-1').trim();
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const sessionToken = inputs.sessionToken ? String(inputs.sessionToken).trim() : undefined;

        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const baseV2 = `https://email.${region}.amazonaws.com`;
        const baseV1 = `https://email.${region}.amazonaws.com`;

        switch (actionName) {
            case 'sendEmail': {
                const fromEmail = String(inputs.fromEmailAddress ?? '').trim();
                const toAddresses = Array.isArray(inputs.toAddresses) ? inputs.toAddresses : [String(inputs.toAddresses ?? '').trim()];
                const subject = String(inputs.subject ?? '').trim();
                const bodyText = String(inputs.bodyText ?? inputs.body ?? '').trim();
                const bodyHtml = String(inputs.bodyHtml ?? '').trim();
                if (!fromEmail || !toAddresses.length || !subject) throw new Error('fromEmailAddress, toAddresses, and subject are required.');
                const url = `${baseV2}/v2/email/outbound-emails`;
                const body = JSON.stringify({
                    Content: { Simple: { Subject: { Data: subject, Charset: 'UTF-8' }, Body: { ...(bodyHtml ? { Html: { Data: bodyHtml, Charset: 'UTF-8' } } : {}), ...(bodyText ? { Text: { Data: bodyText, Charset: 'UTF-8' } } : {}) } } },
                    Destination: { ToAddresses: toAddresses },
                    FromEmailAddress: fromEmail
                });
                const headers = buildSigV4Headers('POST', url, body, 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'POST', headers, body });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
                logger.log('[SES] Email sent successfully');
                return { output: { messageId: data.MessageId, status: 'sent' } };
            }

            case 'sendRawEmail': {
                const fromEmail = String(inputs.fromEmailAddress ?? '').trim();
                const rawMessage = String(inputs.rawMessage ?? '').trim();
                if (!fromEmail || !rawMessage) throw new Error('fromEmailAddress and rawMessage are required.');
                const url = `${baseV2}/v2/email/outbound-emails`;
                const body = JSON.stringify({
                    Content: { Raw: { Data: Buffer.from(rawMessage).toString('base64') } },
                    FromEmailAddress: fromEmail
                });
                const headers = buildSigV4Headers('POST', url, body, 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'POST', headers, body });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
                return { output: { messageId: data.MessageId, status: 'sent' } };
            }

            case 'sendTemplatedEmail': {
                const fromEmail = String(inputs.fromEmailAddress ?? '').trim();
                const toAddresses = Array.isArray(inputs.toAddresses) ? inputs.toAddresses : [String(inputs.toAddresses ?? '').trim()];
                const templateName = String(inputs.templateName ?? '').trim();
                const templateData = inputs.templateData ? (typeof inputs.templateData === 'string' ? inputs.templateData : JSON.stringify(inputs.templateData)) : '{}';
                if (!fromEmail || !templateName) throw new Error('fromEmailAddress and templateName are required.');
                const url = `${baseV2}/v2/email/outbound-emails`;
                const body = JSON.stringify({
                    Content: { Template: { TemplateName: templateName, TemplateData: templateData } },
                    Destination: { ToAddresses: toAddresses },
                    FromEmailAddress: fromEmail
                });
                const headers = buildSigV4Headers('POST', url, body, 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'POST', headers, body });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
                return { output: { messageId: data.MessageId, status: 'sent' } };
            }

            case 'listTemplates': {
                const url = `${baseV2}/v2/email/templates`;
                const headers = buildSigV4Headers('GET', url, '', 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
                return { output: { templates: data.TemplatesMetadata ?? [], nextToken: data.NextToken } };
            }

            case 'getTemplate': {
                const templateName = String(inputs.templateName ?? '').trim();
                if (!templateName) throw new Error('templateName is required.');
                const url = `${baseV2}/v2/email/templates/${encodeURIComponent(templateName)}`;
                const headers = buildSigV4Headers('GET', url, '', 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
                return { output: data };
            }

            case 'createTemplate': {
                const templateName = String(inputs.templateName ?? '').trim();
                const subjectPart = String(inputs.subjectPart ?? '').trim();
                const htmlPart = String(inputs.htmlPart ?? '').trim();
                const textPart = String(inputs.textPart ?? '').trim();
                if (!templateName || !subjectPart) throw new Error('templateName and subjectPart are required.');
                const url = `${baseV2}/v2/email/templates`;
                const body = JSON.stringify({ TemplateName: templateName, TemplateContent: { Subject: subjectPart, Html: htmlPart, Text: textPart } });
                const headers = buildSigV4Headers('POST', url, body, 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'POST', headers, body });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
                return { output: { templateName, status: 'created' } };
            }

            case 'updateTemplate': {
                const templateName = String(inputs.templateName ?? '').trim();
                if (!templateName) throw new Error('templateName is required.');
                const url = `${baseV2}/v2/email/templates/${encodeURIComponent(templateName)}`;
                const body = JSON.stringify({ TemplateContent: { Subject: inputs.subjectPart, Html: inputs.htmlPart, Text: inputs.textPart } });
                const headers = buildSigV4Headers('PUT', url, body, 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'PUT', headers, body });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
                return { output: { templateName, status: 'updated' } };
            }

            case 'deleteTemplate': {
                const templateName = String(inputs.templateName ?? '').trim();
                if (!templateName) throw new Error('templateName is required.');
                const url = `${baseV2}/v2/email/templates/${encodeURIComponent(templateName)}`;
                const headers = buildSigV4Headers('DELETE', url, '', 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'DELETE', headers });
                if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.message ?? JSON.stringify(data)); }
                return { output: { templateName, status: 'deleted' } };
            }

            case 'listEmailIdentities': {
                const url = `${baseV2}/v2/email/identities`;
                const headers = buildSigV4Headers('GET', url, '', 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
                return { output: { identities: data.EmailIdentities ?? [], nextToken: data.NextToken } };
            }

            case 'verifyEmailIdentity': {
                const emailIdentity = String(inputs.emailIdentity ?? '').trim();
                if (!emailIdentity) throw new Error('emailIdentity is required.');
                const url = `${baseV2}/v2/email/identities`;
                const body = JSON.stringify({ EmailIdentity: emailIdentity });
                const headers = buildSigV4Headers('POST', url, body, 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'POST', headers, body });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
                return { output: { emailIdentity, status: 'verification_started', identityType: data.IdentityType } };
            }

            case 'deleteIdentity': {
                const emailIdentity = String(inputs.emailIdentity ?? '').trim();
                if (!emailIdentity) throw new Error('emailIdentity is required.');
                const url = `${baseV2}/v2/email/identities/${encodeURIComponent(emailIdentity)}`;
                const headers = buildSigV4Headers('DELETE', url, '', 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'DELETE', headers });
                if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.message ?? JSON.stringify(data)); }
                return { output: { emailIdentity, status: 'deleted' } };
            }

            case 'getSendQuota': {
                const url = `${baseV1}/v2/email/account`;
                const headers = buildSigV4Headers('GET', url, '', 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
                return { output: { sendingEnabled: data.SendingEnabled, dailyQuota: data.SendQuota?.Max24HourSend, sentLast24Hours: data.SendQuota?.SentLast24Hours, maxSendRate: data.SendQuota?.MaxSendRate } };
            }

            case 'getSendStatistics': {
                const url = `${baseV2}/v2/email/account/dedicated-ips`;
                const headers = buildSigV4Headers('GET', url, '', 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
                return { output: data };
            }

            case 'listSuppressedDestinations': {
                const url = `${baseV2}/v2/email/suppression/addresses`;
                const headers = buildSigV4Headers('GET', url, '', 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
                return { output: { suppressedDestinations: data.SuppressedDestinationSummaries ?? [], nextToken: data.NextToken } };
            }

            case 'putSuppressedDestination': {
                const emailAddress = String(inputs.emailAddress ?? '').trim();
                const reason = String(inputs.reason ?? 'BOUNCE').trim();
                if (!emailAddress) throw new Error('emailAddress is required.');
                const url = `${baseV2}/v2/email/suppression/addresses`;
                const body = JSON.stringify({ EmailAddress: emailAddress, Reason: reason });
                const headers = buildSigV4Headers('PUT', url, body, 'ses', region, accessKeyId, secretAccessKey, sessionToken);
                const res = await fetch(url, { method: 'PUT', headers, body });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
                return { output: { emailAddress, reason, status: 'suppressed' } };
            }

            default:
                throw new Error(`Unknown SES action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
