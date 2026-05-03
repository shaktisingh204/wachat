/**
 * Template-driven programmatic SEO. Each row of `dataset` is interpolated
 * into a `template`, producing a `ProgrammaticPage`. Slugs are slugified
 * and de-duplicated.
 */
import type { ProgrammaticPage, Schema } from './types';

export type PageTemplate = {
  /** Template strings using `{{field}}` interpolation. */
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  body: string;
  /** Optional schema generator that runs per row. */
  schema?: (row: Record<string, unknown>) => Schema | Schema[] | null | undefined;
};

export type GeneratePagesOptions = {
  /** Skip rows that would produce duplicate slugs. */
  dedupe?: boolean;
};

export function generatePages(
  template: PageTemplate,
  dataset: Record<string, unknown>[],
  opts: GeneratePagesOptions = {},
): ProgrammaticPage[] {
  const dedupe = opts.dedupe ?? true;
  const seen = new Set<string>();
  const out: ProgrammaticPage[] = [];

  for (const row of dataset) {
    const slug = slugify(interpolate(template.slug, row));
    if (!slug) continue;
    if (dedupe && seen.has(slug)) continue;
    seen.add(slug);

    const schema = template.schema?.(row);
    const schemaList = schema ? (Array.isArray(schema) ? schema : [schema]) : undefined;

    out.push({
      slug,
      title: interpolate(template.title, row),
      metaDescription: interpolate(template.metaDescription, row),
      h1: interpolate(template.h1, row),
      body: interpolate(template.body, row),
      schema: schemaList,
      data: row,
    });
  }
  return out;
}

/**
 * Tiny `{{field}}` interpolator. Missing fields render as empty strings.
 * Supports nested paths via dot notation: `{{user.name}}`.
 */
export function interpolate(template: string, row: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const v = getPath(row, path);
    return v == null ? '' : String(v);
  });
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
