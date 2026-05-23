import sys

with open('src/app/dashboard/crm/inventory/adjustments/_components/filtered-audit-timeline.tsx', 'r') as f:
    content = f.read()

content = content.replace("export interface EntityAuditTimelineProps {", "export interface EntityAuditTimelineProps {\n    eventType?: string;")
content = content.replace("export async function EntityAuditTimeline({", "export async function FilteredAuditTimeline({")
content = content.replace("title = 'Activity',\n}: EntityAuditTimelineProps) {", "title = 'Activity',\n    eventType,\n}: EntityAuditTimelineProps) {")

query_patch = """{
                    userId: new ObjectId(userId),
                    entityKind,
                    entityId,
                } as any"""

new_query_patch = """{
                    userId: new ObjectId(userId),
                    entityKind,
                    entityId,
                    ...(eventType ? { action: eventType } : {})
                } as any"""

content = content.replace(query_patch, new_query_patch)

with open('src/app/dashboard/crm/inventory/adjustments/_components/filtered-audit-timeline.tsx', 'w') as f:
    f.write(content)

