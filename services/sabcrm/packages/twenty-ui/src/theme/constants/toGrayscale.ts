// Black-&-white reskin helper.
// Converts any color string (hex, rgb/rgba, hsl, or Radix `color(display-p3 R G B / a)`)
// to a luminance-preserving neutral gray using Rec.709 luma (0.2126R + 0.7152G + 0.0722B).
// Alpha and the original color space wrapper are preserved so structure (opacity, layering)
// stays intact while hue is removed.

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const round = (value: number): number => Math.round(value * 1000) / 1000;

const REC_709_R = 0.2126;
const REC_709_G = 0.7152;
const REC_709_B = 0.0722;

const luma = (r: number, g: number, b: number): number =>
  clamp01(REC_709_R * r + REC_709_G * g + REC_709_B * b);

// sRGB 0..255 channel -> 0..1
const parseByte = (raw: string): number => clamp01(parseInt(raw, 10) / 255);

// p3 / unit channel: either 0..1 float or a percentage
const parseUnit = (raw: string): number => {
  const trimmed = raw.trim();
  if (trimmed.endsWith('%')) {
    return clamp01(parseFloat(trimmed) / 100);
  }
  return clamp01(parseFloat(trimmed));
};

const formatByte = (value01: number): number => Math.round(value01 * 255);

// HSL -> RGB (0..1)
const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  if (s === 0) {
    return [l, l, l];
  }
  const hueToRgb = (p: number, q: number, t: number): number => {
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
  return [
    hueToRgb(p, q, h + 1 / 3),
    hueToRgb(p, q, h),
    hueToRgb(p, q, h - 1 / 3),
  ];
};

export const toGrayscale = (color: string): string => {
  if (typeof color !== 'string') {
    return color;
  }

  const value = color.trim();

  // color(display-p3 R G B [/ a]) — Radix P3 form
  const p3Match = value.match(
    /^color\(\s*display-p3\s+([^)]+?)\)\s*$/i,
  );
  if (p3Match !== null) {
    const inside = p3Match[1];
    const [rgbPart, alphaPart] = inside.split('/');
    const channels = rgbPart.trim().split(/\s+/);
    if (channels.length >= 3) {
      const r = parseUnit(channels[0]);
      const g = parseUnit(channels[1]);
      const b = parseUnit(channels[2]);
      const gray = round(luma(r, g, b));
      const alphaSuffix =
        alphaPart !== undefined ? ` / ${alphaPart.trim()}` : '';
      return `color(display-p3 ${gray} ${gray} ${gray}${alphaSuffix})`;
    }
    return value;
  }

  // #rgb / #rgba / #rrggbb / #rrggbbaa
  const hexMatch = value.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hexMatch !== null) {
    const hex = hexMatch[1];
    let r = 0;
    let g = 0;
    let b = 0;
    let alphaHex = '';
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16) / 255;
      g = parseInt(hex[1] + hex[1], 16) / 255;
      b = parseInt(hex[2] + hex[2], 16) / 255;
      if (hex.length === 4) alphaHex = hex[3] + hex[3];
    } else if (hex.length === 6 || hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16) / 255;
      g = parseInt(hex.slice(2, 4), 16) / 255;
      b = parseInt(hex.slice(4, 6), 16) / 255;
      if (hex.length === 8) alphaHex = hex.slice(6, 8);
    } else {
      return value;
    }
    const grayByte = formatByte(luma(r, g, b));
    const grayHex = grayByte.toString(16).padStart(2, '0');
    return `#${grayHex}${grayHex}${grayHex}${alphaHex}`;
  }

  // rgb(...) / rgba(...)
  const rgbMatch = value.match(/^rgba?\(\s*([^)]+)\)\s*$/i);
  if (rgbMatch !== null) {
    const parts = rgbMatch[1].split(/[,/]/).map((part) => part.trim());
    if (parts.length >= 3) {
      const r = parseByte(parts[0]);
      const g = parseByte(parts[1]);
      const b = parseByte(parts[2]);
      const grayByte = formatByte(luma(r, g, b));
      const alpha = parts[3];
      return alpha !== undefined
        ? `rgba(${grayByte}, ${grayByte}, ${grayByte}, ${alpha})`
        : `rgb(${grayByte}, ${grayByte}, ${grayByte})`;
    }
    return value;
  }

  // hsl(...) / hsla(...)
  const hslMatch = value.match(/^hsla?\(\s*([^)]+)\)\s*$/i);
  if (hslMatch !== null) {
    const parts = hslMatch[1].split(/[,/]/).map((part) => part.trim());
    if (parts.length >= 3) {
      const h = (parseFloat(parts[0]) % 360) / 360;
      const s = parseFloat(parts[1]) / 100;
      const l = parseFloat(parts[2]) / 100;
      const [r, g, b] = hslToRgb(h, s, l);
      const grayByte = formatByte(luma(r, g, b));
      const alpha = parts[3];
      return alpha !== undefined
        ? `rgba(${grayByte}, ${grayByte}, ${grayByte}, ${alpha})`
        : `rgb(${grayByte}, ${grayByte}, ${grayByte})`;
    }
    return value;
  }

  // Unknown / non-color string — leave untouched
  return value;
};

// Maps every leaf string value of a flat color record through toGrayscale,
// preserving the exact key set and value type (string).
export const mapRecordToGrayscale = <TKey extends string>(
  record: Record<TKey, string>,
): Record<TKey, string> => {
  const result = {} as Record<TKey, string>;
  for (const key of Object.keys(record) as TKey[]) {
    result[key] = toGrayscale(record[key]);
  }
  return result;
};
