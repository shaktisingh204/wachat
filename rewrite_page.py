import re

with open('src/app/dashboard/telegram/mini-apps/page.tsx', 'r') as f:
    content = f.read()

imports_to_add = """
import { StatusPill } from './_components/status-pill';
import { KpiCard } from './_components/kpi-card';
import { MiniAppFormDrawer } from './_components/mini-app-form-drawer';
import { DetailDrawer } from './_components/detail-drawer';
import { SendDialog } from './_components/send-dialog';
import { RowActionsMenu } from './_components/row-actions-menu';
"""

content = content.replace("import { SabFileUrlInput } from '@/components/sabfiles';", "import { SabFileUrlInput } from '@/components/sabfiles';\n" + imports_to_add)

# Find the start of KpiCard
start_idx = content.find("function KpiCard({")
# Find the start of export default function MiniAppsPage
end_idx = content.find("export default function MiniAppsPage() {")

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + content[end_idx:]

with open('src/app/dashboard/telegram/mini-apps/page.tsx', 'w') as f:
    f.write(content)
