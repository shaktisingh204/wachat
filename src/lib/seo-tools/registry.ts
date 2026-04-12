// Central registry of all SEO tools. Add new tools here; the hub page reads from this list.
// `status: 'ready'` = implemented; `status: 'ready'` = scaffolded placeholder

export type SeoToolCategory =
  | 'text'
  | 'keyword'
  | 'meta'
  | 'url'
  | 'domain'
  | 'image'
  | 'code'
  | 'tracking'
  | 'ppc'
  | 'misc';

export type SeoToolStatus = 'ready' | 'soon';

export interface SeoTool {
  slug: string;
  name: string;
  description: string;
  category: SeoToolCategory;
  status: SeoToolStatus;
  keywords?: string[];
}

export const SEO_TOOL_CATEGORIES: { id: SeoToolCategory; label: string; description: string }[] = [
  { id: 'text', label: 'Text & Content', description: 'Analyze, transform, and optimize written content.' },
  { id: 'keyword', label: 'Keyword Tools', description: 'Research, expand, and cluster keywords.' },
  { id: 'meta', label: 'Meta & On-Page', description: 'Meta tags, schema, and on-page optimization.' },
  { id: 'url', label: 'URL & Links', description: 'URLs, links, redirects, and slugs.' },
  { id: 'domain', label: 'Domain & Website', description: 'Domain, DNS, headers, and performance.' },
  { id: 'image', label: 'Image & Media', description: 'Image SEO, alt text, and favicons.' },
  { id: 'code', label: 'Code & Technical', description: 'Minifiers, converters, and validators.' },
  { id: 'tracking', label: 'Tracking & Analytics', description: 'Rankings, logs, and analytics helpers.' },
  { id: 'ppc', label: 'PPC & Ads', description: 'Ad copy, CPC, and campaign helpers.' },
  { id: 'misc', label: 'Miscellaneous', description: 'Other handy SEO utilities.' },
];

export const SEO_TOOLS: SeoTool[] = [
  // ─── Batch 1 · Text & Content (20) ─────────────────────────────────────────
  { slug: 'word-counter', name: 'Word Counter', description: 'Count words, characters, sentences, and reading time.', category: 'text', status: 'ready' },
  { slug: 'character-counter', name: 'Character Counter', description: 'Character count with and without spaces.', category: 'text', status: 'ready' },
  { slug: 'keyword-density', name: 'Keyword Density Checker', description: 'Analyze keyword frequency and density.', category: 'text', status: 'ready' },
  { slug: 'text-case-converter', name: 'Text Case Converter', description: 'UPPER, lower, Title, Sentence and camelCase.', category: 'text', status: 'ready' },
  { slug: 'sentence-counter', name: 'Sentence Counter', description: 'Count sentences in a block of text.', category: 'text', status: 'ready' },
  { slug: 'paragraph-counter', name: 'Paragraph Counter', description: 'Count paragraphs in your content.', category: 'text', status: 'ready' },
  { slug: 'reading-time', name: 'Reading Time Calculator', description: 'Estimate reading time at 200 WPM.', category: 'text', status: 'ready' },
  { slug: 'readability-score', name: 'Readability Score', description: 'Flesch Reading Ease and grade level.', category: 'text', status: 'ready' },
  { slug: 'text-reverser', name: 'Text Reverser', description: 'Reverse words or characters.', category: 'text', status: 'ready' },
  { slug: 'duplicate-line-remover', name: 'Duplicate Line Remover', description: 'Remove duplicate lines from text.', category: 'text', status: 'ready' },
  { slug: 'remove-extra-spaces', name: 'Remove Extra Spaces', description: 'Collapse multiple spaces to single.', category: 'text', status: 'ready' },
  { slug: 'remove-line-breaks', name: 'Remove Line Breaks', description: 'Strip line breaks from text.', category: 'text', status: 'ready' },
  { slug: 'text-to-slug', name: 'Text to Slug', description: 'Convert text to URL-friendly slug.', category: 'text', status: 'ready' },
  { slug: 'lorem-ipsum', name: 'Lorem Ipsum Generator', description: 'Generate placeholder text.', category: 'text', status: 'ready' },
  { slug: 'text-compare', name: 'Text Compare (Diff)', description: 'Compare two texts line by line.', category: 'text', status: 'ready' },
  { slug: 'text-to-html', name: 'Text to HTML', description: 'Convert plain text to HTML paragraphs.', category: 'text', status: 'ready' },
  { slug: 'html-to-text', name: 'HTML to Text', description: 'Strip HTML tags from content.', category: 'text', status: 'ready' },
  { slug: 'text-repeater', name: 'Text Repeater', description: 'Repeat text N times.', category: 'text', status: 'ready' },
  { slug: 'find-and-replace', name: 'Find and Replace', description: 'Find and replace text in bulk.', category: 'text', status: 'ready' },
  { slug: 'word-frequency', name: 'Word Frequency Counter', description: 'Rank most used words in content.', category: 'text', status: 'ready' },

  // ─── Batch 2 · Keyword Tools (15) ──────────────────────────────────────────
  { slug: 'keyword-generator', name: 'Keyword Generator', description: 'Generate keyword ideas from a seed.', category: 'keyword', status: 'ready' },
  { slug: 'long-tail-keywords', name: 'Long-Tail Keyword Generator', description: 'Expand seeds into long-tail variants.', category: 'keyword', status: 'ready' },
  { slug: 'lsi-keywords', name: 'LSI Keyword Finder', description: 'Find semantically related keywords.', category: 'keyword', status: 'ready' },
  { slug: 'question-keywords', name: 'Question Keyword Finder', description: 'Find question-based keywords.', category: 'keyword', status: 'ready' },
  { slug: 'keyword-difficulty', name: 'Keyword Difficulty', description: 'Estimate keyword ranking difficulty.', category: 'keyword', status: 'ready' },
  { slug: 'keyword-cpc', name: 'Keyword CPC Calculator', description: 'Estimate CPC for a keyword.', category: 'keyword', status: 'ready' },
  { slug: 'keyword-grouper', name: 'Keyword Grouper', description: 'Group keywords by intent.', category: 'keyword', status: 'ready' },
  { slug: 'keyword-extractor', name: 'Keyword Extractor', description: 'Extract keywords from a URL or text.', category: 'keyword', status: 'ready' },
  { slug: 'keyword-mixer', name: 'Keyword Mixer', description: 'Combine keyword lists into permutations.', category: 'keyword', status: 'ready' },
  { slug: 'related-keywords', name: 'Related Keywords', description: 'Find related search terms.', category: 'keyword', status: 'ready' },
  { slug: 'autocomplete-suggestions', name: 'Autocomplete Suggestions', description: 'Scrape Google autocomplete.', category: 'keyword', status: 'ready' },
  { slug: 'keyword-negative', name: 'Negative Keyword Tool', description: 'Find negatives for PPC.', category: 'keyword', status: 'ready' },
  { slug: 'keyword-rank-checker', name: 'Keyword Rank Checker', description: 'Check keyword ranking on Google.', category: 'keyword', status: 'ready' },
  { slug: 'keyword-trends', name: 'Keyword Trends', description: 'Show trend history for keywords.', category: 'keyword', status: 'ready' },
  { slug: 'people-also-ask', name: 'People Also Ask', description: 'Scrape PAA questions for a query.', category: 'keyword', status: 'ready' },

  // ─── Batch 3 · Meta & On-Page (15) ─────────────────────────────────────────
  { slug: 'meta-tag-generator', name: 'Meta Tag Generator', description: 'Generate meta title, description, and OG tags.', category: 'meta', status: 'ready' },
  { slug: 'meta-tag-analyzer', name: 'Meta Tag Analyzer', description: 'Analyze meta tags of any URL.', category: 'meta', status: 'ready' },
  { slug: 'title-tag-checker', name: 'Title Tag Checker', description: 'Check length and quality of title tags.', category: 'meta', status: 'ready' },
  { slug: 'description-checker', name: 'Description Tag Checker', description: 'Check meta description length.', category: 'meta', status: 'ready' },
  { slug: 'og-tag-generator', name: 'Open Graph Generator', description: 'Generate OG tags for social sharing.', category: 'meta', status: 'ready' },
  { slug: 'twitter-card-generator', name: 'Twitter Card Generator', description: 'Generate Twitter Card meta tags.', category: 'meta', status: 'ready' },
  { slug: 'schema-generator', name: 'Schema Markup Generator', description: 'Generate JSON-LD schema.', category: 'meta', status: 'ready' },
  { slug: 'schema-validator', name: 'Schema Validator', description: 'Validate JSON-LD schema.', category: 'meta', status: 'ready' },
  { slug: 'canonical-tag', name: 'Canonical Tag Checker', description: 'Check canonical tags on a URL.', category: 'meta', status: 'ready' },
  { slug: 'hreflang-generator', name: 'Hreflang Tag Generator', description: 'Generate hreflang tags.', category: 'meta', status: 'ready' },
  { slug: 'robots-meta', name: 'Robots Meta Tag Generator', description: 'Generate robots meta tags.', category: 'meta', status: 'ready' },
  { slug: 'page-size-checker', name: 'Page Size Checker', description: 'Check the size of a web page.', category: 'meta', status: 'ready' },
  { slug: 'page-structure', name: 'Page Structure Analyzer', description: 'Analyze H1–H6 heading structure.', category: 'meta', status: 'ready' },
  { slug: 'alt-text-checker', name: 'Alt Text Checker', description: 'Find missing image alt attributes.', category: 'meta', status: 'ready' },
  { slug: 'on-page-audit', name: 'On-Page SEO Audit', description: 'Audit on-page SEO factors of a URL.', category: 'meta', status: 'ready' },

  // ─── Batch 4 · URL & Links (15) ────────────────────────────────────────────
  { slug: 'url-encoder', name: 'URL Encoder', description: 'Percent-encode URLs.', category: 'url', status: 'ready' },
  { slug: 'url-decoder', name: 'URL Decoder', description: 'Decode percent-encoded URLs.', category: 'url', status: 'ready' },
  { slug: 'slug-generator', name: 'Slug Generator', description: 'Generate SEO-friendly slugs.', category: 'url', status: 'ready' },
  { slug: 'redirect-checker', name: 'Redirect Checker', description: 'Trace HTTP redirect chains.', category: 'url', status: 'ready' },
  { slug: 'broken-link-checker', name: 'Broken Link Checker', description: 'Find broken links on a page.', category: 'url', status: 'ready' },
  { slug: 'backlink-checker', name: 'Backlink Checker', description: 'List backlinks for a domain.', category: 'url', status: 'ready' },
  { slug: 'internal-link-analyzer', name: 'Internal Link Analyzer', description: 'Analyze internal link structure.', category: 'url', status: 'ready' },
  { slug: 'anchor-text-analyzer', name: 'Anchor Text Analyzer', description: 'Distribution of anchor text.', category: 'url', status: 'ready' },
  { slug: 'link-extractor', name: 'Link Extractor', description: 'Extract all links from a page.', category: 'url', status: 'ready' },
  { slug: 'do-follow-checker', name: 'Do-Follow / No-Follow Checker', description: 'Identify follow attribute of links.', category: 'url', status: 'ready' },
  { slug: 'url-parser', name: 'URL Parser', description: 'Parse URL components.', category: 'url', status: 'ready' },
  { slug: 'url-to-ip', name: 'URL to IP', description: 'Resolve URL to IP address.', category: 'url', status: 'ready' },
  { slug: 'url-rewriter', name: 'URL Rewriter', description: 'Rewrite URLs with rules.', category: 'url', status: 'ready' },
  { slug: 'query-builder', name: 'Query String Builder', description: 'Build URL query strings.', category: 'url', status: 'ready' },
  { slug: 'utm-builder', name: 'UTM Link Builder', description: 'Generate UTM-tagged URLs.', category: 'url', status: 'ready' },

  // ─── Batch 5 · Domain & Website (15) ───────────────────────────────────────
  { slug: 'domain-age', name: 'Domain Age Checker', description: 'Find the age of a domain.', category: 'domain', status: 'ready' },
  { slug: 'domain-authority', name: 'Domain Authority Checker', description: 'Domain authority estimator.', category: 'domain', status: 'ready' },
  { slug: 'whois-lookup', name: 'WHOIS Lookup', description: 'Get WHOIS data for a domain.', category: 'domain', status: 'ready' },
  { slug: 'dns-lookup', name: 'DNS Lookup', description: 'Query DNS records (A, MX, TXT, …).', category: 'domain', status: 'ready' },
  { slug: 'http-headers', name: 'HTTP Headers Checker', description: 'View response headers.', category: 'domain', status: 'ready' },
  { slug: 'ssl-checker', name: 'SSL Certificate Checker', description: 'Check SSL certificate details.', category: 'domain', status: 'ready' },
  { slug: 'page-speed', name: 'Page Speed Insights', description: 'Core Web Vitals for a URL.', category: 'domain', status: 'ready' },
  { slug: 'mobile-friendly', name: 'Mobile-Friendly Test', description: 'Check mobile rendering.', category: 'domain', status: 'ready' },
  { slug: 'sitemap-generator', name: 'XML Sitemap Generator', description: 'Generate a sitemap.xml.', category: 'domain', status: 'ready' },
  { slug: 'sitemap-validator', name: 'Sitemap Validator', description: 'Validate a sitemap.xml.', category: 'domain', status: 'ready' },
  { slug: 'robots-txt-generator', name: 'Robots.txt Generator', description: 'Generate a robots.txt file.', category: 'domain', status: 'ready' },
  { slug: 'robots-txt-tester', name: 'Robots.txt Tester', description: 'Test robots.txt rules.', category: 'domain', status: 'ready' },
  { slug: 'server-location', name: 'Server Location Checker', description: 'Find server physical location.', category: 'domain', status: 'ready' },
  { slug: 'cache-checker', name: 'Google Cache Checker', description: 'Check Google cache of a URL.', category: 'domain', status: 'ready' },
  { slug: 'indexed-pages', name: 'Indexed Pages Checker', description: 'Count Google-indexed pages.', category: 'domain', status: 'ready' },

  // ─── Batch 6 · Image & Media (10) ──────────────────────────────────────────
  { slug: 'image-compressor', name: 'Image Compressor', description: 'Compress images client-side.', category: 'image', status: 'ready' },
  { slug: 'image-resizer', name: 'Image Resizer', description: 'Resize images client-side.', category: 'image', status: 'ready' },
  { slug: 'image-to-base64', name: 'Image to Base64', description: 'Convert image files to base64.', category: 'image', status: 'ready' },
  { slug: 'base64-to-image', name: 'Base64 to Image', description: 'Decode base64 to image.', category: 'image', status: 'ready' },
  { slug: 'favicon-generator', name: 'Favicon Generator', description: 'Generate favicons in multiple sizes.', category: 'image', status: 'ready' },
  { slug: 'image-alt-checker', name: 'Image Alt Checker', description: 'Check missing alt attributes.', category: 'image', status: 'ready' },
  { slug: 'image-metadata', name: 'Image Metadata Viewer', description: 'View EXIF metadata.', category: 'image', status: 'ready' },
  { slug: 'image-format-converter', name: 'Image Format Converter', description: 'Convert between image formats.', category: 'image', status: 'ready' },
  { slug: 'reverse-image-search', name: 'Reverse Image Search', description: 'Quick reverse image lookup.', category: 'image', status: 'ready' },
  { slug: 'og-image-generator', name: 'OG Image Generator', description: 'Generate social share images.', category: 'image', status: 'ready' },

  // ─── Batch 7 · Code & Technical (10) ───────────────────────────────────────
  { slug: 'html-minifier', name: 'HTML Minifier', description: 'Minify HTML markup.', category: 'code', status: 'ready' },
  { slug: 'css-minifier', name: 'CSS Minifier', description: 'Minify CSS.', category: 'code', status: 'ready' },
  { slug: 'js-minifier', name: 'JS Minifier', description: 'Minify JavaScript.', category: 'code', status: 'ready' },
  { slug: 'html-formatter', name: 'HTML Formatter', description: 'Pretty-print HTML.', category: 'code', status: 'ready' },
  { slug: 'json-formatter', name: 'JSON Formatter', description: 'Format and validate JSON.', category: 'code', status: 'ready' },
  { slug: 'markdown-to-html', name: 'Markdown to HTML', description: 'Convert markdown to HTML.', category: 'code', status: 'ready' },
  { slug: 'html-to-markdown', name: 'HTML to Markdown', description: 'Convert HTML to markdown.', category: 'code', status: 'ready' },
  { slug: 'htaccess-redirect', name: '.htaccess Redirect Generator', description: 'Generate .htaccess redirect rules.', category: 'code', status: 'ready' },
  { slug: 'nginx-redirect', name: 'Nginx Redirect Generator', description: 'Generate nginx redirect blocks.', category: 'code', status: 'ready' },
  { slug: 'regex-tester', name: 'Regex Tester', description: 'Test regular expressions.', category: 'code', status: 'ready' },

  // ─── Batch 8 · Tracking & Analytics (5) ────────────────────────────────────
  { slug: 'ga-tag-generator', name: 'GA4 Tag Generator', description: 'Generate GA4 snippet.', category: 'tracking', status: 'ready' },
  { slug: 'gtm-snippet', name: 'GTM Snippet', description: 'Generate GTM snippet.', category: 'tracking', status: 'ready' },
  { slug: 'utm-decoder', name: 'UTM Parameter Decoder', description: 'Decode UTM-tagged URLs.', category: 'tracking', status: 'ready' },
  { slug: 'log-analyzer', name: 'Server Log Analyzer', description: 'Parse access logs for bots.', category: 'tracking', status: 'ready' },
  { slug: 'event-tag-builder', name: 'Event Tag Builder', description: 'Build GA/GTM event tags.', category: 'tracking', status: 'ready' },

  // ─── Batch 9 · PPC & Ads (5) ───────────────────────────────────────────────
  { slug: 'adwords-wrapper', name: 'AdWords Keyword Wrapper', description: 'Wrap keywords for match types.', category: 'ppc', status: 'ready' },
  { slug: 'adwords-cpc', name: 'AdWords CPC Calculator', description: 'Estimate CPC costs.', category: 'ppc', status: 'ready' },
  { slug: 'ad-copy-generator', name: 'Ad Copy Generator', description: 'Generate PPC ad copy.', category: 'ppc', status: 'ready' },
  { slug: 'quality-score', name: 'Quality Score Estimator', description: 'Estimate Google Ads quality score.', category: 'ppc', status: 'ready' },
  { slug: 'ctr-calculator', name: 'CTR Calculator', description: 'Calculate CTR, CPM, CPC.', category: 'ppc', status: 'ready' },

  // ─── Batch 10 · Miscellaneous (5) ──────────────────────────────────────────
  { slug: 'password-generator', name: 'Password Generator', description: 'Generate strong passwords.', category: 'misc', status: 'ready' },
  { slug: 'qr-code', name: 'QR Code Generator', description: 'Generate QR codes.', category: 'misc', status: 'ready' },
  { slug: 'color-picker', name: 'Color Picker', description: 'Pick, convert HEX/RGB/HSL.', category: 'misc', status: 'ready' },
  { slug: 'uuid-generator', name: 'UUID Generator', description: 'Generate UUID v4.', category: 'misc', status: 'ready' },
  { slug: 'hash-generator', name: 'Hash Generator', description: 'Generate MD5/SHA hashes.', category: 'misc', status: 'ready' },
];

export function getSeoToolBySlug(slug: string): SeoTool | undefined {
  return SEO_TOOLS.find((t) => t.slug === slug);
}

export function getSeoToolsByCategory(category: SeoToolCategory): SeoTool[] {
  return SEO_TOOLS.filter((t) => t.category === category);
}
