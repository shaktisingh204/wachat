import type { ObjectId } from 'mongodb';

/* ── Coordinates ──────────────────────────────────────── */
export type Coordinates = { x: number; y: number };
export type GraphPosition = Coordinates & { scale: number };

/* ── Connecting IDs (edge dragging) ───────────────────── */
export type ConnectingIds = {
  source:
    | { eventId: string; groupId?: undefined; blockId?: undefined; itemId?: undefined }
    | { groupId: string; blockId?: string; itemId?: string; eventId?: undefined };
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
  | 'events';

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
  | 'ab_test';

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

export type BlockType =
  | BubbleBlockType
  | InputBlockType
  | LogicBlockType
  | IntegrationBlockType;

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
};

/** Options for a URL input block. */
export type UrlInputOptions = {
  placeholder?: string;
  buttonLabel?: string;
  variableId?: string;
  /** Message shown when the user enters an invalid URL */
  retryMessageContent?: string;
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
  /** Variable ID containing a dynamic list of choices */
  dynamicVariableId?: string;
  /** Show a search box above the choices */
  isSearchable?: boolean;
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
};

/* ── Logic block options ──────────────────────────────── */

/** A single comparison clause within a condition block. */
export type ConditionComparison = {
  id: string;
  /** Left-hand variable ID */
  variableId?: string;
  /** Comparison operator */
  operator?: string;
  /** Right-hand literal or {{variable}} */
  value?: string;
};

/** Options for a condition (branching) block. */
export type ConditionOptions = {
  /** 'AND' requires all comparisons to pass; 'OR' requires at least one */
  logicalOperator?: 'AND' | 'OR';
  /** Flat condition rows (SabFlow UI model) */
  conditions?: Array<{
    id: string;
    variableId: string;
    operator: string;
    value: string;
  }>;
};

/** Options for a set-variable block. */
export type SetVariableOptions = {
  variableId?: string;
  /** How to compute the new value */
  valueType?: string;
  /** Static value or JS expression string */
  value?: string;
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

/** Options for an HTTP request (webhook) integration block. */
export type WebhookOptions = {
  /** Request URL */
  url?: string;
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Request headers */
  headers?: KVPair[];
  /** Raw JSON body (may contain {{variable}} tokens) */
  body?: string;
  /** Variable ID to store the raw response body */
  responseVariable?: string;
  /** Variable ID to store the HTTP status code */
  statusCodeVariable?: string;
  /** Response field extraction mappings (Typebot compat) */
  responseMappings?: ResponseMapping[];
};

/** Options for a send-email integration block. */
export type SendEmailOptions = {
  to?: string;
  from?: string;
  replyTo?: string;
  subject?: string;
  body?: string;
  isCustomSmtp?: boolean;
  credentialsId?: string;
};

/** Options for a Google Sheets integration block. */
export type GoogleSheetsOptions = {
  spreadsheetId?: string;
  sheetId?: string | number;
  action?: 'Get' | 'Insert row' | 'Update row';
  cellsToExtract?: Array<{ id: string; column?: string; variableId?: string }>;
  cellsToUpsert?: Array<{ id: string; column?: string; value?: string }>;
  referenceCell?: { column?: string; value?: string };
};

/** Options for an AI (LLM) integration block (OpenAI / Anthropic / etc.). */
export type AIBlockOptions = {
  credentialsId?: string;
  model?: string;
  systemPrompt?: string;
  userMessage?: string;
  responseVariable?: string;
  temperature?: number;
  maxTokens?: number;
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
  | ConditionOptions
  | SetVariableOptions
  | ABTestOptions
  | JumpOptions
  | RedirectOptions
  | ScriptOptions
  | WaitOptions
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
};

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
  | { id: string; groupId: string; type: 'payment_input';      outgoingEdgeId?: string; items?: BlockItem[]; options?: BlockOptions        }
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
  'condition', 'set_variable', 'redirect', 'script', 'typebot_link', 'wait', 'jump', 'ab_test',
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
export type EventType = 'start';

export type SabFlowEvent = {
  id: string;
  type: EventType;
  graphCoordinates: Coordinates;
  outgoingEdgeId?: string;
};

/* ── Edge ─────────────────────────────────────────────── */
export type EdgeFrom =
  | { eventId: string; groupId?: undefined; blockId?: undefined; itemId?: undefined }
  | { groupId: string; blockId?: undefined; itemId?: undefined; eventId?: undefined }
  | { groupId: string; blockId: string; itemId?: undefined; eventId?: undefined }
  | { groupId: string; blockId: string; itemId: string; eventId?: undefined };

export type EdgeTo = {
  groupId: string;
  blockId?: string;
};

export type Edge = {
  id: string;
  from: EdgeFrom;
  to: EdgeTo;
};

/* ── Variable ─────────────────────────────────────────── */
export type Variable = {
  id: string;
  name: string;
  value?: string;
};

/* ── Theme ────────────────────────────────────────────── */
export type SabFlowTheme = {
  general?: {
    font?: string;
    background?: { type: 'Color' | 'Image' | 'None'; content?: string };
    progressBar?: {
      isEnabled?: boolean;
      color?: string;
      placement?: 'top' | 'bottom';
    };
  };
  chat?: {
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
    hostBubble?: { backgroundColor?: string; color?: string };
    guestBubble?: { backgroundColor?: string; color?: string };
    input?: {
      backgroundColor?: string;
      color?: string;
      placeholderColor?: string;
    };
    button?: { backgroundColor?: string; color?: string };
  };
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
  theme: SabFlowTheme;
  settings: Record<string, unknown>;
  publicId?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
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
