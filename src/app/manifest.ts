import type { MetadataRoute } from 'next';

/**
 * Web App Manifest for the SabCRM Progressive Web App.
 *
 * Next.js auto-detects this file convention and serves it at
 * `/manifest.webmanifest` with the correct `application/manifest+json`
 * content-type — it is referenced automatically; nothing needs to be wired into
 * a `<link rel="manifest">` in any layout (Next injects it).
 *
 * Icons reuse in-repo public assets (no external CDN): a scalable SVG mark
 * (`/sabcrm-icon.svg`, doubles as the maskable icon since it scales) plus the
 * existing favicon as a small fallback. The app launches into the SabCRM home
 * (`/sabcrm`) in standalone (no browser chrome) so it feels native on mobile.
 *
 * `dynamic = 'force-static'` so the manifest is emitted as a static asset at
 * build time (it never varies per request).
 */
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SabCRM',
    short_name: 'SabCRM',
    description:
      'SabCRM — the metadata-driven CRM, native to the SabNode workspace. Works offline for recently-viewed records.',
    id: '/sabcrm',
    start_url: '/sabcrm',
    scope: '/sabcrm',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0b0b0f',
    theme_color: '#6366f1',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/sabcrm-icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'any',
      },
      {
        src: '/sabcrm-icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'maskable',
      },
      {
        src: '/sites/favicon.ico',
        type: 'image/x-icon',
        sizes: '48x48',
      },
    ],
    shortcuts: [
      {
        name: 'My work',
        short_name: 'My work',
        url: '/sabcrm/my-work',
      },
      {
        name: 'Search',
        short_name: 'Search',
        url: '/sabcrm/search',
      },
    ],
  };
}
