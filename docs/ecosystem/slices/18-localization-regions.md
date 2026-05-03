## 18. Localization, Regions & Tax

1. Build a centralized i18n message catalog with namespaced keys per module (Wachat, SabFlow, CRM, SEO, SabChat) versioned in MongoDB.
2. Wire next-intl into the App Router with a `[locale]` segment, locale negotiation, and fallback to English for missing keys.
3. Ship UI strings in 25 languages spanning English, Spanish, Portuguese, French, German, Italian, Dutch, Polish, Turkish, and Russian baseline tiers.
4. Extend localization coverage to Arabic, Hebrew, Hindi, Bengali, Marathi, Tamil, Telugu, Indonesian, Vietnamese, and Thai for emerging market reach.
5. Complete the catalog with Japanese, Korean, Mandarin, Cantonese, Ukrainian, and Hinglish variants for full regional parity.
6. Detect browser `Accept-Language` headers in proxy middleware and persist the chosen locale on a server-side httpOnly cookie.
7. Add a locale switcher in the top navbar that previews translation completeness percentages before committing the change.
8. Build right-to-left layout flipping using CSS logical properties and `dir="rtl"` for Arabic and Hebrew users.
9. Audit Tailwind classes to replace `ml-*`/`mr-*` with `ms-*`/`me-*` logical equivalents across all components.
10. Mirror icons, chevrons, and progress indicators automatically in RTL mode while preserving brand logos and number directionality.
11. Implement bidirectional text isolation using `<bdi>` wrappers for usernames, phone numbers, and embedded English in Arabic flows.
12. Build a translation memory database keyed on source text hash to reuse approved phrases across modules and reduce retranslation cost.
13. Maintain a per-tenant glossary enforcing brand terms (SabNode, Wachat, SabFlow) untranslated and product nouns consistent across locales.
14. Integrate AI-assisted translation via the AI Gateway routing to GPT-4 or DeepL with locale-specific prompt templates and tone hints.
15. Queue AI suggestions into a reviewer workflow with inline diff, glossary violations, and approve/edit/reject actions per string.
16. Track translator productivity metrics (strings/hour, edit distance, rejection rate) for staffing freelancer review pools.
17. Provision regional data centers in US-East, US-West, EU-West, EU-Central, India, Singapore, Sydney, and Brazil with active-active Mongo replicas.
18. Route tenants to their home region via Vercel routing middleware reading the workspace `homeRegion` field at request time.
19. Pin Firebase Storage buckets and Redis clusters per region to keep media and queues local for latency under 80ms.
20. Replicate translation catalogs globally via Edge Config so locale lookups stay sub-10ms regardless of user location.
21. Build a currency catalog with 50+ ISO 4217 codes, daily ECB exchange rate refresh, and per-tenant display currency preference.
22. Render prices using `Intl.NumberFormat` with locale-aware thousands separators, decimal points, and currency symbol placement.
23. Compute taxes server-side with a pluggable engine supporting EU VAT (per-country rates), India GST (CGST/SGST/IGST split), US sales tax (state+ZIP nexus), and Brazil PIS/COFINS layers.
24. Integrate TaxJar or Avalara as fallback for nexus-determination and exemption certificates on enterprise plans.
25. Validate VAT IDs through the VIES service and apply reverse-charge for B2B EU cross-border invoices automatically.
26. Generate locale-compliant invoice PDFs (German GoBD, Italian SDI e-invoice XML, Indian e-invoice IRN) via a templated rendering service.
27. Add LGPD compliance toggles for Brazilian tenants enforcing DPO contact, data subject portal, and ANPD breach reporting workflows.
28. Add PIPEDA controls for Canadian tenants covering consent receipts, breach risk thresholds, and Privacy Commissioner notification timelines.
29. Add KSA PDPL controls for Saudi tenants enforcing data residency in-Kingdom, SDAIA registration metadata, and Arabic-language privacy notices.
30. Auto-detect tenant region from billing address and pre-toggle the correct compliance bundle on workspace creation.
31. Store all timestamps in UTC and convert to the tenant's IANA timezone (`Asia/Kolkata`, `America/Sao_Paulo`) at render time only.
32. Make SabFlow scheduled triggers DST-aware using `luxon` zoned cron expressions that survive spring-forward and fall-back transitions.
33. Surface a "schedule will run at X local / Y UTC" preview on every cron, broadcast, and reminder UI to prevent off-by-an-hour bugs.
34. Detect tenant timezone from browser on first signup and offer a confirmation dialog before persisting to the workspace record.
35. Format dates using `Intl.DateTimeFormat` with locale-specific patterns (DD/MM/YYYY in EU, MM/DD/YYYY in US, YYYY年MM月DD日 in JP).
36. Render relative times ("3 hours ago", "yesterday") using `Intl.RelativeTimeFormat` localized per user preference.
37. Pluralize counts correctly via ICU MessageFormat handling Arabic's six plural categories and Russian's three forms.
38. Handle CJK input methods in textareas by debouncing onChange to fire after IME composition end events.
39. Integrate KakaoTalk Business Channel as a Wachat provider for Korean tenants with template approval and alimtalk/friendtalk routing.
40. Integrate LINE Official Account as a Wachat channel for Japan and Thailand including rich menus and broadcast quotas.
41. Integrate WeChat Work and WeChat Official Account for mainland China with required ICP licensing checks at provisioning time.
42. Add Zalo channel support for Vietnam with OA verification, ZNS template approval, and Vietnamese-specific opt-in flows.
43. Add Viber Business and Telegram Business as channels for Eastern European and CIS markets with respective API adapters.
44. Build a per-region channel catalog gating which providers appear in onboarding based on tenant home region and language.
45. Localize email templates, push notifications, and SMS bodies with the same i18n catalog used by web UI for consistency.
46. Localize legal pages (Terms, Privacy, DPA) per jurisdiction with a versioned acceptance log capturing IP, timestamp, and locale.
47. Build a locale-coverage admin dashboard showing translation completeness percent, missing keys, and stale entries per language.
48. Run a CI check that fails PRs introducing untranslated strings outside English and reports key counts per locale to GitHub.
49. Expose a public-facing locale toggle on marketing pages with hreflang tags emitted for SEO and canonical URL preservation.
50. Track locale, region, currency, and channel usage in the analytics warehouse to prioritize translation investment by revenue impact.
