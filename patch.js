const fs = require('fs');
const path = 'src/app/dashboard/crm/inventory/stock-transfers/[id]/edit/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import { getSession } from '@/app/actions/user.actions';",
  "import * as React from 'react';\nimport { Skeleton } from '@/components/zoruui';\nimport { getSession } from '@/app/actions/user.actions';"
);

const skeletonStr = `
function AuditTimelineSkeleton() {
    return (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
            <Skeleton className="mb-4 h-5 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}
`;

content = content.replace(
  "export default async function EditStockTransferPage",
  skeletonStr + "\nexport default async function EditStockTransferPage"
);

content = content.replace(
  /<EntityAuditTimeline[\s\S]*?\/>/,
  `<React.Suspense fallback={<AuditTimelineSkeleton />}>
                    <EntityAuditTimeline
                        entityKind="stock_transfer"
                        entityId={String(id)}
                        title="Activity"
                        limit={25}
                    />
                </React.Suspense>`
);

fs.writeFileSync(path, content);
