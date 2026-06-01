#!/usr/bin/env node
/*
 * Black-&-white reskin generator (self-contained, no Twenty/Nx toolchain required).
 *
 * Rewrites every chromatic color value in the ACTIVE CSS-variable theme files
 * (theme-light.css / theme-dark.css) to a luminance-preserving neutral gray using
 * Rec.709 luma (0.2126R + 0.7152G + 0.0722B). Handles:
 *   - color(display-p3 R G B [/ a])   (Radix P3 form, with optional alpha)
 *   - #rgb / #rgba / #rrggbb / #rrggbbaa
 *   - rgb(...) / rgba(...)
 *   - hsl(...) / hsla(...)
 * Alpha is preserved. Backgrounds/text/border STRUCTURE is untouched — only hue is
 * removed (each color becomes a gray of the same perceived lightness). Non-color
 * tokens (px sizes, durations, font families, the base64 noise data URL, gradients'
 * geometry, blur/saturate filters) are left intact; only the color tokens inside them
 * are converted.
 *
 * Usage:
 *   node packages/twenty-ui/scripts/generateGrayscaleTheme.cjs
 *   node packages/twenty-ui/scripts/generateGrayscaleTheme.cjs --check   (verify only, exit 1 if chromatic values remain)
 */

const fs = require('fs');
const path = require('path');

const REC_709_R = 0.2126;
const REC_709_G = 0.7152;
const REC_709_B = 0.0722;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const round3 = (v) => Math.round(v * 1000) / 1000;
const luma = (r, g, b) => clamp01(REC_709_R * r + REC_709_G * g + REC_709_B * b);

const parseUnit = (raw) => {
  const t = raw.trim();
  if (t.endsWith('%')) return clamp01(parseFloat(t) / 100);
  return clamp01(parseFloat(t));
};
const parseByte = (raw) => clamp01(parseInt(raw, 10) / 255);
const toByte = (v01) => Math.round(v01 * 255);

const hslToRgb = (h, s, l) => {
  if (s === 0) return [l, l, l];
  const f = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)];
};

// --- per-form converters (return null when not a color of that form) ---

const convertP3 = (full) =>
  full.replace(/color\(\s*display-p3\s+([^)]+?)\)/gi, (match, inside) => {
    const [rgbPart, alphaPart] = inside.split('/');
    const ch = rgbPart.trim().split(/\s+/);
    if (ch.length < 3) return match;
    const r = parseUnit(ch[0]);
    const g = parseUnit(ch[1]);
    const b = parseUnit(ch[2]);
    const gray = round3(luma(r, g, b));
    const alpha = alphaPart !== undefined ? ` / ${alphaPart.trim()}` : '';
    return `color(display-p3 ${gray} ${gray} ${gray}${alpha})`;
  });

const convertRgb = (full) =>
  full.replace(/rgba?\(\s*([^)]+)\)/gi, (match, inside) => {
    const parts = inside.split(/[,/]/).map((p) => p.trim());
    if (parts.length < 3) return match;
    // bail out if any of first three are not numeric (e.g. var(--x))
    if (parts.slice(0, 3).some((p) => Number.isNaN(parseFloat(p)))) return match;
    const r = parseByte(parts[0]);
    const g = parseByte(parts[1]);
    const b = parseByte(parts[2]);
    const gray = toByte(luma(r, g, b));
    const alpha = parts[3];
    return alpha !== undefined
      ? `rgba(${gray}, ${gray}, ${gray}, ${alpha})`
      : `rgb(${gray}, ${gray}, ${gray})`;
  });

const convertHsl = (full) =>
  full.replace(/hsla?\(\s*([^)]+)\)/gi, (match, inside) => {
    const parts = inside.split(/[,/]/).map((p) => p.trim());
    if (parts.length < 3) return match;
    const h = (parseFloat(parts[0]) % 360) / 360;
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    if ([h, s, l].some((n) => Number.isNaN(n))) return match;
    const [r, g, b] = hslToRgb(h, s, l);
    const gray = toByte(luma(r, g, b));
    const alpha = parts[3];
    return alpha !== undefined
      ? `rgba(${gray}, ${gray}, ${gray}, ${alpha})`
      : `rgb(${gray}, ${gray}, ${gray})`;
  });

// Hex: convert standalone hex color tokens. Skip anything inside a data: URL.
const convertHex = (full) =>
  full.replace(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g, (match, hex) => {
    let r, g, b, alphaHex = '';
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16) / 255;
      g = parseInt(hex[1] + hex[1], 16) / 255;
      b = parseInt(hex[2] + hex[2], 16) / 255;
      if (hex.length === 4) alphaHex = hex[3] + hex[3];
    } else {
      r = parseInt(hex.slice(0, 2), 16) / 255;
      g = parseInt(hex.slice(2, 4), 16) / 255;
      b = parseInt(hex.slice(4, 6), 16) / 255;
      if (hex.length === 8) alphaHex = hex.slice(6, 8);
    }
    const grayByte = toByte(luma(r, g, b));
    const grayHex = grayByte.toString(16).padStart(2, '0');
    return `#${grayHex}${grayHex}${grayHex}${alphaHex}`;
  });

// Protect base64 data URLs (the noise PNG) from hex conversion by masking them out.
const withDataUrlsMasked = (content, fn) => {
  const masks = [];
  const masked = content.replace(/url\(data:[^)]*\)/gi, (m) => {
    const token = `__DATA_URL_MASK_${masks.length}__`;
    masks.push(m);
    return token;
  });
  const processed = fn(masked);
  return processed.replace(/__DATA_URL_MASK_(\d+)__/g, (_, i) => masks[Number(i)]);
};

const grayscaleCss = (content) =>
  withDataUrlsMasked(content, (masked) => {
    let out = masked;
    out = convertP3(out);
    out = convertRgb(out);
    out = convertHsl(out);
    out = convertHex(out);
    return out;
  });

// --- chromatic detection for verification ---

const isChromaticP3 = (content) => {
  const matches = content.match(/color\(\s*display-p3\s+([^)]+?)\)/gi) || [];
  return matches.filter((m) => {
    const inside = m.replace(/color\(\s*display-p3\s+/i, '').replace(/\)$/, '');
    const ch = inside.split('/')[0].trim().split(/\s+/);
    if (ch.length < 3) return false;
    const [r, g, b] = ch.map(parseUnit);
    return Math.abs(r - g) > 0.001 || Math.abs(g - b) > 0.001 || Math.abs(r - b) > 0.001;
  });
};

const isChromaticHex = (content) => {
  const masked = content.replace(/url\(data:[^)]*\)/gi, '');
  const matches = masked.match(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g) || [];
  return matches.filter((m) => {
    const hex = m.slice(1);
    let r, g, b;
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    return r !== g || g !== b || r !== b;
  });
};

const isChromaticRgbHsl = (content) => {
  const found = [];
  const scan = (re, parseFns) => {
    let m;
    while ((m = re.exec(content)) !== null) {
      const parts = m[1].split(/[,/]/).map((p) => p.trim());
      if (parts.length < 3) continue;
      const [r, g, b] = parseFns(parts);
      if ([r, g, b].some((n) => Number.isNaN(n))) continue;
      if (Math.abs(r - g) > 0.5 || Math.abs(g - b) > 0.5 || Math.abs(r - b) > 0.5) {
        found.push(m[0]);
      }
    }
  };
  scan(/rgba?\(\s*([^)]+)\)/gi, (p) => [parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2])]);
  scan(/hsla?\(\s*([^)]+)\)/gi, (p) => {
    const h = (parseFloat(p[0]) % 360) / 360;
    const s = parseFloat(p[1]) / 100;
    const l = parseFloat(p[2]) / 100;
    if ([h, s, l].some((n) => Number.isNaN(n))) return [NaN, NaN, NaN];
    const [r, g, b] = hslToRgb(h, s, l);
    return [r * 255, g * 255, b * 255];
  });
  return found;
};

const findChromatic = (content) => [
  ...isChromaticP3(content),
  ...isChromaticHex(content),
  ...isChromaticRgbHsl(content),
];

// --- main ---

// Default targets are the source CSS-variable theme files. Explicit file
// paths may be passed as positional args (e.g. the built dist/*.css) so the
// same luminance transform can be applied to stale build artifacts before a
// full rebuild regenerates them from the now-grayscale source.
const DEFAULT_TARGETS = [
  path.resolve(__dirname, '..', 'src', 'theme-constants', 'theme-light.css'),
  path.resolve(__dirname, '..', 'src', 'theme-constants', 'theme-dark.css'),
];

const checkOnly = process.argv.includes('--check');
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const TARGETS = positional.length
  ? positional.map((p) => path.resolve(process.cwd(), p))
  : DEFAULT_TARGETS;
let anyChromatic = false;

for (const file of TARGETS) {
  if (!fs.existsSync(file)) {
    console.error(`[grayscale] missing: ${file}`);
    process.exitCode = 1;
    continue;
  }
  const original = fs.readFileSync(file, 'utf8');

  if (checkOnly) {
    const remaining = findChromatic(original);
    if (remaining.length > 0) {
      anyChromatic = true;
      console.error(`[grayscale] CHROMATIC values remain in ${path.basename(file)} (${remaining.length}):`);
      console.error('  ' + remaining.slice(0, 10).join('\n  '));
    } else {
      console.log(`[grayscale] OK (no chromatic values): ${path.basename(file)}`);
    }
    continue;
  }

  const converted = grayscaleCss(original);
  fs.writeFileSync(file, converted, 'utf8');
  const remaining = findChromatic(converted);
  console.log(
    `[grayscale] rewrote ${path.basename(file)} — chromatic values remaining: ${remaining.length}`,
  );
  if (remaining.length > 0) {
    anyChromatic = true;
    console.error('  ' + remaining.slice(0, 10).join('\n  '));
  }
}

if (anyChromatic && checkOnly) process.exitCode = 1;
