/**
 * JSON-LD schema.org generators. All functions return plain objects —
 * callers are responsible for serializing and embedding them.
 */
import type { Schema } from './types';

export type ArticleInput = {
  headline: string;
  description?: string;
  image?: string | string[];
  authorName?: string;
  authorUrl?: string;
  publisherName?: string;
  publisherLogo?: string;
  datePublished?: string;
  dateModified?: string;
  url?: string;
};

export function articleSchema(input: ArticleInput): Schema {
  return clean({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    image: input.image,
    author: input.authorName
      ? { '@type': 'Person', name: input.authorName, url: input.authorUrl }
      : undefined,
    publisher: input.publisherName
      ? {
          '@type': 'Organization',
          name: input.publisherName,
          logo: input.publisherLogo
            ? { '@type': 'ImageObject', url: input.publisherLogo }
            : undefined,
        }
      : undefined,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    mainEntityOfPage: input.url ? { '@type': 'WebPage', '@id': input.url } : undefined,
  }) as Schema;
}

export type ProductInput = {
  name: string;
  description?: string;
  image?: string | string[];
  sku?: string;
  brand?: string;
  price?: number;
  priceCurrency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  url?: string;
  ratingValue?: number;
  reviewCount?: number;
};

export function productSchema(input: ProductInput): Schema {
  return clean({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    image: input.image,
    sku: input.sku,
    brand: input.brand ? { '@type': 'Brand', name: input.brand } : undefined,
    offers:
      input.price != null
        ? {
            '@type': 'Offer',
            price: input.price,
            priceCurrency: input.priceCurrency ?? 'USD',
            availability: input.availability
              ? `https://schema.org/${input.availability}`
              : 'https://schema.org/InStock',
            url: input.url,
          }
        : undefined,
    aggregateRating:
      input.ratingValue != null && input.reviewCount != null
        ? {
            '@type': 'AggregateRating',
            ratingValue: input.ratingValue,
            reviewCount: input.reviewCount,
          }
        : undefined,
  }) as Schema;
}

export type FaqInput = { questions: { q: string; a: string }[] };

export function faqSchema(input: FaqInput): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: input.questions.map((qa) => ({
      '@type': 'Question',
      name: qa.q,
      acceptedAnswer: { '@type': 'Answer', text: qa.a },
    })),
  };
}

export type HowToStep = { name: string; text: string; image?: string; url?: string };
export type HowToInput = {
  name: string;
  description?: string;
  totalTime?: string; // ISO 8601 duration, e.g. PT15M
  steps: HowToStep[];
  image?: string;
};

export function howToSchema(input: HowToInput): Schema {
  return clean({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: input.name,
    description: input.description,
    totalTime: input.totalTime,
    image: input.image,
    step: input.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
      image: s.image,
      url: s.url,
    })),
  }) as Schema;
}

export type BreadcrumbInput = { items: { name: string; url: string }[] };

export function breadcrumbSchema(input: BreadcrumbInput): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: input.items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

/**
 * Render a JSON-LD `<script>` tag for a schema (or array of schemas).
 * Escapes `</` to prevent script-tag injection.
 */
export function renderJsonLd(schema: Schema | Schema[]): string {
  const json = JSON.stringify(schema).replace(/<\//g, '<\\/');
  return `<script type="application/ld+json">${json}</script>`;
}

function clean<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const nested = clean(v as Record<string, unknown>);
      if (Object.keys(nested).length > 0) out[k] = nested;
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
