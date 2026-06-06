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
export interface BotChoice { _id: string; username: string; name: string; botId: number; }
//  Bot selector
// ---------------------------------------------------------------------------

export function BotSelector({
    bots,
    selectedBotId,
    onSelect,
    loading,
}: {
    bots: BotChoice[];
    selectedBotId: string | null;
    onSelect: (id: string) => void;
    loading: boolean;
}) {
    return (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <div className="text-[11px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                    Bot
                </div>
                <div className="text-[13.5px] text-zoru-ink">
                    {loading ? 'Loading connected bots…' : 'Pick which bot owns these packs.'}
                </div>
            </div>
            <div className="flex w-full max-w-sm items-center gap-2">
                <Select
                    value={selectedBotId ?? undefined}
                    onValueChange={(v) => onSelect(v)}
                    disabled={loading || bots.length === 0}
                >
                    <ZoruSelectTrigger className="w-full">
                        <ZoruSelectValue
                            placeholder={
                                loading
                                    ? 'Loading bots…'
                                    : bots.length === 0
                                      ? 'No bots connected'
                                      : 'Select a bot'
                            }
                        />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {bots.map((b) => (
                            <ZoruSelectItem key={b._id} value={b._id}>
                                <span className="flex items-center gap-2">
                                    <span className="font-medium">{b.name || b.username}</span>
                                    <span className="text-zoru-ink-muted">@{b.username}</span>
                                </span>
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </Select>
            </div>
        </Card>
    );
}

