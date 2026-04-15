'use server';

export async function executeFixerioAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://data.fixer.io/api';

    const buildUrl = (endpoint: string, extra?: Record<string, string>) => {
        const params = new URLSearchParams({ access_key: inputs.accessKey, ...extra });
        return `${BASE_URL}/${endpoint}?${params}`;
    };

    try {
        switch (actionName) {
            case 'getLatestRates': {
                const extra: Record<string, string> = {};
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('latest', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get latest rates' };
                return { output: data };
            }
            case 'getHistoricalRates': {
                const extra: Record<string, string> = {};
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl(inputs.date, extra));
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
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('timeseries', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get time series' };
                return { output: data };
            }
            case 'getFluctuation': {
                const extra: Record<string, string> = {
                    start_date: inputs.start_date,
                    end_date: inputs.end_date,
                };
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('fluctuation', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get fluctuation' };
                return { output: data };
            }
            case 'listSymbols': {
                const res = await fetch(buildUrl('symbols'));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to list symbols' };
                return { output: data };
            }
            case 'getEndOfDayRates': {
                const extra: Record<string, string> = {};
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl(inputs.date, extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get end of day rates' };
                return { output: data };
            }
            case 'getMonthlyRates': {
                const now = new Date();
                const year = inputs.year || now.getFullYear();
                const month = String(inputs.month || now.getMonth() + 1).padStart(2, '0');
                const start_date = `${year}-${month}-01`;
                const lastDay = new Date(year, inputs.month || now.getMonth() + 1, 0).getDate();
                const end_date = `${year}-${month}-${lastDay}`;
                const extra: Record<string, string> = { start_date, end_date };
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('timeseries', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get monthly rates' };
                return { output: data };
            }
            case 'getHighestRates': {
                const extra: Record<string, string> = {
                    start_date: inputs.start_date,
                    end_date: inputs.end_date,
                };
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('fluctuation', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get highest rates' };
                const highest: Record<string, any> = {};
                if (data.rates) {
                    for (const [currency, info] of Object.entries<any>(data.rates)) {
                        highest[currency] = info.end_rate > info.start_rate ? info.end_rate : info.start_rate;
                    }
                }
                return { output: { ...data, highest_rates: highest } };
            }
            case 'getLowestRates': {
                const extra: Record<string, string> = {
                    start_date: inputs.start_date,
                    end_date: inputs.end_date,
                };
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('fluctuation', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get lowest rates' };
                const lowest: Record<string, any> = {};
                if (data.rates) {
                    for (const [currency, info] of Object.entries<any>(data.rates)) {
                        lowest[currency] = info.end_rate < info.start_rate ? info.end_rate : info.start_rate;
                    }
                }
                return { output: { ...data, lowest_rates: lowest } };
            }
            case 'getWeeklyRates': {
                const endDate = new Date(inputs.end_date || Date.now());
                const startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - 7);
                const extra: Record<string, string> = {
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                };
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('timeseries', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get weekly rates' };
                return { output: data };
            }
            case 'getQuarterlyRates': {
                const extra: Record<string, string> = {
                    start_date: inputs.start_date,
                    end_date: inputs.end_date,
                };
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('timeseries', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get quarterly rates' };
                return { output: data };
            }
            case 'getYearlyRates': {
                const year = inputs.year || new Date().getFullYear();
                const extra: Record<string, string> = {
                    start_date: `${year}-01-01`,
                    end_date: `${year}-12-31`,
                };
                if (inputs.base) extra.base = inputs.base;
                if (inputs.symbols) extra.symbols = inputs.symbols;
                const res = await fetch(buildUrl('timeseries', extra));
                const data = await res.json();
                if (!data.success) return { error: data.error?.info || 'Failed to get yearly rates' };
                return { output: data };
            }
            case 'getApiStatus': {
                const res = await fetch(buildUrl('latest'));
                const data = await res.json();
                return { output: { status: data.success ? 'active' : 'error', details: data } };
            }
            case 'checkUsage': {
                const res = await fetch(buildUrl('latest'));
                const data = await res.json();
                return { output: { usage: data.success ? 'ok' : 'error', response: data } };
            }
            default:
                return { error: `Unknown Fixer.io action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Fixerio] Error in action ${actionName}: ${err.message}`);
        return { error: err.message || 'Fixer.io action failed' };
    }
}
