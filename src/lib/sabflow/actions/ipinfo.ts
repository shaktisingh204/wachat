'use server';

export async function executeIpinfoAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://ipinfo.io';
    const token = inputs.token;
    const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

    try {
        switch (actionName) {
            case 'lookupIP': {
                const ip = inputs.ipAddress || inputs.ip;
                const res = await fetch(`${BASE}/${ip}/json?token=${token}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'lookupMyIP': {
                const res = await fetch(`${BASE}/json?token=${token}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'lookupBatch': {
                const res = await fetch(`${BASE}/batch?token=${token}`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputs.addresses),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getASN': {
                const asn = inputs.asn;
                const res = await fetch(`${BASE}/${asn}/json?token=${token}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getCarrier': {
                const ip = inputs.ipAddress || inputs.ip;
                const res = await fetch(`${BASE}/${ip}/carrier?token=${token}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getPrivacy': {
                const ip = inputs.ipAddress || inputs.ip;
                const res = await fetch(`${BASE}/${ip}/privacy?token=${token}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'lookupHostname': {
                const ip = inputs.ipAddress || inputs.ip;
                const res = await fetch(`${BASE}/${ip}/hostname?token=${token}`, { headers });
                const text = await res.text();
                return { output: { hostname: text.trim() } };
            }
            case 'getBogon': {
                const ip = inputs.ipAddress || inputs.ip;
                const res = await fetch(`${BASE}/${ip}/bogon?token=${token}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getRangeMap': {
                const res = await fetch(`${BASE}/map?token=${token}`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputs.ips),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getCountryInfo': {
                const country = inputs.country;
                const res = await fetch(`${BASE}/countries/${country}?token=${token}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getContinentInfo': {
                const ip = inputs.ipAddress || inputs.ip;
                const res = await fetch(`${BASE}/${ip}/continent?token=${token}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getCompanyInfo': {
                const ip = inputs.ipAddress || inputs.ip;
                const res = await fetch(`${BASE}/${ip}/company?token=${token}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getAbuseInfo': {
                const ip = inputs.ipAddress || inputs.ip;
                const res = await fetch(`${BASE}/${ip}/abuse?token=${token}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getCountryIP': {
                const ip = inputs.ipAddress || inputs.ip;
                const res = await fetch(`${BASE}/${ip}/country?token=${token}`, { headers });
                const text = await res.text();
                return { output: { country: text.trim() } };
            }
            case 'getDomain': {
                const ip = inputs.ipAddress || inputs.ip;
                const res = await fetch(`${BASE}/${ip}/domains?token=${token}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown IPinfo action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`IPinfo action error: ${err.message}`);
        return { error: err.message || 'IPinfo action failed' };
    }
}
