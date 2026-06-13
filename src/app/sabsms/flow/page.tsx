import Link from 'next/link';
import { Workflow } from 'lucide-react';

import { Button, RouteComingSoon } from '@/components/sabcrm/20ui';

/**
 * /sabsms/flow — visual SMS flow builder.
 *
 * The standalone canvas that used to live here was a non-functional mock:
 * it rendered fabricated per-block economics (credit cost, usage counts)
 * and an editable schema that persisted nowhere, backed by a hand-written
 * `mock-data` module. It was never reachable from navigation.
 *
 * The REAL SabSMS automation surface is two things that DO work:
 *   - the SabSMS SabFlow blocks catalogue at `/sabsms/sabflow-blocks`
 *     (live from the block registry via `GET /api/sabsms/blocks`), and
 *   - the SabFlow visual editor itself, where those blocks are wired into
 *     runnable flows.
 * Rather than keep a fictional duplicate canvas, this route points to
 * them honestly until a dedicated in-module builder is built.
 */
export default function SabsmsFlowPage() {
  return (
    <div className="p-6">
      <RouteComingSoon
        icon={Workflow}
        title="Visual flow builder"
        description="Build SMS automations by wiring SabSMS blocks into a flow. The SabSMS blocks are live now — browse them in the catalogue, then compose them in the SabFlow editor. A dedicated in-module canvas is on the way."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild>
              <Link href="/sabsms/sabflow-blocks">Browse SabSMS blocks</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sabflow">Open SabFlow editor</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
