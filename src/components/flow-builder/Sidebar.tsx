'use client';

import React, { useState } from 'react';
import {
  LuMessageSquare, LuImage, LuToggleRight, LuType, LuClock,
  LuGitBranch, LuCode, LuSend, LuBot, LuSmartphone, LuMail,
  LuUserPlus, LuLink, LuQrCode, LuMapPin, LuContact,
  LuSmilePlus, LuMusic, LuVideo, LuFileText, LuSticker,
  LuList, LuExternalLink, LuShoppingCart, LuUserCheck,
  LuVariable, LuWebhook, LuTag, LuBell, LuArrowRightLeft,
  LuSearch, LuChevronDown,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

type BlockDef = {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
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
      { type: 'text', label: 'Send Text', icon: LuMessageSquare, desc: 'Send a text message' },
      { type: 'image', label: 'Send Image', icon: LuImage, desc: 'Send an image with caption' },
      { type: 'video', label: 'Send Video', icon: LuVideo, desc: 'Send a video message' },
      { type: 'audio', label: 'Send Audio', icon: LuMusic, desc: 'Send an audio file' },
      { type: 'document', label: 'Send Document', icon: LuFileText, desc: 'Send a document file' },
      { type: 'sticker', label: 'Send Sticker', icon: LuSticker, desc: 'Send a sticker' },
      { type: 'sendLocation', label: 'Send Location', icon: LuMapPin, desc: 'Share a location' },
      { type: 'sendContact', label: 'Send Contact', icon: LuContact, desc: 'Share a contact card' },
      { type: 'reaction', label: 'React to Message', icon: LuSmilePlus, desc: 'Add emoji reaction' },
    ],
  },
  {
    title: 'Interactive',
    blocks: [
      { type: 'buttons', label: 'Reply Buttons', icon: LuToggleRight, desc: 'Up to 3 quick reply buttons' },
      { type: 'listMessage', label: 'List Menu', icon: LuList, desc: 'Dropdown list with sections' },
      { type: 'ctaUrl', label: 'CTA URL Button', icon: LuExternalLink, desc: 'Open URL button' },
      { type: 'sendTemplate', label: 'Send Template', icon: LuSend, desc: 'Send approved template' },
      { type: 'triggerMetaFlow', label: 'Meta Flow', icon: LuBot, desc: 'Trigger a WhatsApp Flow' },
    ],
  },
  {
    title: 'Logic',
    blocks: [
      { type: 'input', label: 'Wait for Input', icon: LuType, desc: 'Wait for user reply' },
      { type: 'condition', label: 'Condition', icon: LuGitBranch, desc: 'Branch on variable' },
      { type: 'delay', label: 'Delay', icon: LuClock, desc: 'Wait before next step' },
      { type: 'setVariable', label: 'Set Variable', icon: LuVariable, desc: 'Store a value' },
      { type: 'triggerFlow', label: 'Trigger Flow', icon: LuArrowRightLeft, desc: 'Jump to another flow' },
    ],
  },
  {
    title: 'Integrations',
    blocks: [
      { type: 'api', label: 'HTTP Request', icon: LuCode, desc: 'Call any REST API' },
      { type: 'webhook', label: 'Webhook', icon: LuWebhook, desc: 'Send data to webhook URL' },
      { type: 'sendSms', label: 'Send SMS', icon: LuSmartphone, desc: 'Send an SMS message' },
      { type: 'sendEmail', label: 'Send Email', icon: LuMail, desc: 'Send an email' },
    ],
  },
  {
    title: 'CRM & Commerce',
    blocks: [
      { type: 'createCrmLead', label: 'Create Lead', icon: LuUserPlus, desc: 'Add CRM lead/deal' },
      { type: 'assignAgent', label: 'Assign Agent', icon: LuUserCheck, desc: 'Route to team member' },
      { type: 'addTag', label: 'Add Tag', icon: LuTag, desc: 'Tag the contact' },
      { type: 'sendOrder', label: 'Send Order', icon: LuShoppingCart, desc: 'Send order details' },
      { type: 'generateShortLink', label: 'Short Link', icon: LuLink, desc: 'Create a short URL' },
      { type: 'generateQrCode', label: 'QR Code', icon: LuQrCode, desc: 'Generate QR code' },
      { type: 'notification', label: 'Notification', icon: LuBell, desc: 'Send internal notification' },
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
      <div className="relative">
        <LuSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blocks..."
          className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
        />
      </div>

      {/* Groups */}
      {filteredGroups.map((group) => {
        const isCollapsed = collapsed[group.title];
        return (
          <div key={group.title}>
            <button
              type="button"
              onClick={() => setCollapsed(c => ({ ...c, [group.title]: !c[group.title] }))}
              className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1.5 hover:text-foreground"
            >
              {group.title}
              <LuChevronDown className={cn('h-3 w-3 transition-transform', isCollapsed && '-rotate-90')} />
            </button>

            {!isCollapsed && (
              <div className="grid grid-cols-2 gap-1.5">
                {group.blocks.map((block) => {
                  const Icon = block.icon;
                  return (
                    <div
                      key={block.type}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 cursor-grab active:cursor-grabbing hover:border-accent/40 hover:bg-accent/5 transition-colors"
                      onDragStart={(event) => onDragStart(event, block.type)}
                      draggable
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-[10.5px] font-medium text-foreground leading-tight truncate">{block.label}</span>
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
