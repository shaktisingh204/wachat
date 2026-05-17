# @sabnode/sdk

Generated TypeScript client for the SabNode public API. **DO NOT** edit
`src/_generated/` by hand — re-run `pnpm api:gen` from the repo root.

## Usage

```ts
import { SabnodeClient } from '@sabnode/sdk';

const sn = new SabnodeClient({ apiKey: process.env.SABNODE_API_KEY! });
const me = await sn.identityGetMe();
console.log(me.data);
```
