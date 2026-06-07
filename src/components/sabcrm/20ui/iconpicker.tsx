'use client';

/**
 * 20ui — IconPicker.
 *
 * A trigger showing the current glyph that opens a token-styled Popover with a
 * search field and an accessible grid of lucide icons. Selecting an icon commits
 * its name through `onChange`; typing in the search filters the grid by name.
 *
 * Mirrors Ui20's IconPicker API (value / onChange / placeholder / align /
 * disabled), reimplemented in 20ui style on top of the 20ui Popover + Input.
 *
 * Lucide ships ~1500 icons. Importing them all bloats the bundle and slows the
 * grid, so we curate a static subset of ~150 common names (statically imported,
 * tree-shake-friendly). The grid is keyboard-friendly: it is a `role="listbox"`
 * with each cell an `option`, roving focus via arrow keys, and a clear empty
 * state. Controlled: `value` is the icon name source of truth.
 *
 *   <IconPicker value="briefcase" onChange={setIcon} />
 */

import * as React from 'react';
import {
  Search,
  CircleDot,
  // Movement + travel
  Plane, Car, Bus, Train, Ship, Bike, Fuel, Truck, Package, Rocket, MapPin, Map, Compass, Navigation, Globe, Anchor,
  // Food + drink
  UtensilsCrossed, Coffee, Pizza, Apple, Cake, Wine, Beer, IceCream,
  // Commerce
  ShoppingCart, ShoppingBag, Gift, Tag, Tags, Receipt, CreditCard, Wallet, Banknote, PiggyBank, Coins, DollarSign, Percent, BadgeCheck,
  // Work + places
  Briefcase, Building, Building2, Home, Hotel, Bed, Store, Factory, Warehouse, Landmark,
  // Tech + devices
  Lightbulb, Wifi, Phone, Smartphone, Tablet, Laptop, Monitor, Printer, Keyboard, Mouse, HardDrive, Cpu, MemoryStick, Usb, Battery, Plug,
  // Tools + trades
  Wrench, HardHat, Hammer, Drill, Paintbrush, PaintBucket, Scissors, Ruler, Pencil, PenTool, Eraser,
  // Health
  Stethoscope, Pill, HeartPulse, Cross, Activity, Brain, Bone, Syringe,
  // Learning + media
  GraduationCap, BookOpen, Book, Library, Newspaper, Megaphone, Sparkles, Camera, Video, Music, Music2, Film, Clapperboard, Mic, Headphones, Image, Palette,
  // Play + nature
  Gamepad2, Dumbbell, Trophy, Medal, Target, Flame, Trees, TreePine, Flower2, Leaf, PawPrint, Bird, Fish, Bug,
  // People
  Baby, Users, User, UserRound, UserPlus, Contact, Smile, Heart, ThumbsUp, Handshake,
  // Objects + symbols
  Star, Bookmark, LifeBuoy, Layers, Settings, Sliders, ShieldCheck, Shield, Lock, Unlock, Key, Eye, EyeOff,
  // Comms + time
  Bell, Mail, MessageSquare, MessageCircle, Send, Inbox, AtSign, Calendar, CalendarDays, Clock, AlarmClock, Hourglass, Timer,
  // Files + data
  Folder, FolderOpen, File, FileText, Files, ClipboardList, Clipboard, CheckCircle2, AlertTriangle, AlertCircle, Info, HelpCircle, XCircle,
  Boxes, Box, Database, Server, Cloud, CloudUpload, CloudDownload, BarChart3, LineChart, PieChart, TrendingUp, Gauge,
  // Weather + misc
  Sun, Moon, CloudRain, Snowflake, Umbrella, Zap, Wind, Droplet, Mountain, Tent, Flag, Crown, Gem, Puzzle, Wand2, Feather, Link, Hash, Filter, Search as SearchGlyph,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Popover, PopoverTrigger, PopoverContent } from './popover';
import { Input } from './field';
import './iconpicker.css';

/**
 * Curated subset of common lucide icons keyed by their kebab-case name (the
 * canonical form callers store). Kept static so the bundler can tree-shake and
 * the grid never has to load the full lucide manifest.
 *
 * e.g. ICONS["briefcase"] -> the Briefcase component.
 */
export const ICONS: Record<string, LucideIcon> = {
  // Movement + travel
  plane: Plane, car: Car, bus: Bus, train: Train, ship: Ship, bike: Bike, fuel: Fuel,
  truck: Truck, package: Package, rocket: Rocket, 'map-pin': MapPin, map: Map,
  compass: Compass, navigation: Navigation, globe: Globe, anchor: Anchor,
  // Food + drink
  'utensils-crossed': UtensilsCrossed, coffee: Coffee, pizza: Pizza, apple: Apple,
  cake: Cake, wine: Wine, beer: Beer, 'ice-cream': IceCream,
  // Commerce
  'shopping-cart': ShoppingCart, 'shopping-bag': ShoppingBag, gift: Gift, tag: Tag, tags: Tags,
  receipt: Receipt, 'credit-card': CreditCard, wallet: Wallet, banknote: Banknote,
  'piggy-bank': PiggyBank, coins: Coins, 'dollar-sign': DollarSign, percent: Percent, 'badge-check': BadgeCheck,
  // Work + places
  briefcase: Briefcase, building: Building, 'building-2': Building2, home: Home,
  hotel: Hotel, bed: Bed, store: Store, factory: Factory, warehouse: Warehouse, landmark: Landmark,
  // Tech + devices
  lightbulb: Lightbulb, wifi: Wifi, phone: Phone, smartphone: Smartphone, tablet: Tablet,
  laptop: Laptop, monitor: Monitor, printer: Printer, keyboard: Keyboard, mouse: Mouse,
  'hard-drive': HardDrive, cpu: Cpu, 'memory-stick': MemoryStick, usb: Usb, battery: Battery, plug: Plug,
  // Tools + trades
  wrench: Wrench, 'hard-hat': HardHat, hammer: Hammer, drill: Drill,
  paintbrush: Paintbrush, 'paint-bucket': PaintBucket, scissors: Scissors, ruler: Ruler,
  pencil: Pencil, 'pen-tool': PenTool, eraser: Eraser,
  // Health
  stethoscope: Stethoscope, pill: Pill, 'heart-pulse': HeartPulse, cross: Cross,
  activity: Activity, brain: Brain, bone: Bone, syringe: Syringe,
  // Learning + media
  'graduation-cap': GraduationCap, 'book-open': BookOpen, book: Book, library: Library,
  newspaper: Newspaper, megaphone: Megaphone, sparkles: Sparkles, camera: Camera, video: Video,
  music: Music, 'music-2': Music2, film: Film, clapperboard: Clapperboard, mic: Mic,
  headphones: Headphones, image: Image, palette: Palette,
  // Play + nature
  gamepad: Gamepad2, dumbbell: Dumbbell, trophy: Trophy, medal: Medal, target: Target,
  flame: Flame, trees: Trees, 'tree-pine': TreePine, flower: Flower2, leaf: Leaf,
  'paw-print': PawPrint, bird: Bird, fish: Fish, bug: Bug,
  // People
  baby: Baby, users: Users, user: User, 'user-round': UserRound, 'user-plus': UserPlus,
  contact: Contact, smile: Smile, heart: Heart, 'thumbs-up': ThumbsUp, handshake: Handshake,
  // Objects + symbols
  star: Star, bookmark: Bookmark, 'life-buoy': LifeBuoy, layers: Layers, settings: Settings,
  sliders: Sliders, 'shield-check': ShieldCheck, shield: Shield, lock: Lock, unlock: Unlock,
  key: Key, eye: Eye, 'eye-off': EyeOff,
  // Comms + time
  bell: Bell, mail: Mail, 'message-square': MessageSquare, 'message-circle': MessageCircle,
  send: Send, inbox: Inbox, 'at-sign': AtSign, calendar: Calendar, 'calendar-days': CalendarDays,
  clock: Clock, 'alarm-clock': AlarmClock, hourglass: Hourglass, timer: Timer,
  // Files + data
  folder: Folder, 'folder-open': FolderOpen, file: File, 'file-text': FileText, files: Files,
  'clipboard-list': ClipboardList, clipboard: Clipboard, 'check-circle': CheckCircle2,
  'alert-triangle': AlertTriangle, 'alert-circle': AlertCircle, info: Info, 'help-circle': HelpCircle, 'x-circle': XCircle,
  boxes: Boxes, box: Box, database: Database, server: Server, cloud: Cloud,
  'cloud-upload': CloudUpload, 'cloud-download': CloudDownload, 'bar-chart': BarChart3,
  'line-chart': LineChart, 'pie-chart': PieChart, 'trending-up': TrendingUp, gauge: Gauge,
  // Weather + misc
  sun: Sun, moon: Moon, 'cloud-rain': CloudRain, snowflake: Snowflake, umbrella: Umbrella,
  zap: Zap, wind: Wind, droplet: Droplet, mountain: Mountain, tent: Tent, flag: Flag,
  crown: Crown, gem: Gem, puzzle: Puzzle, wand: Wand2, feather: Feather, link: Link,
  hash: Hash, filter: Filter, search: SearchGlyph,
};

/** Stable ordered list of [name, Component] so the grid order never reshuffles. */
const ICON_ENTRIES: ReadonlyArray<readonly [string, LucideIcon]> = Object.entries(ICONS);

export interface IconPickerProps {
  /** The current icon name (a key of `ICONS`), or "" for none. */
  value: string;
  /** Fired with the chosen icon name, or "" when cleared. */
  onChange: (next: string) => void;
  /** Optional tint applied to the trigger + selected glyph. */
  color?: string;
  className?: string;
  disabled?: boolean;
  /** Popover alignment against the trigger. */
  align?: 'start' | 'center' | 'end';
  /** Trigger label shown when no icon is picked. No em dashes in UI copy. */
  placeholder?: string;
}

export function IconPicker({
  value,
  onChange,
  color,
  className,
  disabled = false,
  align = 'start',
  placeholder = 'Choose icon',
}: IconPickerProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const searchRef = React.useRef<HTMLInputElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);

  // Reset the search each time the popover closes so it reopens clean.
  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const entries = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICON_ENTRIES;
    return ICON_ENTRIES.filter(([name]) => name.includes(q));
  }, [query]);

  // Exactly one cell carries tabIndex=0 so the grid is a single tab stop and
  // arrow keys rove the rest. Prefer the active icon; if it is absent from the
  // current (possibly filtered) results, fall back to the first cell.
  const activeInResults = Boolean(value) && entries.some(([name]) => name === value);
  const rovingName = activeInResults ? value : entries[0]?.[0];

  const Selected: LucideIcon = (value && ICONS[value]) || CircleDot;
  const tint = color || undefined;

  const commit = React.useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
    },
    [onChange],
  );

  // Roving focus across the grid cells with the arrow keys. The grid is a wrapped
  // flex of fixed-width cells, so we derive the column count from layout rather
  // than hardcoding it (stays correct if the panel ever changes width).
  const onGridKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const grid = gridRef.current;
      if (!grid) return;
      const cells = Array.from(
        grid.querySelectorAll<HTMLButtonElement>('[data-icon-cell]'),
      );
      if (cells.length === 0) return;

      const current = document.activeElement as HTMLElement | null;
      const index = current ? cells.indexOf(current as HTMLButtonElement) : -1;

      // Columns = how many cells share the first cell's top offset.
      const firstTop = cells[0].offsetTop;
      let cols = cells.findIndex((c) => c.offsetTop > firstTop);
      if (cols === -1) cols = cells.length;
      cols = Math.max(1, cols);

      let next = index;
      switch (e.key) {
        case 'ArrowRight':
          next = index < 0 ? 0 : Math.min(index + 1, cells.length - 1);
          break;
        case 'ArrowLeft':
          next = index < 0 ? 0 : Math.max(index - 1, 0);
          break;
        case 'ArrowDown':
          next = index < 0 ? 0 : Math.min(index + cols, cells.length - 1);
          break;
        case 'ArrowUp':
          // From the top row, jump back up to the search input.
          if (index >= 0 && index < cols) {
            e.preventDefault();
            searchRef.current?.focus();
            return;
          }
          next = index < 0 ? 0 : Math.max(index - cols, 0);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = cells.length - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      cells[next]?.focus();
    },
    [],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={
            value ? `Pick an icon. Current icon ${value}` : 'Pick an icon'
          }
          className={['u-iconpicker__trigger', className]
            .filter(Boolean)
            .join(' ')}
        >
          <span className="u-iconpicker__trigger-swatch" style={tint ? { color: tint } : undefined} aria-hidden="true">
            <Selected className="u-iconpicker__trigger-glyph" />
          </span>
          <span className="u-iconpicker__trigger-name">{value || placeholder}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        className="u-iconpicker__panel"
        // Move focus straight to the search field instead of the panel so the
        // user can type immediately; Radix would otherwise focus the content.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <div className="u-iconpicker__search">
          <Input
            ref={searchRef}
            inputSize="sm"
            iconLeft={Search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons"
            aria-label="Search icons by name"
            autoComplete="off"
            spellCheck={false}
            // From the search field, ArrowDown drops focus into the grid.
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                gridRef.current
                  ?.querySelector<HTMLButtonElement>('[data-icon-cell]')
                  ?.focus();
              }
            }}
          />
        </div>

        {entries.length > 0 ? (
          <div
            ref={gridRef}
            role="listbox"
            aria-label="Icons"
            className="u-iconpicker__grid"
            onKeyDown={onGridKeyDown}
          >
            {entries.map(([name, Icon]) => {
              const active = value === name;
              return (
                <button
                  key={name}
                  type="button"
                  data-icon-cell=""
                  role="option"
                  aria-selected={active}
                  aria-label={name}
                  title={name}
                  // Only the roving cell (active, or the first when none) is in
                  // the tab order; arrow keys move focus between the rest.
                  tabIndex={name === rovingName ? 0 : -1}
                  className={['u-iconpicker__cell', active && 'is-active']
                    .filter(Boolean)
                    .join(' ')}
                  style={active && tint ? { color: tint } : undefined}
                  onClick={() => commit(name)}
                >
                  <Icon className="u-iconpicker__cell-glyph" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="u-iconpicker__empty" role="status">
            No icons match that search.
          </p>
        )}

        <div className="u-iconpicker__footer">
          <button
            type="button"
            className="u-iconpicker__clear"
            disabled={!value}
            onClick={() => commit('')}
          >
            Clear
          </button>
          <span className="u-iconpicker__count" aria-live="polite">
            {entries.length} {entries.length === 1 ? 'icon' : 'icons'}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default IconPicker;
