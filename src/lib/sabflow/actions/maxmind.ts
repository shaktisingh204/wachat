
'use server';

export async function executeMaxMindAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accountId = String(inputs.accountId ?? '').trim();
        const licenseKey = String(inputs.licenseKey ?? '').trim();

        if (!accountId) throw new Error('accountId is required.');
        if (!licenseKey) throw new Error('licenseKey is required.');

        const authHeader = `Basic ${Buffer.from(`${accountId}:${licenseKey}`).toString('base64')}`;
        const geoipBase = 'https://geoip.maxmind.com/geoip/v2.1';
        const minfraudBase = 'https://minfraud.maxmind.com/minfraud/v2.0';

        const geoipFetch = async (endpoint: string) => {
            const url = `${geoipBase}/${endpoint}`;
            logger?.log(`[MaxMind] GET ${url}`);
            const res = await fetch(url, {
                headers: {
                    Authorization: authHeader,
                    Accept: 'application/json',
                },
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error || data?.message || `MaxMind GeoIP error ${res.status}`);
            return data;
        };

        const minfraudPost = async (endpoint: string, body: any) => {
            const url = `${minfraudBase}/${endpoint}`;
            logger?.log(`[MaxMind] POST ${url}`);
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error || data?.message || `MaxMind minFraud error ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'lookupCountry': {
                const ip = String(inputs.ip ?? 'me').trim();
                const data = await geoipFetch(`country/${ip}`);
                return { output: data };
            }

            case 'lookupCity': {
                const ip = String(inputs.ip ?? 'me').trim();
                const data = await geoipFetch(`city/${ip}`);
                return { output: data };
            }

            case 'lookupInsights': {
                const ip = String(inputs.ip ?? 'me').trim();
                const data = await geoipFetch(`insights/${ip}`);
                return { output: data };
            }

            case 'lookupAsn': {
                const ip = String(inputs.ip ?? 'me').trim();
                const data = await geoipFetch(`asn/${ip}`);
                return { output: data };
            }

            case 'lookupConnectionType': {
                const ip = String(inputs.ip ?? 'me').trim();
                const data = await geoipFetch(`connection-type/${ip}`);
                return { output: data };
            }

            case 'lookupDomain': {
                const ip = String(inputs.ip ?? 'me').trim();
                const data = await geoipFetch(`domain/${ip}`);
                return { output: data };
            }

            case 'lookupIsp': {
                const ip = String(inputs.ip ?? 'me').trim();
                const data = await geoipFetch(`isp/${ip}`);
                return { output: data };
            }

            case 'scoreFraud': {
                const body: any = {};
                if (inputs.device) body.device = typeof inputs.device === 'string' ? JSON.parse(inputs.device) : inputs.device;
                if (inputs.event) body.event = typeof inputs.event === 'string' ? JSON.parse(inputs.event) : inputs.event;
                if (inputs.account) body.account = typeof inputs.account === 'string' ? JSON.parse(inputs.account) : inputs.account;
                if (inputs.email) body.email = typeof inputs.email === 'string' ? JSON.parse(inputs.email) : inputs.email;
                if (inputs.billing) body.billing = typeof inputs.billing === 'string' ? JSON.parse(inputs.billing) : inputs.billing;
                if (inputs.payment) body.payment = typeof inputs.payment === 'string' ? JSON.parse(inputs.payment) : inputs.payment;
                if (inputs.order) body.order = typeof inputs.order === 'string' ? JSON.parse(inputs.order) : inputs.order;
                if (inputs.creditCard) body.credit_card = typeof inputs.creditCard === 'string' ? JSON.parse(inputs.creditCard) : inputs.creditCard;
                if (inputs.shipping) body.shipping = typeof inputs.shipping === 'string' ? JSON.parse(inputs.shipping) : inputs.shipping;
                const data = await minfraudPost('score', body);
                return { output: data };
            }

            case 'checkFraud': {
                const body: any = {};
                if (inputs.device) body.device = typeof inputs.device === 'string' ? JSON.parse(inputs.device) : inputs.device;
                if (inputs.event) body.event = typeof inputs.event === 'string' ? JSON.parse(inputs.event) : inputs.event;
                if (inputs.account) body.account = typeof inputs.account === 'string' ? JSON.parse(inputs.account) : inputs.account;
                if (inputs.email) body.email = typeof inputs.email === 'string' ? JSON.parse(inputs.email) : inputs.email;
                if (inputs.billing) body.billing = typeof inputs.billing === 'string' ? JSON.parse(inputs.billing) : inputs.billing;
                if (inputs.payment) body.payment = typeof inputs.payment === 'string' ? JSON.parse(inputs.payment) : inputs.payment;
                if (inputs.order) body.order = typeof inputs.order === 'string' ? JSON.parse(inputs.order) : inputs.order;
                if (inputs.creditCard) body.credit_card = typeof inputs.creditCard === 'string' ? JSON.parse(inputs.creditCard) : inputs.creditCard;
                if (inputs.shipping) body.shipping = typeof inputs.shipping === 'string' ? JSON.parse(inputs.shipping) : inputs.shipping;
                const data = await minfraudPost('factors', body);
                return { output: data };
            }

            default:
                throw new Error(`Unknown MaxMind action: "${actionName}"`);
        }
    } catch (err: any) {
        logger?.log(`[MaxMind] Error: ${err.message}`);
        return { error: err.message };
    }
}
