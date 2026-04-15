'use server';

export async function executeCurrencylayerAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.currencylayer.com';

    const buildUrl = (endpoint: string, extra?: Record<string, string>) => {
        const params = new URLSearchParams({ access_key: inputs.accessKey, ...extra });
        return `${BASE_URL}/${endpoint}?${params}`;
    };

    try {
        switch (actionName) {
            case 'getLiveRates': {
                const extra: Record<string, string> = {};
                if (inputs.currencies) extra.currencies = inputs.currencies;
                if (inputs.source) extra.source = inputs.source;
                const res = await fetch(buildUrl('live', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get live rates' };
                return { output: data };
            }
            case 'getHistoricalRates': {
                const extra: Record<string, string> = { date: inputs.date };
                if (inputs.currencies) extra.currencies = inputs.currencies;
                if (inputs.source) extra.source = inputs.source;
                const res = await fetch(buildUrl('historical', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get historical rates' };
                return { output: data };
            }
            case 'convertAmount': {
                const extra: Record<string, string> = {
                    from: inputs.from,
                    to: inputs.to,
                    amount: String(inputs.amount),
                };
                if (inputs.date) extra.date = inputs.date;
                const res = await fetch(buildUrl('convert', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to convert amount' };
                return { output: data };
            }
            case 'getTimeSeries': {
                const extra: Record<string, string> = {
                    start_date: inputs.start_date,
                    end_date: inputs.end_date,
                };
                if (inputs.currencies) extra.currencies = inputs.currencies;
                if (inputs.source) extra.source = inputs.source;
                const res = await fetch(buildUrl('timeframe', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get time series' };
                return { output: data };
            }
            case 'getFluctuation': {
                const extra: Record<string, string> = {
                    start_date: inputs.start_date,
                    end_date: inputs.end_date,
                };
                if (inputs.currencies) extra.currencies = inputs.currencies;
                if (inputs.source) extra.source = inputs.source;
                const res = await fetch(buildUrl('fluctuation', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get fluctuation' };
                return { output: data };
            }
            case 'listCurrencies': {
                const res = await fetch(buildUrl('list'));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to list currencies' };
                return { output: data };
            }
            case 'getBankFeeRates': {
                const extra: Record<string, string> = {};
                if (inputs.currencies) extra.currencies = inputs.currencies;
                const res = await fetch(buildUrl('live', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get bank fee rates' };
                return { output: { ...data, note: 'Bank fee rates based on live rates' } };
            }
            case 'getAutocorrect': {
                const extra: Record<string, string> = {};
                if (inputs.currencies) extra.currencies = inputs.currencies;
                const res = await fetch(buildUrl('live', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get autocorrect data' };
                return { output: data };
            }
            case 'getQuotes': {
                const extra: Record<string, string> = {};
                if (inputs.currencies) extra.currencies = inputs.currencies;
                if (inputs.source) extra.source = inputs.source;
                const res = await fetch(buildUrl('live', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get quotes' };
                return { output: data };
            }
            case 'getHistoricalQuotes': {
                const extra: Record<string, string> = { date: inputs.date };
                if (inputs.currencies) extra.currencies = inputs.currencies;
                if (inputs.source) extra.source = inputs.source;
                const res = await fetch(buildUrl('historical', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get historical quotes' };
                return { output: data };
            }
            case 'checkApiStatus': {
                const res = await fetch(buildUrl('live'));
                const data = await res.json();
                return { output: { status: data.success ? 'active' : 'error', details: data } };
            }
            case 'getAccountInfo': {
                const res = await fetch(buildUrl('live'));
                const data = await res.json();
                return { output: { account: { access_key: inputs.accessKey }, api_response: data } };
            }
            case 'listBanks': {
                const res = await fetch(buildUrl('list'));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to list banks' };
                return { output: data };
            }
            case 'convertMultiple': {
                const targets: string[] = Array.isArray(inputs.targets) ? inputs.targets : (inputs.targets || '').split(',');
                const results: Record<string, any> = {};
                for (const to of targets) {
                    const extra: Record<string, string> = {
                        from: inputs.from,
                        to: to.trim(),
                        amount: String(inputs.amount),
                    };
                    const res = await fetch(buildUrl('convert', extra));
                    const data = await res.json();
                    results[to.trim()] = data.success ? data.result : { error: data.error?.info };
                }
                return { output: { conversions: results } };
            }
            case 'getEndOfDayRates': {
                const extra: Record<string, string> = { date: inputs.date };
                if (inputs.currencies) extra.currencies = inputs.currencies;
                const res = await fetch(buildUrl('historical', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get end of day rates' };
                return { output: data };
            }
            default:
                return { error: `Unknown Currencylayer action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Currencylayer] Error in action ${actionName}: ${err.message}`);
        return { error: err.message || 'Currencylayer action failed' };
    }
}
