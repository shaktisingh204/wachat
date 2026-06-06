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
} from '@/components/sabcrm/20ui/compat';
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
import { TelegramProjectGate } from '../../_components/telegram-project-gate';
import type {
    SetRow,
    StickerRow,
    StickerType,
    StickerInputBody,
    MaskPositionDto,
} from '@/lib/rust-client/telegram-stickers';
//  KPIs
// ---------------------------------------------------------------------------

export function Kpis({
    kpi,
}: {
    kpi: { totalSets: number; totalStickers: number; maskSets: number; customEmojiSets: number };
}) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
                label="Total sets"
                value={kpi.totalSets}
                icon={<Layers className="h-4 w-4" />}
            />
            <StatCard
                label="Total stickers"
                value={kpi.totalStickers}
                icon={<StickerIcon className="h-4 w-4" />}
            />
            <StatCard
                label="Mask sets"
                value={kpi.maskSets}
                icon={<Smile className="h-4 w-4" />}
            />
            <StatCard
                label="Custom emoji sets"
                value={kpi.customEmojiSets}
                icon={<ImageIcon className="h-4 w-4" />}
            />
        </div>
    );
}

export function KpiSkeleton() {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[88px] w-full" />
            ))}
        </div>
    );
}

