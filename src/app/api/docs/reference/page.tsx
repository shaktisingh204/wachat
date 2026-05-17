/**
 * Full interactive API reference at `/api/docs/reference`.
 *
 * Renders the Scalar (https://scalar.com/) viewer against the live
 * OpenAPI 3.1 spec served by `/api/v1/openapi`. The spec is generated
 * from `tools/api-manifest/` on every `pnpm api:gen` so this page is
 * always in sync with the routes.
 *
 * For the dashboard sandbox (with the user's test key pre-filled), see
 * `/dashboard/api/docs`. The curated quick-start curl recipes live at
 * the parent `/api/docs` page.
 *
 * This page returns a full HTML document — Scalar wants control of the
 * <body> so it can mount its own root. Returning a complete document
 * from a Server Component sidesteps the App Router's default layout
 * wrapping.
 */

export const dynamic = 'force-static';
export const runtime = 'nodejs';

export default function ApiReferencePage(): JSX.Element {
  return (
    <html lang="en">
      <head>
        <title>SabNode API Reference</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Interactive reference for the SabNode public API. 500+ endpoints across messaging, CRM, HRM, sales, accounting, and more."
        />
      </head>
      <body style={{ margin: 0 }}>
        <script
          id="api-reference"
          data-url="/api/v1/openapi"
          data-configuration={JSON.stringify({
            theme: 'default',
            layout: 'modern',
            hideDownloadButton: false,
            hideTestRequestButton: false,
            showSidebar: true,
            metaData: {
              title: 'SabNode API Reference',
              description:
                'Authenticate with a Bearer API key issued from /dashboard/api/keys. ' +
                'Errors follow the RFC 7807 problem-details envelope.',
            },
          })}
        />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </body>
    </html>
  );
}
