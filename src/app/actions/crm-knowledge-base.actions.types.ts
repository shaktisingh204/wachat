/**
 * Types extracted from crm-knowledge-base.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface KbArticleDoc {
  _id: string;
  title?: string;
  slug?: string;
  body?: string;
  category?: string;
  tags?: string[];
  visibility?: 'public' | 'portal' | 'internal' | string;
  status?: 'draft' | 'published' | 'archived' | string;
  helpfulCount?: number;
  helpfulYes?: number;
  helpfulNo?: number;
  viewCount?: number;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
  lastReviewedAt?: string;
  /** Optional related article ids (entity refs). */
  relatedArticles?: string[];
  /** SEO meta fields. */
  seoTitle?: string;
  seoDescription?: string;
}
