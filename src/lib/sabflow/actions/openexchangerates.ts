'use server';

export async function executeOpenExchangeRatesAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://openexchangerates.org/api';

    const buildUrl = (endpoint: string, extra?: Record<string, string>) => {
        const params = new URLSearchParams({ app_id: inputs.appId, ...extra });
        return `${BASE_URL}/${endpoint}?${params}`;
    };

    try {
        switch (actionName) {
            case 'getLatestRates': {
                const extra: Record<string, string> = {};
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                if (inputs.prettyprint !== undefined) extra.prettyprint = String(inputs.prettyprint);
                if (inputs.show_alternative !== undefined) extra.show_alternative = String(inputs.show_alternative);
                const res = await fetch(buildUrl('latest.json', extra));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to get latest rates' };
                return { output: data };
            }
            case 'getHistoricalRates': {
                const extra: Record<string, string> = {};
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl(`historical/${inputs.date}.json`, extra));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to get historical rates' };
                return { output: data };
            }
            case 'getCurrencies': {
                const extra: Record<string, string> = {};
                if (inputs.show_alternative !== undefined) extra.show_alternative = String(inputs.show_alternative);
                if (inputs.show_inactive !== undefined) extra.show_inactive = String(inputs.show_inactive);
                const res = await fetch(buildUrl('currencies.json', extra));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to get currencies' };
                return { output: data };
            }
            case 'convertAmount': {
                const extra: Record<string, string> = {
                    from: inputs.from,
                    to: inputs.to,
                    amount: String(inputs.amount),
                };
                if (inputs.prettyprint !== undefined) extra.prettyprint = String(inputs.prettyprint);
                const res = await fetch(buildUrl('convert', extra));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to convert amount' };
                return { output: data };
            }
            case 'getTimeSeries': {
                const extra: Record<string, string> = {
                    start: inputs.start,
                    end: inputs.end,
                };
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('time-series.json', extra));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to get time series' };
                return { output: data };
            }
            case 'getOHLC': {
                const extra: Record<string, string> = {
                    start_time: inputs.start_time,
                    period: inputs.period,
                };
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('ohlc.json', extra));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to get OHLC data' };
                return { output: data };
            }
            case 'getUsageStats': {
                const res = await fetch(buildUrl('usage.json'));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to get usage stats' };
                return { output: data };
            }
            case 'getQuotes': {
                const extra: Record<string, string> = {};
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('latest.json', extra));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to get quotes' };
                return { output: data };
            }
            case 'listAlternativeCurrencies': {
                const extra: Record<string, string> = { show_alternative: '1' };
                const res = await fetch(buildUrl('currencies.json', extra));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to list alternative currencies' };
                return { output: data };
            }
            case 'getGoldPrice': {
                const extra: Record<string, string> = { symbols: 'XAU' };
                if (inputs.base) extra.base = inputs.base;
                const res = await fetch(buildUrl('latest.json', extra));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to get gold price' };
                return { output: { gold_price: data.rates?.XAU, base: data.base, timestamp: data.timestamp } };
            }
            case 'getSpotPrices': {
                const commodities = inputs.symbols || 'XAU,XAG,XPT,XPD';
                const extra: Record<string, string> = { symbols: commodities };
                if (inputs.base) extra.base = inputs.base;
                const res = await fetch(buildUrl('latest.json', extra));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to get spot prices' };
                return { output: data };
            }
            case 'getExchangeData': {
                const extra: Record<string, string> = {};
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('latest.json', extra));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to get exchange data' };
                return { output: data };
            }
            case 'compareRates': {
                const [res1, res2] = await Promise.all([
                    fetch(buildUrl('latest.json', { base: inputs.base1 || 'USD', symbols: inputs.currency })),
                    fetch(buildUrl('latest.json', { base: inputs.base2 || 'EUR', symbols: inputs.currency })),
                ]);
                const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
                if (data1.error) return { error: data1.description || 'Failed to compare rates' };
                if (data2.error) return { error: data2.description || 'Failed to compare rates' };
                return { output: { base1_rates: data1, base2_rates: data2 } };
            }
            case 'getPreviousClose': {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const dateStr = yesterday.toISOString().split('T')[0];
                const extra: Record<string, string> = {};
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl(`historical/${dateStr}.json`, extra));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to get previous close' };
                return { output: { ...data, close_date: dateStr } };
            }
            case 'getPredicatedRates': {
                const extra: Record<string, string> = {
                    start: inputs.start || new Date().toISOString().split('T')[0],
                    end: inputs.end || new Date().toISOString().split('T')[0],
                };
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('time-series.json', extra));
                const data = await res.json();
                if (data.error) return { error: data.description || 'Failed to get predicated rates' };
                return { output: { ...data, note: 'Historical trend data for rate prediction' } };
            }
            default:
                return { error: `Unknown Open Exchange Rates action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[OpenExchangeRates] Error in action ${actionName}: ${err.message}`);
        return { error: err.message || 'Open Exchange Rates action failed' };
    }
}
