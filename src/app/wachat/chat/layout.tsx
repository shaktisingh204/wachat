'use client';

import { ModuleTheme } from '@/components/dashboard-ui/module-theme';

/**
 * /wachat/chat layout — full-bleed surface for the live inbox. Drops the
 * default WaPage centered max-width since the 3-pane chat shell wants
 * every pixel. Still wraps in ModuleTheme so child components can read
 * the emerald accent vars.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleTheme slug="wachat">
      <div className="h-full w-full">{children}</div>
    </ModuleTheme>
  );
}
