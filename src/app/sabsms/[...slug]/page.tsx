import React from "react";
import Link from "next/link";
import { RouteComingSoon, Button } from '@/components/sabcrm/20ui';

export const dynamic = "force-dynamic";

// Nearly every SabSMS surface now has a real page; this catch-all only
// fires for genuinely-unmapped paths. Keep the copy generic — the named
// routes below no longer carry stale "Coming in Phase N" promises.
const TITLES: Record<string, string> = {};

async function SabsmsCatchAllPageContent({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const key = slug?.[0] ?? "";
  const title = TITLES[key] ?? `SabSMS · /${(slug ?? []).join("/")}`;
  return (
    <RouteComingSoon
      title={title}
      description="This route isn't mapped to a SabSMS surface yet. See plans/sabsms-v2-beyond-world-class.md for the roadmap."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/sabsms">Back to SabSMS overview</Link>
        </Button>
      }
    />
  );
}


export default function SabsmsCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <SabsmsCatchAllPageContent params={params} />
    </React.Suspense>
  );
}
