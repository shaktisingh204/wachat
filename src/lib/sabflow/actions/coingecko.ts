'use server';

const CG_BASE = 'https://api.coingecko.com/api/v3';

async function cgFetch(path: string, apiKey: string | undefined, logger: any) {
    const url = `${CG_BASE}${path}`;
    logger.log(`[CoinGecko] GET ${path.split('?')[0]}`);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['x-cg-demo-api-key'] = apiKey;
    const res = await fetch(url, { headers });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.error || data?.status?.error_message || `CoinGecko API error: ${res.status}`);
    return data;
}

export async function executeCoinGeckoAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey ? String(inputs.apiKey).trim() : undefined;

        switch (actionName) {
            case 'getCoinsList': {
                const includePlatform = inputs.includePlatform ? 'true' : 'false';
                logger.log('[CoinGecko] getCoinsList');
                const data = await cgFetch(`/coins/list?include_platform=${includePlatform}`, apiKey, logger);
                return { output: { coins: Array.isArray(data) ? data : [] } };
            }

            case 'getCoinMarkets': {
                const vsCurrency = String(inputs.vsCurrency ?? 'usd');
                const perPage = Number(inputs.perPage ?? 100);
                const page = Number(inputs.page ?? 1);
                const order = String(inputs.order ?? 'market_cap_desc');
                logger.log(`[CoinGecko] getCoinMarkets: currency=${vsCurrency}`);
                let path = `/coins/markets?vs_currency=${vsCurrency}&order=${order}&per_page=${perPage}&page=${page}&sparkline=false`;
                if (inputs.ids) path += `&ids=${encodeURIComponent(String(inputs.ids))}`;
                const data = await cgFetch(path, apiKey, logger);
                return { output: { markets: Array.isArray(data) ? data : [] } };
            }

            case 'getCoinData': {
                const coinId = String(inputs.coinId ?? '').trim();
                if (!coinId) throw new Error('coinId is required.');
                logger.log(`[CoinGecko] getCoinData: ${coinId}`);
                const data = await cgFetch(`/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`, apiKey, logger);
                return {
                    output: {
                        id: data.id,
                        symbol: data.symbol,
                        name: data.name,
                        currentPrice: data.market_data?.current_price ?? {},
                        marketCap: data.market_data?.market_cap ?? {},
                        priceChangePercentage24h: data.market_data?.price_change_percentage_24h ?? null,
                        image: data.image?.small ?? '',
                    },
                };
            }

            case 'getCoinHistoricalData': {
                const coinId = String(inputs.coinId ?? '').trim();
                const date = String(inputs.date ?? '').trim();
                if (!coinId) throw new Error('coinId is required.');
                if (!date) throw new Error('date (dd-mm-yyyy) is required.');
                logger.log(`[CoinGecko] getCoinHistoricalData: ${coinId} on ${date}`);
                const data = await cgFetch(`/coins/${coinId}/history?date=${date}`, apiKey, logger);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        marketData: data.market_data ?? {},
                    },
                };
            }

            case 'getCoinMarketChart': {
                const coinId = String(inputs.coinId ?? '').trim();
                const vsCurrency = String(inputs.vsCurrency ?? 'usd');
                const days = String(inputs.days ?? '7');
                if (!coinId) throw new Error('coinId is required.');
                logger.log(`[CoinGecko] getCoinMarketChart: ${coinId} ${days}d`);
                const data = await cgFetch(`/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}`, apiKey, logger);
                return { output: { prices: data.prices ?? [], market_caps: data.market_caps ?? [], total_volumes: data.total_volumes ?? [] } };
            }

            case 'getCoinOHLC': {
                const coinId = String(inputs.coinId ?? '').trim();
                const vsCurrency = String(inputs.vsCurrency ?? 'usd');
                const days = String(inputs.days ?? '7');
                if (!coinId) throw new Error('coinId is required.');
                logger.log(`[CoinGecko] getCoinOHLC: ${coinId}`);
                const data = await cgFetch(`/coins/${coinId}/ohlc?vs_currency=${vsCurrency}&days=${days}`, apiKey, logger);
                return { output: { ohlc: Array.isArray(data) ? data : [] } };
            }

            case 'getExchanges': {
                const perPage = Number(inputs.perPage ?? 100);
                const page = Number(inputs.page ?? 1);
                logger.log('[CoinGecko] getExchanges');
                const data = await cgFetch(`/exchanges?per_page=${perPage}&page=${page}`, apiKey, logger);
                return { output: { exchanges: Array.isArray(data) ? data : [] } };
            }

            case 'getExchange': {
                const exchangeId = String(inputs.exchangeId ?? '').trim();
                if (!exchangeId) throw new Error('exchangeId is required.');
                logger.log(`[CoinGecko] getExchange: ${exchangeId}`);
                const data = await cgFetch(`/exchanges/${exchangeId}`, apiKey, logger);
                return { output: { id: data.id, name: data.name, url: data.url, tradeVolume24hBtc: data.trade_volume_24h_btc ?? null, trustScore: data.trust_score ?? null } };
            }

            case 'getTrending': {
                logger.log('[CoinGecko] getTrending');
                const data = await cgFetch('/search/trending', apiKey, logger);
                return { output: { coins: (data.coins ?? []).map((c: any) => ({ id: c.item?.id, name: c.item?.name, symbol: c.item?.symbol, marketCapRank: c.item?.market_cap_rank })), nfts: data.nfts ?? [] } };
            }

            case 'getGlobalData': {
                logger.log('[CoinGecko] getGlobalData');
                const data = await cgFetch('/global', apiKey, logger);
                return { output: { data: data.data ?? {} } };
            }

            case 'searchCoins': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                logger.log(`[CoinGecko] searchCoins: ${query}`);
                const data = await cgFetch(`/search?query=${encodeURIComponent(query)}`, apiKey, logger);
                return { output: { coins: data.coins ?? [], exchanges: data.exchanges ?? [], categories: data.categories ?? [] } };
            }

            case 'getAssetPlatforms': {
                logger.log('[CoinGecko] getAssetPlatforms');
                const data = await cgFetch('/asset_platforms', apiKey, logger);
                return { output: { platforms: Array.isArray(data) ? data : [] } };
            }

            case 'getCategories': {
                logger.log('[CoinGecko] getCategories');
                const data = await cgFetch('/coins/categories/list', apiKey, logger);
                return { output: { categories: Array.isArray(data) ? data : [] } };
            }

            case 'getExchangeRates': {
                logger.log('[CoinGecko] getExchangeRates');
                const data = await cgFetch('/exchange_rates', apiKey, logger);
                return { output: { rates: data.rates ?? {} } };
            }

            case 'getSimplePrice': {
                const ids = String(inputs.ids ?? '').trim();
                const vsCurrencies = String(inputs.vsCurrencies ?? 'usd');
                if (!ids) throw new Error('ids is required (comma-separated coin ids).');
                logger.log(`[CoinGecko] getSimplePrice: ${ids}`);
                const data = await cgFetch(`/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vsCurrencies)}&include_24hr_change=true&include_market_cap=true`, apiKey, logger);
                return { output: { prices: data } };
            }

            default:
                return { error: `Unknown CoinGecko action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`[CoinGecko] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown error in CoinGecko action.' };
    }
}
