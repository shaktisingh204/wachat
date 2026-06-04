'use client';

/**
 * TwentyEmbed — mounts the REAL built `twenty-front` SPA inside SabNode.
 *
 * The blueprint's verdict (docs/twenty-clone/PLAN.md §1) is to run Twenty's own
 * frontend as-is rather than re-port 6000+ files. `twenty-front` is a separate
 * Vite build, so it's embedded via an iframe inside SabNode's chrome — the host
 * page wraps this in `SabcrmOuterShell` (the SabNode app rail + header), so the
 * user keeps the workspace's app switcher while the iframe is 100% real Twenty
 * (same CSS, same elements, zero drift). The iframe's `/sabcrm/api/*` calls hit
 * the existing Next.js proxy → `twenty-server`.
 *
 * The source URL is configurable so the build output can be served wherever ops
 * mounts it (a static path under the app, or twenty-server itself).
 */

import * as React from 'react';

/** Where the built twenty-front is served. Override via NEXT_PUBLIC_TWENTY_FRONT_URL. */
const TWENTY_FRONT_URL =
  process.env.NEXT_PUBLIC_TWENTY_FRONT_URL && process.env.NEXT_PUBLIC_TWENTY_FRONT_URL.length > 0
    ? process.env.NEXT_PUBLIC_TWENTY_FRONT_URL
    : '/sabcrm/app/';

export function TwentyEmbed(): React.JSX.Element {
  return (
    <iframe
      src={TWENTY_FRONT_URL}
      title="SabCRM"
      // Fill the SabcrmOuterShell body (min-h-0 flex-1) edge-to-edge.
      className="h-full w-full border-0"
      // Same-origin (served under /sabcrm) so the iframe shares cookies/session
      // with the host; allow the capabilities Twenty needs.
      allow="clipboard-read; clipboard-write; fullscreen"
    />
  );
}

export default TwentyEmbed;
