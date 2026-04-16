/**
 * SabFlow — Block-to-WhatsApp message mapper
 *
 * Converts a SabFlow `Block` (+ the current session variables map) into one
 * or more {@link WhatsAppMessage} values suitable for posting to the Cloud
 * API via {@link sendMessage}.
 *
 * Mapping summary:
 *   - text bubble          → text message
 *   - image bubble         → image message (with caption fallback to alt)
 *   - video bubble         → video message
 *   - audio bubble         → audio message
 *   - choice_input         → interactive buttons (split into multiple
 *                             messages when >3 choices — WhatsApp caps at 3)
 *   - picture_choice_input → interactive buttons (images not rendered)
 *   - inputs (all others)  → text message surfacing the prompt / instruction
 *
 * Unknown / unsupported block types produce `[]` so callers can safely
 * concatenate the result.
 */

import { substituteVariables } from '@/lib/sabflow/engine';
import type {
  Block,
  ChoiceItem,
  ImageBubbleOptions,
  VideoBubbleOptions,
  AudioBubbleOptions,
  TextBubbleOptions,
  ChoiceInputOptions,
  TextInputOptions,
  EmailInputOptions,
  PhoneInputOptions,
  UrlInputOptions,
  NumberInputOptions,
  DateInputOptions,
  TimeInputOptions,
  RatingInputOptions,
  FileInputOptions,
} from '@/lib/sabflow/types';
import type { WhatsAppMessage, WhatsAppReplyButton } from './types';

/** WhatsApp Cloud API limits. */
const WA_BUTTON_LIMIT = 3;
const WA_BUTTON_TITLE_LIMIT = 20;
const WA_BODY_TEXT_LIMIT = 1024;

/* ── helpers ────────────────────────────────────────────────────────────── */

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '…';
}

function interpolate(raw: string | undefined, variables: Record<string, string>): string {
  if (!raw) return '';
  return substituteVariables(raw, variables);
}

/** Chunk a list into fixed-size slices (last one may be smaller). */
function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function inputPromptFor(block: Block): string {
  const o = block.options ?? {};
  switch (block.type) {
    case 'text_input': {
      const opts = o as TextInputOptions;
      return opts.placeholder ?? 'Please type your answer.';
    }
    case 'email_input': {
      const opts = o as EmailInputOptions;
      return opts.placeholder ?? 'Please reply with your email address.';
    }
    case 'phone_input': {
      const opts = o as PhoneInputOptions;
      return opts.placeholder ?? 'Please reply with your phone number.';
    }
    case 'url_input': {
      const opts = o as UrlInputOptions;
      return opts.placeholder ?? 'Please reply with a URL.';
    }
    case 'number_input': {
      const opts = o as NumberInputOptions;
      return opts.placeholder ?? 'Please reply with a number.';
    }
    case 'date_input': {
      const opts = o as DateInputOptions;
      return opts.labels?.button ? `${opts.labels.button}: please reply with a date.` : 'Please reply with a date.';
    }
    case 'time_input': {
      const opts = o as TimeInputOptions;
      return opts.labels?.button ? `${opts.labels.button}: please reply with a time.` : 'Please reply with a time.';
    }
    case 'rating_input': {
      const opts = o as RatingInputOptions;
      const max = opts.length ?? 5;
      return `Please reply with a rating from 1 to ${max}.`;
    }
    case 'file_input': {
      const opts = o as FileInputOptions;
      return opts.labels?.placeholder ?? 'Please send the requested file as an attachment.';
    }
    default:
      return 'Please reply to continue.';
  }
}

/* ── main entry ─────────────────────────────────────────────────────────── */

/**
 * Map a {@link Block} into zero or more {@link WhatsAppMessage} payloads.
 *
 * @param block      The SabFlow block to convert.
 * @param variables  Current session variables for {{var}} interpolation.
 * @returns          Ordered list of messages; empty when the block type
 *                   cannot be represented over WhatsApp.
 */
export function blockToWhatsAppMessage(
  block: Block,
  variables: Record<string, string>,
): WhatsAppMessage[] {
  const options = block.options ?? {};

  /* ── Bubble blocks ─────────────────────────────────────────────────── */

  if (block.type === 'text') {
    const opts = options as TextBubbleOptions;
    const body = interpolate(opts.content ?? opts.html, variables).trim();
    if (!body) return [];
    return [
      {
        type: 'text',
        text: { body: truncate(body, WA_BODY_TEXT_LIMIT) },
      },
    ];
  }

  if (block.type === 'image') {
    const opts = options as ImageBubbleOptions;
    const link = interpolate(opts.url, variables).trim();
    if (!link) return [];
    const caption = interpolate(opts.alt, variables).trim() || undefined;
    return [
      {
        type: 'image',
        image: caption ? { link, caption } : { link },
      },
    ];
  }

  if (block.type === 'video') {
    const opts = options as VideoBubbleOptions;
    const link = interpolate(opts.url, variables).trim();
    if (!link) return [];
    return [{ type: 'video', video: { link } }];
  }

  if (block.type === 'audio') {
    const opts = options as AudioBubbleOptions;
    const link = interpolate(opts.url, variables).trim();
    if (!link) return [];
    return [{ type: 'audio', audio: { link } }];
  }

  /* ── Choice input → interactive buttons ────────────────────────────── */

  if (block.type === 'choice_input' || block.type === 'picture_choice_input') {
    const opts = options as ChoiceInputOptions;
    const items = (block.items ?? []) as ChoiceItem[];
    if (items.length === 0) return [];

    const promptRaw =
      (opts.buttonLabel && opts.buttonLabel.trim()) ||
      (opts.searchInputPlaceholder && opts.searchInputPlaceholder.trim()) ||
      'Please pick an option:';
    const prompt = truncate(interpolate(promptRaw, variables), WA_BODY_TEXT_LIMIT);

    const buttons: WhatsAppReplyButton[] = items.map((item) => {
      const title = truncate(
        interpolate(item.content ?? item.title ?? '', variables) || 'Select',
        WA_BUTTON_TITLE_LIMIT,
      );
      return {
        type: 'reply',
        reply: {
          id: item.id,
          title,
        },
      };
    });

    // WhatsApp caps interactive button messages at 3 buttons.  Split into
    // multiple messages when necessary, suffixing a continuation hint.
    const batches = chunk(buttons, WA_BUTTON_LIMIT);
    return batches.map<WhatsAppMessage>((batch, idx) => ({
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text:
            batches.length > 1
              ? truncate(`${prompt} (${idx + 1}/${batches.length})`, WA_BODY_TEXT_LIMIT)
              : prompt,
        },
        action: { buttons: batch },
      },
    }));
  }

  /* ── Input blocks (non-choice) → text prompt ───────────────────────── */

  const INPUT_TYPES = new Set<Block['type']>([
    'text_input',
    'email_input',
    'phone_input',
    'url_input',
    'number_input',
    'date_input',
    'time_input',
    'rating_input',
    'file_input',
    'payment_input',
  ]);

  if (INPUT_TYPES.has(block.type)) {
    const body = interpolate(inputPromptFor(block), variables);
    return [{ type: 'text', text: { body: truncate(body, WA_BODY_TEXT_LIMIT) } }];
  }

  /* ── Unsupported (embed / logic / integrations) ────────────────────── */

  return [];
}
