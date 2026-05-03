/**
 * SEO & Growth Engine — shared type definitions.
 *
 * These types are intentionally framework-agnostic (no Mongo `ObjectId`)
 * so they can be used on the client and server. Persisted shapes can extend
 * these where needed.
 */

export type Severity = 'critical' | 'warning' | 'info';

export type AuditFinding = {
  /** Stable machine code, e.g. "missing_meta_description". */
  code: string;
  /** Human-readable summary. */
  message: string;
  severity: Severity;
  /** Optional element/selector pointer. */
  element?: string;
  /** Recommended remediation. */
  recommendation?: string;
};

export type Audit = {
  url: string;
  fetchedAt: string;
  status: number;
  /** 0–100 health score, derived from findings. */
  score: number;
  findings: AuditFinding[];
  summary: {
    critical: number;
    warning: number;
    info: number;
  };
};

export type RankPosition = {
  keyword: string;
  engine: 'google' | 'bing' | 'yahoo' | 'duckduckgo';
  location: string;
  device: 'desktop' | 'mobile' | 'tablet';
  position: number | null;
  url?: string;
  /** ISO timestamp of when the rank was checked. */
  checkedAt: string;
  /** Position change vs. last check (positive = improvement). */
  change?: number;
};

export type Backlink = {
  sourceUrl: string;
  sourceDomain: string;
  targetUrl: string;
  anchorText: string;
  rel: 'follow' | 'nofollow' | 'ugc' | 'sponsored';
  domainAuthority?: number;
  firstSeen: string;
  lastSeen: string;
  status: 'live' | 'lost' | 'broken';
};

export type KeywordIntent = 'informational' | 'navigational' | 'commercial' | 'transactional';

export type Keyword = {
  term: string;
  volume: number;
  difficulty: number;
  cpc?: number;
  intent: KeywordIntent;
  parent?: string;
  serpFeatures?: string[];
};

export type ContentBriefSection = {
  heading: string;
  level: 2 | 3 | 4;
  bullets: string[];
};

export type ContentBrief = {
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  intent: KeywordIntent;
  targetWordCount: number;
  sections: ContentBriefSection[];
  questions: string[];
  competitors: string[];
  outline: string[];
};

export type LinkProspect = {
  domain: string;
  url: string;
  contactEmail?: string;
  domainAuthority?: number;
  relevanceScore: number; // 0..1
  status: 'new' | 'contacted' | 'replied' | 'won' | 'lost';
  notes?: string;
};

export type OutreachMessage = {
  from: 'us' | 'them';
  body: string;
  sentAt: string;
};

export type OutreachThread = {
  prospect: LinkProspect;
  subject: string;
  messages: OutreachMessage[];
  lastActivity: string;
  status: 'new' | 'contacted' | 'replied' | 'won' | 'lost';
};

export type SocialChannel = 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'pinterest';

export type SocialPost = {
  id: string;
  channel: SocialChannel;
  body: string;
  mediaUrls?: string[];
  scheduledFor: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  campaignId?: string;
  utm?: Record<string, string>;
};

export type AbTestVariant = {
  id: string;
  label: string;
  weight: number; // 0..1, sum across variants should equal 1
  visitors: number;
  conversions: number;
};

export type HeatmapEvent = {
  pageUrl: string;
  type: 'click' | 'scroll' | 'move' | 'rage-click' | 'dead-click';
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
  timestamp: string;
  visitorId: string;
  sessionId: string;
};

export type SchemaType =
  | 'Article'
  | 'Product'
  | 'FAQPage'
  | 'HowTo'
  | 'BreadcrumbList'
  | 'Organization'
  | 'WebSite';

export type Schema = {
  '@context': 'https://schema.org';
  '@type': SchemaType;
  [key: string]: unknown;
};

export type ProgrammaticPage = {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  body: string;
  schema?: Schema[];
  data: Record<string, unknown>;
};

export type TopicalCluster = {
  hub: string;
  spokes: string[];
};

export type CompetitorGap = {
  keyword: string;
  ourPosition: number | null;
  theirPosition: number;
  competitor: string;
  volume: number;
  opportunity: 'easy' | 'medium' | 'hard';
};

export type FunnelStep = {
  name: string;
  visitors: number;
  conversions: number;
};

export type FunnelDrop = {
  fromStep: string;
  toStep: string;
  dropRate: number;
  flagged: boolean;
};
