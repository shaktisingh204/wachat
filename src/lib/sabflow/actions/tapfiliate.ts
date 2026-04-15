
'use server';

const TAPFILIATE_BASE_URL = 'https://api.tapfiliate.com/1.6';

async function tapfiliateFetch(apiKey: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    logger?.log(`[Tapfiliate] ${method} ${path}`);
    const url = `${TAPFILIATE_BASE_URL}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    let data: any;
    try {
        data = await res.json();
    } catch {
        if (!res.ok) throw new Error(`Tapfiliate API error: ${res.status}`);
        return {};
    }
    if (!res.ok) {
        throw new Error(data?.message || data?.errors?.[0] || `Tapfiliate API error: ${res.status}`);
    }
    return data;
}

export async function executeTapfiliateAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) return { error: 'apiKey is required.' };

        const tap = (method: string, path: string, body?: any) =>
            tapfiliateFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listAffiliates': {
                const page = inputs.page ?? 1;
                const offset = inputs.offset ?? 0;
                const limit = inputs.limit ?? 25;
                const data = await tap('GET', `/affiliates/?page=${page}&offset=${offset}&limit=${limit}`);
                return {
                    output: {
                        affiliates: Array.isArray(data) ? data.map((a: any) => ({
                            id: a.id,
                            firstname: a.firstname,
                            lastname: a.lastname,
                            email: a.email,
                            type: a.type,
                            referralCode: a.referral_code,
                        })) : [],
                    },
                };
            }

            case 'getAffiliate': {
                const affiliateId = String(inputs.affiliateId ?? '').trim();
                if (!affiliateId) return { error: 'affiliateId is required.' };
                const data = await tap('GET', `/affiliates/${affiliateId}/`);
                return {
                    output: {
                        id: data.id,
                        firstname: data.firstname,
                        lastname: data.lastname,
                        email: data.email,
                        referralCode: data.referral_code,
                        createdAt: data.created_at,
                        password_reset_required: data.password_reset_required,
                    },
                };
            }

            case 'createAffiliate': {
                const email = String(inputs.email ?? '').trim();
                const firstname = String(inputs.firstname ?? '').trim();
                const lastname = String(inputs.lastname ?? '').trim();
                if (!email || !firstname || !lastname) return { error: 'email, firstname, and lastname are required.' };
                const body: any = { email, firstname, lastname };
                if (inputs.password) body.password = inputs.password;
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.referralCode) body.referral_code = inputs.referralCode;
                if (inputs.metaData) body.meta_data = inputs.metaData;
                const data = await tap('POST', '/affiliates/', body);
                return {
                    output: {
                        id: data.id,
                        firstname: data.firstname,
                        lastname: data.lastname,
                        referralCode: data.referral_code,
                    },
                };
            }

            case 'deleteAffiliate': {
                const affiliateId = String(inputs.affiliateId ?? '').trim();
                if (!affiliateId) return { error: 'affiliateId is required.' };
                await tap('DELETE', `/affiliates/${affiliateId}/`);
                return { output: { deleted: true } };
            }

            case 'listPrograms': {
                const data = await tap('GET', '/programs/');
                return {
                    output: {
                        programs: Array.isArray(data) ? data.map((p: any) => ({
                            id: p.id,
                            title: p.title,
                            currencyIso: p.currency?.iso,
                            cookieTime: p.cookie_time,
                            flatFee: p.flat_fee,
                            percentageFee: p.percentage_fee,
                            publishingStatus: p.publishing_status,
                        })) : [],
                    },
                };
            }

            case 'getProgram': {
                const programId = String(inputs.programId ?? '').trim();
                if (!programId) return { error: 'programId is required.' };
                const data = await tap('GET', `/programs/${programId}/`);
                return {
                    output: {
                        id: data.id,
                        title: data.title,
                        affiliateCount: data.affiliate_count,
                    },
                };
            }

            case 'addAffiliateToProgram': {
                const programId = String(inputs.programId ?? '').trim();
                const affiliateId = String(inputs.affiliateId ?? '').trim();
                if (!programId || !affiliateId) return { error: 'programId and affiliateId are required.' };
                const data = await tap('POST', `/programs/${programId}/affiliates/`, { affiliate: { id: affiliateId } });
                return { output: { id: data.id, approvalStatus: data.approval_status } };
            }

            case 'listConversions': {
                const programId = inputs.programId ?? '';
                const affiliateId = inputs.affiliateId ?? '';
                const dateFrom = inputs.dateFrom ?? '';
                const dateTo = inputs.dateTo ?? '';
                const data = await tap('GET', `/conversions/?program_id=${programId}&affiliate_id=${affiliateId}&date_from=${dateFrom}&date_to=${dateTo}`);
                return {
                    output: {
                        conversions: Array.isArray(data) ? data.map((c: any) => ({
                            id: c.id,
                            amount: c.amount,
                            commissionAmount: c.commission_amount,
                            clickId: c.click_id,
                            conversionSubId: c.conversion_sub_id,
                            affiliateId: c.affiliate?.id,
                            createdAt: c.created_at,
                        })) : [],
                    },
                };
            }

            case 'createConversion': {
                const programId = String(inputs.programId ?? '').trim();
                const clickId = String(inputs.clickId ?? '').trim();
                const amount = inputs.amount;
                if (!programId || !clickId || amount === undefined) return { error: 'programId, clickId, and amount are required.' };
                const body: any = {
                    program_id: programId,
                    click_id: clickId,
                    amount,
                    commission_type: inputs.commissionType ?? 'default',
                };
                if (inputs.externalId) body.external_id = inputs.externalId;
                if (inputs.metaData) body.meta_data = inputs.metaData;
                const data = await tap('POST', '/conversions/', body);
                return { output: { id: data.id, amount: data.amount, commissionAmount: data.commission_amount } };
            }

            case 'listPayments': {
                const affiliateId = inputs.affiliateId ?? '';
                const data = await tap('GET', `/payments/?affiliate_id=${affiliateId}`);
                return {
                    output: {
                        payments: Array.isArray(data) ? data.map((p: any) => ({
                            id: p.id,
                            affiliateId: p.affiliate?.id,
                            amount: p.amount,
                            currency: p.currency,
                            paymentMethod: p.payment_method,
                            createdAt: p.created_at,
                        })) : [],
                    },
                };
            }

            case 'createPayment': {
                const affiliateId = String(inputs.affiliateId ?? '').trim();
                const amount = inputs.amount;
                if (!affiliateId || amount === undefined) return { error: 'affiliateId and amount are required.' };
                const body = {
                    affiliate: { id: affiliateId },
                    amount,
                    currency: inputs.currency ?? 'USD',
                    payment_method: inputs.paymentMethod ?? 'bank',
                };
                const data = await tap('POST', '/payments/', body);
                return { output: { id: data.id, amount: data.amount } };
            }

            case 'listClicks': {
                const affiliateId = inputs.affiliateId ?? '';
                const programId = inputs.programId ?? '';
                const dateFrom = inputs.dateFrom ?? '';
                const dateTo = inputs.dateTo ?? '';
                const data = await tap('GET', `/clicks/?affiliate_id=${affiliateId}&program_id=${programId}&date_from=${dateFrom}&date_to=${dateTo}`);
                return {
                    output: {
                        clicks: Array.isArray(data) ? data.map((c: any) => ({
                            id: c.id,
                            ip: c.ip,
                            referrer: c.referrer,
                            metaData: c.meta_data,
                            createdAt: c.created_at,
                        })) : [],
                    },
                };
            }

            default:
                return { error: `Unknown Tapfiliate action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Tapfiliate] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown Tapfiliate error.' };
    }
}
