'use client';

// The wachat root layout already wraps every page in the new shell.
// Children render directly so each integration page controls its own
// header via `<PageHeader />`.
export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
