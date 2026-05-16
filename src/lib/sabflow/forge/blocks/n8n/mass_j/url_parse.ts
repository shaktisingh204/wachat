/**
 * Forge block: URL Parse
 *
 * Split a URL into its WHATWG parts (protocol/host/path/query). Query string
 * is materialised into a plain object so flow authors can index into it
 * with the JSON jq block.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_url_parse',
  name: 'URL: Parse',
  description: 'Parse a URL into protocol, host, path and query parts.',
  iconName: 'LuLink',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'parse',
      label: 'Parse',
      fields: [{ id: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://example.com/path?x=1' }],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const raw = asString(ctx.options.url);
        let u: URL;
        try {
          u = new URL(raw);
        } catch (err) {
          throw new Error(`URL parse failed: ${(err as Error).message}`);
        }
        const query: Record<string, string> = {};
        u.searchParams.forEach((value, key) => {
          query[key] = value;
        });
        return {
          outputs: {
            protocol: u.protocol.replace(/:$/, ''),
            host: u.host,
            hostname: u.hostname,
            port: u.port,
            pathname: u.pathname,
            search: u.search,
            hash: u.hash,
            query,
          },
        };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
