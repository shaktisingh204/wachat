'use client';
import {
  LuMessageSquare,
  LuImage,
  LuVideo,
  LuMic,
  LuCode,
  LuType,
  LuHash,
  LuMail,
  LuPhone,
  LuLink,
  LuCalendar,
  LuClock,
  LuStar,
  LuUpload,
  LuCreditCard,
  LuSquareCheck,
  LuLayoutGrid,
  LuGitBranch,
  LuVariable,
  LuExternalLink,
  LuFileCode,
  LuTimer,
  LuShuffle,
  LuFlaskConical,
  LuGlobe,
  LuSend,
  LuSheet,
  LuChartBar,
  LuBot,
  LuZap,
  LuUsers,
  LuPlug,
  LuEye,
  LuActivity,
  LuCalendarDays,
  LuDatabase,
  LuVolume2,
  LuBrain,
  LuCpu,
  LuLayers,
  LuRepeat,
  LuGitMerge,
  LuSplit,
  LuFilter,
  LuArrowDownWideNarrow,
  LuPackage,
  LuWorkflow,
  LuMessageCircleReply,
} from 'react-icons/lu';
import type { Block, BlockType } from '@/lib/sabflow/types';
import { WithVariableContent } from './WithVariableContent';
import type { ComponentType } from 'react';

/* ── icon map ────────────────────────────────────────────────────────────── */

type IconComponent = ComponentType<{ className?: string }>;

const BLOCK_ICONS: Record<BlockType, IconComponent> = {
  // Bubbles
  text:                 LuMessageSquare,
  image:                LuImage,
  video:                LuVideo,
  audio:                LuMic,
  embed:                LuCode,
  // Inputs
  text_input:           LuType,
  number_input:         LuHash,
  email_input:          LuMail,
  phone_input:          LuPhone,
  url_input:            LuLink,
  date_input:           LuCalendar,
  time_input:           LuClock,
  rating_input:         LuStar,
  file_input:           LuUpload,
  payment_input:        LuCreditCard,
  choice_input:         LuSquareCheck,
  picture_choice_input: LuLayoutGrid,
  // Logic
  condition:            LuGitBranch,
  set_variable:         LuVariable,
  redirect:             LuExternalLink,
  script:               LuFileCode,
  typebot_link:         LuLink,
  wait:                 LuTimer,
  jump:                 LuShuffle,
  ab_test:              LuFlaskConical,
  merge:                LuGitMerge,
  loop:                 LuRepeat,
  switch:               LuSplit,
  filter:               LuFilter,
  sort:                 LuArrowDownWideNarrow,
  set:                  LuVariable,
  execute_workflow:     LuWorkflow,
  respond_to_webhook:   LuMessageCircleReply,
  // Forge integrations
  forge_notion:         LuPackage,
  forge_airtable:       LuPackage,
  forge_slack:          LuPackage,
  forge_discord:        LuPackage,
  forge_github:         LuPackage,
  forge_twilio:         LuPackage,
  forge_sendgrid:       LuPackage,
  // Integrations
  webhook:              LuGlobe,
  send_email:           LuSend,
  google_sheets:        LuSheet,
  google_analytics:     LuChartBar,
  open_ai:              LuBot,
  zapier:               LuZap,
  make_com:             LuLayers,
  pabbly_connect:       LuPlug,
  chatwoot:             LuUsers,
  pixel:                LuEye,
  segment:              LuActivity,
  cal_com:              LuCalendarDays,
  nocodb:               LuDatabase,
  elevenlabs:           LuVolume2,
  anthropic:            LuBrain,
  together_ai:          LuCpu,
  mistral:              LuBot,
};

/* ── category helpers ────────────────────────────────────────────────────── */

const BUBBLE_TYPES = new Set<BlockType>(['text', 'image', 'video', 'audio', 'embed']);
const INPUT_TYPES = new Set<BlockType>([
  'text_input', 'number_input', 'email_input', 'phone_input', 'url_input',
  'date_input', 'time_input', 'rating_input', 'file_input', 'payment_input',
  'choice_input', 'picture_choice_input',
]);
const LOGIC_TYPES = new Set<BlockType>([
  'condition', 'set_variable', 'redirect', 'script', 'typebot_link', 'wait', 'jump', 'ab_test',
  'merge', 'loop', 'switch', 'filter', 'sort', 'set', 'execute_workflow', 'respond_to_webhook',
]);

/* ── label map ───────────────────────────────────────────────────────────── */

const BLOCK_LABELS: Record<BlockType, string> = {
  text: 'Text', image: 'Image', video: 'Video', audio: 'Audio', embed: 'Embed',
  text_input: 'Text Input', number_input: 'Number', email_input: 'Email',
  phone_input: 'Phone', url_input: 'URL', date_input: 'Date', time_input: 'Time',
  rating_input: 'Rating', file_input: 'File Upload', payment_input: 'Payment',
  choice_input: 'Buttons', picture_choice_input: 'Picture Choice',
  condition: 'Condition', set_variable: 'Set Variable', redirect: 'Redirect',
  script: 'Script', typebot_link: 'Jump to Flow', wait: 'Wait', jump: 'Jump', ab_test: 'A/B Test',
  webhook: 'HTTP Request', send_email: 'Send Email', google_sheets: 'Google Sheets',
  google_analytics: 'Google Analytics', open_ai: 'OpenAI', zapier: 'Zapier',
  make_com: 'Make', pabbly_connect: 'Pabbly', chatwoot: 'Chatwoot', pixel: 'Pixel',
  segment: 'Segment', cal_com: 'Cal.com', nocodb: 'NocoDB', elevenlabs: 'ElevenLabs',
  anthropic: 'Anthropic', together_ai: 'Together AI', mistral: 'Mistral AI',
  merge: 'Merge', loop: 'Loop', switch: 'Switch', filter: 'Filter', sort: 'Sort',
  set: 'Set Variable', execute_workflow: 'Execute Workflow', respond_to_webhook: 'Respond',
  forge_notion: 'Notion', forge_airtable: 'Airtable', forge_slack: 'Slack',
  forge_discord: 'Discord', forge_github: 'GitHub', forge_twilio: 'Twilio',
  forge_sendgrid: 'SendGrid',
};

/* ── BlockNodeContent ────────────────────────────────────────────────────── */

type Props = {
  block: Block;
};

/**
 * Rich content preview rendered inside a BlockNode card.
 *
 * - Shows a react-icons/lu icon coloured by block category
 * - Shows a text preview with `{{variable}}` chips for bubble types
 * - Shows input placeholder or collected-variable info for input types
 * - Shows a concise summary line for logic/integration types
 */
export function BlockNodeContent({ block }: Props) {
  const Icon = BLOCK_ICONS[block.type] ?? LuCode;
  const label = BLOCK_LABELS[block.type] ?? block.type;
  const iconColor = getIconColor(block.type);

  return (
    <div className="flex items-start gap-2 flex-1 min-w-0">
      {/* Category icon */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md mt-0.5"
        style={{ backgroundColor: `${iconColor}18`, color: iconColor }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Label + preview */}
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium text-[var(--gray-12)] truncate">{label}</div>
        <BlockPreview block={block} />
      </div>
    </div>
  );
}

/* ── BlockPreview ────────────────────────────────────────────────────────── */

function BlockPreview({ block }: { block: Block }) {
  const opts = block.options ?? {};

  /* ── Bubble types ── */
  if (BUBBLE_TYPES.has(block.type)) {
    switch (block.type as 'text' | 'image' | 'video' | 'audio' | 'embed') {
      case 'text': {
        const raw = typeof opts.content === 'string' ? opts.content.trim() : '';
        if (!raw) return <PreviewEmpty label="No message" />;
        return (
          <WithVariableContent
            text={raw}
            maxLength={80}
            className="text-[11px] text-[var(--gray-9)] mt-0.5"
          />
        );
      }
      case 'image': {
        const url = typeof opts.url === 'string' ? opts.url : '';
        return url
          ? <PreviewText>{truncate(url, 60)}</PreviewText>
          : <PreviewEmpty label="No image URL" />;
      }
      case 'video': {
        const url = typeof opts.url === 'string' ? opts.url : '';
        return url
          ? <PreviewText>{truncate(url, 60)}</PreviewText>
          : <PreviewEmpty label="No video URL" />;
      }
      case 'audio': {
        const url = typeof opts.url === 'string' ? opts.url : '';
        return url
          ? <PreviewText>{truncate(url, 60)}</PreviewText>
          : <PreviewEmpty label="No audio URL" />;
      }
      case 'embed': {
        const url = typeof opts.url === 'string' ? opts.url : '';
        return url
          ? <PreviewText>{truncate(url, 60)}</PreviewText>
          : <PreviewEmpty label="No embed URL" />;
      }
    }
  }

  /* ── Input types ── */
  if (INPUT_TYPES.has(block.type)) {
    switch (block.type as typeof INPUT_TYPES extends Set<infer T> ? T : never) {
      case 'text_input':
      case 'number_input':
      case 'email_input':
      case 'phone_input':
      case 'url_input': {
        const placeholder = getNestedString(opts, 'labels', 'placeholder')
          ?? getNestedString(opts, 'placeholder')
          ?? '';
        const varName = typeof opts.variableId === 'string' ? opts.variableId : '';
        if (placeholder) return <PreviewText>{truncate(placeholder, 50)}</PreviewText>;
        if (varName)     return <PreviewText>Collect into <em>{varName}</em></PreviewText>;
        return null;
      }
      case 'date_input':
      case 'time_input': {
        const varId = typeof opts.variableId === 'string' ? opts.variableId : '';
        return varId ? <PreviewText>Store in {varId}</PreviewText> : null;
      }
      case 'rating_input': {
        const max = typeof opts.maximum === 'number' ? opts.maximum : 5;
        return <PreviewText>1 – {max} stars</PreviewText>;
      }
      case 'choice_input':
      case 'picture_choice_input': {
        const varId = typeof opts.variableId === 'string' ? opts.variableId : '';
        return varId ? <PreviewText>Collect into {varId}</PreviewText> : null;
      }
      case 'payment_input': {
        const amount = typeof opts.amount === 'string' || typeof opts.amount === 'number'
          ? String(opts.amount)
          : '';
        const currency = typeof opts.currency === 'string' ? opts.currency : '';
        if (amount && currency) return <PreviewText>{currency} {amount}</PreviewText>;
        if (amount)             return <PreviewText>{amount}</PreviewText>;
        return null;
      }
      case 'file_input': {
        return <PreviewText>File upload</PreviewText>;
      }
      default:
        return null;
    }
  }

  /* ── Logic types ── */
  if (LOGIC_TYPES.has(block.type)) {
    switch (block.type as typeof LOGIC_TYPES extends Set<infer T> ? T : never) {
      case 'condition':
        return <PreviewText>If / Else branching</PreviewText>;
      case 'set_variable': {
        const varId = typeof opts.variableId === 'string' ? opts.variableId : '';
        const expr  = typeof opts.expressionToEvaluate === 'string' ? opts.expressionToEvaluate : '';
        if (varId && expr) return <PreviewText>{varId} = {truncate(expr, 40)}</PreviewText>;
        if (varId)         return <PreviewText>Set {varId}</PreviewText>;
        return null;
      }
      case 'redirect': {
        const url = typeof opts.url === 'string' ? opts.url : '';
        return url ? <PreviewText>{truncate(url, 60)}</PreviewText> : null;
      }
      case 'script': {
        const code = typeof opts.code === 'string' ? opts.code.replace(/\n/g, ' ').trim() : '';
        return code ? <PreviewText>{truncate(code, 60)}</PreviewText> : null;
      }
      case 'typebot_link': {
        const name = typeof opts.flowName === 'string' ? opts.flowName : '';
        return name ? <PreviewText>{name}</PreviewText> : null;
      }
      case 'wait': {
        const secs = typeof opts.secondsToWaitFor === 'number' ? opts.secondsToWaitFor : null;
        return secs !== null ? <PreviewText>Wait {secs}s</PreviewText> : null;
      }
      case 'jump': {
        const groupTitle = typeof opts.groupTitle === 'string' ? opts.groupTitle : '';
        return groupTitle ? <PreviewText>Jump to "{groupTitle}"</PreviewText> : null;
      }
      case 'ab_test': {
        const aPercent = typeof opts.aPercentage === 'number' ? opts.aPercentage : 50;
        return <PreviewText>A {aPercent}% / B {100 - aPercent}%</PreviewText>;
      }
      default:
        return null;
    }
  }

  /* ── Integration types ── */
  switch (block.type) {
    case 'webhook': {
      const url = typeof opts.url === 'string' ? opts.url : '';
      const method = typeof opts.method === 'string' ? opts.method : 'GET';
      return url
        ? <PreviewText>{method} {truncate(url, 50)}</PreviewText>
        : <PreviewText>{method}</PreviewText>;
    }
    case 'send_email': {
      const subject = typeof opts.subject === 'string' ? opts.subject : '';
      return subject ? <PreviewText>{truncate(subject, 60)}</PreviewText> : null;
    }
    case 'google_sheets': {
      const action = typeof opts.action === 'string' ? opts.action : '';
      return action ? <PreviewText>{action}</PreviewText> : null;
    }
    case 'google_analytics': {
      const eventAction = typeof opts.action === 'string' ? opts.action : '';
      return eventAction ? <PreviewText>{eventAction}</PreviewText> : null;
    }
    case 'open_ai': {
      const model = typeof opts.model === 'string' ? opts.model : '';
      return model ? <PreviewText>{model}</PreviewText> : null;
    }
    case 'zapier':
    case 'make_com':
    case 'pabbly_connect': {
      const webhook = typeof opts.webhookUrl === 'string' ? opts.webhookUrl : '';
      return webhook ? <PreviewText>{truncate(webhook, 50)}</PreviewText> : null;
    }
    case 'chatwoot': {
      const account = typeof opts.accountId === 'string' ? opts.accountId : '';
      return account ? <PreviewText>Account {account}</PreviewText> : null;
    }
    case 'cal_com': {
      const calLink = typeof opts.calLink === 'string' ? opts.calLink : '';
      return calLink ? <PreviewText>{calLink}</PreviewText> : null;
    }
    default:
      return null;
  }
}

/* ── small helpers ───────────────────────────────────────────────────────── */

function PreviewText({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] text-[var(--gray-9)] truncate mt-0.5 leading-snug">
      {children}
    </div>
  );
}

function PreviewEmpty({ label }: { label: string }) {
  return (
    <div className="text-[11px] text-[var(--gray-7)] italic truncate mt-0.5">{label}</div>
  );
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

/** Safely reads nested string keys: `getNestedString(opts, 'labels', 'placeholder')` */
function getNestedString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  let cur: unknown = obj;
  for (const key of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** Returns a hex colour for category-coloured icon backgrounds. */
function getIconColor(type: BlockType): string {
  if (BUBBLE_TYPES.has(type))       return '#6366f1';
  if (INPUT_TYPES.has(type))        return '#0ea5e9';
  if (LOGIC_TYPES.has(type))        return '#f97316';
  return '#ec4899'; // integrations
}
