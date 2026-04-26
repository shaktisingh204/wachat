import type { ObjectId } from 'mongodb';

/* ── Coordinates ──────────────────────────────────────── */
export type Coordinates = { x: number; y: number };
export type GraphPosition = Coordinates & { scale: number };

/* ── Connecting IDs (edge dragging) ───────────────────── */
export type ConnectingIds = {
  source:
    | { eventId: string; groupId?: undefined; blockId?: undefined; itemId?: undefined; pinId?: undefined }
    | { groupId: string; blockId?: string; itemId?: string; pinId?: string; eventId?: undefined };
  target?: {
    groupId?: string;
    blockId?: string;
  };
};

/* ── Block Categories ─────────────────────────────────── */
export type BlockCategory =
  | 'bubbles'
  | 'inputs'
  | 'logic'
  | 'integrations'
  | 'events'
  | 'forge'
  | 'ai'
  | 'webhook';

/* ── Block Types (Typebot-style) ──────────────────────── */
export type BubbleBlockType =
  | 'text'
  | 'image'
  | 'video'
  | 'embed'
  | 'audio';

export type InputBlockType =
  | 'text_input'
  | 'number_input'
  | 'email_input'
  | 'phone_input'
  | 'url_input'
  | 'date_input'
  | 'time_input'
  | 'rating_input'
  | 'file_input'
  | 'payment_input'
  | 'choice_input'
  | 'picture_choice_input';

export type LogicBlockType =
  | 'condition'
  | 'set_variable'
  | 'redirect'
  | 'script'
  | 'typebot_link'
  | 'wait'
  | 'jump'
  | 'ab_test'
  | 'merge'
  | 'switch'
  | 'loop'
  | 'filter'
  | 'sort'
  | 'set'
  | 'execute_workflow'
  | 'respond_to_webhook';

export type IntegrationBlockType =
  | 'webhook'
  | 'send_email'
  | 'google_sheets'
  | 'google_analytics'
  | 'open_ai'
  | 'zapier'
  | 'make_com'
  | 'pabbly_connect'
  | 'chatwoot'
  | 'pixel'
  | 'segment'
  | 'cal_com'
  | 'nocodb'
  | 'elevenlabs'
  | 'anthropic'
  | 'together_ai'
  | 'mistral';

/**
 * Forge-registered integration block types.
 *
 * These are declarative blocks implemented via `src/lib/sabflow/forge/` —
 * a shared schema drives both the settings UI (ForgeBlockSettings) and the
 * runtime (`ForgeAction.run`).  Add a new entry here when publishing a new
 * forge block so it becomes assignable to the `BlockType` union.
 */
export type ForgeBlockType =
  | 'forge_notion'
  | 'forge_airtable'
  | 'forge_slack'
  | 'forge_discord'
  | 'forge_github'
  | 'forge_twilio'
  | 'forge_sendgrid';

export type BlockType =
  | BubbleBlockType
  | InputBlockType
  | LogicBlockType
  | IntegrationBlockType
  | ForgeBlockType;

/* ══════════════════════════════════════════════════════════
   BLOCK OPTION TYPES — mapped from Typebot block schemas
   ══════════════════════════════════════════════════════════ */

/* ── Bubble block options ─────────────────────────────── */

/** Options for a text/message bubble block. */
export type TextBubbleOptions = {
  /** Plain-text message content. Supports {{variable}} tokens. */
  content?: string;
  /** Rich-text representation (Plate.js element array) */
  richText?: unknown[];
  /** HTML string representation */
  html?: string;
  /** Typing emulation settings */
  typingEmulation?: {
    enabled: boolean;
    speed: number;
  };
};

/** Options for an image bubble block. */
export type ImageBubbleOptions = {
  /** Direct image URL or {{variable}} */
  url?: string;
  /** Accessible alt text */
  alt?: string;
  /** Click-through link */
  link?: string;
  /** Whether the image is hosted by SabFlow */
  isHosted?: boolean;
};

/** Options for a video bubble block. */
export type VideoBubbleOptions = {
  /** Video URL (YouTube, Vimeo, direct, etc.) */
  url?: string;
  /** Embed aspect ratio, e.g. "16/9" */
  aspectRatio?: string;
  /** Max CSS width, e.g. "600px" */
  maxWidth?: string;
  /** Whether browser controls are visible */
  areControlsDisplayed?: boolean;
  /** Autoplay on render */
  isAutoplayEnabled?: boolean;
  /** Provider-specific video ID */
  id?: string;
};

/** Options for an audio bubble block. */
export type AudioBubbleOptions = {
  /** Audio file URL */
  url?: string;
  /** Autoplay on render */
  isAutoplayEnabled?: boolean;
};

/** Options for an embed (iframe) bubble block. */
export type EmbedBubbleOptions = {
  /** URL to embed inside an iframe */
  url?: string;
  /** Iframe height value */
  height?: { value: number; unit: 'px' | '%' };
  /** Wait for a JS event emitted from inside the iframe */
  waitForEvent?: {
    isEnabled?: boolean;
    name?: string;
    saveDataInVariableId?: string;
  };
};

/* ── Input block options ──────────────────────────────── */

/** Options for a short/long text input block. */
export type TextInputOptions = {
  /** Input placeholder text */
  placeholder?: string;
  /** Submit button label */
  buttonLabel?: string;
  /** Variable ID to store the answer */
  variableId?: string;
  /** Render a multi-line textarea instead of a single-line input */
  isLong?: boolean;
  /** HTML input mode hint */
  inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
  /** Minimum allowed character length */
  minLength?: number;
  /** Maximum allowed character length */
  maxLength?: number;
  /** Regex pattern string the value must match */
  pattern?: string;
  /** Message shown when the value does not match `pattern` */
  patternMessage?: string;
};

/** Options for a numeric input block. */
export type NumberInputOptions = {
  placeholder?: string;
  buttonLabel?: string;
  variableId?: string;
  /** Minimum allowed value (number or {{variable}}) */
  min?: number | string;
  /** Maximum allowed value (number or {{variable}}) */
  max?: number | string;
  /** Step increment (number or {{variable}}) */
  step?: number | string;
  /** BCP 47 locale for formatting, e.g. "en-US" */
  locale?: string;
  /** Restrict to integer (whole-number) values */
  integer?: boolean;
};

/** Options for an email address input block. */
export type EmailInputOptions = {
  placeholder?: string;
  buttonLabel?: string;
  variableId?: string;
  /** Message shown when the user enters an invalid email */
  retryMessageContent?: string;
};

/** Options for a phone number input block. */
export type PhoneInputOptions = {
  placeholder?: string;
  buttonLabel?: string;
  variableId?: string;
  /** Message shown when the user enters an invalid phone number */
  retryMessageContent?: string;
  /** Default country code prefix, e.g. "US", "IN" */
  defaultCountryCode?: string;
  /** Default country for validation (ISO 3166-1 alpha-2, e.g. "US", "IN"). */
  country?: string;
};

/** Options for a URL input block. */
export type UrlInputOptions = {
  placeholder?: string;
  buttonLabel?: string;
  variableId?: string;
  /** Message shown when the user enters an invalid URL */
  retryMessageContent?: string;
  /** Require the URL to use the https:// scheme. */
  requireHttps?: boolean;
};

/** Options for a date picker input block. */
export type DateInputOptions = {
  /** Unicode CLDR date format string */
  format?: string;
  /** Minimum selectable date (ISO string or {{variable}}) */
  minDate?: string;
  /** Maximum selectable date (ISO string or {{variable}}) */
  maxDate?: string;
  variableId?: string;
  buttonLabel?: string;
  /** Show a time picker alongside the date picker */
  hasTime?: boolean;
  /** Allow selecting a date range */
  isRange?: boolean;
  labels?: {
    button?: string;
    from?: string;
    to?: string;
  };
};

/** Options for a time picker input block. */
export type TimeInputOptions = {
  /** Unicode CLDR time format string */
  format?: string;
  variableId?: string;
  labels?: {
    button?: string;
  };
  /** Earliest selectable time as "HH:MM". */
  minTime?: string;
  /** Latest selectable time as "HH:MM". */
  maxTime?: string;
};

/** Options for a star / numeric rating input block. */
export type RatingInputOptions = {
  /** Number of rating steps */
  length?: number;
  /** Render as icons or numbers */
  buttonType?: 'Icons' | 'Numbers';
  /** Starting value (number or {{variable}}) */
  startsAt?: number | string;
  labels?: {
    left?: string;
    right?: string;
    button?: string;
  };
  customIcon?: {
    isEnabled?: boolean;
    /** Raw SVG string for a custom icon */
    svg?: string;
  };
  variableId?: string;
  /** Submit immediately when a rating is tapped */
  isOneClickSubmitEnabled?: boolean;
};

/** Options for a single / multi-choice (buttons) input block. */
export type ChoiceInputOptions = {
  /** Allow the user to select multiple items */
  isMultipleChoice?: boolean;
  variableId?: string;
  /** Submit button label when multiple-choice is on */
  buttonLabel?: string;
  /**
   * When true, the choices list is driven by a variable containing a JSON
   * array of strings rather than the static `block.items` list.
   */
  isDynamic?: boolean;
  /** Variable ID containing a dynamic list of choice strings (JSON array) */
  dynamicVariableId?: string;
  /** Show a search box above the choices */
  isSearchable?: boolean;
  /** Placeholder shown inside the search box */
  searchInputPlaceholder?: string;
};

/** Options for a picture-choice (card grid) input block. */
export type PictureChoiceOptions = {
  isMultipleChoice?: boolean;
  variableId?: string;
  buttonLabel?: string;
  isSearchable?: boolean;
  searchInputPlaceholder?: string;
  dynamicItems?: {
    isEnabled?: boolean;
    titlesVariableId?: string;
    descriptionsVariableId?: string;
    pictureSrcsVariableId?: string;
  };
};

/* ── Payment input ────────────────────────────────────── */

/** Supported payment providers. */
export type PaymentProvider = 'stripe' | 'razorpay' | 'paypal';

/** Options for a payment collection input block. */
export type PaymentInputOptions = {
  /** Which payment provider to charge through. */
  provider?: PaymentProvider;
  /** References a stored credential (stripe secret key, etc.). */
  credentialId?: string;
  /** Amount to charge — supports {{variables}}. Parsed as a decimal. */
  amount?: string;
  /** 3-letter ISO currency code, e.g. "USD". */
  currency?: string;
  /** Description shown on the payment provider's checkout page. */
  description?: string;
  /** Variable ID to store the payment result (paymentIntentId / status). */
  variableId?: string;
  /** Customisable UI labels. */
  labels?: {
    /** Button text — supports {{variables}}. Default: "Pay {{amount}}". */
    button?: string;
    /** Message shown after a successful payment. */
    success?: string;
  };
  /** Toggle collecting extra information from the payer. */
  additionalInformation?: {
    /** Collect customer full name. */
    name?: string;
    /** Collect customer email address. */
    email?: string;
    /** Collect customer phone number. */
    phoneNumber?: string;
    /** Collect billing address fields. */
    address?: {
      country?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
  };
};

/** Options for a file-upload input block. */
export type FileInputOptions = {
  isRequired?: boolean;
  isMultipleAllowed?: boolean;
  variableId?: string;
  labels?: {
    placeholder?: string;
    button?: string;
    clear?: string;
    skip?: string;
    success?: {
      single?: string;
      multiple?: string;
    };
  };
  allowedFileTypes?: {
    isEnabled?: boolean;
    types?: string[];
  };
  /** Maximum file size in megabytes. */
  maxSizeMB?: number;
  /**
   * Flat list of accepted MIME types / extensions — e.g.
   * ["image/*", ".pdf", "application/json"].  Simpler alternative to
   * `allowedFileTypes.types`.
   */
  acceptedTypes?: string[];
};

/* ── Logic block options ──────────────────────────────── */

/** All comparison operators supported by the condition block. */
export type ComparisonOperator =
  | 'Equal to'
  | 'Not equal to'
  | 'Contains'
  | 'Does not contain'
  | 'Greater than'
  | 'Less than'
  | 'Greater than or equal'
  | 'Less than or equal'
  | 'Is empty'
  | 'Is not empty'
  | 'Starts with'
  | 'Ends with'
  | 'Matches regex';

/** A single comparison clause within a condition group. */
export type Comparison = {
  id: string;
  /** Left-hand variable ID */
  variableId?: string;
  /** Comparison operator */
  operator?: ComparisonOperator;
  /** Right-hand literal or {{variable}} */
  value?: string;
};

/** A group of comparisons joined by a single logical operator. */
export type ConditionGroup = {
  id: string;
  /** Logical operator between comparisons within this group */
  logicalOperator: 'AND' | 'OR';
  comparisons: Comparison[];
};

/**
 * Options for a condition (branching) block.
 *
 * Structured as a list of groups where:
 * - comparisons *within* a group are evaluated using `group.logicalOperator`
 * - groups themselves are joined by the top-level `logicalOperator`
 */
export type ConditionOptions = {
  /** Logical operator applied between groups */
  logicalOperator: 'AND' | 'OR';
  /** One or more condition groups */
  conditionGroups: ConditionGroup[];
};

/**
 * Legacy single comparison clause shape (kept for ConditionItem back-compat).
 * New code should use `Comparison` from this module.
 */
export type ConditionComparison = {
  id: string;
  /** Left-hand variable ID */
  variableId?: string;
  /** Comparison operator */
  operator?: string;
  /** Right-hand literal or {{variable}} */
  value?: string;
};

/** Options for a set-variable block. */
export type SetVariableOptions = {
  variableId?: string;
  /**
   * How to compute the new value.
   * Supported: "custom" | "empty" | "today" | "now" | "random_id" |
   *            "code" | "append" | "sum" | "subtract" | "multiply" | "divide"
   */
  valueType?: string;
  /** Static value, JS expression string, or numeric operand */
  value?: string;
  /** JS expression to evaluate when valueType === "code" */
  code?: string;
  /** JS expression to evaluate (Typebot compat) */
  expressionToEvaluate?: string;
  /** Whether to treat expressionToEvaluate as code */
  isCode?: boolean;
  /** Whether to execute the expression on the client */
  isExecutedOnClient?: boolean;
  /** Whether to run on client (SabFlow alias) */
  runOnClient?: boolean;
};

/** Options for an A/B test (traffic split) block. */
export type ABTestOptions = {
  /** Percentage of traffic routed to path A (0–100) */
  aPercent?: number;
};

/** Options for a jump-to-group block. */
export type JumpOptions = {
  /** Target group ID */
  groupId?: string;
  /** Target block ID within the group */
  blockId?: string;
};

/** Options for a URL redirect block. */
export type RedirectOptions = {
  /** Destination URL */
  url?: string;
  /** Open in a new browser tab */
  isNewTab?: boolean;
};

/** Options for a script execution block. */
export type ScriptOptions = {
  /** Human-readable label for the script */
  name?: string;
  /** JavaScript source code */
  content?: string;
  /** Execute on the client (browser) rather than server */
  isExecutedOnClient?: boolean;
  /** Execute in a shared parent context */
  shouldExecuteInParentContext?: boolean;
};

/* ── Merge block options ──────────────────────────────── */

/**
 * Merge modes (n8n-style).
 *
 * - `append`      concatenate all input arrays into one output array
 * - `mergeByKey`  SQL-like join on a shared field
 * - `multiplex`   cartesian product across every input
 * - `pickFirst`   pass through the first non-empty input
 */
export type MergeMode = 'append' | 'mergeByKey' | 'multiplex' | 'pickFirst';

/** Options for a merge (fan-in) logic block. */
export type MergeOptions = {
  /** Combination strategy — defaults to 'append'. */
  mode?: MergeMode;
  /** For `mergeByKey`: field name used as the join key on both sides. */
  mergeByField?: string;
  /** For `mergeByKey`: keep items whose key did not match anything. */
  includeUnpaired?: boolean;
};

/** Options for a wait/delay block. */
export type WaitOptions = {
  /** Number of seconds to pause execution (string or number) */
  secondsToWaitFor?: string | number;
  /** Custom field used by SabFlow UI for the numeric value */
  seconds?: number;
  /** Optional message to display while waiting */
  waitingMessage?: string;
  /** Pause the chat entirely (Typebot compat) */
  shouldPause?: boolean;
};

/* ── Integration block options ────────────────────────── */

/** A key/value pair row (used in webhook headers, etc.). */
export type KVPair = {
  id: string;
  key: string;
  value: string;
};

/** A response-mapping row for HTTP request blocks. */
export type ResponseMapping = {
  id: string;
  /** Dot-notation JSON path into the response */
  jsonPath: string;
  /** Variable ID to save the extracted value */
  variableId?: string;
};

/** Structured body of an HTTP request (form/JSON/raw/binary). */
export type WebhookBody = {
  /** `'form-data'` is accepted as a legacy alias for `'form'`. */
  type: 'json' | 'form' | 'form-data' | 'raw' | 'binary';
  content?: string;
  pairs?: KVPair[];
  /** Legacy form-encoded payload (key/value list). Prefer `pairs`. */
  formData?: KVPair[];
};

/** Options for an HTTP request (webhook) integration block. */
export type WebhookOptions = {
  /** Request URL */
  url?: string;
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Request headers */
  headers?: KVPair[];
  /** Raw JSON body (may contain {{variable}} tokens) */
  body?: string | WebhookBody;
  /** Query parameters (key/value pairs, supports {{variable}}). */
  queryParams?: KVPair[];
  /** Request timeout in milliseconds. Default: no timeout. */
  timeout?: number;
  /** Variable ID to store the raw response body */
  responseVariable?: string;
  /** Variable ID to store the HTTP status code */
  statusCodeVariable?: string;
  /** Save the entire response (status + headers + body) into the response variable. */
  saveFullResponseToVariable?: boolean;
  /** @alias responseVariable — kept for legacy callers. */
  fullResponseVariableId?: string;
  /** @alias statusCodeVariable — kept for legacy callers. */
  statusCodeVariableId?: string;
  /** Response field extraction mappings (Typebot compat) */
  responseMappings?: ResponseMapping[];
  /** Auth strategy when the request must be signed/authenticated. */
  authentication?:
    | { type: 'none' }
    | { type: 'basic'; username?: string; password?: string }
    | { type: 'bearer'; token?: string }
    | { type: 'header'; name?: string; value?: string }
    | { type: 'oauth2'; credentialId?: string };
};

/** A file attachment entry (URL-based) for send-email blocks. */
export type EmailAttachment = {
  id: string;
  /** Direct URL to the file (supports {{variable}}) */
  url: string;
};

/** SMTP connection settings for a send-email block. */
export type SmtpConfig = {
  host?: string;
  /** TCP port, e.g. 587 or 465 */
  port?: number;
  /** Use STARTTLS upgrade (port 587) instead of implicit TLS (port 465) */
  useStartTls?: boolean;
  username?: string;
  password?: string;
};

/** Options for a send-email integration block. */
export type SendEmailOptions = {
  /** Sender display name, e.g. "My Bot" */
  fromName?: string;
  /** Sender address, e.g. "no-reply@myapp.com" */
  fromEmail?: string;
  /** Reply-to address (optional) */
  replyTo?: string;
  /** Recipient(s) — comma-separated, supports {{variable}} */
  to?: string;
  /** Email subject — supports {{variable}} */
  subject?: string;
  /** Body content type */
  bodyType?: 'richtext' | 'html';
  /** Email body — supports {{variable}} */
  body?: string;
  /** File attachment URLs */
  attachments?: EmailAttachment[];
  /** When true, use custom SMTP; when false, use workspace SMTP */
  useCustomSmtp?: boolean;
  /** Custom SMTP connection settings */
  smtp?: SmtpConfig;
  /** @legacy — kept for back-compat with existing documents */
  from?: string;
  /** @legacy — kept for back-compat */
  isCustomSmtp?: boolean;
  /** @legacy — kept for back-compat */
  credentialsId?: string;
};

/** A column-to-variable extractor row (Get data action). */
export type SheetsExtractor = {
  id: string;
  /** Column letter, e.g. "A" */
  column: string;
  /** Variable ID to save the cell value into */
  variableId?: string;
};

/** A column-value pair row (Insert / Update actions). */
export type SheetsCellValue = {
  id: string;
  /** Column letter, e.g. "A" */
  column: string;
  /** Cell value — supports {{variable}} tokens */
  value: string;
};

/** Options for a Google Sheets integration block. */
export type GoogleSheetsOptions = {
  spreadsheetId?: string;
  sheetName?: string;
  action?: 'get_data' | 'insert_row' | 'update_row' | 'delete_row';
  /** Get data: the reference cell/range, e.g. "A1" or {{variable}} */
  referenceRow?: string;
  /** Get data: column → variable mappings */
  extractors?: SheetsExtractor[];
  /** Insert / Update row: column → value mappings */
  cellValues?: SheetsCellValue[];
  /** Update / Delete row: row number (string or {{variable}}) */
  rowNumber?: string;
  /** @legacy fields — kept for back-compat with existing documents */
  sheetId?: string | number;
  cellsToExtract?: Array<{ id: string; column?: string; variableId?: string }>;
  cellsToUpsert?: Array<{ id: string; column?: string; value?: string }>;
  referenceCell?: { column?: string; value?: string };
};

/** Options for an AI (LLM) integration block (OpenAI / Anthropic / etc.). */
export type AIBlockOptions = {
  /* ── Credentials ─────────────────────────────── */
  credentialsId?: string;
  /** Inherit the API key from workspace settings instead of storing it per-block. */
  useWorkspaceKey?: boolean;
  apiKey?: string;
  /* ── Core ────────────────────────────────────── */
  model?: string;
  /** Task variant (OpenAI-specific): ask_assistant | create_image | create_transcription | create_speech | create_embedding */
  task?: string;
  /* ── Ask assistant ───────────────────────────── */
  systemPrompt?: string;
  userMessage?: string;
  /** How the conversation history is sent: "last" | "all" | "custom" */
  messagesFormat?: string;
  /** Explicit messages array when messagesFormat === "custom" */
  customMessages?: Array<{ id: string; role: 'system' | 'user' | 'assistant'; content: string }>;
  responseVariable?: string;
  responseVariableId?: string;
  /* ── Advanced (ask assistant) ────────────────── */
  temperature?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  /* ── Create image ────────────────────────────── */
  imagePrompt?: string;
  imageSize?: string;
  imageQuality?: string;
  imageUrlVariableId?: string;
  /* ── Create transcription ────────────────────── */
  audioUrlVariableId?: string;
  transcriptionLanguage?: string;
  transcriptionVariableId?: string;
  /* ── Create speech ───────────────────────────── */
  speechText?: string;
  speechVoice?: string;
  speechUrlVariableId?: string;
  /* ── Create embedding ────────────────────────── */
  embeddingInput?: string;
  embeddingVariableId?: string;
};

/* ══════════════════════════════════════════════════════════
   BLOCK ITEM TYPES
   ══════════════════════════════════════════════════════════ */

/** Base item shape — used for choice buttons, condition branches, etc. */
export type BlockItem = {
  id: string;
  /** Optional block ID (v5 compat) */
  blockId?: string;
  /** Outgoing edge ID attached to this item */
  outgoingEdgeId?: string;
  /** Human-readable text */
  content?: string;
  [key: string]: unknown;
};

/** A single choice button item (for choice_input / picture_choice_input blocks). */
export type ChoiceItem = {
  id: string;
  blockId?: string;
  outgoingEdgeId?: string;
  /** Button label */
  content?: string;
  /** Stored value (if different from label) */
  value?: string;
  /** Image URL for picture choice items */
  pictureSrc?: string;
  title?: string;
  description?: string;
  displayCondition?: {
    isEnabled?: boolean;
    condition?: unknown;
  };
};

/** A condition branch item (for condition blocks). */
export type ConditionItem = {
  id: string;
  blockId?: string;
  outgoingEdgeId?: string;
  /** The condition expression for this branch */
  content?: {
    comparisons?: ConditionComparison[];
    logicalOperator?: 'AND' | 'OR';
  };
};

/** An A/B test path item (path "a" or "b"). */
export type ABTestItem = {
  id: string;
  outgoingEdgeId?: string;
  path: 'a' | 'b';
};

/* ══════════════════════════════════════════════════════════
   UNION OF ALL OPTION TYPES
   ══════════════════════════════════════════════════════════ */

/**
 * Union of all block-specific option types.
 *
 * Intersected with `Record<string, unknown>` so that:
 * - Existing components can spread `{ ...options, ...patch }` (where patch is
 *   `Record<string, unknown>`) and assign the result back to `Block.options`
 *   without TypeScript complaining.
 * - New code can import the individual option types for precise typing.
 */
export type BlockOptions = (
  | TextBubbleOptions
  | ImageBubbleOptions
  | VideoBubbleOptions
  | AudioBubbleOptions
  | EmbedBubbleOptions
  | TextInputOptions
  | NumberInputOptions
  | EmailInputOptions
  | PhoneInputOptions
  | UrlInputOptions
  | DateInputOptions
  | TimeInputOptions
  | RatingInputOptions
  | ChoiceInputOptions
  | PictureChoiceOptions
  | FileInputOptions
  | PaymentInputOptions
  | ConditionOptions
  | SetVariableOptions
  | ABTestOptions
  | JumpOptions
  | RedirectOptions
  | ScriptOptions
  | WaitOptions
  | MergeOptions
  | LoopOptions
  | SwitchOptions
  | FilterOptions
  | SortOptions
  | WebhookOptions
  | SendEmailOptions
  | GoogleSheetsOptions
  | AIBlockOptions
) & Record<string, unknown>;

/* ── Block data ───────────────────────────────────────── */

/**
 * A single node in the flow graph.
 *
 * `options` is typed as the union of all block-specific option shapes (each
 * field optional) intersected with `Record<string, unknown>` for backward
 * compatibility with existing spread patterns:
 *   `const options = block.options ?? {}`
 *   `onBlockChange({ ...block, options: { ...options, ...patch } })`
 */
export type Block = {
  id: string;
  type: BlockType;
  groupId: string;
  options?: BlockOptions;
  items?: BlockItem[];
  outgoingEdgeId?: string;
  /** Custom input ports — when omitted, `getDefaultPorts()` is used. */
  inputPorts?: NodePort[];
  /** Custom output ports — when omitted, `getDefaultPorts()` is used. */
  outputPorts?: NodePort[];
  /** Custom output pins — overrides `getDefaultPins(type)`. */
  outputPins?: OutputPin[];
  /** n8n-style retry-on-failure config. */
  retry?: NodeRetryConfig;
  /** n8n-style error-handling strategy. */
  onError?: NodeErrorStrategy;
  /** Pinned output — when set, engine skips execution and returns this. */
  pinData?: unknown;
  /**
   * Canvas position for this block when rendered as an atomic n8n-style node.
   * When absent, the n8n canvas falls back to the containing group's coords
   * plus a per-index vertical offset.
   */
  graphCoordinates?: Coordinates;
};

/**
 * n8n-style retry config.  When a node throws, the executor re-runs it up to
 * `maxTries` times, sleeping `waitMs` between attempts (optionally multiplied
 * by a backoff factor).
 */
export type NodeRetryConfig = {
  /** Total attempts including the first. Minimum 1. Default 1 (no retry). */
  maxTries: number;
  /** Delay between attempts in ms. Default 1000. */
  waitMs?: number;
  /** 'linear' = constant waitMs; 'exponential' = waitMs * 2^(attempt-1). */
  backoff?: 'linear' | 'exponential';
};

/**
 * Action to take when a node errors after all retries are exhausted.
 *   - 'stop'                 — default. Execution halts, error propagates.
 *   - 'continueRegularOutput'— swallow the error, continue on the main pin.
 *   - 'continueErrorOutput'  — route to the node's 'error' pin edges.
 */
export type NodeErrorStrategy =
  | 'stop'
  | 'continueRegularOutput'
  | 'continueErrorOutput';

/* ── Discriminated union for type-safe access ─────────── */

/**
 * Fully discriminated block union.  Use this when you need precise typing on
 * `block.options` and have already narrowed `block.type`.
 *
 * Example:
 *   function handleBlock(block: TypedBlock) {
 *     if (block.type === 'text') {
 *       block.options?.content  // ← TypeScript knows this is TextBubbleOptions
 *     }
 *   }
 */
export type TypedBlock =
  | { id: string; groupId: string; type: 'text';               outgoingEdgeId?: string; items?: BlockItem[]; options?: TextBubbleOptions    }
  | { id: string; groupId: string; type: 'image';              outgoingEdgeId?: string; items?: BlockItem[]; options?: ImageBubbleOptions   }
  | { id: string; groupId: string; type: 'video';              outgoingEdgeId?: string; items?: BlockItem[]; options?: VideoBubbleOptions   }
  | { id: string; groupId: string; type: 'audio';              outgoingEdgeId?: string; items?: BlockItem[]; options?: AudioBubbleOptions   }
  | { id: string; groupId: string; type: 'embed';              outgoingEdgeId?: string; items?: BlockItem[]; options?: EmbedBubbleOptions   }
  | { id: string; groupId: string; type: 'text_input';         outgoingEdgeId?: string; items?: BlockItem[]; options?: TextInputOptions     }
  | { id: string; groupId: string; type: 'number_input';       outgoingEdgeId?: string; items?: BlockItem[]; options?: NumberInputOptions   }
  | { id: string; groupId: string; type: 'email_input';        outgoingEdgeId?: string; items?: BlockItem[]; options?: EmailInputOptions    }
  | { id: string; groupId: string; type: 'phone_input';        outgoingEdgeId?: string; items?: BlockItem[]; options?: PhoneInputOptions    }
  | { id: string; groupId: string; type: 'url_input';          outgoingEdgeId?: string; items?: BlockItem[]; options?: UrlInputOptions      }
  | { id: string; groupId: string; type: 'date_input';         outgoingEdgeId?: string; items?: BlockItem[]; options?: DateInputOptions     }
  | { id: string; groupId: string; type: 'time_input';         outgoingEdgeId?: string; items?: BlockItem[]; options?: TimeInputOptions     }
  | { id: string; groupId: string; type: 'rating_input';       outgoingEdgeId?: string; items?: BlockItem[]; options?: RatingInputOptions   }
  | { id: string; groupId: string; type: 'file_input';         outgoingEdgeId?: string; items?: BlockItem[]; options?: FileInputOptions     }
  | { id: string; groupId: string; type: 'payment_input';      outgoingEdgeId?: string; items?: BlockItem[]; options?: PaymentInputOptions }
  | { id: string; groupId: string; type: 'choice_input';       outgoingEdgeId?: string; items?: ChoiceItem[]; options?: ChoiceInputOptions  }
  | { id: string; groupId: string; type: 'picture_choice_input'; outgoingEdgeId?: string; items?: ChoiceItem[]; options?: PictureChoiceOptions }
  | { id: string; groupId: string; type: 'condition';          outgoingEdgeId?: string; items?: ConditionItem[]; options?: ConditionOptions }
  | { id: string; groupId: string; type: 'set_variable';       outgoingEdgeId?: string; items?: BlockItem[]; options?: SetVariableOptions  }
  | { id: string; groupId: string; type: 'redirect';           outgoingEdgeId?: string; items?: BlockItem[]; options?: RedirectOptions     }
  | { id: string; groupId: string; type: 'script';             outgoingEdgeId?: string; items?: BlockItem[]; options?: ScriptOptions       }
  | { id: string; groupId: string; type: 'typebot_link';       outgoingEdgeId?: string; items?: BlockItem[]; options?: BlockOptions        }
  | { id: string; groupId: string; type: 'wait';               outgoingEdgeId?: string; items?: BlockItem[]; options?: WaitOptions         }
  | { id: string; groupId: string; type: 'jump';               outgoingEdgeId?: string; items?: BlockItem[]; options?: JumpOptions         }
  | { id: string; groupId: string; type: 'ab_test';            outgoingEdgeId?: string; items?: ABTestItem[]; options?: ABTestOptions      }
  | { id: string; groupId: string; type: 'merge';              outgoingEdgeId?: string; items?: BlockItem[]; options?: MergeOptions       }
  | { id: string; groupId: string; type: 'loop';               outgoingEdgeId?: string; items?: BlockItem[]; options?: LoopOptions        }
  | { id: string; groupId: string; type: 'switch';             outgoingEdgeId?: string; items?: BlockItem[]; options?: SwitchOptions      }
  | { id: string; groupId: string; type: 'filter';             outgoingEdgeId?: string; items?: BlockItem[]; options?: FilterOptions      }
  | { id: string; groupId: string; type: 'sort';               outgoingEdgeId?: string; items?: BlockItem[]; options?: SortOptions        }
  | { id: string; groupId: string; type: 'webhook';            outgoingEdgeId?: string; items?: BlockItem[]; options?: WebhookOptions      }
  | { id: string; groupId: string; type: 'send_email';         outgoingEdgeId?: string; items?: BlockItem[]; options?: SendEmailOptions    }
  | { id: string; groupId: string; type: 'google_sheets';      outgoingEdgeId?: string; items?: BlockItem[]; options?: GoogleSheetsOptions }
  | { id: string; groupId: string; type: 'google_analytics';   outgoingEdgeId?: string; items?: BlockItem[]; options?: BlockOptions        }
  | { id: string; groupId: string; type: 'open_ai';            outgoingEdgeId?: string; items?: BlockItem[]; options?: AIBlockOptions      }
  | { id: string; groupId: string; type: 'zapier';             outgoingEdgeId?: string; items?: BlockItem[]; options?: BlockOptions        }
  | { id: string; groupId: string; type: 'make_com';           outgoingEdgeId?: string; items?: BlockItem[]; options?: BlockOptions        }
  | { id: string; groupId: string; type: 'pabbly_connect';     outgoingEdgeId?: string; items?: BlockItem[]; options?: BlockOptions        }
  | { id: string; groupId: string; type: 'chatwoot';           outgoingEdgeId?: string; items?: BlockItem[]; options?: BlockOptions        }
  | { id: string; groupId: string; type: 'pixel';              outgoingEdgeId?: string; items?: BlockItem[]; options?: BlockOptions        }
  | { id: string; groupId: string; type: 'segment';            outgoingEdgeId?: string; items?: BlockItem[]; options?: BlockOptions        }
  | { id: string; groupId: string; type: 'cal_com';            outgoingEdgeId?: string; items?: BlockItem[]; options?: BlockOptions        }
  | { id: string; groupId: string; type: 'nocodb';             outgoingEdgeId?: string; items?: BlockItem[]; options?: BlockOptions        }
  | { id: string; groupId: string; type: 'elevenlabs';         outgoingEdgeId?: string; items?: BlockItem[]; options?: AIBlockOptions      }
  | { id: string; groupId: string; type: 'anthropic';          outgoingEdgeId?: string; items?: BlockItem[]; options?: AIBlockOptions      }
  | { id: string; groupId: string; type: 'together_ai';        outgoingEdgeId?: string; items?: BlockItem[]; options?: AIBlockOptions      }
  | { id: string; groupId: string; type: 'mistral';            outgoingEdgeId?: string; items?: BlockItem[]; options?: AIBlockOptions      };

/* ── Type-guard helpers ───────────────────────────────── */

const BUBBLE_BLOCK_TYPES: BubbleBlockType[] = ['text', 'image', 'video', 'audio', 'embed'];
const INPUT_BLOCK_TYPES: InputBlockType[] = [
  'text_input', 'number_input', 'email_input', 'phone_input', 'url_input',
  'date_input', 'time_input', 'rating_input', 'file_input', 'payment_input',
  'choice_input', 'picture_choice_input',
];
const LOGIC_BLOCK_TYPES: LogicBlockType[] = [
  'condition', 'set_variable', 'redirect', 'script', 'typebot_link', 'wait', 'jump', 'ab_test', 'merge',
];
const INTEGRATION_BLOCK_TYPES: IntegrationBlockType[] = [
  'webhook', 'send_email', 'google_sheets', 'google_analytics', 'open_ai',
  'zapier', 'make_com', 'pabbly_connect', 'chatwoot', 'pixel', 'segment',
  'cal_com', 'nocodb', 'elevenlabs', 'anthropic', 'together_ai', 'mistral',
];

/** Returns true when the block emits a bubble message to the user. */
export const isBubbleBlock = (block: Block): boolean =>
  (BUBBLE_BLOCK_TYPES as string[]).includes(block.type);

/** Returns true when the block collects input from the user. */
export const isInputBlock = (block: Block): boolean =>
  (INPUT_BLOCK_TYPES as string[]).includes(block.type);

/** Returns true when the block controls flow logic. */
export const isLogicBlock = (block: Block): boolean =>
  (LOGIC_BLOCK_TYPES as string[]).includes(block.type);

/** Returns true when the block calls an external integration. */
export const isIntegrationBlock = (block: Block): boolean =>
  (INTEGRATION_BLOCK_TYPES as string[]).includes(block.type);

/* ── Group ────────────────────────────────────────────── */
export type Group = {
  id: string;
  title: string;
  graphCoordinates: Coordinates;
  blocks: Block[];
};

/* ── Event ────────────────────────────────────────────── */
export type EventType = 'start' | 'schedule' | 'webhook' | 'manual' | 'error';

export type ScheduleEventOptions = {
  cronExpression: string;
  timezone?: string;
  enabled?: boolean;
};

export type WebhookEventOptions = {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ANY';
  authentication: 'none' | 'header' | 'basic' | 'query';
  authHeaderName?: string;
  authHeaderValue?: string;
  authBasicUser?: string;
  authBasicPassword?: string;
  responseMode: 'immediately' | 'lastNode' | 'responseNode';
  responseCode?: number;
  responseData?: string;
  responseHeaders?: { name: string; value: string }[];
  enabled?: boolean;
};

export type ManualEventOptions = {
  enabled?: boolean;
  samplePayload?: Record<string, unknown>;
};

export type SabFlowEvent = {
  id: string;
  type: EventType;
  graphCoordinates: Coordinates;
  outgoingEdgeId?: string;
  options?: ScheduleEventOptions | WebhookEventOptions | ManualEventOptions;
  /**
   * App-event slug picked from the trigger panel (e.g. `whatsapp_message_received`,
   * `crm_deal_moved`). Independent of `type` — `type` describes the engine
   * subscription mechanism (webhook / schedule / manual / start / error) while
   * `appEvent` records the specific SabNode product event the user selected.
   */
  appEvent?: string;
};

/* ── Port / Handle types (n8n-style) ─────────────────── */

/** Semantic type of a port — determines which ports can connect to each other. */
export type PortType = 'main' | 'ai' | 'tool' | 'data';

/**
 * A single input or output port on a block.
 *
 * The `id` follows the n8n convention: `"{mode}/{type}/{index}"`,
 * e.g. `"outputs/main/0"`, `"inputs/main/1"`.
 */
export type NodePort = {
  id: string;
  mode: 'input' | 'output';
  type: PortType;
  index: number;
  label?: string;
  /** Max connections allowed on this handle. Defaults: inputs=1, outputs=Infinity. */
  maxConnections?: number;
  /** When true the port must be connected for the block to be valid. */
  required?: boolean;
};

/** Status of an edge — drives colour / animation in the edge renderer. */
export type EdgeStatus = 'idle' | 'success' | 'error' | 'pinned' | 'running';

/* ── Output pins (legacy multi-output system) ─────────── */
export type OutputPin = {
  id: string;
  label: string;
  color?: string;
};

/* ── Edge ─────────────────────────────────────────────── */
export type EdgeFrom =
  | { eventId: string; groupId?: undefined; blockId?: undefined; itemId?: undefined; pinId?: undefined }
  | { groupId: string; blockId?: undefined; itemId?: undefined; pinId?: undefined; eventId?: undefined }
  | { groupId: string; blockId: string; itemId?: undefined; pinId?: string; eventId?: undefined }
  | { groupId: string; blockId: string; itemId: string; pinId?: undefined; eventId?: undefined };

export type EdgeTo = {
  groupId: string;
  blockId?: string;
};

export type Edge = {
  id: string;
  from: EdgeFrom;
  to: EdgeTo;
  /** n8n-style handle ID on the source, e.g. "outputs/main/0". */
  sourceHandle?: string;
  /** n8n-style handle ID on the target, e.g. "inputs/main/0". */
  targetHandle?: string;
  /** Visual status of this edge — drives colour and animation. */
  status?: EdgeStatus;
};

/* ── Variable ─────────────────────────────────────────── */
export type Variable = {
  id: string;
  name: string;
  /** Current / default runtime value (string serialisation) */
  value?: string;
  /** Typed default value — used by the engine to seed the session */
  defaultValue?: string | number | boolean;
  /** Session-only: not persisted to results across sessions */
  isSessionVariable?: boolean;
  /** Hidden from the results table / exports */
  isHidden?: boolean;
};

/* ── Theme ────────────────────────────────────────────── */

/**
 * A colour value that is either a literal hex/CSS colour string,
 * or a reference to a flow variable.
 */
export type ThemeColor =
  | { type: 'Color'; value: string }
  | { type: 'Variable'; id: string };

/** Theme overrides for the bot (host) message bubbles. */
export type HostBubbleTheme = {
  backgroundColor?: ThemeColor;
  color?: ThemeColor;
  /** CSS border-radius value, e.g. "8px" or "1rem" */
  borderRadius?: string;
  fontFamily?: string;
};

/** Theme overrides for the user (guest) message bubbles. */
export type GuestBubbleTheme = {
  backgroundColor?: ThemeColor;
  color?: ThemeColor;
  borderRadius?: string;
};

/** Theme overrides for the text / date / email input field. */
export type InputTheme = {
  backgroundColor?: ThemeColor;
  color?: ThemeColor;
  borderColor?: ThemeColor;
  borderRadius?: string;
  placeholderColor?: ThemeColor;
};

/** Theme overrides for the primary send / choice buttons. */
export type ButtonTheme = {
  backgroundColor?: ThemeColor;
  color?: ThemeColor;
  borderRadius?: string;
};

/** Full chat-window theme configuration. */
export type ChatTheme = {
  background?: { type: 'Color' | 'Gradient' | 'Image'; content?: string };
  hostBubble?: HostBubbleTheme;
  guestBubble?: GuestBubbleTheme;
  input?: InputTheme;
  button?: ButtonTheme;
  fontFamily?: string;
  /** Global corner-roundness preset applied across all chat elements. */
  roundness?: 'None' | 'Medium' | 'Large';
};

/** General (page-level) theme configuration. */
export type GeneralTheme = {
  font?: string;
  background?: { type: 'Color' | 'Transparent'; color?: string };
};

/**
 * Composite flow theme.
 * `FlowTheme` is the canonical name used in new code.
 * `SabFlowTheme` is the legacy name kept for backward-compat with
 * existing DB documents — it is a superset that also carries the
 * old flat fields alongside the new rich typed fields.
 */
export type FlowTheme = {
  chat?: ChatTheme;
  general?: GeneralTheme;
};

export type SabFlowTheme = FlowTheme & {
  general?: Omit<GeneralTheme, 'background'> & {
    /** @legacy */
    background?: { type: 'Color' | 'Image' | 'None' | 'Transparent'; content?: string; color?: string };
    progressBar?: {
      isEnabled?: boolean;
      color?: string;
      placement?: 'top' | 'bottom';
    };
  };
  chat?: ChatTheme & {
    container?: {
      backgroundColor?: string;
      maxWidth?: string;
      maxHeight?: string;
    };
    header?: {
      backgroundColor?: string;
      color?: string;
      isEnabled?: boolean;
    };
    /** @legacy — flat string colour, superseded by hostBubble.backgroundColor */
    hostBubble?: Omit<HostBubbleTheme, 'backgroundColor' | 'color'> & {
      backgroundColor?: string | ThemeColor;
      color?: string | ThemeColor;
    };
    /** @legacy — flat string colour, superseded by guestBubble.backgroundColor */
    guestBubble?: Omit<GuestBubbleTheme, 'backgroundColor' | 'color'> & {
      backgroundColor?: string | ThemeColor;
      color?: string | ThemeColor;
    };
    input?: Omit<InputTheme, 'backgroundColor' | 'color' | 'placeholderColor'> & {
      backgroundColor?: string | ThemeColor;
      color?: string | ThemeColor;
      placeholderColor?: string | ThemeColor;
    };
    button?: Omit<ButtonTheme, 'backgroundColor' | 'color'> & {
      backgroundColor?: string | ThemeColor;
      color?: string | ThemeColor;
    };
  };
};

/* ── FlowSettings ─────────────────────────────────────── */

/**
 * Per-flow configuration that drives behaviour, SEO, and embed options.
 * All fields are optional so that a partial object can be saved incrementally.
 */
export type FlowSettings = {
  /* ── General ──────────────────────────────────────── */
  /** Internal description (not shown to users). */
  description?: string;
  /** BCP 47 language tag for the flow's primary language, e.g. "en", "es". */
  language?: string;

  /* ── Behaviour ────────────────────────────────────── */
  /** Persist the user's session across visits (localStorage / cookie). */
  rememberUser?: boolean;
  /** Render a close / dismiss button in the chat widget. */
  showCloseButton?: boolean;
  /** Show a "Restart" button so users can start over. */
  allowRestart?: boolean;
  /** Strip UTM / query-string params from the share URL. */
  hideQueryString?: boolean;
  /** Pressing Escape dismisses the chat widget. */
  closeOnEscapeKey?: boolean;

  /* ── Metadata (SEO) ───────────────────────────────── */
  /** Browser tab / og:title for the full-page embed. */
  seoTitle?: string;
  /** meta description / og:description for the full-page embed. */
  seoDescription?: string;
  /** Favicon URL for the full-page embed. */
  faviconUrl?: string;
  /** Open Graph / social preview image URL. */
  ogImageUrl?: string;

  /* ── Custom Domain ────────────────────────────────── */
  /** Custom hostname, e.g. "chat.yoursite.com". */
  customDomain?: string;

  /* ── Custom CSS ───────────────────────────────────── */
  /** Raw CSS injected into the full-page embed. */
  customCss?: string;

  /* ── Legacy / misc keys kept for back-compat ─────── */
  customHeadScript?: string;
  [key: string]: unknown;
};

/* ── Annotations (canvas sticky notes / text labels) ─── */

/** Pastel colour palette for sticky-note annotations. */
export type AnnotationColor =
  | 'yellow'
  | 'pink'
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange';

/**
 * A free-floating sticky note / label attached to the flow canvas.
 *
 * Annotations are not part of the flow graph (they have no edges, blocks,
 * or runtime semantics).  They exist purely so teammates can leave comments
 * and visual hints on the canvas.
 */
export type Annotation = {
  id: string;
  type: 'sticky_note' | 'text_label';
  graphCoordinates: Coordinates;
  /** Width in canvas units (defaults to 200 at render time). */
  width?: number;
  /** Height in canvas units (defaults to 150 at render time). */
  height?: number;
  /** User-authored rich-text-ish content (plain string, line-breaks allowed). */
  content: string;
  /** Visual colour key — maps to a pastel background palette. */
  color?: AnnotationColor;
  /** Optional font-size override in px. */
  fontSize?: number;
};

/* ── SabFlow (document) ───────────────────────────────── */
export type SabFlowDoc = {
  _id?: ObjectId;
  userId: string;
  projectId?: string;
  name: string;
  events: SabFlowEvent[];
  groups: Group[];
  edges: Edge[];
  variables: Variable[];
  /** Free-floating sticky notes / text labels on the canvas. */
  annotations?: Annotation[];
  theme: SabFlowTheme;
  settings: FlowSettings;
  publicId?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
};

/* ── Notification settings ────────────────────────────── */

export type FlowNotificationSettings = {
  flowId: string;
  emailOnSubmission: boolean;
  /** List of email addresses to notify on each submission */
  emailAddresses: string[];
  /** Optional webhook URL called on each submission */
  webhookUrl?: string;
  webhookOnSubmission: boolean;
  digestEnabled: boolean;
  digestFrequency: 'daily' | 'weekly';
  /** HH:mm string e.g. "09:00" */
  digestTime?: string;
};

/* ── Recent activity ──────────────────────────────────── */

/** A single row returned by getRecentSubmissions() */
export type RecentSubmissionRow = {
  submissionId: string;
  flowId: string;
  flowName: string;
  completedAt: Date;
};

/* ── Draggable state ──────────────────────────────────── */
export type DraggedBlock = Block & { groupId: string };
export type DraggedItem = BlockItem & { type: BlockType; blockId: string };

/* ── Runtime / Execution types ────────────────────────── */

/** A message the flow engine sends out to the user (bubble output). */
export type OutgoingMessage =
  | { type: 'text';  content: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'video'; url: string }
  | { type: 'audio'; url: string }
  | { type: 'embed'; url: string };

/** A pending input request waiting for the user's reply. */
export type InputRequest = {
  blockId: string;
  inputType: InputBlockType;
  /** Variable name to store the answer into */
  variableName?: string;
  /** For choice / picture_choice inputs */
  choices?: { id: string; label: string; imageUrl?: string }[];
  /** Validation hints forwarded to the client */
  validation?: Record<string, unknown>;
};

/** Status of a single flow execution session. */
export type SessionState = {
  sessionId: string;
  flowId: string;
  /** Resolved variable map (variable id → current value) */
  variables: Record<string, string>;
  /** Current position in the flow graph */
  currentGroupId: string | null;
  currentBlockIndex: number;
  isCompleted: boolean;
  /** ISO timestamp */
  createdAt: string;
  updatedAt: string;
};

/* ── Loop block options ──────────────────────────────── */

export type LoopOptions = {
  arrayPath?: string;
  batchSize?: number;
  itemVariableName?: string;
  indexVariableName?: string;
  maxIterations?: number;
  mode?: 'sequential' | 'parallel';
  concurrency?: number;
  /** When true, swallow per-iteration errors and continue with the next item. */
  continueOnFail?: boolean;
};

/* ── Switch / Filter / Sort block options ────────────── */

export type SwitchCase = {
  id: string;
  /** Pin id this case routes to, e.g. "case_1" or a user-defined id. */
  pinId: string;
  /** Human label displayed next to the pin. */
  label?: string;
  /** Comparison operator. */
  operator?: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
  /** Raw value or expression to compare against. */
  value?: string;
};

export type SwitchOptions = {
  /** Expression or variable that feeds the comparison. */
  expression?: string;
  cases?: SwitchCase[];
  /** Fallback pin id when no case matches — defaults to "default". */
  defaultPinId?: string;
};

export type FilterOptions = {
  /** Expression / variable holding the array to filter. */
  arrayPath?: string;
  /** Expression evaluated for each item — truthy → pass, falsy → fail. */
  condition?: string;
};

export type SortOptions = {
  /** Expression / variable holding the array to sort. */
  arrayPath?: string;
  /** Field to sort by — supports dot-paths like `user.name`. */
  sortBy?: string;
  /** Sort direction. */
  direction?: 'asc' | 'desc';
};

/* ── Respond to Webhook options ──────────────────────── */

export type RespondToWebhookOptions = {
  responseCode?: number;
  responseData?: string;
  responseHeaders?: { name: string; value: string }[];
};

/* ── Execution history ───────────────────────────────── */

export type ExecutionTriggerMode = 'manual' | 'schedule' | 'webhook' | 'start' | 'test';
export type ExecutionStatus = 'running' | 'success' | 'error' | 'cancelled';

/** Per-node detail attached to an `ExecutionHistoryEntry`. */
export type ExecutionHistoryNode = {
  blockId: string;
  blockType: string;
  status: ExecutionStatus | 'skipped' | 'waiting';
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
};

export type ExecutionHistoryEntry = {
  id: string;
  flowId: string;
  sessionId: string;
  triggerMode: ExecutionTriggerMode;
  startedAt: Date;
  finishedAt?: Date;
  status: ExecutionStatus;
  error?: string;
  nodeCount: number;
  executionTimeMs?: number;
  variables?: Record<string, unknown>;
  /** Optional per-block execution detail (only persisted when verbose). */
  nodes?: ExecutionHistoryNode[];
  /** Optional captured trigger payload that started this execution. */
  inputData?: unknown;
  /** ID of the first block that ran in this execution (for resuming partial runs). */
  startNodeId?: string;
};

/** Optional filter passed to `listExecutions()`. All fields are AND-ed. */
export type ExecutionHistoryFilter = {
  flowId?: string;
  sessionId?: string;
  status?: ExecutionStatus | ExecutionStatus[];
  triggerMode?: ExecutionTriggerMode | ExecutionTriggerMode[];
  /** Inclusive lower-bound on `startedAt`. */
  startedAfter?: Date;
  /** Exclusive upper-bound on `startedAt`. */
  startedBefore?: Date;
  /** @alias `startedAfter`. */
  from?: Date;
  /** @alias `startedBefore`. */
  to?: Date;
  /** Page offset for paginated results. */
  skip?: number;
  /** Page size; default 50 in callers. */
  limit?: number;
};
