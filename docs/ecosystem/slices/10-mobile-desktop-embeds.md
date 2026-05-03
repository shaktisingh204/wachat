## 10. Mobile, Desktop & Embeds

1. Ship an Expo-based React Native app for iOS and Android sharing TypeScript types and API clients with the existing SabNode Next.js web codebase.
2. Build a unified live-chat inbox screen on mobile mirroring desktop conversation queues, with swipe-to-assign, swipe-to-archive, and pull-to-refresh interactions.
3. Implement push notifications via Firebase Cloud Messaging on Android and APNs on iOS, registering device tokens against the per-user, per-tenant subscription record.
4. Wire mobile push categories to in-app deep links so tapping a "new message" notification routes the user directly to that Wachat conversation thread.
5. Add a CRM contact lookup screen with fuzzy search, recent contacts, starred contacts, and offline-cached results pulled from the existing Mongo CRM module.
6. Implement a mobile-optimized broadcast composer with template picker, media attachment, audience preview, and scheduled send respecting tenant credit balance.
7. Add biometric authentication on mobile using Face ID, Touch ID, and Android BiometricPrompt to unlock the app and authorize sensitive CRM exports.
8. Build offline-first sync for conversations and contacts using SQLite plus a queued mutation log that replays against SabNode APIs when connectivity returns.
9. Ship deep-linking via universal links on iOS and App Links on Android targeting workflows, contacts, broadcasts, conversations, and admin dashboards.
10. Provide a per-tenant white-label mobile build pipeline producing branded IPA and APK artifacts using EAS Build with tenant-supplied icons and colors.
11. Add a mobile workflow runs viewer that streams SabFlow execution logs over WebSocket and lets operators retry, cancel, or pin failing nodes.
12. Implement push-to-talk voice notes in mobile chat that upload to S3-compatible storage and transcribe via the existing AI gateway pipeline.
13. Add an in-app QR scanner for joining tenants, claiming WhatsApp numbers, pairing devices, and importing contacts from printed cards.
14. Ship an Electron desktop app wrapping the SabNode web shell with native window chrome, multi-tenant tab switching, and shared session cookies.
15. Add a system-tray icon on Windows, macOS, and Linux showing unread counts, with quick-reply popovers and a "snooze notifications" toggle.
16. Register a global hotkey, default Cmd+Shift+R, that opens a floating reply window pre-targeted at the most recent unread conversation.
17. Build native OS notifications for Electron with reply, mark-read, and assign actions invoked through the Notification API rich actions surface.
18. Implement auto-update for Electron via electron-updater pulling signed builds from a SabNode-hosted release feed gated by tenant channel.
19. Add code signing and notarization for macOS, EV signing for Windows, and AppImage plus deb plus rpm artifacts for Linux distribution.
20. Ship a desktop "focus mode" that mutes non-priority tenants, hides marketing widgets, and surfaces only assigned conversations and SLA-breaching tickets.
21. Build a Chrome MV3 extension that enriches any web page with hovercards showing matching CRM contacts, last touch, and open deals.
22. Port the same extension to Edge, Firefox, and Safari Web Extensions using a shared WebExtension polyfill and per-store manifest variants.
23. Add a LinkedIn capture button injected on profile pages that imports name, headline, company, and avatar into a chosen CRM list.
24. Add a Twitter and X capture flow that records handle, follower count, latest post, and tags the new contact with the originating campaign.
25. Implement a Gmail and Outlook sidebar via the extension that logs email threads to CRM contacts and surfaces SabFlow follow-up suggestions.
26. Add a clipboard-aware "save selection to CRM" context-menu action that recognizes emails, phone numbers, and URLs and routes to the right module.
27. Ship an embeddable chat widget loaded by a one-line script tag that boots an iframe sandbox with tenant-scoped configuration and rate-limited API keys.
28. Add a customizable launcher with greetings, away messages, business-hours logic, and consent banners satisfying GDPR, CCPA, and DPDP requirements.
29. Provide an inbox-iframe embed letting partners host the agent inbox inside their own admin panel with postMessage-based auth and theme handoff.
30. Provide a dashboard-iframe embed exposing analytics widgets, broadcast metrics, and SabFlow run summaries with signed JWT-based session bridging.
31. Publish a Swift SDK on Swift Package Manager for native iOS apps wrapping live chat, push registration, identity, and event tracking calls.
32. Publish a Kotlin SDK on Maven Central for native Android apps mirroring the Swift SDK surface and supporting Jetpack Compose composables.
33. Publish a React Native SDK on npm with hooks like useSabChat, useSabContact, and useSabPush abstracting permissions and background sync.
34. Publish a Flutter SDK on pub.dev exposing widgets and streams over a Pigeon-generated platform channel layer for both iOS and Android.
35. Implement Web Push via VAPID keys for the embeddable widget, gracefully falling back to in-page toast banners when the user denies permission.
36. Add a unified design-system package distributed as @sabnode/ui consumed by web, mobile, Electron, and embeds with shared tokens, icons, and primitives.
37. Generate platform-specific theme outputs from Style Dictionary, emitting CSS variables, Tailwind config, iOS asset catalogs, and Android XML resources.
38. Ship a shared accessibility audit kit ensuring every surface meets WCAG 2.2 AA color contrast, focus, and screen-reader navigation requirements.
39. Build a localization pipeline using ICU MessageFormat with translations stored in the existing tenant-scoped Mongo collection and pulled at app launch.
40. Add right-to-left layout support across mobile, desktop, and embeds for Arabic, Hebrew, Urdu, and Farsi tenants with automated mirror snapshot tests.
41. Implement a per-tenant feature-flag bridge so embed, mobile, and desktop surfaces honor the same Unleash-style toggles served from SabNode admin.
42. Add an offline conflict-resolution UI on mobile letting agents inspect, merge, or discard pending mutations after extended offline periods.
43. Ship an Apple Watch companion app surfacing urgent inbox notifications, quick replies via dictation, and SLA countdown complications for active conversations.
44. Ship a Wear OS tile and complication for Android wearables mirroring the Apple Watch features with Tile Service refresh on push.
45. Add Siri Shortcuts and Android App Actions for "send broadcast", "lookup contact", and "summarize today's inbox" voice triggers tied to the existing AI gateway.
46. Provide a SabNode CLI distributed via Homebrew, Scoop, and npm for triggering broadcasts, exporting CRM, and running SabFlow tests from desktop terminals.
47. Add per-platform crash and performance telemetry through Sentry with PII scrubbing, tenant tagging, and release-health dashboards visible in admin.
48. Implement an embed CSP and sandbox audit script run in CI that fails builds when widget bundles exceed 80 KB gzipped or import disallowed origins.
49. Add a shared cross-surface session model using OIDC refresh tokens secured by Keychain on iOS, Keystore on Android, and OS credential vaults on desktop.
50. Ship a partner-facing playground site at embeds.sabnode.com letting integrators preview, configure, and copy snippets for every embed and SDK variant.
