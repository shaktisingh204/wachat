/**
 * /wachat/chat loading — mirrors the 3-pane inbox shape so the layout
 * doesn't shift in. Full-bleed (no WaPage wrapper) to match the chat
 * route which uses the full canvas.
 */
import { Card, CardBody } from '@/components/sabcrm/20ui/card';
import { Skeleton } from '@/components/sabcrm/20ui/loading';

export default function ChatLoading() {
  return (
    <div className="flex h-full w-full gap-3 p-3">
      {/* Conversation list pane */}
      <Card variant="outlined" padding="md" className="h-full w-[320px] shrink-0">
        <CardBody>
          <Skeleton width={128} height={16} radius={9999} />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton circle width={36} />
                <div className="flex-1 space-y-1.5">
                  <Skeleton width={96} height={12} radius={9999} />
                  <Skeleton width={128} height={10} radius={9999} />
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Chat message pane */}
      <Card variant="outlined" padding="none" className="h-full flex-1" />

      {/* Contact detail pane */}
      <Card variant="outlined" padding="md" className="h-full w-[300px] shrink-0">
        <CardBody>
          <Skeleton circle width={48} />
          <div className="mt-3">
            <Skeleton width={128} height={16} radius={9999} />
          </div>
          <div className="mt-2">
            <Skeleton width={96} height={12} radius={9999} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
