#!/bin/bash
FILE="src/app/dashboard/telegram/stickers/page.tsx"

# We'll prepend the imports to page.tsx
cat << 'IMP' > "${FILE}.tmp"
'use client';
import { Header } from './_components/header';
import { BotSelector, type BotChoice } from './_components/bot-selector';
import { Kpis, KpiSkeleton } from './_components/kpis';
import { SetsGrid, GridSkeleton } from './_components/sets-grid';
import { CreatePackDrawer } from './_components/create-pack-drawer';
import { SetDetailDrawer } from './_components/set-detail-drawer';
IMP

# Strip the first 'use client' from original file and the BotChoice interface, 
# then append everything else. We can just append everything from line 2 of the original file,
# but we also need to remove `interface BotChoice`.

awk '
BEGIN { skip = 0 }
/^interface BotChoice \{/ { skip = 1; next }
/^}/ { if (skip) { skip = 0; next } }
{ if (!skip && NR > 1) print $0 }
' "$FILE" >> "${FILE}.tmp"

mv "${FILE}.tmp" "$FILE"
