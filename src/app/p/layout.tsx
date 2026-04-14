import type { ReactNode } from 'react';

/**
 * Public portal layout.
 *
 * Used by customer-facing pages under `/p/*` — pages that leads or
 * clients reach via a shared URL without authenticating. This layout
 * intentionally avoids the Clay sidebar/topbar chrome. It renders a
 * centered, calm surface that is safe to share externally.
 */
export default function PublicPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-clay-bg text-clay-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              aria-hidden="true"
              className="h-8 w-8 rounded-clay-md bg-clay-rose-soft"
            />
            <span className="text-[14px] font-semibold text-clay-ink">
              Customer Portal
            </span>
          </div>
          <span className="text-[11.5px] text-clay-ink-muted">
            Secure shared link
          </span>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="pt-6 text-center text-[11.5px] text-clay-ink-muted">
          This page is intended for the recipient of the shared link.
        </footer>
      </div>
    </div>
  );
}
