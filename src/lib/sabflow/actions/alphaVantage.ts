
'use server';

const AV_BASE = 'https://www.alphavantage.co';

async function avFetch(path: string, apiKey: string, logger: any): Promise<any> {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${AV_BASE}${path}${sep}apikey=${apiKey}`;
    logger.log(`[AlphaVantage] GET ${path}`);
    const res = await fetch(url);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.['Error Message'] || data?.Note || `AlphaVantage API error: ${res.status}`);
    if (data?.['Error Message']) throw new Error(data['Error Message']);
    if (data?.Note) throw new Error(`AlphaVantage rate limit: ${data.Note}`);
    return data;
}

function parseTimeSeries(data: any, tsKey: string): { date: string; open: string; high: string; low: string; close: string; volume: string }[] {
    const ts = data[tsKey] ?? {};
    return Object.entries(ts).map(([date, vals]: [string, any]) => ({
        date,
        open: vals['1. open'],
        high: vals['2. high'],
        low: vals['3. low'],
        close: vals['4. close'],
        volume: vals['5. volume'],
    }));
}

export async function executeAlphaVantageAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const fetch_ = (path: string) => avFetch(path, apiKey, logger);

        switch (actionName) {
            case 'getQuote': {
                const symbol = String(inputs.symbol ?? '').trim();
                if (!symbol) throw new Error('symbol is required.');
                const data = await fetch_(`/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}`);
                const d = data['Global Quote'] ?? {};
                return {
                    output: {
                        symbol: d['01. symbol'],
                        price: d['05. price'],
                        volume: d['06. volume'],
                        change: d['09. change'],
                        changePercent: d['10. change percent'],
                    },
                };
            }

            case 'getDailySeries': {
                const symbol = String(inputs.symbol ?? '').trim();
                if (!symbol) throw new Error('symbol is required.');
                const outputsize = inputs.outputsize ?? 'compact';
                const data = await fetch_(`/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=${outputsize}`);
                const series = parseTimeSeries(data, 'Time Series (Daily)');
                return { output: { symbol, timeSeries: series } };
            }

            case 'getIntradaySeries': {
                const symbol = String(inputs.symbol ?? '').trim();
                if (!symbol) throw new Error('symbol is required.');
                const interval = inputs.interval ?? '5min';
                const outputsize = inputs.outputsize ?? 'compact';
                const data = await fetch_(`/query?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}`);
                const tsKey = `Time Series (${interval})`;
                const ts = data[tsKey] ?? {};
                const timeSeries = Object.entries(ts).map(([datetime, vals]: [string, any]) => ({
                    datetime,
                    open: vals['1. open'],
                    high: vals['2. high'],
                    low: vals['3. low'],
                    close: vals['4. close'],
                    volume: vals['5. volume'],
                }));
                return { output: { symbol, interval, timeSeries } };
            }

            case 'getWeeklySeries': {
                const symbol = String(inputs.symbol ?? '').trim();
                if (!symbol) throw new Error('symbol is required.');
                const data = await fetch_(`/query?function=TIME_SERIES_WEEKLY&symbol=${encodeURIComponent(symbol)}`);
                const series = parseTimeSeries(data, 'Weekly Time Series');
                return { output: { symbol, timeSeries: series } };
            }

            case 'getMonthlySeries': {
                const symbol = String(inputs.symbol ?? '').trim();
                if (!symbol) throw new Error('symbol is required.');
                const data = await fetch_(`/query?function=TIME_SERIES_MONTHLY&symbol=${encodeURIComponent(symbol)}`);
                const series = parseTimeSeries(data, 'Monthly Time Series');
                return { output: { symbol, timeSeries: series } };
            }

            case 'searchSymbol': {
                const keywords = String(inputs.keywords ?? '').trim();
                if (!keywords) throw new Error('keywords is required.');
                const data = await fetch_(`/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(keywords)}`);
                const bestMatches = (data.bestMatches ?? []).map((m: any) => ({
                    symbol: m['1. symbol'],
                    name: m['2. name'],
                    type: m['3. type'],
                    region: m['4. region'],
                    currency: m['8. currency'],
                    matchScore: m['9. matchScore'],
                }));
                return { output: { bestMatches } };
            }

            case 'getCurrencyExchange': {
                const fromCurrency = String(inputs.fromCurrency ?? '').trim();
                const toCurrency = String(inputs.toCurrency ?? '').trim();
                if (!fromCurrency) throw new Error('fromCurrency is required.');
                if (!toCurrency) throw new Error('toCurrency is required.');
                const data = await fetch_(`/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}`);
                const d = data['Realtime Currency Exchange Rate'] ?? {};
                return {
                    output: {
                        fromCurrency: d['1. From_Currency Code'],
                        toCurrency: d['3. To_Currency Code'],
                        exchangeRate: d['5. Exchange Rate'],
                        bidPrice: d['8. Bid Price'],
                        askPrice: d['9. Ask Price'],
                    },
                };
            }

            case 'getForexDaily': {
                const fromSymbol = String(inputs.fromSymbol ?? '').trim();
                const toSymbol = String(inputs.toSymbol ?? '').trim();
                if (!fromSymbol) throw new Error('fromSymbol is required.');
                if (!toSymbol) throw new Error('toSymbol is required.');
                const outputsize = inputs.outputsize ?? 'compact';
                const data = await fetch_(`/query?function=FX_DAILY&from_symbol=${fromSymbol}&to_symbol=${toSymbol}&outputsize=${outputsize}`);
                const ts = data['Time Series FX (Daily)'] ?? {};
                const series = Object.entries(ts).map(([date, vals]: [string, any]) => ({
                    date,
                    open: vals['1. open'],
                    high: vals['2. high'],
                    low: vals['3. low'],
                    close: vals['4. close'],
                }));
                return { output: { series } };
            }

            case 'getCryptoRating': {
                const symbol = String(inputs.symbol ?? '').trim();
                if (!symbol) throw new Error('symbol is required.');
                const data = await fetch_(`/query?function=CRYPTO_RATING&symbol=${encodeURIComponent(symbol)}`);
                return { output: { rating: data['Crypto Rating (FCAS)'] ?? data } };
            }

            case 'getCryptoExchange': {
                const fromCurrency = String(inputs.fromCurrency ?? '').trim();
                const toCurrency = String(inputs.toCurrency ?? '').trim();
                if (!fromCurrency) throw new Error('fromCurrency is required.');
                if (!toCurrency) throw new Error('toCurrency is required.');
                const data = await fetch_(`/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}`);
                const d = data['Realtime Currency Exchange Rate'] ?? {};
                return {
                    output: {
                        fromCurrency: d['1. From_Currency Code'],
                        toCurrency: d['3. To_Currency Code'],
                        exchangeRate: d['5. Exchange Rate'],
                    },
                };
            }

            case 'getTechnicalIndicator': {
                const symbol = String(inputs.symbol ?? '').trim();
                if (!symbol) throw new Error('symbol is required.');
                const indicator = String(inputs.indicator ?? '').trim();
                if (!indicator) throw new Error('indicator is required.');
                const interval = inputs.interval ?? 'daily';
                const timePeriod = inputs.timePeriod ?? 14;
                const seriesType = inputs.seriesType ?? 'close';
                const data = await fetch_(
                    `/query?function=${encodeURIComponent(indicator)}&symbol=${encodeURIComponent(symbol)}&interval=${interval}&time_period=${timePeriod}&series_type=${seriesType}`,
                );
                const metaData = data['Meta Data'] ?? {};
                // Technical analysis key varies by indicator — grab first non-Meta Data key
                const taKey = Object.keys(data).find((k) => k !== 'Meta Data') ?? '';
                const rawTa = data[taKey] ?? {};
                const technicalAnalysis = Object.entries(rawTa).map(([date, vals]) => ({ date, ...(typeof vals === 'object' ? vals : { value: vals }) }));
                return { output: { metaData, technicalAnalysis } };
            }

            case 'getCompanyOverview': {
                const symbol = String(inputs.symbol ?? '').trim();
                if (!symbol) throw new Error('symbol is required.');
                const data = await fetch_(`/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}`);
                return {
                    output: {
                        symbol: data.Symbol,
                        assetType: data.AssetType,
                        name: data.Name,
                        description: data.Description,
                        exchange: data.Exchange,
                        currency: data.Currency,
                        country: data.Country,
                        sector: data.Sector,
                        industry: data.Industry,
                        marketCapitalization: data.MarketCapitalization,
                        peRatio: data.PERatio,
                        dividendYield: data.DividendYield,
                        eps: data.EPS,
                        bookValue: data.BookValue,
                    },
                };
            }

            default:
                return { error: `AlphaVantage action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'AlphaVantage action failed.' };
    }
}
