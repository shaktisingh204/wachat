/**
 * Forge block: Mindee
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mindee/Mindee.node.ts
 * Credential type: 'mindee' (expects { apiKey }).
 *
 * Endpoint: https://api.mindee.net/v1/products/mindee/{product}/v{version}/predict
 * Auth: Authorization: Token <apiKey>
 *
 * Operations:
 *   - receipt.parse    POST /products/mindee/expense_receipts/v5/predict
 *   - invoice.parse    POST /products/mindee/invoices/v4/predict
 *   - passport.parse   POST /products/mindee/passport/v1/predict
 *   - custom.parse     POST /products/{org}/{product}/v{version}/predict (manual product path)
 *
 * The Mindee API requires a multipart upload with the document binary; this
 * port supports `documentUrl` (fetch+forward) — for direct file uploads users
 * should wire SabFiles → URL → here.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString, requireCredential } from '../_shared/http';

const API = 'https://api.mindee.net/v1';

function token(ctx: ForgeActionContext): string {
  const cred = requireCredential('Mindee', ctx.credential);
  const key = cred.apiKey ?? cred.accessToken;
  if (!key) throw new Error('Mindee: credential is missing `apiKey`');
  return `Token ${key}`;
}

async function predict(
  ctx: ForgeActionContext,
  productPath: string,
  docUrl: string,
  service: string,
): Promise<ForgeActionResult> {
  const fetched = await fetch(docUrl);
  if (!fetched.ok) throw new Error(`${service}: failed to fetch document (${fetched.status})`);
  const buf = Buffer.from(await fetched.arrayBuffer());
  const contentType = fetched.headers.get('content-type') ?? 'application/octet-stream';
  const fileName = docUrl.split('/').pop() || 'document';

  const form = new FormData();
  form.append(
    'document',
    new Blob([new Uint8Array(buf)], { type: contentType }),
    fileName,
  );

  const res = await fetch(`${API}${productPath}`, {
    method: 'POST',
    headers: { Authorization: token(ctx) },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${service} parse failed (${res.status}): ${text.slice(0, 300)}`);
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return {
    outputs: { result: body },
    logs: [`${service} parse → ${fileName}`],
  };
}

async function receiptParse(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.documentUrl);
  if (!url) throw new Error('Mindee: documentUrl is required');
  return predict(ctx, '/products/mindee/expense_receipts/v5/predict', url, 'Mindee receipt');
}

async function invoiceParse(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.documentUrl);
  if (!url) throw new Error('Mindee: documentUrl is required');
  return predict(ctx, '/products/mindee/invoices/v4/predict', url, 'Mindee invoice');
}

async function passportParse(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.documentUrl);
  if (!url) throw new Error('Mindee: documentUrl is required');
  return predict(ctx, '/products/mindee/passport/v1/predict', url, 'Mindee passport');
}

async function customParse(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.documentUrl);
  const org = asString(ctx.options.org) || 'mindee';
  const product = asString(ctx.options.product);
  const version = asString(ctx.options.version) || '1';
  if (!url) throw new Error('Mindee: documentUrl is required');
  if (!product) throw new Error('Mindee: product is required');

  const path = `/products/${encodeURIComponent(org)}/${encodeURIComponent(product)}/v${encodeURIComponent(version)}/predict`;
  return predict(ctx, path, url, `Mindee ${product}`);
}

const block: ForgeBlock = {
  id: 'forge_mindee',
  name: 'Mindee',
  description: 'OCR receipts, invoices, passports and custom Mindee products.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mindee' },
  actions: [
    {
      id: 'receipt_parse',
      label: 'Parse receipt',
      description: 'Extract structured data from a receipt image.',
      fields: [
        { id: 'documentUrl', label: 'Document URL', type: 'text', required: true },
      ],
      run: receiptParse,
    },
    {
      id: 'invoice_parse',
      label: 'Parse invoice',
      description: 'Extract structured data from an invoice document.',
      fields: [
        { id: 'documentUrl', label: 'Document URL', type: 'text', required: true },
      ],
      run: invoiceParse,
    },
    {
      id: 'passport_parse',
      label: 'Parse passport',
      description: 'Extract MRZ + fields from a passport scan.',
      fields: [
        { id: 'documentUrl', label: 'Document URL', type: 'text', required: true },
      ],
      run: passportParse,
    },
    {
      id: 'custom_parse',
      label: 'Custom product',
      description: 'Run a custom Mindee product against a document.',
      fields: [
        { id: 'documentUrl', label: 'Document URL', type: 'text', required: true },
        { id: 'org', label: 'Org slug', type: 'text', placeholder: 'mindee' },
        { id: 'product', label: 'Product slug', type: 'text', required: true },
        { id: 'version', label: 'Version', type: 'text', placeholder: '1' },
      ],
      run: customParse,
    },
  ],
};

registerForgeBlock(block);
export default block;
