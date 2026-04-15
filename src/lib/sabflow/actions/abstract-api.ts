'use server';

export async function executeAbstractApiAction(actionName: string, inputs: any, user: any, logger: any) {
    const key = inputs.apiKey;

    const ENDPOINTS: Record<string, string> = {
        validateEmail: 'https://emailvalidation.abstractapi.com/v1',
        validatePhone: 'https://phonevalidation.abstractapi.com/v1',
        validateVAT: 'https://vat.abstractapi.com/v1',
        lookupIP: 'https://ipgeolocation.abstractapi.com/v1',
        getGeolocation: 'https://ipgeolocation.abstractapi.com/v1',
        convertCurrency: 'https://exchange-rates.abstractapi.com/v1/convert',
        getExchangeRates: 'https://exchange-rates.abstractapi.com/v1/live',
        checkHolidays: 'https://holidays.abstractapi.com/v1',
        validateIBAN: 'https://ibanvalidation.abstractapi.com/v1',
        scrapeWebsite: 'https://scrape.abstractapi.com/v1',
        generateAvatar: 'https://avatars.abstractapi.com/v1',
        detectTimezone: 'https://timezone.abstractapi.com/v1',
        checkPublicHolidays: 'https://holidays.abstractapi.com/v1',
        lookupCompany: 'https://companyenrichment.abstractapi.com/v1',
        validateAddress: 'https://addressvalidation.abstractapi.com/v1',
    };

    try {
        switch (actionName) {
            case 'validateEmail': {
                const params = new URLSearchParams({ api_key: key, email: inputs.email });
                const res = await fetch(`${ENDPOINTS.validateEmail}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'validatePhone': {
                const params = new URLSearchParams({ api_key: key, phone: inputs.phone });
                const res = await fetch(`${ENDPOINTS.validatePhone}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'validateVAT': {
                const params = new URLSearchParams({ api_key: key, vat_number: inputs.vatNumber });
                const res = await fetch(`${ENDPOINTS.validateVAT}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'lookupIP': {
                const params = new URLSearchParams({ api_key: key, ...(inputs.ipAddress ? { ip_address: inputs.ipAddress } : {}) });
                const res = await fetch(`${ENDPOINTS.lookupIP}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'getGeolocation': {
                const params = new URLSearchParams({ api_key: key, ...(inputs.ipAddress ? { ip_address: inputs.ipAddress } : {}) });
                const res = await fetch(`${ENDPOINTS.getGeolocation}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'convertCurrency': {
                const params = new URLSearchParams({ api_key: key, base: inputs.base, target: inputs.target, date: inputs.date || '', amount: String(inputs.amount || 1) });
                const res = await fetch(`${ENDPOINTS.convertCurrency}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'getExchangeRates': {
                const params = new URLSearchParams({ api_key: key, base: inputs.base });
                const res = await fetch(`${ENDPOINTS.getExchangeRates}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'checkHolidays': {
                const params = new URLSearchParams({ api_key: key, country: inputs.country, year: String(inputs.year || new Date().getFullYear()), ...(inputs.month ? { month: String(inputs.month) } : {}), ...(inputs.day ? { day: String(inputs.day) } : {}) });
                const res = await fetch(`${ENDPOINTS.checkHolidays}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'validateIBAN': {
                const params = new URLSearchParams({ api_key: key, iban: inputs.iban });
                const res = await fetch(`${ENDPOINTS.validateIBAN}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'scrapeWebsite': {
                const params = new URLSearchParams({ api_key: key, url: inputs.url });
                const res = await fetch(`${ENDPOINTS.scrapeWebsite}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'generateAvatar': {
                const params = new URLSearchParams({ api_key: key, name: inputs.name, ...(inputs.size ? { size: String(inputs.size) } : {}), ...(inputs.imageType ? { image_type: inputs.imageType } : {}), ...(inputs.isRounded !== undefined ? { is_rounded: String(inputs.isRounded) } : {}) });
                const res = await fetch(`${ENDPOINTS.generateAvatar}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'detectTimezone': {
                const params = new URLSearchParams({ api_key: key, ...(inputs.location ? { location: inputs.location } : {}), ...(inputs.ipAddress ? { ip_address: inputs.ipAddress } : {}), ...(inputs.longitude ? { longitude: String(inputs.longitude) } : {}), ...(inputs.latitude ? { latitude: String(inputs.latitude) } : {}) });
                const res = await fetch(`${ENDPOINTS.detectTimezone}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'checkPublicHolidays': {
                const params = new URLSearchParams({ api_key: key, country: inputs.country, year: String(inputs.year || new Date().getFullYear()) });
                const res = await fetch(`${ENDPOINTS.checkPublicHolidays}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'lookupCompany': {
                const params = new URLSearchParams({ api_key: key, domain: inputs.domain });
                const res = await fetch(`${ENDPOINTS.lookupCompany}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'validateAddress': {
                const params = new URLSearchParams({ api_key: key, address: inputs.address, ...(inputs.country ? { country: inputs.country } : {}) });
                const res = await fetch(`${ENDPOINTS.validateAddress}/?${params}`);
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown Abstract API action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Abstract API action error: ${err.message}`);
        return { error: err.message || 'Abstract API action failed' };
    }
}
