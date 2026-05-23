# Masterplan Chunk 32

## Route / Component: `src/app/dashboard/seo/tools/page-size-checker/page.tsx`
**Current Features**: A UI page to check the byte size, status, content-type, and redirection hops of a given web page URL using the `apiFetchUrl` internal API.
**Possible Features**: Add historical tracking of page sizes. Visualize size breakdown (HTML vs embedded scripts if we expand the API to fetch resources). Add a warning if size exceeds best-practice thresholds (e.g., > 2MB).
**Errors**: `res` is typed as `any`. No loading skeleton, just a disabled button state. 
**Enhancement Plan**: Replace `any` typing with a specific interface for API responses. Add visual indicators (green/yellow/red) depending on page size limits.

## Route / Component: `src/app/dashboard/seo/tools/page-speed/page.tsx`
**Current Features**: A mockup tool for Google PageSpeed Insights. It currently generates deterministic placeholder data (Performance, LCP, FID, CLS, TTFB) based on a simple hash of the URL instead of hitting a real API.
**Possible Features**: Integrate actual Google PageSpeed Insights API. Support mobile vs desktop selection. Provide suggestions to fix core web vitals issues.
**Errors**: `data` is typed as `any`. The file fakes the metrics using a `hash()` function.
**Enhancement Plan**: Remove placeholder logic and implement real API calls to Google's Lighthouse/PageSpeed API. Add detailed audit breakdowns. Replace `any` state with a strongly typed CoreWebVitals interface.

## Route / Component: `src/app/dashboard/seo/tools/page-structure/page.tsx`
**Current Features**: Analyzes a URL's structure by parsing HTML into an H1-H6 heading hierarchy using `apiFetchUrl` and `parseHtml`. Outputs a warning if there isn't exactly one H1 tag.
**Possible Features**: Add visualization of the heading tree (indented lists). Check for skipped heading levels (e.g., H2 straight to H4).
**Errors**: Minimal error handling for unparseable HTML.
**Enhancement Plan**: Improve the UI to render the headers in a nested tree view rather than flat categories.

## Route / Component: `src/app/dashboard/seo/tools/page.tsx`
**Current Features**: A hub page displaying all available SEO tools. It allows filtering by category and searching by text (name/description/slug). The items are mapped from `SEO_TOOLS` and `SEO_TOOL_CATEGORIES`.
**Possible Features**: Add favorites/bookmarks for frequently used tools. Add analytics to track which tools are most popular and surface them at the top.
**Errors**: `Wrapper` variable is typed as `any`.
**Enhancement Plan**: Fix `any` typing for `Wrapper` using `ElementType`. Improve the grid layout with small icons for each tool category.

## Route / Component: `src/app/dashboard/seo/tools/paragraph-counter/page.tsx`
**Current Features**: Text area component that counts paragraphs, sentences, and words using utility functions from `text-utils`.
**Possible Features**: Add reading time estimate, character count (with/without spaces), and reading level (Flesch-Kincaid).
**Errors**: None visually apparent, relies heavily on regex in `text-utils`.
**Enhancement Plan**: Enhance to a full "Content Analyzer" with keyword density and readability scoring.

## Route / Component: `src/app/dashboard/seo/tools/password-generator/page.tsx`
**Current Features**: Generates random secure passwords using `crypto.getRandomValues`. Has settings for length and character sets (upper, lower, digits, symbols), and calculates a basic visual strength score.
**Possible Features**: Check generated password against HaveIBeenPwned API (locally/anonymously via k-anonymity). Provide memorable passphrases (e.g., "correct-horse-battery-staple").
**Errors**: The strength calculation logic is very naive (`length * 6 + options * 10`). 
**Enhancement Plan**: Use a robust library like `zxcvbn` for strength estimation. Improve the UI to show specific weak points.

## Route / Component: `src/app/dashboard/seo/tools/people-also-ask/page.tsx`
**Current Features**: Uses question prefixes (e.g., "how to", "what is") and appends the user's query to fetch Google autocomplete suggestions via `/api/seo-tools/autocomplete`.
**Possible Features**: Export questions to CSV. Group questions semantically. Provide search volume for each question.
**Errors**: The `catch {}` block inside the loop silently ignores API errors, meaning partial failures go unnoticed.
**Enhancement Plan**: Add error reporting or retry logic. Create a structured table UI with bulk export instead of a simple list.

## Route / Component: `src/app/dashboard/seo/tools/qr-code/page.tsx`
**Current Features**: Generates an SVG QR code for the provided text/URL using `react-qr-code`. Allows downloading the QR code as an SVG.
**Possible Features**: Support custom colors, logo overlays, and different export formats (PNG, WebP).
**Errors**: The download function uses manual DOM querying (`wrapRef.current?.querySelector('svg')`) which is fragile in React.
**Enhancement Plan**: Refactor the download functionality using a standard library for rendering SVG to canvas and saving, avoiding direct DOM access.

## Route / Component: `src/app/dashboard/seo/tools/quality-score/page.tsx`
**Current Features**: A simple calculator that estimates a Google Ads Quality Score based on Expected CTR, Ad Relevance, and Landing Page Experience ratings.
**Possible Features**: Provide tooltips explaining each metric and how to improve them. Add history tracking for campaigns.
**Errors**: The math does not clamp correctly if inputs are bypassed or cleared.
**Enhancement Plan**: Make the slider/input UX richer. Add suggestions on how to improve scores based on the input values.

## Route / Component: `src/app/dashboard/seo/tools/query-builder/page.tsx`
**Current Features**: Allows users to build URL query strings by inputting a base URL and key/value pairs dynamically.
**Possible Features**: Parse an existing URL to populate the key/value list. Batch export/copy URLs.
**Errors**: The silent `catch { return ''; }` hides errors when the user inputs an invalid base URL (e.g. without `http://`).
**Enhancement Plan**: Add validation UI for the base URL so users understand why the output is blank. Add the ability to paste a full URL and decode it into the table.

## Route / Component: `src/app/dashboard/seo/tools/question-keywords/page.tsx`
**Current Features**: Takes a seed keyword and generates common questions (how, what, why, etc.) by mapping over an array of `QUESTION_TEMPLATES`.
**Possible Features**: Use an actual API (e.g., DataForSEO, Ahrefs, or Google Autocomplete) to fetch real questions and their search volume.
**Errors**: None visually apparent.
**Enhancement Plan**: Connect to real keyword databases. Allow exporting the generated questions to CSV.

## Route / Component: `src/app/dashboard/seo/tools/readability-score/page.tsx`
**Current Features**: Text area component calculating Flesch Reading Ease and Flesch–Kincaid grade level using internal text utilities.
**Possible Features**: Highlight complex words or long sentences that contribute to a poor readability score. Add other scores like Gunning Fog or SMOG.
**Errors**: None visually apparent.
**Enhancement Plan**: Add visualizations for sentence length distribution. Add real-time highlighting of hard-to-read sentences.

## Route / Component: `src/app/dashboard/seo/tools/reading-time/page.tsx`
**Current Features**: Text area component estimating reading time based on a user-adjustable "words per minute" metric (default 200).
**Possible Features**: Add speaking time (for scripts). Account for images in the text (which add ~12 seconds per image).
**Errors**: None visually apparent.
**Enhancement Plan**: Make it a more comprehensive content analyzer that also estimates text-to-speech lengths.

## Route / Component: `src/app/dashboard/seo/tools/redirect-checker/page.tsx`
**Current Features**: Checks a URL and displays the redirect chain, hops, and final URL/status using `apiFetchUrl`.
**Possible Features**: Provide a warning if the redirect chain is too long (e.g., >3 hops which hurts SEO). Handle meta-refresh redirects.
**Errors**: None visually apparent.
**Enhancement Plan**: Add visual warnings for redirect loops or overly long chains. Add a visual timeline UI for the redirect chain.

## Route / Component: `src/app/dashboard/seo/tools/regex-tester/page.tsx`
**Current Features**: A UI for testing regular expressions against a sample text. Uses `dangerouslySetInnerHTML` with basic `<mark>` highlighting to show matches.
**Possible Features**: Include regex cheatsheet. Provide regex explanations (e.g. splitting the pattern and explaining what each token does).
**Errors**: The `escape` function used before injecting HTML might cause alignment/character issues with certain HTML entities depending on the regex. `dangerouslySetInnerHTML` is used.
**Enhancement Plan**: Use a robust code highlighting library or regex parser (like `regex-colorizer`) instead of manual `<mark>` injection to prevent XSS or misaligned highlighting.

## Route / Component: `src/app/dashboard/seo/tools/related-keywords/page.tsx`
**Current Features**: Appends static prefixes, suffixes, and modifiers to a seed keyword to generate related keyword ideas.
**Possible Features**: Fetch real search volumes and CPC for the generated ideas. Group them by search intent.
**Errors**: None visually apparent.
**Enhancement Plan**: Connect to a keyword data provider rather than using hardcoded lists.

## Route / Component: `src/app/dashboard/seo/tools/remove-extra-spaces/page.tsx`
**Current Features**: Text area that collapses multiple spaces and blank lines using `removeExtraSpaces`.
**Possible Features**: Option to trim trailing spaces or completely remove blank lines (vs collapsing them).
**Errors**: None visually apparent.
**Enhancement Plan**: Add toggles to let the user specify exactly which types of spaces/lines to remove.

## Route / Component: `src/app/dashboard/seo/tools/remove-line-breaks/page.tsx`
**Current Features**: Removes all line breaks from the provided text using `removeLineBreaks`.
**Possible Features**: Option to replace line breaks with spaces or specific separators (e.g., commas for CSVs).
**Errors**: None visually apparent.
**Enhancement Plan**: Add a separator input (defaulting to space) instead of just stripping line breaks entirely which might merge words.

## Route / Component: `src/app/dashboard/seo/tools/reverse-image-search/page.tsx`
**Current Features**: Takes an image URL and generates direct links to Google Lens, TinEye, Yandex, and Bing reverse image searches.
**Possible Features**: Support image file uploads (convert to data URL or upload to a temporary host and pass to the engines).
**Errors**: None visually apparent.
**Enhancement Plan**: Add image upload capability. Embed the image preview.

## Route / Component: `src/app/dashboard/seo/tools/robots-meta/page.tsx`
**Current Features**: Generates a `<meta name="robots">` tag via UI toggles for index, follow, noarchive, nosnippet, and noimageindex.
**Possible Features**: Add max-snippet, max-video-preview, and max-image-preview directives.
**Errors**: None visually apparent.
**Enhancement Plan**: Include advanced directives like `max-snippet` with numeric inputs.

## Route / Component: `src/app/dashboard/seo/tools/robots-txt-generator/page.tsx`
**Current Features**: Form for building a robots.txt file with `User-agent`, `Disallow`, `Allow`, `Crawl-delay`, and `Sitemap` directives. Provides a download button to save the file.
**Possible Features**: Add presets for common frameworks (e.g., WordPress, Next.js). Show real-time previews of which URLs would be blocked based on sample inputs.
**Errors**: None visually apparent.
**Enhancement Plan**: Add standard platform presets. Let users input their own domain and automatically append the common sitemap path.

## Route / Component: `src/app/dashboard/seo/tools/robots-txt-tester/page.tsx`
**Current Features**: Fetches the `robots.txt` of a provided domain via `apiFetchUrl` and displays its raw content.
**Possible Features**: Parse the `robots.txt` and provide a search box to test if a specific URL is allowed or disallowed for a specific bot.
**Errors**: The protocol prepend regex `/^https?:\/\//` and string manipulation is slightly naive.
**Enhancement Plan**: Add a true testing capability where the user enters a specific path and user-agent to see if the fetched `robots.txt` blocks it.

## Route / Component: `src/app/dashboard/seo/tools/schema/page.tsx`
**Current Features**: A wrapper page that renders the `<SchemaBuilder />` component from `@/components/seo/schema-builder`.
**Possible Features**: N/A (relies on the inner component).
**Errors**: None within this file.
**Enhancement Plan**: Add saved schema templates.

## Route / Component: `src/app/dashboard/seo/tools/schema-generator/page.tsx`
**Current Features**: A dynamic form generating JSON-LD `<script>` tags for schemas: Article, Product, LocalBusiness, FAQPage, and ZoruBreadcrumbList.
**Possible Features**: Add more schema types (Event, Recipe, Person, Organization).
**Errors**: The `obj` is explicitly typed as `any`.
**Enhancement Plan**: Use a robust typing library for Schema.org JSON-LD to prevent typos and ensure required fields are present.

## Route / Component: `src/app/dashboard/seo/tools/schema-validator/page.tsx`
**Current Features**: Takes raw JSON-LD text (or a script tag), cleans it, parses it, and displays the `@context`, `@type`, and a pretty-printed JSON.
**Possible Features**: Run the parsed schema against actual Schema.org validation rules to highlight missing or required properties.
**Errors**: It only checks if it's valid JSON, not if it's a valid Schema according to Google's structured data guidelines.
**Enhancement Plan**: Add a JSON Schema validator package to verify that all required fields for the specific `@type` are present.

## Route / Component: `src/app/dashboard/seo/tools/sentence-counter/page.tsx`
**Current Features**: Counts sentences, words, and the average words per sentence.
**Possible Features**: Highlight overly long sentences.
**Errors**: The logic for counting sentences relies on `text-utils` which might fail on abbreviations (like "e.g." or "Mr.").
**Enhancement Plan**: Integrate an advanced NLP sentence boundary detection library rather than simple regex. Add a visual highlight for "hard to read" sentences.

## Route / Component: `src/app/dashboard/seo/tools/server-location/page.tsx`
**Current Features**: Uses an internal `apiDnsLookup` endpoint to resolve the IPv4 A records of a domain. It explicitly states it's local DNS only and doesn't do geolocation.
**Possible Features**: Integrate a free/open GeoIP database to actually show the server location (city/country) on a map.
**Errors**: `data` is typed as `any`.
**Enhancement Plan**: Call a free IP geolocation API to fulfill the tool's namesake "Server Location". Replace `any` type with a structured interface.

## Route / Component: `src/app/dashboard/seo/tools/sitemap-generator/page.tsx`
**Current Features**: Takes a list of URLs and wraps them in valid `sitemap.xml` markup with configurable priority and changefreq.
**Possible Features**: Extract URLs automatically from a domain instead of requiring manual input. Allow per-URL priority settings.
**Errors**: The priority and changefreq apply globally to all provided URLs, which is often not desirable.
**Enhancement Plan**: Make it a table where each URL has its own dropdowns for priority and changefreq.

## Route / Component: `src/app/dashboard/seo/tools/sitemap-validator/page.tsx`
**Current Features**: Fetches a sitemap XML URL, parses the XML to check for headers, `urlset`, `sitemapindex`, and counts the `<loc>` tags using regex.
**Possible Features**: Check if URLs inside the sitemap return 200 OK or redirect/404.
**Errors**: Uses naive string `.matchAll` regex to parse XML, which will fail if tags are formatted unexpectedly or contain CDATA.
**Enhancement Plan**: Refactor to use a proper XML parser (like `fast-xml-parser`) for reliable results. 

## Route / Component: `src/app/dashboard/seo/tools/slug-generator/page.tsx`
**Current Features**: Converts a string into a URL-friendly slug using `toSlug`.
**Possible Features**: Allow selecting standard lowercase vs Title Case or camelCase slugs.
**Errors**: `catch` block in clipboard copy is empty.
**Enhancement Plan**: Add customizable separators (hyphen vs underscore). Add a toast notification for copy success/failure.

## Route / Component: `src/app/dashboard/seo/tools/ssl-checker/page.tsx`
**Current Features**: Form for checking the SSL certificate of a domain. Calls `apiSsl` to fetch data and displays host, authorized status, protocol, issuer, validity period, and SHA-256 fingerprint.
**Possible Features**: Add a visual trust meter. Explain what specific errors mean (e.g. self-signed vs expired). Check for weak cipher suites.
**Errors**: None visually apparent, assumes `apiSsl` handles error translation well.
**Enhancement Plan**: Replace `any` typing on `data` with a structured SSL interface. Add visual cues (red text/badge) if less than 30 days remaining.

## Route / Component: `src/app/dashboard/seo/tools/text-case-converter/page.tsx`
**Current Features**: Converts text into UPPER CASE, lower case, Title Case, Sentence case, camelCase, and iNVERSE cASE using utility functions.
**Possible Features**: Add snake_case and kebab-case. Add real-time preview instead of clicking buttons.
**Errors**: None visually apparent.
**Enhancement Plan**: Expand the set of supported casing styles. Add a button to copy the output automatically.

## Route / Component: `src/app/dashboard/seo/tools/text-compare/page.tsx`
**Current Features**: Compares two blocks of text line-by-line and highlights the differences using the `diffLines` utility.
**Possible Features**: Add character-level diffs within changed lines. Allow ignoring whitespace differences.
**Errors**: The diff rendering is quite simple and might not align perfectly if lines have different heights.
**Enhancement Plan**: Implement a more robust library like `diff-match-patch` for character-level granularity and better side-by-side sync scrolling.

## Route / Component: `src/app/dashboard/seo/tools/text-repeater/page.tsx`
**Current Features**: Takes input text and repeats it N times, joined by a chosen separator (like `\n` or `\t`).
**Possible Features**: Add a suffix or prefix per repeated line. Allow auto-incrementing numbers (e.g., repeating a pattern with 1, 2, 3...).
**Errors**: None visually apparent.
**Enhancement Plan**: Add options for appending line numbers. Provide a quick copy-to-clipboard button.

## Route / Component: `src/app/dashboard/seo/tools/text-reverser/page.tsx`
**Current Features**: Reverses text by characters, word order, or line order.
**Possible Features**: Mirror text using Unicode equivalent characters (uʍop ǝpısdn).
**Errors**: Reversing characters directly using string split/reverse will break emojis/surrogate pairs.
**Enhancement Plan**: Use a Unicode-aware string reverser library (like `grapheme-splitter`) to correctly handle emojis and complex characters.

## Route / Component: `src/app/dashboard/seo/tools/text-to-html/page.tsx`
**Current Features**: Converts plain text to HTML paragraphs using the `textToHtml` utility.
**Possible Features**: Support simple markdown formatting (bold, italic, links). Add an HTML preview iframe.
**Errors**: None visually apparent.
**Enhancement Plan**: Upgrade this to a minimal markdown-to-HTML converter for greater utility.

## Route / Component: `src/app/dashboard/seo/tools/text-to-slug/page.tsx`
**Current Features**: Generates a URL-friendly slug from text input in real-time.
**Possible Features**: Same as `slug-generator` (they seem functionally identical, though `text-to-slug` lacks a copy button and uses a simpler UI).
**Errors**: Duplicate functionality with `slug-generator`.
**Enhancement Plan**: Deprecate one of them and redirect to the canonical tool, or consolidate the UI.

## Route / Component: `src/app/dashboard/seo/tools/title-tag-checker/page.tsx`
**Current Features**: Fetches a URL and parses its HTML to extract the `<title>` tag. Validates its length, recommending 30–60 characters. Shows a progress bar.
**Possible Features**: Suggest optimized titles using AI. Check if the title matches the H1. Check for keyword stuffing.
**Errors**: Uses naive length constraints; Google actually truncates based on pixel width, not character count.
**Enhancement Plan**: Add pixel-width calculation for more accurate title truncation warnings, mimicking desktop and mobile SERPs.

## Route / Component: `src/app/dashboard/seo/tools/twitter-card-generator/page.tsx`
**Current Features**: Form for building Twitter meta tags (`twitter:card`, `twitter:site`, `twitter:title`, `twitter:description`, `twitter:image`). Generates HTML meta tags.
**Possible Features**: Show a live visual preview of what the card would look like on Twitter/X.
**Errors**: The image URL field isn't validated.
**Enhancement Plan**: Add a live visual mock-up of the Twitter card alongside the code generator.

## Route / Component: `src/app/dashboard/seo/tools/url-decoder/page.tsx`
**Current Features**: Decodes percent-encoded URLs using `decodeURIComponent` with error handling.
**Possible Features**: Highlight the decoded query parameters in a structured table. Provide a one-click toggle to encode back.
**Errors**: `catch (e: any)` used.
**Enhancement Plan**: Parse out the decoded URL search params and display them in a neat table view. Provide a toggle to switch between encode/decode modes in one tool.

## Route / Component: `src/app/dashboard/seo/tools/url-encoder/page.tsx`
**Current Features**: A UI that takes plain text and encodes it via `encodeURIComponent`.
**Possible Features**: Option to encode/decode in the same UI. Support form-url-encoding (`+` instead of `%20`).
**Errors**: The catch block is empty.
**Enhancement Plan**: Merge this logic with the URL Decoder page into a single tool for better UX.

## Route / Component: `src/app/dashboard/seo/tools/url-parser/page.tsx`
**Current Features**: Uses the native `new URL()` constructor to split a URL into protocol, hostname, port, pathname, search, hash, username, password, origin, and href. Displays them in a table.
**Possible Features**: Parse out the query string parameters into a nested table. Allow users to edit parts and rebuild the URL.
**Errors**: The `catch (e: any)` hides actual native exceptions (though the message is handled, TS rules usually prefer `unknown`).
**Enhancement Plan**: Provide query string parameter breakdown natively.

## Route / Component: `src/app/dashboard/seo/tools/url-rewriter/page.tsx`
**Current Features**: Takes a URL, finds text (literal or regex), and replaces it with another text.
**Possible Features**: Highlight the replaced section in the output. Keep a history of rewrite rules.
**Errors**: The inline regex generation `new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')` assumes simple global replacement, and silent catch on failure.
**Enhancement Plan**: Add live highlighting of what changed. Show diff between old and new URLs.

## Route / Component: `src/app/dashboard/seo/tools/url-to-ip/page.tsx`
**Current Features**: Uses `apiDnsLookup` to fetch the A records for the hostname extracted from the provided URL.
**Possible Features**: Also fetch AAAA (IPv6) and MX/TXT records. Combine with the Server Location checker.
**Errors**: Only checks 'A' records explicitly. No fallback for CNAME handling if not handled natively by `apiDnsLookup`.
**Enhancement Plan**: Merge with the Server Location tool, as they essentially do the exact same thing (IP resolution).

## Route / Component: `src/app/dashboard/seo/tools/utm-builder/page.tsx`
**Current Features**: A UI form to construct a Google Analytics UTM-tagged URL from a base URL and fields for source, medium, campaign, term, and content.
**Possible Features**: Save frequently used parameters (e.g. medium: email). Integrate a URL shortener button.
**Errors**: Native `new URL` throws if base is invalid, which is caught silently returning an empty string without notifying the user why.
**Enhancement Plan**: Add validation to the Base URL field to inform the user if it's missing `http://`.
