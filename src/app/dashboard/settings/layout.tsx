/**
 * Settings layout — empty passthrough.
 *
 * Previously rendered its own h1 + description header, which conflicted
 * with the Clay page-level header rebuilt inside the route itself. Kept
 * as a file only so nested routes (/dashboard/settings/profile etc.)
 * inherit Clay chrome from the dashboard layout above.
 */

import React from 'react';

export default function WachatSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
