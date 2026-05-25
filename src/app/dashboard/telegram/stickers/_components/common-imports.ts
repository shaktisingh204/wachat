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
