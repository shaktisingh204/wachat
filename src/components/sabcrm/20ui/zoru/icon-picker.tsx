"use client";

import * as React from "react";
import {
  Search,
  CircleDot,
  Plane, Car, Bus, Train, Ship, Bike, Fuel, Truck, Package,
  UtensilsCrossed, Coffee, Pizza,
  ShoppingCart, ShoppingBag, Gift,
  Receipt, CreditCard, Wallet, Banknote, PiggyBank,
  Briefcase, Building2, Home, Hotel, Bed,
  Lightbulb, Wifi, Phone, Smartphone, Laptop, Monitor, Printer,
  Wrench, HardHat, Hammer,
  Stethoscope, Pill, HeartPulse,
  GraduationCap, BookOpen, Newspaper,
  Megaphone, Sparkles, Camera, Music, Film, Gamepad2, Dumbbell,
  Trees, PawPrint, Baby, Users, UserRound,
  Tag, Star, Bookmark, LifeBuoy, Layers, Settings, ShieldCheck,
  Bell, Mail, MessageSquare, Calendar, Clock, MapPin, Globe,
  Folder, FileText, ClipboardList, CheckCircle2, AlertTriangle,
  Boxes, Database, Server, Cloud, Activity, BarChart3,
} from "lucide-react";

import { cn } from "./lib/cn";
import { Input } from "./input";
import { Popover, ZoruPopoverContent, ZoruPopoverTrigger } from "./popover";

export const ZORU_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  plane: Plane, car: Car, bus: Bus, train: Train, ship: Ship, bike: Bike, fuel: Fuel,
  truck: Truck, package: Package,
  "utensils-crossed": UtensilsCrossed, coffee: Coffee, pizza: Pizza,
  "shopping-cart": ShoppingCart, "shopping-bag": ShoppingBag, gift: Gift,
  receipt: Receipt, "credit-card": CreditCard, wallet: Wallet, banknote: Banknote, "piggy-bank": PiggyBank,
  briefcase: Briefcase, building: Building2, home: Home, hotel: Hotel, bed: Bed,
  lightbulb: Lightbulb, wifi: Wifi, phone: Phone, smartphone: Smartphone,
  laptop: Laptop, monitor: Monitor, printer: Printer,
  wrench: Wrench, "hard-hat": HardHat, hammer: Hammer,
  stethoscope: Stethoscope, pill: Pill, "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap, "book-open": BookOpen, newspaper: Newspaper,
  megaphone: Megaphone, sparkles: Sparkles, camera: Camera, music: Music, film: Film,
  gamepad: Gamepad2, dumbbell: Dumbbell, trees: Trees, "paw-print": PawPrint, baby: Baby,
  users: Users, user: UserRound, tag: Tag, star: Star, bookmark: Bookmark,
  "life-buoy": LifeBuoy, layers: Layers, settings: Settings, "shield-check": ShieldCheck,
  bell: Bell, mail: Mail, "message-square": MessageSquare, calendar: Calendar, clock: Clock,
  "map-pin": MapPin, globe: Globe,
  folder: Folder, "file-text": FileText, "clipboard-list": ClipboardList,
  "check-circle": CheckCircle2, "alert-triangle": AlertTriangle,
  boxes: Boxes, database: Database, server: Server, cloud: Cloud,
  activity: Activity, "bar-chart": BarChart3,
};

export interface ZoruIconPickerProps {
  value: string;
  onChange: (next: string) => void;
  /** Optional tint color for the selected glyph swatch. */
  color?: string;
  className?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  /** Trigger placeholder when no icon picked. */
  placeholder?: string;
}

export function ZoruIconPicker({
  value,
  onChange,
  color,
  className,
  disabled,
  align = "start",
  placeholder = "choose icon…",
}: ZoruIconPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const entries = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = Object.entries(ZORU_ICONS);
    if (!q) return all;
    return all.filter(([name]) => name.toLowerCase().includes(q));
  }, [query]);

  const Selected = value && ZORU_ICONS[value] ? ZORU_ICONS[value] : CircleDot;
  const swatchColor = color || "currentColor";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ZoruPopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Pick an icon (current: ${value || "none"})`}
          className={cn(
            "inline-flex w-full items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-2 py-1.5 text-sm text-zoru-ink transition-colors hover:border-zoru-line-strong",
            disabled && "cursor-not-allowed opacity-50",
            "focus-visible:outline-none",
            className,
          )}
        >
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] border border-zoru-line bg-zoru-surface"
            style={{ color: swatchColor }}
          >
            <Selected className="h-4 w-4" />
          </span>
          <span className="font-mono text-xs text-zoru-ink-muted">
            {value || placeholder}
          </span>
        </button>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent align={align} className="w-72 space-y-2 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zoru-ink-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons…"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="grid max-h-56 grid-cols-7 gap-1 overflow-y-auto">
          {entries.map(([name, Icon]) => {
            const active = value === name;
            return (
              <button
                key={name}
                type="button"
                aria-label={name}
                title={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] border border-transparent text-zoru-ink-muted transition-colors",
                  "hover:border-zoru-line hover:bg-zoru-surface-2 hover:text-zoru-ink",
                  active && "border-zoru-ink bg-zoru-surface-2 text-zoru-ink",
                )}
                style={active && color ? { color } : undefined}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
          {entries.length === 0 ? (
            <div className="col-span-7 py-4 text-center text-xs text-zoru-ink-muted">
              No icons match.
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-zoru-line pt-2">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="text-xs text-zoru-ink-muted hover:text-zoru-ink"
          >
            Clear
          </button>
          <span className="text-[11px] text-zoru-ink-muted">{entries.length} icons</span>
        </div>
      </ZoruPopoverContent>
    </Popover>
  );
}
