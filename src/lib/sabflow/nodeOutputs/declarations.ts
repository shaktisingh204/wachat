/**
 * Declared output schemas, keyed by block type.
 *
 * When a block type is missing from this map, the picker falls back to whatever
 * keys it observed in the last execution result (see `mergeWithLastRun.ts`).
 * That keeps the picker useful for every block — declared schemas just provide
 * nicer labels, type info, and examples.
 */

import type { NodeOutputField } from './schema';

const TEXT_INPUT_FIELDS: NodeOutputField[] = [
  { key: 'answer', label: 'User answer', type: 'string', example: 'Hello world' },
  { key: 'submittedAt', label: 'Submitted at', type: 'date' },
];

const WHATSAPP_TRIGGER_FIELDS: NodeOutputField[] = [
  { key: 'from', label: 'Sender phone', type: 'string', example: '+919876543210' },
  { key: 'message', label: 'Message text', type: 'string', example: 'Hi there' },
  { key: 'messageId', label: 'Message ID', type: 'string' },
  { key: 'timestamp', label: 'Timestamp', type: 'date' },
  { key: 'contact.name', label: 'Contact name', type: 'string' },
];

const OPENAI_FIELDS: NodeOutputField[] = [
  { key: 'response', label: 'Assistant response (text)', type: 'string', example: 'The capital of France is Paris.' },
  { key: 'choices.0.message.content', label: 'First choice content', type: 'string' },
  { key: 'choices.0.message.role', label: 'First choice role', type: 'string', example: 'assistant' },
  { key: 'choices.0.finish_reason', label: 'Finish reason', type: 'string', example: 'stop' },
  { key: 'usage.prompt_tokens', label: 'Prompt tokens', type: 'number' },
  { key: 'usage.completion_tokens', label: 'Completion tokens', type: 'number' },
  { key: 'usage.total_tokens', label: 'Total tokens', type: 'number' },
  { key: 'model', label: 'Model', type: 'string', example: 'gpt-4o-mini' },
  { key: 'id', label: 'Response ID', type: 'string' },
  { key: 'created', label: 'Created (epoch s)', type: 'number' },
];

const ANTHROPIC_FIELDS: NodeOutputField[] = [
  { key: 'response', label: 'Assistant response (text)', type: 'string' },
  { key: 'content.0.text', label: 'First content block', type: 'string' },
  { key: 'stop_reason', label: 'Stop reason', type: 'string', example: 'end_turn' },
  { key: 'usage.input_tokens', label: 'Input tokens', type: 'number' },
  { key: 'usage.output_tokens', label: 'Output tokens', type: 'number' },
  { key: 'model', label: 'Model', type: 'string' },
  { key: 'id', label: 'Response ID', type: 'string' },
];

const ELEVENLABS_FIELDS: NodeOutputField[] = [
  { key: 'audioUrl', label: 'Audio URL', type: 'string', example: 'https://…/voice.mp3' },
  { key: 'voiceId', label: 'Voice ID', type: 'string' },
  { key: 'voice', label: 'Voice name', type: 'string', example: 'Rachel' },
  { key: 'durationSeconds', label: 'Duration (s)', type: 'number' },
  { key: 'characterCount', label: 'Character count', type: 'number' },
  { key: 'requestId', label: 'Request ID', type: 'string' },
  { key: 'model', label: 'Model', type: 'string', example: 'eleven_multilingual_v2' },
  { key: 'audioFormat', label: 'Audio format', type: 'string', example: 'mp3_44100_128' },
  { key: 'sizeBytes', label: 'File size (bytes)', type: 'number' },
  { key: 'language', label: 'Language code', type: 'string' },
];

const SEND_EMAIL_FIELDS: NodeOutputField[] = [
  { key: 'messageId', label: 'Message ID', type: 'string' },
  { key: 'accepted', label: 'Accepted recipients', type: 'array' },
  { key: 'rejected', label: 'Rejected recipients', type: 'array' },
  { key: 'response', label: 'SMTP response', type: 'string' },
  { key: 'sentAt', label: 'Sent at', type: 'date' },
  { key: 'envelope.to', label: 'Envelope to', type: 'array' },
];

const WEBHOOK_FIELDS: NodeOutputField[] = [
  { key: 'statusCode', label: 'HTTP status', type: 'number', example: 200 },
  { key: 'body', label: 'Response body', type: 'object' },
  { key: 'headers', label: 'Response headers', type: 'object' },
  { key: 'durationMs', label: 'Duration (ms)', type: 'number' },
];

const SET_VARIABLE_FIELDS: NodeOutputField[] = [
  { key: 'value', label: 'New value', type: 'string' },
  { key: 'variableName', label: 'Variable name', type: 'string' },
];

const WAIT_FIELDS: NodeOutputField[] = [
  { key: 'waitedSeconds', label: 'Waited seconds', type: 'number' },
];

const SCRIPT_FIELDS: NodeOutputField[] = [
  { key: 'result', label: 'Return value', type: 'object' },
  { key: 'log', label: 'Console output', type: 'string' },
];

const GOOGLE_SHEETS_FIELDS: NodeOutputField[] = [
  { key: 'rows', label: 'Rows', type: 'array' },
  { key: 'updatedCells', label: 'Updated cells', type: 'number' },
  { key: 'spreadsheetId', label: 'Spreadsheet ID', type: 'string' },
  { key: 'range', label: 'Affected range', type: 'string' },
];

const CONDITION_FIELDS: NodeOutputField[] = [
  { key: 'matched', label: 'Matched branch', type: 'string' },
  { key: 'result', label: 'Boolean result', type: 'boolean' },
];

const CHOICE_INPUT_FIELDS: NodeOutputField[] = [
  { key: 'answer', label: 'Selected choice', type: 'string' },
  { key: 'answers', label: 'Selected choices (multi)', type: 'array' },
];

const FILE_INPUT_FIELDS: NodeOutputField[] = [
  { key: 'url', label: 'File URL', type: 'string' },
  { key: 'name', label: 'File name', type: 'string' },
  { key: 'size', label: 'File size (bytes)', type: 'number' },
  { key: 'mimeType', label: 'MIME type', type: 'string' },
];

const PAYMENT_INPUT_FIELDS: NodeOutputField[] = [
  { key: 'paymentIntentId', label: 'Payment intent ID', type: 'string' },
  { key: 'status', label: 'Payment status', type: 'string', example: 'succeeded' },
  { key: 'amount', label: 'Amount', type: 'number' },
  { key: 'currency', label: 'Currency', type: 'string' },
];

const GENERIC_INPUT_FIELDS: NodeOutputField[] = [
  { key: 'answer', label: 'User answer', type: 'string' },
];

export const BLOCK_OUTPUT_SCHEMAS: Record<string, NodeOutputField[]> = {
  /* ── Inputs ────────────────────────────────────────────── */
  text_input: TEXT_INPUT_FIELDS,
  number_input: [{ key: 'answer', label: 'User answer', type: 'number' }],
  email_input: [{ key: 'answer', label: 'Email address', type: 'string' }],
  phone_input: [{ key: 'answer', label: 'Phone number', type: 'string' }],
  url_input: [{ key: 'answer', label: 'URL', type: 'string' }],
  date_input: [{ key: 'answer', label: 'Selected date', type: 'date' }],
  time_input: [{ key: 'answer', label: 'Selected time', type: 'string' }],
  rating_input: [{ key: 'answer', label: 'Rating', type: 'number' }],
  file_input: FILE_INPUT_FIELDS,
  payment_input: PAYMENT_INPUT_FIELDS,
  choice_input: CHOICE_INPUT_FIELDS,
  picture_choice_input: CHOICE_INPUT_FIELDS,

  /* ── Logic ─────────────────────────────────────────────── */
  condition: CONDITION_FIELDS,
  set_variable: SET_VARIABLE_FIELDS,
  wait: WAIT_FIELDS,
  script: SCRIPT_FIELDS,

  /* ── AI ────────────────────────────────────────────────── */
  open_ai: OPENAI_FIELDS,
  anthropic: ANTHROPIC_FIELDS,
  together_ai: OPENAI_FIELDS,
  mistral: OPENAI_FIELDS,
  elevenlabs: ELEVENLABS_FIELDS,

  /* ── Integrations ──────────────────────────────────────── */
  webhook: WEBHOOK_FIELDS,
  send_email: SEND_EMAIL_FIELDS,
  google_sheets: GOOGLE_SHEETS_FIELDS,

  /* ── Trigger / Start node aliases ──────────────────────── */
  whatsapp_trigger: WHATSAPP_TRIGGER_FIELDS,
  trigger: WHATSAPP_TRIGGER_FIELDS,

  /* ── Forge aliases (declarative integrations) ──────────── */
  forge_send_email_n8n: SEND_EMAIL_FIELDS,
  forge_audio_elevenlabs_tts: ELEVENLABS_FIELDS,
  forge_webhook: WEBHOOK_FIELDS,
};

/** Fallback when the block type has no declared schema. */
export const FALLBACK_FIELDS: NodeOutputField[] = GENERIC_INPUT_FIELDS;

export function getDeclaredFields(blockType: string): NodeOutputField[] | undefined {
  return BLOCK_OUTPUT_SCHEMAS[blockType];
}
