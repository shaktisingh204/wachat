/**
 * Forge block: Marketstack
 *
 * Source: n8n-master/packages/nodes-base/nodes/Marketstack/Marketstack.node.ts
 *
 * API key passed inline as a `password` field. Sent via `?access_key=…` query
 * param per Marketstack API docs.
 *
 * Operations covered:
 *   - eod.list             GET /eod
 *   - intraday.list        GET /intraday
 *   - tickers.list         GET /tickers
 *   - exchanges.list       GET /exchanges
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.marketstack.com/v1';

function requireKey(ctx: ForgeActionContext): string {
  const k = asString(ctx.options.apiKey);
  if (!k) throw new Error('Marketstack: apiKey is required');
  return k;
}

function qs(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') u.set(k, v);
  }
  return u.toString();
}

async function eodList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = requireKey(ctx);
  const symbols = asString(ctx.options.symbols);
  if (!symbols) throw new Error('Marketstack: symbols is required');
  const url = `${API}/eod?${qs({
    access_key: apiKey,
    symbols,
    date_from: asString(ctx.options.dateFrom),
    date_to: asString(ctx.options.dateTo),
    limit: asString(ctx.options.limit),
  })}`;
  const res = await apiRequest({ service: 'Marketstack', method: 'GET', url });
  return {
    outputs: { eod: res.data },
    logs: [`Marketstack eod → ${symbols}`],
  };
}

async function intradayList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = requireKey(ctx);
  const symbols = asString(ctx.options.symbols);
  if (!symbols) throw new Error('Marketstack: symbols is required');
  const url = `${API}/intraday?${qs({
    access_key: apiKey,
    symbols,
    interval: asString(ctx.options.interval) || '1hour',
    date_from: asString(ctx.options.dateFrom),
    date_to: asString(ctx.options.dateTo),
    limit: asString(ctx.options.limit),
  })}`;
  const res = await apiRequest({ service: 'Marketstack', method: 'GET', url });
  return {
    outputs: { intraday: res.data },
    logs: [`Marketstack intraday → ${symbols}`],
  };
}

async function tickersList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = requireKey(ctx);
  const url = `${API}/tickers?${qs({
    access_key: apiKey,
    search: asString(ctx.options.search),
    exchange: asString(ctx.options.exchange),
    limit: asString(ctx.options.limit),
  })}`;
  const res = await apiRequest({ service: 'Marketstack', method: 'GET', url });
  return {
    outputs: { tickers: res.data },
    logs: ['Marketstack tickers list'],
  };
}

async function exchangesList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = requireKey(ctx);
  const url = `${API}/exchanges?${qs({
    access_key: apiKey,
    search: asString(ctx.options.search),
    limit: asString(ctx.options.limit),
  })}`;
  const res = await apiRequest({ service: 'Marketstack', method: 'GET', url });
  return {
    outputs: { exchanges: res.data },
    logs: ['Marketstack exchanges list'],
  };
}

const INTERVAL_OPTIONS = [
  { label: '1 minute', value: '1min' },
  { label: '5 minutes', value: '5min' },
  { label: '10 minutes', value: '10min' },
  { label: '15 minutes', value: '15min' },
  { label: '30 minutes', value: '30min' },
  { label: '1 hour', value: '1hour' },
  { label: '3 hours', value: '3hour' },
  { label: '6 hours', value: '6hour' },
  { label: '12 hours', value: '12hour' },
  { label: '24 hours', value: '24hour' },
];

const block: ForgeBlock = {
  id: 'forge_marketstack',
  name: 'Marketstack',
  description: 'Fetch end-of-day, intraday and reference data from Marketstack.',
  iconName: 'LuLineChart',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'eod_list',
      label: 'End-of-day data',
      description: 'Fetch end-of-day stock data for one or more tickers.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'symbols', label: 'Symbols (comma-separated)', type: 'text', required: true, placeholder: 'AAPL,MSFT' },
        { id: 'dateFrom', label: 'Date from (YYYY-MM-DD)', type: 'text' },
        { id: 'dateTo', label: 'Date to (YYYY-MM-DD)', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: eodList,
    },
    {
      id: 'intraday_list',
      label: 'Intraday data',
      description: 'Fetch intraday stock data at a chosen interval.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'symbols', label: 'Symbols (comma-separated)', type: 'text', required: true, placeholder: 'AAPL' },
        { id: 'interval', label: 'Interval', type: 'select', options: INTERVAL_OPTIONS, defaultValue: '1hour' },
        { id: 'dateFrom', label: 'Date from (ISO)', type: 'text' },
        { id: 'dateTo', label: 'Date to (ISO)', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: intradayList,
    },
    {
      id: 'tickers_list',
      label: 'List tickers',
      description: 'Search and list supported tickers.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'search', label: 'Search', type: 'text', placeholder: 'apple' },
        { id: 'exchange', label: 'Exchange MIC', type: 'text', placeholder: 'XNAS' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: tickersList,
    },
    {
      id: 'exchanges_list',
      label: 'List exchanges',
      description: 'Search and list supported exchanges.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'search', label: 'Search', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: exchangesList,
    },
  ],
};

registerForgeBlock(block);
export default block;
