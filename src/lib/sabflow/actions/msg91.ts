'use server';

export async function executeMsg91Action(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { authKey } = inputs;
        if (!authKey) return { error: 'MSG91: authKey is required.' };

        const jsonHeaders = {
            'Content-Type': 'application/json',
            authkey: authKey,
        };

        const getJson = async (url: string): Promise<any> => {
            logger.log(`MSG91 GET ${url}`);
            const res = await fetch(url, { method: 'GET', headers: jsonHeaders });
            const text = await res.text();
            if (!res.ok) throw new Error(`MSG91 GET failed (${res.status}): ${text}`);
            return text ? JSON.parse(text) : {};
        };

        const postJson = async (url: string, body: any): Promise<any> => {
            logger.log(`MSG91 POST ${url}`);
            const res = await fetch(url, {
                method: 'POST',
                headers: jsonHeaders,
                body: JSON.stringify(body),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`MSG91 POST failed (${res.status}): ${text}`);
            return text ? JSON.parse(text) : {};
        };

        switch (actionName) {
            case 'sendSms': {
                const { mobiles, message, senderId, route, dltTemplateId, flash } = inputs;
                if (!mobiles) return { error: 'MSG91 sendSms: mobiles is required.' };
                if (!message) return { error: 'MSG91 sendSms: message is required.' };
                if (!senderId) return { error: 'MSG91 sendSms: senderId is required.' };

                const params = new URLSearchParams({
                    authkey: authKey,
                    mobiles: String(mobiles),
                    message: message,
                    sender: senderId,
                    route: String(route ?? 4),
                    flash: String(flash ?? 0),
                });
                if (dltTemplateId) params.set('dlt_te_id', String(dltTemplateId));

                logger.log(`MSG91 sendSms POST https://api.msg91.com/api/sendhttp.php`);
                const res = await fetch(`https://api.msg91.com/api/sendhttp.php?${params.toString()}`, {
                    method: 'POST',
                    headers: { authkey: authKey },
                });
                const text = await res.text();
                if (!res.ok) throw new Error(`MSG91 sendSms failed (${res.status}): ${text}`);
                let parsed: any;
                try { parsed = JSON.parse(text); } catch { parsed = { message: text }; }
                return { output: parsed };
            }

            case 'sendOtp': {
                const { mobile, otp, templateId, senderId } = inputs;
                if (!mobile) return { error: 'MSG91 sendOtp: mobile is required.' };
                const generatedOtp = otp ?? Math.floor(1000 + Math.random() * 9000);
                const params = new URLSearchParams({
                    authkey: authKey,
                    mobile: String(mobile),
                    otp: String(generatedOtp),
                });
                if (templateId) params.set('template_id', String(templateId));
                if (senderId) params.set('sender', senderId);

                const data = await getJson(`https://control.msg91.com/api/v5/otp?${params.toString()}`);
                return { output: data };
            }

            case 'verifyOtp': {
                const { mobile, otp } = inputs;
                if (!mobile) return { error: 'MSG91 verifyOtp: mobile is required.' };
                if (!otp) return { error: 'MSG91 verifyOtp: otp is required.' };

                const params = new URLSearchParams({
                    authkey: authKey,
                    mobile: String(mobile),
                    otp: String(otp),
                });
                const data = await getJson(`https://control.msg91.com/api/v5/otp/verify?${params.toString()}`);
                return { output: data };
            }

            case 'resendOtp': {
                const { mobile, retryType } = inputs;
                if (!mobile) return { error: 'MSG91 resendOtp: mobile is required.' };
                const params = new URLSearchParams({
                    authkey: authKey,
                    mobile: String(mobile),
                    retrytype: retryType ?? 'text',
                });
                const data = await getJson(`https://control.msg91.com/api/v5/otp/retry?${params.toString()}`);
                return { output: data };
            }

            case 'getBalance': {
                const data = await getJson(
                    `https://control.msg91.com/api/balance.php?authkey=${encodeURIComponent(authKey)}&type=json`
                );
                return { output: { balance: data.balance, type: data.type } };
            }

            case 'getDeliveryReport': {
                const { campaignId } = inputs;
                if (!campaignId) return { error: 'MSG91 getDeliveryReport: campaignId is required.' };
                const params = new URLSearchParams({ authkey: authKey, campaign_id: String(campaignId) });
                const data = await getJson(`https://api.msg91.com/api/v5/report?${params.toString()}`);
                return { output: { data: data.data ?? data } };
            }

            case 'getSmsSentReport': {
                const { startDate, endDate, requestId } = inputs;
                if (!startDate) return { error: 'MSG91 getSmsSentReport: startDate is required.' };
                if (!endDate) return { error: 'MSG91 getSmsSentReport: endDate is required.' };
                const body: any = { startDate, endDate };
                if (requestId) body.requestId = requestId;
                const data = await postJson(
                    `https://api.msg91.com/api/v5/report/smreport.json?authkey=${encodeURIComponent(authKey)}`,
                    body
                );
                return { output: { data: data.data ?? data } };
            }

            case 'sendBulkSms': {
                const { recipients, flowId } = inputs;
                if (!recipients) return { error: 'MSG91 sendBulkSms: recipients is required.' };
                const fId = flowId ?? inputs.flowId;
                if (!fId) return { error: 'MSG91 sendBulkSms: flowId is required.' };
                const data = await postJson('https://api.msg91.com/api/v5/flow/', {
                    flow_id: fId,
                    recipients,
                });
                return { output: data };
            }

            case 'createCampaign': {
                const { campaignName, senderId, message, mobiles, scheduleDateTime, flowId } = inputs;
                if (!campaignName) return { error: 'MSG91 createCampaign: campaignName is required.' };
                if (!senderId) return { error: 'MSG91 createCampaign: senderId is required.' };
                if (!message) return { error: 'MSG91 createCampaign: message is required.' };
                if (!mobiles) return { error: 'MSG91 createCampaign: mobiles is required.' };
                const body: any = {
                    campaign_name: campaignName,
                    sender: senderId,
                    message,
                    mobiles,
                };
                if (scheduleDateTime) body.scheduleTime = scheduleDateTime;
                if (flowId) body.flow_id = flowId;
                const data = await postJson(
                    `https://api.msg91.com/api/v5/flow?authkey=${encodeURIComponent(authKey)}`,
                    body
                );
                return { output: { campaignId: data.campaign_id ?? data.id, message: data.message } };
            }

            case 'listCampaigns': {
                const data = await getJson(
                    `https://control.msg91.com/api/v5/campaign/list?authkey=${encodeURIComponent(authKey)}`
                );
                return { output: { data: data.data ?? data } };
            }

            default:
                return { error: `MSG91: unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`MSG91 action error: ${err?.message}`);
        return { error: err?.message ?? 'MSG91 action failed.' };
    }
}
