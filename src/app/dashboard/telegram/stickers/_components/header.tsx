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
import { TelegramProjectGate } from '../../_components/telegram-project-gate';
import type {
    SetRow,
    StickerRow,
    StickerType,
    StickerInputBody,
    MaskPositionDto,
} from '@/lib/rust-client/telegram-stickers';
//  Header
// ---------------------------------------------------------------------------

export function Header({
    onCreate,
    onRefresh,
    refreshing,
    disabled,
}: {
    onCreate: () => void;
    onRefresh: () => void;
    refreshing: boolean;
    disabled?: boolean;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
                <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                        background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
                        boxShadow: `0 10px 28px ${ACCENT}40`,
                    }}
                >
                    <StickerIcon className="h-6 w-6 text-white" strokeWidth={1.75} />
                </div>
                <div>
                    <p className="text-[11px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                        Telegram
                    </p>
                    <h1 className="text-[22px] leading-tight text-zoru-ink">Telegram Stickers</h1>
                    <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
                        Create, edit and publish sticker packs through the bot you select.
                        Files come from your SabFiles library — no external URLs.
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    disabled={disabled || refreshing}
                >
                    {refreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                </Button>
                <Button size="sm" onClick={onCreate} disabled={disabled}>
                    <Plus className="h-4 w-4" /> New sticker pack
                </Button>
            </div>
        </div>
    );
}

