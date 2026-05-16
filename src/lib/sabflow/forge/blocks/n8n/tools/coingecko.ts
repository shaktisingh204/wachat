/**
 * Forge block: CoinGecko
 *
 * Source: n8n-master/packages/nodes-base/nodes/CoinGecko/CoinGecko.node.ts
 *
 * No auth — CoinGecko public API.
 *
 * Operations covered:
 *   - price.simple         GET /simple/price
 *   - coin.list            GET /coins/list
 *   - coin.get             GET /coins/{id}
 *   - search.trending      GET /search/trending
 *   - market.global        GET /global
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.coingecko.com/api/v3';

async function priceSimple(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const ids = asString(ctx.options.ids);
  const vs = asString(ctx.options.vsCurrencies);
  if (!ids) throw new Error('CoinGecko: ids is required');
  if (!vs) throw new Error('CoinGecko: vsCurrencies is required');
  const qs = new URLSearchParams({ ids, vs_currencies: vs }).toString();
  const res = await apiRequest({
    service: 'CoinGecko',
    method: 'GET',
    url: `${API}/simple/price?${qs}`,
  });
  return {
    outputs: { prices: res.data },
    logs: [`CoinGecko price → ${ids} in ${vs}`],
  };
}

async function coinList(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'CoinGecko',
    method: 'GET',
    url: `${API}/coins/list`,
  });
  return {
    outputs: { coins: res.data },
    logs: ['CoinGecko coin list'],
  };
}

async function coinGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.coinId);
  if (!id) throw new Error('CoinGecko: coinId is required');
  const res = await apiRequest({
    service: 'CoinGecko',
    method: 'GET',
    url: `${API}/coins/${encodeURIComponent(id)}`,
  });
  return {
    outputs: { coin: res.data },
    logs: [`CoinGecko coin get → ${id}`],
  };
}

async function searchTrending(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'CoinGecko',
    method: 'GET',
    url: `${API}/search/trending`,
  });
  return {
    outputs: { trending: res.data },
    logs: ['CoinGecko search trending'],
  };
}

async function marketGlobal(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'CoinGecko',
    method: 'GET',
    url: `${API}/global`,
  });
  return {
    outputs: { global: res.data },
    logs: ['CoinGecko global market data'],
  };
}

const block: ForgeBlock = {
  id: 'forge_coingecko',
  name: 'CoinGecko',
  description: 'Look up cryptocurrency prices, coins and trending tokens.',
  iconName: 'LuBitcoin',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'price_simple',
      label: 'Get price',
      description: 'Fetch the current price of one or more coins in given currencies.',
      fields: [
        { id: 'ids', label: 'Coin IDs', type: 'text', required: true, placeholder: 'bitcoin,ethereum' },
        { id: 'vsCurrencies', label: 'vs currencies', type: 'text', required: true, placeholder: 'usd,eur' },
      ],
      run: priceSimple,
    },
    {
      id: 'coin_list',
      label: 'List coins',
      description: 'Fetch the full list of supported coins (id, symbol, name).',
      fields: [],
      run: coinList,
    },
    {
      id: 'coin_get',
      label: 'Get coin',
      description: 'Fetch a single coin’s metadata, price and market data.',
      fields: [
        { id: 'coinId', label: 'Coin ID', type: 'text', required: true, placeholder: 'bitcoin' },
      ],
      run: coinGet,
    },
    {
      id: 'search_trending',
      label: 'Trending searches',
      description: 'Fetch the top-7 trending coins searched in the last 24h.',
      fields: [],
      run: searchTrending,
    },
    {
      id: 'market_global',
      label: 'Global market data',
      description: 'Fetch global crypto market metrics.',
      fields: [],
      run: marketGlobal,
    },
  ],
};

registerForgeBlock(block);
export default block;
