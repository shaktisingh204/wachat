/**
 * Twenty colour palette resolution.
 *
 * SabCRM SELECT/MULTI_SELECT field options and tags store a colour as one of:
 *   - a bare Twenty palette name (`'turquoise'`, `'sky'`, …) — the schema form,
 *   - a `--zoru-*` CSS custom-property token — the settings-UI form,
 *   - a literal `#hex` / `rgb(...)` value.
 *
 * `resolveTwentyColor` maps any of these to a paintable CSS colour so chips and
 * dropdown dots render the right swatch. The hexes mirror the canonical
 * `TAG_PALETTE` in `dashboard/settings/crm/tags`.
 */

export const TWENTY_PALETTE: Readonly<Record<string, string>> = {
  green: '#3dab5a',
  turquoise: '#21b8a6',
  sky: '#5db4e3',
  blue: '#3b7ae4',
  purple: '#9b51e0',
  pink: '#e052b0',
  red: '#e0484e',
  orange: '#f0883e',
  yellow: '#e0c64a',
  gray: '#8c8c8c',
  grey: '#8c8c8c',
};

/** Resolve a stored colour (name / token / hex) to a paintable CSS value. */
export function resolveTwentyColor(color?: string | null): string | undefined {
  if (!color) return undefined;
  if (color.startsWith('#') || color.startsWith('rgb')) return color;
  if (color.startsWith('--')) return `var(${color})`;
  const key = color.toLowerCase();
  return TWENTY_PALETTE[key];
}
