'use server';

export async function executeCoinMarketCapAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://pro-api.coinmarketcap.com/v1';
    const headers: Record<string, string> = {
        'X-CMC_PRO_API_KEY': inputs.apiKey,
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'getLatestListings': {
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.convert) params.set('convert', inputs.convert);
                if (inputs.sort) params.set('sort', inputs.sort);
                const res = await fetch(`${BASE_URL}/cryptocurrency/listings/latest?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get latest listings' };
                return { output: data };
            }
            case 'getLatestQuotes': {
                const params = new URLSearchParams();
                if (inputs.id) params.set('id', inputs.id);
                if (inputs.slug) params.set('slug', inputs.slug);
                if (inputs.symbol) params.set('symbol', inputs.symbol);
                if (inputs.convert) params.set('convert', inputs.convert);
                const res = await fetch(`${BASE_URL}/cryptocurrency/quotes/latest?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get latest quotes' };
                return { output: data };
            }
            case 'getHistoricalQuotes': {
                const params = new URLSearchParams();
                if (inputs.id) params.set('id', inputs.id);
                if (inputs.symbol) params.set('symbol', inputs.symbol);
                if (inputs.time_start) params.set('time_start', inputs.time_start);
                if (inputs.time_end) params.set('time_end', inputs.time_end);
                if (inputs.count) params.set('count', inputs.count);
                if (inputs.interval) params.set('interval', inputs.interval);
                if (inputs.convert) params.set('convert', inputs.convert);
                const res = await fetch(`${BASE_URL}/cryptocurrency/quotes/historical?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get historical quotes' };
                return { output: data };
            }
            case 'getMarketPairs': {
                const params = new URLSearchParams();
                if (inputs.id) params.set('id', inputs.id);
                if (inputs.slug) params.set('slug', inputs.slug);
                if (inputs.symbol) params.set('symbol', inputs.symbol);
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.convert) params.set('convert', inputs.convert);
                const res = await fetch(`${BASE_URL}/cryptocurrency/market-pairs/latest?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get market pairs' };
                return { output: data };
            }
            case 'getCoinInfo': {
                const params = new URLSearchParams();
                if (inputs.id) params.set('id', inputs.id);
                if (inputs.slug) params.set('slug', inputs.slug);
                if (inputs.symbol) params.set('symbol', inputs.symbol);
                if (inputs.address) params.set('address', inputs.address);
                const res = await fetch(`${BASE_URL}/cryptocurrency/info?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get coin info' };
                return { output: data };
            }
            case 'getGlobalMetrics': {
                const params = new URLSearchParams();
                if (inputs.convert) params.set('convert', inputs.convert);
                const res = await fetch(`${BASE_URL}/global-metrics/quotes/latest?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get global metrics' };
                return { output: data };
            }
            case 'getPriceConversion': {
                const params = new URLSearchParams();
                if (inputs.amount) params.set('amount', inputs.amount);
                if (inputs.id) params.set('id', inputs.id);
                if (inputs.symbol) params.set('symbol', inputs.symbol);
                if (inputs.convert) params.set('convert', inputs.convert);
                if (inputs.time) params.set('time', inputs.time);
                const res = await fetch(`${BASE_URL}/tools/price-conversion?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get price conversion' };
                return { output: data };
            }
            case 'getTrendingLatest': {
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.convert) params.set('convert', inputs.convert);
                const res = await fetch(`${BASE_URL}/cryptocurrency/trending/latest?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get trending latest' };
                return { output: data };
            }
            case 'getTrendingGainersLosers': {
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.convert) params.set('convert', inputs.convert);
                if (inputs.sort_dir) params.set('sort_dir', inputs.sort_dir);
                const res = await fetch(`${BASE_URL}/cryptocurrency/trending/gainers-losers?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get trending gainers/losers' };
                return { output: data };
            }
            case 'getCategories': {
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.id) params.set('id', inputs.id);
                if (inputs.slug) params.set('slug', inputs.slug);
                if (inputs.symbol) params.set('symbol', inputs.symbol);
                const res = await fetch(`${BASE_URL}/cryptocurrency/categories?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get categories' };
                return { output: data };
            }
            case 'getCategory': {
                const params = new URLSearchParams();
                if (inputs.id) params.set('id', inputs.id);
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.convert) params.set('convert', inputs.convert);
                const res = await fetch(`${BASE_URL}/cryptocurrency/category?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get category' };
                return { output: data };
            }
            case 'getAirdrops': {
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.id) params.set('id', inputs.id);
                if (inputs.slug) params.set('slug', inputs.slug);
                if (inputs.symbol) params.set('symbol', inputs.symbol);
                const res = await fetch(`${BASE_URL}/cryptocurrency/airdrops?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get airdrops' };
                return { output: data };
            }
            case 'getExchangeListings': {
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.sort) params.set('sort', inputs.sort);
                if (inputs.convert) params.set('convert', inputs.convert);
                const res = await fetch(`${BASE_URL}/exchange/listings/latest?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get exchange listings' };
                return { output: data };
            }
            case 'getExchangeInfo': {
                const params = new URLSearchParams();
                if (inputs.id) params.set('id', inputs.id);
                if (inputs.slug) params.set('slug', inputs.slug);
                const res = await fetch(`${BASE_URL}/exchange/info?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get exchange info' };
                return { output: data };
            }
            case 'getFearGreedIndex': {
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.limit) params.set('limit', inputs.limit);
                const res = await fetch(`${BASE_URL}/fear-and-greed/latest?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status?.error_message || 'Failed to get fear and greed index' };
                return { output: data };
            }
            default:
                return { error: `Unknown CoinMarketCap action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[CoinMarketCap] Error in action ${actionName}: ${err.message}`);
        return { error: err.message || 'CoinMarketCap action failed' };
    }
}
