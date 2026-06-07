'use client';

import React, { useState } from 'react';
import {
  MessageSquare, Image, ToggleRight, Type, Clock,
  GitBranch, Code, Send, Bot, Smartphone, Mail,
  UserPlus, Link, QrCode, MapPin, Contact,
  SmilePlus, Music, Video, FileText, Sticker,
  List, ExternalLink, ShoppingCart, UserCheck,
  Variable, Webhook, Tag, Bell, ArrowRightLeft,
  Search, ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { Button, Field, Input, cn } from '@/components/sabcrm/20ui';

type BlockDef = {
  type: string;
  label: string;
  icon: LucideIcon;
  desc?: string;
};

type BlockGroup = {
  title: string;
  blocks: BlockDef[];
};

const BLOCK_GROUPS: BlockGroup[] = [
  {
    title: 'Messages',
    blocks: [
      { type: 'text', label: 'Send Text', icon: MessageSquare, desc: 'Send a text message' },
      { type: 'image', label: 'Send Image', icon: Image, desc: 'Send an image with caption' },
      { type: 'video', label: 'Send Video', icon: Video, desc: 'Send a video message' },
      { type: 'audio', label: 'Send Audio', icon: Music, desc: 'Send an audio file' },
      { type: 'document', label: 'Send Document', icon: FileText, desc: 'Send a document file' },
      { type: 'sticker', label: 'Send Sticker', icon: Sticker, desc: 'Send a sticker' },
      { type: 'sendLocation', label: 'Send Location', icon: MapPin, desc: 'Share a location' },
      { type: 'sendContact', label: 'Send Contact', icon: Contact, desc: 'Share a contact card' },
      { type: 'reaction', label: 'React to Message', icon: SmilePlus, desc: 'Add emoji reaction' },
    ],
  },
  {
    title: 'Interactive',
    blocks: [
      { type: 'buttons', label: 'Reply Buttons', icon: ToggleRight, desc: 'Up to 3 quick reply buttons' },
      { type: 'listMessage', label: 'List Menu', icon: List, desc: 'Dropdown list with sections' },
      { type: 'ctaUrl', label: 'CTA URL Button', icon: ExternalLink, desc: 'Open URL button' },
      { type: 'sendTemplate', label: 'Send Template', icon: Send, desc: 'Send approved template' },
      { type: 'triggerMetaFlow', label: 'Meta Flow', icon: Bot, desc: 'Trigger a WhatsApp Flow' },
    ],
  },
  {
    title: 'Logic',
    blocks: [
      { type: 'input', label: 'Wait for Input', icon: Type, desc: 'Wait for user reply' },
      { type: 'condition', label: 'Condition', icon: GitBranch, desc: 'Branch on variable' },
      { type: 'delay', label: 'Delay', icon: Clock, desc: 'Wait before next step' },
      { type: 'setVariable', label: 'Set Variable', icon: Variable, desc: 'Store a value' },
      { type: 'triggerFlow', label: 'Trigger Flow', icon: ArrowRightLeft, desc: 'Jump to another flow' },
    ],
  },
  {
    title: 'Integrations',
    blocks: [
      { type: 'api', label: 'HTTP Request', icon: Code, desc: 'Call any REST API' },
      { type: 'webhook', label: 'Webhook', icon: Webhook, desc: 'Send data to webhook URL' },
      { type: 'sendSms', label: 'Send SMS', icon: Smartphone, desc: 'Send an SMS message' },
      { type: 'sendEmail', label: 'Send Email', icon: Mail, desc: 'Send an email' },
    ],
  },
  {
    title: 'CRM & Commerce',
    blocks: [
      { type: 'createCrmLead', label: 'Create Lead', icon: UserPlus, desc: 'Add CRM lead/deal' },
      { type: 'assignAgent', label: 'Assign Agent', icon: UserCheck, desc: 'Route to team member' },
      { type: 'addTag', label: 'Add Tag', icon: Tag, desc: 'Tag the contact' },
      { type: 'sendOrder', label: 'Send Order', icon: ShoppingCart, desc: 'Send order details' },
      { type: 'generateShortLink', label: 'Short Link', icon: Link, desc: 'Create a short URL' },
      { type: 'generateQrCode', label: 'QR Code', icon: QrCode, desc: 'Generate QR code' },
      { type: 'notification', label: 'Notification', icon: Bell, desc: 'Send internal notification' },
    ],
  },
];

export const ALL_BLOCK_TYPES = BLOCK_GROUPS.flatMap(g => g.blocks);

export const Sidebar = ({ className }: { className?: string }) => {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredGroups = BLOCK_GROUPS.map(g => ({
    ...g,
    blocks: g.blocks.filter(b =>
      b.label.toLowerCase().includes(search.toLowerCase()) ||
      b.type.toLowerCase().includes(search.toLowerCase()) ||
      (b.desc || '').toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(g => g.blocks.length > 0);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search */}
      <Field label={<span className="sr-only">Search blocks</span>}>
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blocks..."
          iconLeft={Search}
          inputSize="sm"
          aria-label="Search blocks"
        />
      </Field>

      {/* Groups */}
      {filteredGroups.map((group) => {
        const isCollapsed = collapsed[group.title];
        return (
          <div key={group.title}>
            <Button
              variant="ghost"
              size="sm"
              block
              onClick={() => setCollapsed(c => ({ ...c, [group.title]: !c[group.title] }))}
              aria-expanded={!isCollapsed}
              className="justify-between mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--st-text-secondary)]"
            >
              <span className="flex w-full items-center justify-between">
                {group.title}
                <ChevronDown
                  size={12}
                  aria-hidden="true"
                  className={cn('transition-transform', isCollapsed && '-rotate-90')}
                />
              </span>
            </Button>

            {!isCollapsed && (
              <div className="grid grid-cols-2 gap-1.5">
                {group.blocks.map((block) => {
                  const Icon = block.icon;
                  return (
                    <div
                      key={block.type}
                      role="button"
                      tabIndex={0}
                      aria-label={`Add ${block.label} block`}
                      title={block.desc}
                      className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2.5 py-2 cursor-grab active:cursor-grabbing hover:border-[var(--st-accent)] hover:bg-[var(--st-bg-muted)] transition-colors"
                      onDragStart={(event) => onDragStart(event, block.type)}
                      draggable
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]" aria-hidden="true" />
                      <span className="text-[10.5px] font-medium text-[var(--st-text)] leading-tight truncate">{block.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
