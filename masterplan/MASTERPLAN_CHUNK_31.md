# SEO Tools Masterplan - Chunk 31 Analysis

Below is the detailed analysis of the SEO tool pages in Chunk 31.

## `/src/app/dashboard/seo/tools/favicon-generator/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/favicon-generator/page.tsx`
- **Current Features**: Client-side favicon generator that takes a square source image and creates PNG favicons at 16, 32, 48, and 180 px using an HTML canvas. Displays previews with download links.
- **Possible Features**: Add ICO format support. Add Apple Touch Icon specific formats. Support cropping tools.
- **Errors**: No explicit error boundary. Missing proper error handling for massive image uploads that might crash the browser canvas.
- **Enhancement Plan**: Implement a Cropper UI so non-square images can be used. Add zip download for all sizes at once.

## `/src/app/dashboard/seo/tools/find-and-replace/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/find-and-replace/page.tsx`
- **Current Features**: A bulk find and replace text utility with regex and case-sensitive toggles. Outputs the replaced text and the match count dynamically via `useMemo`.
- **Possible Features**: Add file upload to find-replace in text files. Add multiple find-replace rules sequentially.
- **Errors**: Invalid Regex triggers a try-catch but swallows the error silently. Large text pasting might lag the main thread since `useMemo` blocks UI.
- **Enhancement Plan**: Add debounce for the find/replace logic. Surface regex compilation errors to the user instead of failing silently. Add a copy-to-clipboard button for the output.

## `/src/app/dashboard/seo/tools/ga-tag-generator/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/ga-tag-generator/page.tsx`
- **Current Features**: Generates the Google Analytics 4 (`gtag.js`) tracking snippet based on a user-provided Measurement ID. Provides a one-click copy button.
- **Possible Features**: Support custom event snippets (e.g. `gtag('event', ...)`). Add options for anonymize IP or user_id tracking.
- **Errors**: None found.
- **Enhancement Plan**: Add a secondary toggle for advanced GA4 configurations like cross-domain tracking setup snippets.

## `/src/app/dashboard/seo/tools/gtm-snippet/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/gtm-snippet/page.tsx`
- **Current Features**: Generates Google Tag Manager `<head>` and `<body>` snippets based on a user-provided GTM Container ID.
- **Possible Features**: Add dataLayer initialization templates (e.g., ecommerce dataLayer structure).
- **Errors**: None found.
- **Enhancement Plan**: Add validation for the GTM ID format (e.g., `GTM-[A-Z0-9]+`). Offer standard e-commerce DataLayer snippets as an additional template copy block.

## `/src/app/dashboard/seo/tools/hash-generator/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/hash-generator/page.tsx`
- **Current Features**: Uses Web Crypto API to generate SHA-1, SHA-256, SHA-384, and SHA-512 hashes from input text.
- **Possible Features**: Add HMAC generation using a secret key. Add MD5 support (would require a small JS library like `spark-md5` since Web Crypto doesn't support it directly).
- **Errors**: None found.
- **Enhancement Plan**: Add file hashing via `FileReader` and Web Crypto API. Support HMAC generation. Add an MD5 polyfill if SEOs strictly need MD5 for legacy systems.

## `/src/app/dashboard/seo/tools/hreflang-generator/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/hreflang-generator/page.tsx`
- **Current Features**: Tool to dynamically add language/locale codes and URLs, returning a block of `<link rel="alternate" hreflang="X" ...>` tags.
- **Possible Features**: Add a pre-filled list or dropdown of valid ISO 639-1 language and ISO 3166-1 region codes to prevent typos.
- **Errors**: Missing validation on URLs and lang tags.
- **Enhancement Plan**: Implement a standard language/region dropdown picker. Add an "x-default" option natively. Allow CSV import/export.

## `/src/app/dashboard/seo/tools/htaccess-redirect/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/htaccess-redirect/page.tsx`
- **Current Features**: A generator for Apache `.htaccess` rewrite rules. Allows users to define multiple "From" and "To" URLs and choose between 301 and 302 redirects.
- **Possible Features**: Add options for WWW vs Non-WWW redirects and HTTP to HTTPS forced redirects.
- **Errors**: Doesn't handle query parameter redirects well (Apache requires `RewriteCond %{QUERY_STRING}`).
- **Enhancement Plan**: Add predefined snippets for common `.htaccess` use cases (Force HTTPS, Add WWW, Block IPs). Build query parameter string handler logic.

## `/src/app/dashboard/seo/tools/html-formatter/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/html-formatter/page.tsx`
- **Current Features**: A naive HTML pretty-printer that restructures raw HTML by fixing indentations based on tag depth.
- **Possible Features**: Add syntax highlighting for the output. Add a file upload option.
- **Errors**: The regex-based naive parser will break on complex HTML (e.g., inline scripts with `<` or `>` characters, or unclosed tags).
- **Enhancement Plan**: Replace the naive custom regex formatter with a robust library like Prettier (via a web worker) for bulletproof formatting.

## `/src/app/dashboard/seo/tools/html-minifier/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/html-minifier/page.tsx`
- **Current Features**: A naive regex-based HTML minifier that removes comments and multiple spaces. Displays the byte savings percentage.
- **Possible Features**: Options to minify inline CSS and JS.
- **Errors**: Regex-based minification can break JS in `<script>` tags if they rely on line breaks (missing semicolons) and will strip spaces inside `<pre>` or `<textarea>` tags.
- **Enhancement Plan**: Integrate a proper HTML minification package (e.g., `html-minifier-terser`) to safely handle `<pre>`, inline `<script>`, and inline `<style>` blocks.

## `/src/app/dashboard/seo/tools/html-to-markdown/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/html-to-markdown/page.tsx`
- **Current Features**: Converts basic HTML tags (headings, strong, em, links, lists, paragraphs, code) into Markdown syntax using regex.
- **Possible Features**: Support tables, blockquotes, and images.
- **Errors**: Highly error-prone due to regex-based HTML parsing. Nested tags (e.g., `<strong><em>Text</em></strong>`) may not resolve perfectly.
- **Enhancement Plan**: Replace the custom regex solution with a library like `Turndown` to ensure accurate and complete HTML-to-Markdown conversion.

## `/src/app/dashboard/seo/tools/html-to-text/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/html-to-text/page.tsx`
- **Current Features**: Uses a utility `htmlToText` to strip HTML tags from an input block, leaving only plain text.
- **Possible Features**: Options to keep line breaks or collapse them.
- **Errors**: Dependent on `htmlToText` implementation.
- **Enhancement Plan**: Add options to strip or preserve newlines, ignore hidden elements, and handle special HTML entities decoding properly.

## `/src/app/dashboard/seo/tools/http-headers/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/http-headers/page.tsx`
- **Current Features**: Checks HTTP response headers for a given URL via `apiFetchUrl`.
- **Possible Features**: Test mobile vs. desktop User-Agents. Display redirect chains.
- **Errors**: Needs proper error boundary for proxy-fetch failures.
- **Enhancement Plan**: Expose User-Agent and method toggles. Show a redirect trace if the URL jumps through multiple 301/302s.

## `/src/app/dashboard/seo/tools/image-alt-checker/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/image-alt-checker/page.tsx`
- **Current Features**: Fetches a URL and parses its HTML to find `<img>` tags. Audits and lists images that are missing `alt` attributes.
- **Possible Features**: Highlight images where `alt` text is excessively long (keyword stuffing check).
- **Errors**: Depends on `apiFetchUrl` which might fail on bot-protected sites.
- **Enhancement Plan**: Identify decorative images (empty alt `alt=""`) and distinguish them from missing alt attributes. Check background images in CSS (advanced).

## `/src/app/dashboard/seo/tools/image-compressor/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/image-compressor/page.tsx`
- **Current Features**: Compresses images locally using the Canvas API. Allows the user to adjust the JPEG quality slider. Shows file size savings.
- **Possible Features**: Support WebP compression. Batch image compression.
- **Errors**: Very large images might crash the canvas/browser memory limit.
- **Enhancement Plan**: Add WebP output format. Implement canvas downscaling in chunks if the image exceeds certain dimensions to prevent memory crashes.

## `/src/app/dashboard/seo/tools/image-format-converter/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/image-format-converter/page.tsx`
- **Current Features**: Converts uploaded images to PNG, JPEG, or WebP using the Canvas API's `toBlob` method.
- **Possible Features**: Quality slider for JPEG/WebP.
- **Errors**: Might lose transparency if converting PNG to JPEG (will result in a black background).
- **Enhancement Plan**: Fill the canvas with a white background before drawing the image when converting to JPEG to prevent transparency turning black.

## `/src/app/dashboard/seo/tools/image-metadata/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/image-metadata/page.tsx`
- **Current Features**: Reads basic browser-accessible image data: Name, size, type, dimensions, last modified date.
- **Possible Features**: Extract full EXIF data (GPS, camera model, etc.).
- **Errors**: Doesn't read EXIF data currently.
- **Enhancement Plan**: Integrate `exif-js` to extract and display detailed EXIF metadata, which is highly useful for local SEO (GPS tags).

## `/src/app/dashboard/seo/tools/image-resizer/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/image-resizer/page.tsx`
- **Current Features**: Resizes an uploaded image to exact dimensions using an HTML canvas and allows downloading as PNG.
- **Possible Features**: Maintain aspect ratio lock. Support cropping instead of squishing.
- **Errors**: Squishes the image if the target aspect ratio doesn't match the original.
- **Enhancement Plan**: Add a "maintain aspect ratio" lock toggle. Add options for "fit", "fill" or "stretch" modes.

## `/src/app/dashboard/seo/tools/image-to-base64/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/image-to-base64/page.tsx`
- **Current Features**: Converts an uploaded image to a base64 Data URL string via `FileReader.readAsDataURL()`.
- **Possible Features**: Two-way conversion (base64 string to image file).
- **Errors**: Freezes browser UI if the image is too large due to massive string state updates.
- **Enhancement Plan**: Show a character count for the base64 string. Truncate the text box display string and use a direct clipboard API call to avoid UI lag.

## `/src/app/dashboard/seo/tools/indexed-pages/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/indexed-pages/page.tsx`
- **Current Features**: Generates Google and Bing `site:` search queries for a given domain and provides clickable links.
- **Possible Features**: Add custom date range or exact-match query modifiers.
- **Errors**: Just a wrapper for search engine links, no internal validation.
- **Enhancement Plan**: Strip HTTP/HTTPS protocols automatically if users mistakenly paste a full URL instead of a domain name.

## `/src/app/dashboard/seo/tools/internal-link-analyzer/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/internal-link-analyzer/page.tsx`
- **Current Features**: Fetches a URL, parses links, and filters them to show only internal links (links matching the same domain).
- **Possible Features**: Export to CSV. Display absolute vs relative paths.
- **Errors**: Might fail on relative links if the base tag is not handled.
- **Enhancement Plan**: Extract and handle the `<base>` HTML tag for accurate relative URL resolution. Flag internal links that have `nofollow` attributes.

## `/src/app/dashboard/seo/tools/js-minifier/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/js-minifier/page.tsx`
- **Current Features**: Naive regex-based minifier that strips comments, line breaks, and whitespace around operators.
- **Possible Features**: Uglify JS (variable renaming).
- **Errors**: Highly unsafe. The regex `replace(/\s*([{};,()\[\]=+\-*/<>!&|])\s*/g, '$1')` will destroy strings containing those characters, breaking the JS completely.
- **Enhancement Plan**: Use a real JS minifier library like `terser` (running in a Web Worker) to safely minify code without corrupting strings or regex literals.

## `/src/app/dashboard/seo/tools/json-formatter/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/json-formatter/page.tsx`
- **Current Features**: Validate, format (pretty-print), and minify JSON via `JSON.parse` and `JSON.stringify`.
- **Possible Features**: Upload/Download JSON files. Provide a tree viewer.
- **Errors**: None found. Standard secure implementation.
- **Enhancement Plan**: Add syntax highlighting for the JSON output. Highlight exact syntax error locations when parsing fails.

## `/src/app/dashboard/seo/tools/keyword-cpc/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/keyword-cpc/page.tsx`
- **Current Features**: Estimates a CPC (Cost-Per-Click) value heuristically based on word length and commercial intent modifier keywords.
- **Possible Features**: Connect to a real Google Ads or Keyword Planner API.
- **Errors**: Values are entirely heuristic/fake.
- **Enhancement Plan**: Make it clear in the UI that this is a simulated heuristic. Integrate a real SERP API (e.g. DataForSEO or similar) for production-grade estimates.

## `/src/app/dashboard/seo/tools/keyword-density/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/keyword-density/page.tsx`
- **Current Features**: Calculates the frequency and density percentage of words in a text block.
- **Possible Features**: Check 2-word and 3-word combinations (n-grams). Add a stopword filter.
- **Errors**: None, but single-word density isn't very useful for modern SEO.
- **Enhancement Plan**: Implement n-gram generation to show bigrams (2-word) and trigrams (3-word) density, which is much more actionable for SEO.

## `/src/app/dashboard/seo/tools/keyword-difficulty/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/keyword-difficulty/page.tsx`
- **Current Features**: Generates a heuristic keyword difficulty score (1-100) using a string hash and keyword length.
- **Possible Features**: Analyze top 10 search results to calculate real KD based on average Domain Authority.
- **Errors**: Simulated data.
- **Enhancement Plan**: Replace deterministic hashing logic with a real API integration or deeply clarify that the tool is a demo.

## `/src/app/dashboard/seo/tools/keyword-extractor/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/keyword-extractor/page.tsx`
- **Current Features**: Extracts top words from text after stripping a predefined list of English stopwords.
- **Possible Features**: Multi-language stopword support.
- **Errors**: Capitalization might skew counts if not normalized.
- **Enhancement Plan**: Add TF-IDF scoring algorithm rather than simple frequency counting to extract genuinely "important" keywords. Add multiple language support.

## `/src/app/dashboard/seo/tools/keyword-generator/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/keyword-generator/page.tsx`
- **Current Features**: Appends common prefixes and suffixes to a seed keyword to generate variants.
- **Possible Features**: Scrape Google Autocomplete for real keyword suggestions.
- **Errors**: None.
- **Enhancement Plan**: Fetch live data from search engine autocomplete APIs (Google, Bing, YouTube) rather than using a hardcoded list of suffixes/prefixes.

## `/src/app/dashboard/seo/tools/keyword-grouper/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/keyword-grouper/page.tsx`
- **Current Features**: Groups a bulk list of keywords based on their first word (stem).
- **Possible Features**: Lexical similarity grouping (Levenshtein distance) or NLP-based topic clustering.
- **Errors**: First-word grouping is extremely rigid. E.g. "best running shoes" and "running shoes" end up in different groups.
- **Enhancement Plan**: Implement NLP based similarity grouping or longest-common-substring logic so phrases sharing core roots are grouped together properly.

## `/src/app/dashboard/seo/tools/keyword-mixer/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/keyword-mixer/page.tsx`
- **Current Features**: Mixes two lists of keywords into every possible combination.
- **Possible Features**: Allow 3 or 4 lists. Add wrapper outputs (e.g. `[keyword]`, `"keyword"`) for Google Ads match types.
- **Errors**: Can generate an extremely massive array that locks up the browser if users paste thousands of rows.
- **Enhancement Plan**: Add a warning/limiter for mixes exceeding 10,000 combinations. Add Google Ads match type formatting modifiers (Exact, Phrase, BMM).

## `/src/app/dashboard/seo/tools/keyword-negative/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/keyword-negative/page.tsx`
- **Current Features**: Scans a keyword list against a hardcoded array of common negative words (like "free", "cheap", "torrent") and flags them.
- **Possible Features**: Allow users to define a custom negative list.
- **Errors**: Hardcoded list is very narrow.
- **Enhancement Plan**: Provide multiple negative lists (e.g. "B2B negatives", "E-commerce negatives") and allow adding custom negative words to cross-reference.

## `/src/app/dashboard/seo/tools/keyword-rank-checker/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/keyword-rank-checker/page.tsx`
- **Current Features**: Heuristic deterministic ranking score generator (returns a fake ranking position).
- **Possible Features**: Real SERP API tracking.
- **Errors**: Explicitly labeled as a placeholder/demo tool.
- **Enhancement Plan**: Hook up an actual SERP scraping API (like DataForSEO, ScaleSERP, or SerpApi) to return true Google rankings.

## `/src/app/dashboard/seo/tools/keyword-trends/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/keyword-trends/page.tsx`
- **Current Features**: Plots a deterministic dummy line chart using SVG to represent 12-month keyword trend interest.
- **Possible Features**: Google Trends API integration.
- **Errors**: Uses fake generated data.
- **Enhancement Plan**: Replace the fake line chart with the `google-trends-api` (via a Next.js server action) to render real global interest graphs.

## `/src/app/dashboard/seo/tools/link-extractor/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/link-extractor/page.tsx`
- **Current Features**: Fetches a page URL, parses all `<a>` tags, and displays their href, anchor text, rel, and nofollow status. Includes CSV export.
- **Possible Features**: Distinguish internal vs external links automatically. Filter by nofollow.
- **Errors**: Relies on a proxy fetcher which can be blocked by target domains.
- **Enhancement Plan**: Automatically resolve relative paths to absolute URLs. Add an inline filter to toggle between internal/external and dofollow/nofollow.

## `/src/app/dashboard/seo/tools/log-analyzer/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/log-analyzer/page.tsx`
- **Current Features**: Parses NCSA combined access logs to find unique IPs, bots, top paths, and user agents.
- **Possible Features**: File upload for massive logs (rather than copy-paste text box).
- **Errors**: `setText` state in a textarea for multi-megabyte log files will freeze the browser.
- **Enhancement Plan**: Change input to file upload exclusively and process the file line-by-line via FileReader API in chunks to handle gigabyte-sized log files.

## `/src/app/dashboard/seo/tools/long-tail-keywords/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/long-tail-keywords/page.tsx`
- **Current Features**: Expands a seed keyword by appending or prepending hardcoded question modifiers ("how to", "best", "near me").
- **Possible Features**: Localize modifiers by language.
- **Errors**: None.
- **Enhancement Plan**: Group outputs logically (e.g. "Questions", "Commercial", "Local") instead of dumping them all into a single list.

## `/src/app/dashboard/seo/tools/lorem-ipsum/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/lorem-ipsum/page.tsx`
- **Current Features**: Randomly generates a block of Lorem Ipsum placeholder text based on paragraph and sentence limits.
- **Possible Features**: Add HTML tags (generate `<p>` and `<ul>` structured text).
- **Errors**: None.
- **Enhancement Plan**: Add a toggle to generate the output wrapped in HTML tags to make it ready for direct page template insertion.

## `/src/app/dashboard/seo/tools/lsi-keywords/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/lsi-keywords/page.tsx`
- **Current Features**: Uses hardcoded prefixes/suffixes (synonyms, topics, contexts) to simulate LSI generation.
- **Possible Features**: NLP API (like Datamuse) to get actual semantically related terms.
- **Errors**: Not true LSI; merely a string concatenator.
- **Enhancement Plan**: Implement the Datamuse API (`https://api.datamuse.com/words?ml=`) to fetch genuine Latent Semantic Indexing terms algorithmically.

## `/src/app/dashboard/seo/tools/markdown-to-html/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/markdown-to-html/page.tsx`
- **Current Features**: Custom regex-based Markdown to HTML converter.
- **Possible Features**: Support Github Flavored Markdown (tables, task lists).
- **Errors**: Custom regex markdown parsers are notoriously brittle. E.g., nested lists, complex code blocks, or HTML embedded in MD will break.
- **Enhancement Plan**: Replace the custom regex implementation with a robust standard parser like `marked` or `remark`.

## `/src/app/dashboard/seo/tools/meta-tag-analyzer/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/meta-tag-analyzer/page.tsx`
- **Current Features**: Fetches a URL and parses out the title, description, canonical, Open Graph, and Twitter card tags.
- **Possible Features**: Provide length validation hints (e.g., Title is too short/long).
- **Errors**: Relies on a proxy fetcher.
- **Enhancement Plan**: Add validation badges (Green/Yellow/Red) based on character lengths. Display a live preview of what the Google SERP and Twitter/Facebook cards would look like.

## `/src/app/dashboard/seo/tools/meta-tag-generator/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/meta-tag-generator/page.tsx`
- **Current Features**: Form with inputs for title, description, author, robots, OG, and Twitter fields, which generates raw HTML meta tags.
- **Possible Features**: Character count limits dynamically updating on inputs.
- **Errors**: None.
- **Enhancement Plan**: Add character counters on the Title and Description fields with color-coding to warn users if their text exceeds standard SERP limits.

## `/src/app/dashboard/seo/tools/mobile-friendly/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/mobile-friendly/page.tsx`
- **Current Features**: Fetches a page and runs regex checks for Viewport tags, media queries, Flash content, and readable font sizes.
- **Possible Features**: Use Google Pagespeed Insights API for a real mobile score.
- **Errors**: Very primitive regex checks. CSS might be external, meaning the `@media` query check will fail if CSS is not inline.
- **Enhancement Plan**: Fetch the actual CSS files referenced in `<link rel="stylesheet">` tags, or ideally wrap Google's Pagespeed Insights API.

## `/src/app/dashboard/seo/tools/nginx-redirect/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/nginx-redirect/page.tsx`
- **Current Features**: Dynamic builder for Nginx `rewrite` directives inside a server block.
- **Possible Features**: Support exact matches (`location = /old`) versus regex matches.
- **Errors**: None.
- **Enhancement Plan**: Allow toggling between `rewrite` rules and `return 301` inside `location` blocks, as `return` is faster/preferred in modern Nginx configs.

## `/src/app/dashboard/seo/tools/og-image-generator/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/og-image-generator/page.tsx`
- **Current Features**: Uses the Canvas API to generate a 1200x630 Open Graph share image with a title, subtitle, bg color, and text color.
- **Possible Features**: Add brand logo watermark. Support background images/patterns.
- **Errors**: Text wrapping logic is basic and might overflow vertically.
- **Enhancement Plan**: Allow users to upload a background image instead of just solid colors. Add vertical centering math so the text is dynamically aligned based on line breaks.

## `/src/app/dashboard/seo/tools/og-tag-generator/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/og-tag-generator/page.tsx`
- **Current Features**: Generates only Open Graph tags (Title, Type, URL, Image, Site name, Description) and outputs them as HTML.
- **Possible Features**: Live Facebook/LinkedIn card preview.
- **Errors**: None.
- **Enhancement Plan**: Add a live CSS-based "Card Preview" showing exactly how the image, title, and description will look when shared on a feed.

## `/src/app/dashboard/seo/tools/on-page-audit/page.tsx`
- **Route / Component**: `src/app/dashboard/seo/tools/on-page-audit/page.tsx`
- **Current Features**: Fetches a URL and runs 10 basic on-page checks (Title length, H1 count, alt tags, JSON-LD, etc.).
- **Possible Features**: Word count estimation. Internal/External link ratio.
- **Errors**: Relies on a proxy fetcher, won't execute client-side JS so SPAs without SSR will fail most checks.
- **Enhancement Plan**: Use a headless browser (Puppeteer) API instead of a simple HTTP proxy to run audits on client-rendered React/Vue sites.
