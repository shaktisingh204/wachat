#!/bin/bash
FILE="src/app/dashboard/telegram/stickers/page.tsx"
DIR="src/app/dashboard/telegram/stickers/_components"
mkdir -p "$DIR"

# Common imports
cat << 'IMP' > "$DIR/common-imports.ts"
import * as React from 'react';
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSelectContent,
  ZoruSelectItem,
  Sheet,
  ZoruSheetContent,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetDescription,
  StatCard,
  EmptyState,
  Skeleton,
  useZoruToast,
  cn,
} from '@/components/zoruui';
import {
  Sticker as StickerIcon,
  Plus,
  Image as ImageIcon,
  Layers,
  Smile,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Replace,
  X,
  Loader2,
  RefreshCw,
  Archive,
} from 'lucide-react';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from './telegram-project-gate';
import type {
    SetRow,
    StickerRow,
    StickerType,
    StickerInputBody,
    MaskPositionDto,
} from '@/lib/rust-client/telegram-stickers';
IMP

# Create specific component files
cat "$DIR/common-imports.ts" > "$DIR/header.tsx"
sed -n '300,358p' "$FILE" >> "$DIR/header.tsx"

cat "$DIR/common-imports.ts" > "$DIR/bot-selector.tsx"
echo "export interface BotChoice { _id: string; username: string; name: string; botId: number; }" >> "$DIR/bot-selector.tsx"
sed -n '360,416p' "$FILE" >> "$DIR/bot-selector.tsx"

cat "$DIR/common-imports.ts" > "$DIR/kpis.tsx"
sed -n '418,461p' "$FILE" >> "$DIR/kpis.tsx"

cat "$DIR/common-imports.ts" > "$DIR/sets-grid.tsx"
sed -n '463,526p' "$FILE" >> "$DIR/sets-grid.tsx"

cat "$DIR/common-imports.ts" > "$DIR/create-pack-drawer.tsx"
echo "import { createStickerSetAction } from '@/app/actions/telegram-stickers.actions';" >> "$DIR/create-pack-drawer.tsx"
sed -n '528,1121p' "$FILE" >> "$DIR/create-pack-drawer.tsx"

cat "$DIR/common-imports.ts" > "$DIR/set-detail-drawer.tsx"
echo "import {
    getStickerSetAction,
    archiveStickerSetAction,
    addStickerAction,
    deleteStickerAction,
    setStickerSetTitleAction,
    setStickerSetThumbnailAction,
    setStickerEmojiListAction,
    setStickerKeywordsAction,
    setStickerMaskPositionAction,
    setStickerPositionAction,
    replaceStickerAction,
} from '@/app/actions/telegram-stickers.actions';" >> "$DIR/set-detail-drawer.tsx"
sed -n '1123,$p' "$FILE" >> "$DIR/set-detail-drawer.tsx"

