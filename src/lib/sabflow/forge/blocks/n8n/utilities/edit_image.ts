/**
 * Forge block: EditImage
 *
 * Source: n8n-master/packages/nodes-base/nodes/EditImage/EditImage.node.ts
 *
 * Image manipulation backed by `sharp`. Every op pulls bytes from a
 * SabFile id (auth'd via the worker-safe Rust JWT minted from
 * `ctx.userId`), processes them in memory, and uploads the result back to
 * the same workspace's SabFile library.
 *
 * Why SabFiles in/out (instead of base64 in flow vars)?
 *   • Vercel Fluid Compute has no persistent disk and tight per-invocation
 *     payload limits; passing multi-MB base64 between blocks is slow and
 *     fragile.
 *   • SabFiles is the canonical storage layer for tenant-scoped binary
 *     content — the same surface every other media-aware feature uses.
 *   • Downstream blocks (Send Email, Read Binary File, etc.) already accept
 *     SabFile ids, so chaining stays consistent.
 *
 * Ops:
 *   resize-image, crop-image, rotate-image, blur-image, border-image,
 *   composite-image, add-text-overlay, draw-shape, transparent-color,
 *   shear-image, create-image, get-info, placeholder-create.
 */

import sharp from 'sharp';

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asBoolean, asNumber, asString } from '../_shared/http';

/* ── Rust BFF worker bridge ─────────────────────────────────────────────── */

async function rustWorkerFetch<T>(
  ctx: ForgeActionContext,
  path: string,
  init: RequestInit = { method: 'GET' },
): Promise<T> {
  if (!ctx.userId) {
    throw new Error('EditImage: ctx.userId missing — cannot mint Rust JWT.');
  }
  const { issueRustJwt } = await import('@/lib/jwt-for-rust');
  const token = await issueRustJwt({
    userId: ctx.userId,
    tenantId: ctx.userId,
    roles: [],
  });
  const base = process.env.RUST_API_URL || 'http://localhost:8080';
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  const res = await fetch(`${base}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.text();
      detail = body.length > 300 ? `${body.slice(0, 300)}…` : body;
    } catch {
      /* ignore */
    }
    throw new Error(`EditImage: Rust BFF ${res.status} ${res.statusText} — ${detail}`);
  }
  return (await res.json()) as T;
}

async function loadSabfile(ctx: ForgeActionContext, id: string): Promise<Buffer> {
  const { url } = await rustWorkerFetch<{ url: string }>(
    ctx,
    `/v1/sabfiles/nodes/${encodeURIComponent(id)}/download`,
  );
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`EditImage: SabFile ${id} fetch failed (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

type UploadedSabfile = {
  id: string;
  name: string;
  size: number;
  mime: string;
  parentId: string | null;
  createdAt: string;
};

async function uploadSabfile(
  ctx: ForgeActionContext,
  name: string,
  buf: Buffer,
  contentType: string,
  folderId: string,
): Promise<UploadedSabfile> {
  const size = buf.length;

  type PresignResponse = {
    upload_url: string;
    key: string;
    method: string;
    headers: Record<string, string>;
    expires_in: number;
  };
  const presign = await rustWorkerFetch<PresignResponse>(ctx, '/v1/sabfiles/upload/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, size, mime: contentType, parent_id: folderId || null }),
  });

  const uploadHeaders = new Headers(presign.headers ?? {});
  if (!uploadHeaders.has('Content-Type')) uploadHeaders.set('Content-Type', contentType);
  const uploadRes = await fetch(presign.upload_url, {
    method: (presign.method || 'PUT').toUpperCase(),
    headers: uploadHeaders,
    body: new Uint8Array(buf),
  });
  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(() => '');
    const clip = txt.length > 300 ? `${txt.slice(0, 300)}…` : txt;
    throw new Error(
      `EditImage: R2 upload failed (${uploadRes.status} ${uploadRes.statusText}): ${clip}`,
    );
  }

  type ConfirmResponse = {
    node: {
      id: string;
      name: string;
      size?: number;
      mime?: string;
      parentId: string | null;
      createdAt: string;
    };
  };
  const confirmed = await rustWorkerFetch<ConfirmResponse>(ctx, '/v1/sabfiles/upload/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: presign.key,
      name,
      size,
      mime: contentType,
      parent_id: folderId || null,
    }),
  });

  return {
    id: confirmed.node.id,
    name: confirmed.node.name,
    size: confirmed.node.size ?? size,
    mime: confirmed.node.mime ?? contentType,
    parentId: confirmed.node.parentId,
    createdAt: confirmed.node.createdAt,
  };
}

/* ── sharp helpers ─────────────────────────────────────────────────────── */

type OutputFormat = 'png' | 'jpeg' | 'webp' | 'avif';

const FORMAT_MIME: Record<OutputFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
};

function pickFormat(ctx: ForgeActionContext, fallback: OutputFormat = 'png'): OutputFormat {
  const raw = asString(ctx.options.outputFormat).toLowerCase();
  if (raw === 'jpeg' || raw === 'jpg') return 'jpeg';
  if (raw === 'png' || raw === 'webp' || raw === 'avif') return raw;
  return fallback;
}

function encode(img: sharp.Sharp, format: OutputFormat, quality?: number): sharp.Sharp {
  // Default JPEG/WebP/AVIF quality matches sharp's own default (80) but is
  // tunable per-op so callers can trade size for fidelity.
  const q = quality ?? 90;
  switch (format) {
    case 'png':
      return img.png();
    case 'jpeg':
      return img.jpeg({ quality: q });
    case 'webp':
      return img.webp({ quality: q });
    case 'avif':
      return img.avif({ quality: q });
  }
}

function outputName(base: string, suffix: string, format: OutputFormat): string {
  const trimmed = base.replace(/\.[^./\\]+$/, '');
  const stem = trimmed || 'image';
  return `${stem}-${suffix}.${format}`;
}

async function emit(
  ctx: ForgeActionContext,
  pipeline: sharp.Sharp,
  suffix: string,
  logLine: string,
): Promise<ForgeActionResult> {
  const format = pickFormat(ctx);
  const quality = asNumber(ctx.options.quality);
  const folderId = asString(ctx.options.outputFolderId).trim();
  const explicitName = asString(ctx.options.outputName).trim();
  const sourceName = asString(ctx.options.sourceName).trim() || 'image';

  const buf = await encode(pipeline, format, quality).toBuffer();
  const name = explicitName || outputName(sourceName, suffix, format);
  const node = await uploadSabfile(ctx, name, buf, FORMAT_MIME[format], folderId);

  return {
    outputs: {
      id: node.id,
      name: node.name,
      size: node.size,
      mime: node.mime,
      format,
      bytes: buf.length,
    },
    logs: [logLine],
  };
}

function requireFileId(ctx: ForgeActionContext): string {
  const id = asString(ctx.options.fileId).trim();
  if (!id) throw new Error('EditImage: fileId is required');
  return id;
}

/* ── Common output fields (resize, blur, etc. share these) ─────────────── */

const OUTPUT_FIELDS = [
  {
    id: 'outputFormat',
    label: 'Output format',
    type: 'select' as const,
    defaultValue: 'png',
    options: [
      { label: 'PNG', value: 'png' },
      { label: 'JPEG', value: 'jpeg' },
      { label: 'WebP', value: 'webp' },
      { label: 'AVIF', value: 'avif' },
    ],
  },
  {
    id: 'quality',
    label: 'Quality (1-100, lossy formats)',
    type: 'number' as const,
    defaultValue: 90,
  },
  {
    id: 'outputName',
    label: 'Output file name (optional)',
    type: 'text' as const,
    placeholder: 'Auto-derived from source if blank',
  },
  {
    id: 'outputFolderId',
    label: 'Output folder ID (optional)',
    type: 'text' as const,
    placeholder: 'Leave blank for root',
  },
  {
    id: 'sourceName',
    label: 'Source file name hint (optional)',
    type: 'text' as const,
    placeholder: 'Used when auto-naming the output',
  },
];

const SOURCE_FIELD = {
  id: 'fileId',
  label: 'Source SabFile id',
  type: 'text' as const,
  required: true,
  placeholder: 'sf_…',
};

/* ── Operations ────────────────────────────────────────────────────────── */

async function resizeImage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireFileId(ctx);
  const width = asNumber(ctx.options.width);
  const height = asNumber(ctx.options.height);
  const fit = (asString(ctx.options.fit) || 'cover') as keyof sharp.FitEnum;
  if (!width && !height) throw new Error('EditImage resize: width or height is required');

  const input = await loadSabfile(ctx, id);
  const pipeline = sharp(input).resize({ width, height, fit, withoutEnlargement: false });
  return emit(ctx, pipeline, 'resized', `EditImage resize → ${width ?? '?'}×${height ?? '?'} (${fit})`);
}

async function cropImage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireFileId(ctx);
  const left = asNumber(ctx.options.left) ?? 0;
  const top = asNumber(ctx.options.top) ?? 0;
  const width = asNumber(ctx.options.width);
  const height = asNumber(ctx.options.height);
  if (!width || !height) throw new Error('EditImage crop: width and height are required');

  const input = await loadSabfile(ctx, id);
  const pipeline = sharp(input).extract({ left, top, width, height });
  return emit(
    ctx,
    pipeline,
    'cropped',
    `EditImage crop → ${width}×${height} @ (${left},${top})`,
  );
}

async function rotateImage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireFileId(ctx);
  const angle = asNumber(ctx.options.angle) ?? 0;
  const background = asString(ctx.options.background) || '#00000000';

  const input = await loadSabfile(ctx, id);
  const pipeline = sharp(input).rotate(angle, { background });
  return emit(ctx, pipeline, 'rotated', `EditImage rotate → ${angle}°`);
}

async function blurImage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireFileId(ctx);
  // sharp's blur sigma must be ≥ 0.3; clamp anything smaller to that floor.
  const sigma = Math.max(0.3, asNumber(ctx.options.sigma) ?? 3);

  const input = await loadSabfile(ctx, id);
  const pipeline = sharp(input).blur(sigma);
  return emit(ctx, pipeline, 'blurred', `EditImage blur → σ=${sigma}`);
}

async function borderImage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireFileId(ctx);
  const borderWidth = asNumber(ctx.options.borderWidth) ?? 10;
  const borderHeight = asNumber(ctx.options.borderHeight) ?? borderWidth;
  const color = asString(ctx.options.borderColor) || '#000000';

  const input = await loadSabfile(ctx, id);
  const pipeline = sharp(input).extend({
    top: borderHeight,
    bottom: borderHeight,
    left: borderWidth,
    right: borderWidth,
    background: color,
  });
  return emit(
    ctx,
    pipeline,
    'bordered',
    `EditImage border → ${borderWidth}×${borderHeight} ${color}`,
  );
}

async function compositeImage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const baseId = requireFileId(ctx);
  const overlayId = asString(ctx.options.overlayFileId).trim();
  if (!overlayId) throw new Error('EditImage composite: overlayFileId is required');
  const left = asNumber(ctx.options.positionX) ?? 0;
  const top = asNumber(ctx.options.positionY) ?? 0;
  const opacity = Math.min(1, Math.max(0, asNumber(ctx.options.opacity) ?? 1));

  const [base, overlay] = await Promise.all([
    loadSabfile(ctx, baseId),
    loadSabfile(ctx, overlayId),
  ]);

  // Pre-multiply overlay by `opacity` since `sharp.composite` has no direct
  // opacity field — easiest path is to bake alpha into the overlay buffer.
  let overlayBuf = overlay;
  if (opacity < 1) {
    overlayBuf = await sharp(overlay)
      .ensureAlpha()
      .composite([
        {
          input: Buffer.from([255, 255, 255, Math.round(255 * opacity)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer();
  }

  const pipeline = sharp(base).composite([{ input: overlayBuf, left, top }]);
  return emit(
    ctx,
    pipeline,
    'composited',
    `EditImage composite → overlay ${overlayId} @ (${left},${top}) α=${opacity}`,
  );
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&apos;',
  );
}

async function addTextOverlay(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireFileId(ctx);
  const text = asString(ctx.options.text);
  if (!text) throw new Error('EditImage text: text is required');
  const fontSize = asNumber(ctx.options.fontSize) ?? 32;
  const fontColor = asString(ctx.options.fontColor) || '#ffffff';
  const positionX = asNumber(ctx.options.positionX) ?? 10;
  const positionY = asNumber(ctx.options.positionY) ?? fontSize + 10;
  const fontFamily = asString(ctx.options.fontFamily) || 'sans-serif';

  const input = await loadSabfile(ctx, id);
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  // SVG overlay is the portable way to draw text with sharp without
  // requiring a system font installer (works in serverless cold-starts).
  const svg = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<text x="${positionX}" y="${positionY}" font-size="${fontSize}" ` +
      `font-family="${escapeXml(fontFamily)}" fill="${escapeXml(fontColor)}">` +
      escapeXml(text) +
      `</text></svg>`,
  );

  const pipeline = sharp(input).composite([{ input: svg, top: 0, left: 0 }]);
  return emit(ctx, pipeline, 'text', `EditImage text → "${text.slice(0, 40)}"`);
}

async function drawShape(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireFileId(ctx);
  const shape = asString(ctx.options.shape).toLowerCase() || 'rectangle';
  const color = asString(ctx.options.color) || '#ff0000';
  const x1 = asNumber(ctx.options.startPositionX) ?? 0;
  const y1 = asNumber(ctx.options.startPositionY) ?? 0;
  const x2 = asNumber(ctx.options.endPositionX) ?? 100;
  const y2 = asNumber(ctx.options.endPositionY) ?? 100;
  const radius = asNumber(ctx.options.cornerRadius) ?? 0;
  const stroke = asNumber(ctx.options.strokeWidth) ?? 2;

  const input = await loadSabfile(ctx, id);
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const safeColor = escapeXml(color);

  let body = '';
  if (shape === 'rectangle') {
    const rx = x1,
      ry = y1,
      rw = Math.max(0, x2 - x1),
      rh = Math.max(0, y2 - y1);
    body = `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="${radius}" ry="${radius}" fill="${safeColor}" />`;
  } else if (shape === 'circle') {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const r = Math.max(0, Math.hypot(x2 - x1, y2 - y1) / 2);
    body = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${safeColor}" />`;
  } else if (shape === 'line') {
    body = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${safeColor}" stroke-width="${stroke}" />`;
  } else {
    throw new Error(`EditImage draw: unknown shape "${shape}"`);
  }

  const svg = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
  );
  const pipeline = sharp(input).composite([{ input: svg, top: 0, left: 0 }]);
  return emit(ctx, pipeline, `${shape}`, `EditImage draw → ${shape} ${safeColor}`);
}

/** Parse `#rrggbb` / `rrggbb` → `[r,g,b]`. Returns null on parse failure. */
function parseHexRgb(s: string): [number, number, number] | null {
  const m = s.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

async function transparentColor(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireFileId(ctx);
  const target = asString(ctx.options.targetColor) || '#ffffff';
  const tolerance = Math.min(255, Math.max(0, asNumber(ctx.options.tolerance) ?? 10));
  const rgb = parseHexRgb(target);
  if (!rgb) throw new Error('EditImage transparent: targetColor must be #rrggbb');

  const input = await loadSabfile(ctx, id);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Walk the raw RGBA buffer and zero alpha where each channel is within
  // `tolerance` of the target — sharp has no built-in "color → alpha", so
  // we patch the buffer ourselves before re-encoding.
  const { width, height, channels } = info;
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += channels) {
    if (
      Math.abs(out[i] - rgb[0]) <= tolerance &&
      Math.abs(out[i + 1] - rgb[1]) <= tolerance &&
      Math.abs(out[i + 2] - rgb[2]) <= tolerance
    ) {
      out[i + 3] = 0;
    }
  }

  const pipeline = sharp(out, { raw: { width, height, channels } });
  return emit(
    ctx,
    pipeline,
    'transparent',
    `EditImage transparent → ${target} ±${tolerance}`,
  );
}

async function shearImage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireFileId(ctx);
  // sharp.affine takes a 2×2 matrix; shear is `[[1, shx], [shy, 1]]`.
  const shx = asNumber(ctx.options.degreesX) ?? 0;
  const shy = asNumber(ctx.options.degreesY) ?? 0;
  const tanX = Math.tan((shx * Math.PI) / 180);
  const tanY = Math.tan((shy * Math.PI) / 180);

  const input = await loadSabfile(ctx, id);
  const pipeline = sharp(input).affine([
    [1, tanX],
    [tanY, 1],
  ]);
  return emit(ctx, pipeline, 'sheared', `EditImage shear → x=${shx}° y=${shy}°`);
}

async function createImage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const width = asNumber(ctx.options.width) ?? 600;
  const height = asNumber(ctx.options.height) ?? 400;
  const background = asString(ctx.options.backgroundColor) || '#ffffff';

  const pipeline = sharp({
    create: {
      width,
      height,
      channels: 4,
      background,
    },
  });
  return emit(ctx, pipeline, `${width}x${height}`, `EditImage create → ${width}×${height} ${background}`);
}

async function getInfo(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireFileId(ctx);
  const input = await loadSabfile(ctx, id);
  const meta = await sharp(input).metadata();
  return {
    outputs: {
      id,
      width: meta.width ?? null,
      height: meta.height ?? null,
      format: meta.format ?? null,
      channels: meta.channels ?? null,
      space: meta.space ?? null,
      density: meta.density ?? null,
      hasAlpha: meta.hasAlpha ?? false,
      bytes: input.length,
    },
    logs: [`EditImage info → ${meta.width}×${meta.height} ${meta.format}`],
  };
}

async function placeholderCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  // Local sharp render so the block doesn't rely on a third-party
  // (dummyimage.com) and can run inside a sandboxed worker without
  // outbound HTTP. Falls back to plain colour fill + centered text.
  const width = asNumber(ctx.options.width) ?? 600;
  const height = asNumber(ctx.options.height) ?? 400;
  const bg = (asString(ctx.options.background) || 'cccccc').replace(/^#/, '');
  const fg = (asString(ctx.options.foreground) || '000000').replace(/^#/, '');
  const text = asString(ctx.options.text) || `${width}×${height}`;
  const fontSize = Math.max(12, Math.round(Math.min(width, height) / 8));
  const safeBg = `#${bg}`;
  const safeFg = `#${fg}`;

  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="${safeBg}"/>` +
      `<text x="50%" y="50%" font-size="${fontSize}" fill="${safeFg}" ` +
      `text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">` +
      escapeXml(text) +
      `</text></svg>`,
  );

  const pipeline = sharp(svg);
  return emit(
    ctx,
    pipeline,
    `placeholder-${width}x${height}`,
    `EditImage placeholder → ${width}×${height}`,
  );
}

/* ── Block schema ──────────────────────────────────────────────────────── */

const block: ForgeBlock = {
  id: 'forge_edit_image',
  name: 'Edit Image',
  description: 'Image manipulation (resize, crop, rotate, blur, composite, text, draw) via sharp + SabFiles.',
  iconName: 'LuImage',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'resize-image',
      label: 'Resize image',
      description: 'Resize a SabFile image to the given dimensions.',
      fields: [
        SOURCE_FIELD,
        { id: 'width', label: 'Width', type: 'number' },
        { id: 'height', label: 'Height', type: 'number' },
        {
          id: 'fit',
          label: 'Fit',
          type: 'select',
          defaultValue: 'cover',
          options: [
            { label: 'cover', value: 'cover' },
            { label: 'contain', value: 'contain' },
            { label: 'fill', value: 'fill' },
            { label: 'inside', value: 'inside' },
            { label: 'outside', value: 'outside' },
          ],
        },
        ...OUTPUT_FIELDS,
      ],
      run: resizeImage,
    },
    {
      id: 'crop-image',
      label: 'Crop image',
      description: 'Extract a rectangle from a SabFile image.',
      fields: [
        SOURCE_FIELD,
        { id: 'left', label: 'Left', type: 'number', defaultValue: 0 },
        { id: 'top', label: 'Top', type: 'number', defaultValue: 0 },
        { id: 'width', label: 'Width', type: 'number', required: true },
        { id: 'height', label: 'Height', type: 'number', required: true },
        ...OUTPUT_FIELDS,
      ],
      run: cropImage,
    },
    {
      id: 'rotate-image',
      label: 'Rotate image',
      description: 'Rotate a SabFile image by a given angle.',
      fields: [
        SOURCE_FIELD,
        { id: 'angle', label: 'Angle (degrees)', type: 'number', defaultValue: 90 },
        { id: 'background', label: 'Fill background', type: 'text', placeholder: '#00000000' },
        ...OUTPUT_FIELDS,
      ],
      run: rotateImage,
    },
    {
      id: 'blur-image',
      label: 'Blur image',
      description: 'Gaussian blur a SabFile image (sigma ≥ 0.3).',
      fields: [
        SOURCE_FIELD,
        { id: 'sigma', label: 'Sigma', type: 'number', defaultValue: 3 },
        ...OUTPUT_FIELDS,
      ],
      run: blurImage,
    },
    {
      id: 'border-image',
      label: 'Add border',
      description: 'Extend a SabFile image with a solid-colour border.',
      fields: [
        SOURCE_FIELD,
        { id: 'borderWidth', label: 'Border width (px, left+right)', type: 'number', defaultValue: 10 },
        { id: 'borderHeight', label: 'Border height (px, top+bottom)', type: 'number', defaultValue: 10 },
        { id: 'borderColor', label: 'Border colour', type: 'text', defaultValue: '#000000' },
        ...OUTPUT_FIELDS,
      ],
      run: borderImage,
    },
    {
      id: 'composite-image',
      label: 'Composite overlay',
      description: 'Place a second SabFile image on top of a base SabFile image at (x, y).',
      fields: [
        SOURCE_FIELD,
        { id: 'overlayFileId', label: 'Overlay SabFile id', type: 'text', required: true },
        { id: 'positionX', label: 'Overlay X', type: 'number', defaultValue: 0 },
        { id: 'positionY', label: 'Overlay Y', type: 'number', defaultValue: 0 },
        { id: 'opacity', label: 'Overlay opacity (0-1)', type: 'number', defaultValue: 1 },
        ...OUTPUT_FIELDS,
      ],
      run: compositeImage,
    },
    {
      id: 'add-text-overlay',
      label: 'Add text overlay',
      description: 'Draw text on top of a SabFile image (SVG overlay).',
      fields: [
        SOURCE_FIELD,
        { id: 'text', label: 'Text', type: 'text', required: true },
        { id: 'fontSize', label: 'Font size', type: 'number', defaultValue: 32 },
        { id: 'fontColor', label: 'Font colour', type: 'text', defaultValue: '#ffffff' },
        { id: 'fontFamily', label: 'Font family', type: 'text', defaultValue: 'sans-serif' },
        { id: 'positionX', label: 'X position', type: 'number', defaultValue: 10 },
        { id: 'positionY', label: 'Y position (baseline)', type: 'number', defaultValue: 40 },
        ...OUTPUT_FIELDS,
      ],
      run: addTextOverlay,
    },
    {
      id: 'draw-shape',
      label: 'Draw shape',
      description: 'Draw a rectangle, circle or line on top of a SabFile image.',
      fields: [
        SOURCE_FIELD,
        {
          id: 'shape',
          label: 'Shape',
          type: 'select',
          defaultValue: 'rectangle',
          options: [
            { label: 'Rectangle', value: 'rectangle' },
            { label: 'Circle', value: 'circle' },
            { label: 'Line', value: 'line' },
          ],
        },
        { id: 'color', label: 'Fill / stroke colour', type: 'text', defaultValue: '#ff0000' },
        { id: 'startPositionX', label: 'Start X', type: 'number', defaultValue: 0 },
        { id: 'startPositionY', label: 'Start Y', type: 'number', defaultValue: 0 },
        { id: 'endPositionX', label: 'End X', type: 'number', defaultValue: 100 },
        { id: 'endPositionY', label: 'End Y', type: 'number', defaultValue: 100 },
        { id: 'cornerRadius', label: 'Corner radius (rectangle)', type: 'number', defaultValue: 0 },
        { id: 'strokeWidth', label: 'Stroke width (line)', type: 'number', defaultValue: 2 },
        ...OUTPUT_FIELDS,
      ],
      run: drawShape,
    },
    {
      id: 'transparent-color',
      label: 'Make colour transparent',
      description: 'Zero the alpha channel wherever pixels match a target colour within a tolerance.',
      fields: [
        SOURCE_FIELD,
        { id: 'targetColor', label: 'Target colour (#rrggbb)', type: 'text', defaultValue: '#ffffff' },
        { id: 'tolerance', label: 'Tolerance (0-255)', type: 'number', defaultValue: 10 },
        ...OUTPUT_FIELDS,
      ],
      run: transparentColor,
    },
    {
      id: 'shear-image',
      label: 'Shear image',
      description: 'Apply an affine shear in degrees on X and/or Y axis.',
      fields: [
        SOURCE_FIELD,
        { id: 'degreesX', label: 'Shear X (degrees)', type: 'number', defaultValue: 0 },
        { id: 'degreesY', label: 'Shear Y (degrees)', type: 'number', defaultValue: 0 },
        ...OUTPUT_FIELDS,
      ],
      run: shearImage,
    },
    {
      id: 'create-image',
      label: 'Create blank image',
      description: 'Create a new solid-colour image at the given dimensions and upload it to SabFiles.',
      fields: [
        { id: 'width', label: 'Width', type: 'number', defaultValue: 600 },
        { id: 'height', label: 'Height', type: 'number', defaultValue: 400 },
        { id: 'backgroundColor', label: 'Background colour', type: 'text', defaultValue: '#ffffff' },
        ...OUTPUT_FIELDS,
      ],
      run: createImage,
    },
    {
      id: 'get-info',
      label: 'Get image info',
      description: 'Return width / height / format / channels / alpha metadata for a SabFile image.',
      fields: [SOURCE_FIELD],
      run: getInfo,
    },
    {
      id: 'placeholder-create',
      label: 'Create placeholder image',
      description: 'Render a coloured rectangle with centered text (locally via sharp) and store as a SabFile.',
      fields: [
        { id: 'width', label: 'Width', type: 'number', defaultValue: 600 },
        { id: 'height', label: 'Height', type: 'number', defaultValue: 400 },
        { id: 'background', label: 'Background hex (no #)', type: 'text', defaultValue: 'cccccc' },
        { id: 'foreground', label: 'Foreground hex (no #)', type: 'text', defaultValue: '000000' },
        { id: 'text', label: 'Text overlay', type: 'text' },
        ...OUTPUT_FIELDS,
      ],
      run: placeholderCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
