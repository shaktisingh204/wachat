/**
 * SabFlow — FULL n8n operation-catalog extractor (supersedes n8n-to-preset.ts).
 *
 * Mission: extract the COMPLETE operation catalog of every n8n app vendored at
 * `n8n-master/packages/nodes-base/nodes/` — every resource, every operation,
 * every field — into `src/lib/sabflow/app-presets/n8n-<id>.json` AppPreset
 * documents (see src/lib/sabflow/app-presets/types.ts).
 *
 * How it works
 *   1. MODULE EVALUATION (primary): each `<App>.node.ts` is transpiled with
 *      the in-repo `typescript` package and evaluated in a `node:vm` sandbox.
 *      Relative imports are loaded recursively through the same pipeline;
 *      `n8n-workflow` (and any unresolvable bare import) is satisfied by a
 *      universal Proxy stub (plus a real `VersionedNodeType` shim so versioned
 *      wrappers expose their nodeVersions). The exported class is instantiated
 *      and `instance.description.properties` gives the COMPLETE, spread-
 *      resolved INodeProperties[] — no AST reassembly needed.
 *   2. SEMANTICS: `resource` options × `operation` options (gated by
 *      displayOptions.show.resource) → endpoints; all other properties are
 *      attached as fields per their displayOptions (absent axis = applies).
 *   3. HTTP MAPPING:
 *        a. declarative `routing.request` on the operation option, with
 *           `={{...}}` expressions folded to `{param}` placeholders, and
 *           field-level `routing.send` → `in: query|body|header`.
 *        b. programmatic: regex scan of the active version's execute() (and
 *           `actions/<resource>/<op>.operation.ts` files) capturing the first
 *           `<helper>ApiRequest*.call(this, 'METHOD', <url>)` per
 *           (resource, operation) block; identifier URLs are chased to their
 *           in-block `const endpoint = \`...\`` assignment.
 *        c. otherwise a method heuristic (get*, list* → GET; delete* → DELETE;
 *           update* → PATCH; else POST) and the endpoint is emitted with
 *           `description: '[unverified path] …'` and counted in the report.
 *   4. baseUrl: requestDefaults.baseURL → GenericFunctions/transport scan →
 *      credentials test baseURL → existing preset baseUrl → curated override.
 *      Apps with no resolvable static base are left untouched and reported.
 *   5. auth: preserved verbatim from the existing preset when present (those
 *      carry curated credentialType/provider wiring); otherwise derived from
 *      the n8n credentials file's `authenticate` block.
 *
 * Mapping decisions (documented per the extraction brief):
 *   - `multiOptions` → `select` with full options + a "(multiple values:
 *     comma-separated)" note appended to the description.
 *   - `collection` / `fixedCollection` → ONE `json` field whose description
 *     lists the inner field names (keeps panels manageable, keeps capability).
 *   - `hidden` / `notice` / `callout` / `curlImport` / `credentialsSelect`
 *     properties are skipped.
 *   - `resourceLocator` → `text` (expects the raw ID).
 *   - `resourceMapper` / `filter` / `assignmentCollection` → `json`.
 *
 * Usage:
 *   npx tsx scripts/n8n-extract-full.ts                 # all apps
 *   npx tsx scripts/n8n-extract-full.ts --apps Hubspot,Slack
 *   npx tsx scripts/n8n-extract-full.ts --limit 25 --dry-run --verbose
 *
 * Report: scripts/output/n8n-extract-full-report.json + console summary.
 *
 * Only touches: src/lib/sabflow/app-presets/n8n-*.json (never the native
 * non-prefixed presets), scripts/output/*.
 */

/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import * as vm from 'node:vm';
import * as ts from 'typescript';

// ───────────────────────────────────────────────────────────────────────────
// Paths / CLI
// ───────────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..');
const NODES_DIR = path.join(REPO_ROOT, 'n8n-master/packages/nodes-base/nodes');
const CREDENTIALS_DIR = path.join(REPO_ROOT, 'n8n-master/packages/nodes-base/credentials');
const PRESETS_DIR = path.join(REPO_ROOT, 'src/lib/sabflow/app-presets');
const OUTPUT_DIR = path.join(REPO_ROOT, 'scripts/output');
const REPORT_PATH = path.join(OUTPUT_DIR, 'n8n-extract-full-report.json');

const ARGV = process.argv.slice(2);
const DRY_RUN = ARGV.includes('--dry-run');
const VERBOSE = ARGV.includes('--verbose');
const LIMIT = (() => {
  const i = ARGV.indexOf('--limit');
  if (i === -1) return Infinity;
  const n = Number(ARGV[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
})();
const ONLY_APPS: Set<string> | null = (() => {
  const i = ARGV.indexOf('--apps');
  if (i === -1 || !ARGV[i + 1]) return null;
  return new Set(ARGV[i + 1].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
})();

// ───────────────────────────────────────────────────────────────────────────
// Preset types (mirrored; script stays standalone under tsx)
// ───────────────────────────────────────────────────────────────────────────

type PresetFieldType = 'text' | 'textarea' | 'number' | 'toggle' | 'select' | 'json' | 'password';
type PresetFieldLocation = 'path' | 'query' | 'body' | 'header';
type PresetHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type PresetField = {
  id: string;
  label: string;
  type: PresetFieldType;
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  description?: string;
  in?: PresetFieldLocation;
  options?: Array<{ value: string; label: string }>;
};

type PresetEndpoint = {
  id: string;
  label: string;
  description?: string;
  method: PresetHttpMethod;
  path: string;
  fields: PresetField[];
  outputPath?: string;
  group?: string;
};

type PresetAuth = {
  type: 'bearer' | 'basic' | 'header' | 'query_token' | 'oauth2' | 'aws_sigv4' | 'none';
  credentialType?: string;
  header?: string;
  scheme?: string;
  queryParam?: string;
  /** Credential data key holding the instance base URL (self-hosted apps). */
  baseUrlFromCredential?: string;
  /** AWS service signing name (`aws_sigv4` — host templated at run time). */
  awsService?: string;
  // Curated presets may carry extra keys (provider, fallback) — preserved as-is.
  [k: string]: unknown;
};

type AppPreset = {
  id: string;
  name: string;
  description?: string;
  category: string;
  iconName: string;
  version: number;
  lastVerified: string;
  status?: 'verified' | 'draft';
  auth: PresetAuth;
  baseUrl: string;
  endpoints: PresetEndpoint[];
};

// ───────────────────────────────────────────────────────────────────────────
// Exclusions — non-REST / local / protocol / control-flow nodes
// ───────────────────────────────────────────────────────────────────────────

/** Matched against the node FILE basename (without `.node.ts`). */
const EXCLUDED_NODES = new Set(
  [
    // control flow / data utilities
    'Code', 'Function', 'FunctionItem', 'If', 'IfV2', 'Switch', 'Merge', 'NoOp', 'Set',
    'SplitInBatches', 'Wait', 'Filter', 'Limit', 'RemoveDuplicates', 'Sort', 'Aggregate',
    'Summarize', 'SplitOut', 'CompareDatasets', 'RenameKeys', 'ItemLists', 'Start',
    'StickyNote', 'NoOpV2', 'ExecutionData', 'ExecuteWorkflow', 'ErrorWorkflow', 'StopAndError',
    'DebugHelper', 'E2eTest', 'Simulate', 'SimulateTrigger', 'Evaluation', 'EvaluationMetrics',
    'AiTransform', 'ManualWorkflowActivator', 'WorkflowTrigger', 'Interval', 'Cron',
    'N8nTrainingCustomerDatastore', 'N8nTrainingCustomerMessenger', 'Form', 'FormV2',
    // generic HTTP / webhook (already native blocks)
    'HttpRequest', 'Webhook', 'RespondToWebhook', 'GraphQL', 'Chat',
    // files / binary / local
    'ReadWriteFile', 'ReadBinaryFile', 'ReadBinaryFiles', 'WriteBinaryFile', 'ReadPdf',
    'SpreadsheetFile', 'EditImage', 'Html', 'HtmlExtract', 'Xml', 'Markdown', 'MoveBinaryData',
    'Compression', 'ConvertToFile', 'ExtractFromFile', 'Crypto', 'DateTime', 'TOTP', 'Cortex',
    'Files', 'LocalFileTrigger', 'iCal', 'ICalendar', 'Rss', 'RssFeedRead',
    // protocols / non-REST transports
    'Ftp', 'Ssh', 'Git', 'ExecuteCommand', 'EmailSend', 'EmailSendV2', 'EmailReadImap',
    'Amqp', 'Mqtt', 'Kafka', 'RabbitMQ', 'Ldap', 'Snmp',
    // databases (native forge/rust paths exist; not preset-HTTP shaped)
    'MongoDb', 'MySql', 'Postgres', 'Redis', 'MicrosoftSql', 'Snowflake', 'CrateDb', 'QuestDb',
    'TimescaleDb', 'Sqlite', 'OracleDatabase', 'DataTable', 'Jwt',
  ].map((s) => s.toLowerCase()),
);

/** Curated base-URL overrides (big apps whose base can't be derived cleanly). */
const BASE_URL_OVERRIDES: Record<string, string> = {
  'n8n-hubspot': 'https://api.hubapi.com',
  'n8n-slack': 'https://slack.com/api',
  'n8n-notion': 'https://api.notion.com/v1',
  'n8n-airtable': 'https://api.airtable.com/v0',
  'n8n-stripe': 'https://api.stripe.com/v1',
  'n8n-asana': 'https://app.asana.com/api/1.0',
  'n8n-github': 'https://api.github.com',
  'n8n-gitlab': 'https://gitlab.com/api/v4',
  'n8n-trello': 'https://api.trello.com/1',
  'n8n-todoist': 'https://api.todoist.com/rest/v2',
  'n8n-discord': 'https://discord.com/api/v10',
  'n8n-telegram': 'https://api.telegram.org',
  'n8n-clickup': 'https://api.clickup.com/api/v2',
  'n8n-mondaycom': 'https://api.monday.com/v2',
  'n8n-pipedrive': 'https://api.pipedrive.com/v1',
  'n8n-intercom': 'https://api.intercom.io',
  'n8n-mailchimp': 'https://us1.api.mailchimp.com/3.0',
  'n8n-shopify': 'https://shopify.dev/admin/api',
  // jiraSoftwareCloudApiRequest builds `${domain}/rest${endpoint}` — the
  // extracted paths (/api/2/…) sit under /rest on the user's own site host.
  'n8n-jira': 'https://{host}/rest',
  'n8n-salesforce': 'https://login.salesforce.com',
  'n8n-zoom': 'https://api.zoom.us/v2',
  'n8n-dropbox': 'https://api.dropboxapi.com/2',
  'n8n-twilio': 'https://api.twilio.com/2010-04-01',
  'n8n-sendgrid': 'https://api.sendgrid.com/v3',
  'n8n-linear': 'https://api.linear.app/graphql',
  // endpoint paths carry the /v4/spreadsheets prefix themselves
  'n8n-google-sheets': 'https://sheets.googleapis.com',
  'n8n-google-docs': 'https://docs.googleapis.com/v1',
  // host is templated from credential data ({projectId}+{region} become
  // required path fields on every endpoint; region e.g. firebaseio.com)
  'n8n-google-firebase-realtime-database': 'https://{projectId}.{region}',
  'n8n-copper': 'https://api.copper.com/developer_api/v1',
  // endpoint paths (/clients, /invoices, …) sit under /api/v1
  'n8n-invoice-ninja': 'https://app.invoiceninja.com/api/v1',
  // the scan otherwise picks the /auth login endpoint as the base
  'n8n-taiga': 'https://api.taiga.io/api/v1',
  // teamSecret comes from the credential in n8n — surfaced as a path field
  'n8n-signl4': 'https://connect.signl4.com/webhook/{teamSecret}',
  // the node's V2 transport prefixes /v2 itself
  'n8n-webflow': 'https://api.webflow.com/v2',
  'n8n-google-drive': 'https://www.googleapis.com/drive/v3',
  'n8n-gmail': 'https://www.googleapis.com/gmail/v1',
  'n8n-google-calendar': 'https://www.googleapis.com/calendar/v3',
  // static bases the source scan can't see (templated literals / http://)
  'n8n-hacker-news': 'http://hn.algolia.com/api/v1',
  'n8n-iterable': 'https://api.iterable.com/api',
  'n8n-mandrill': 'https://mandrillapp.com/api/1.0',
  'n8n-marketstack': 'http://api.marketstack.com/v1',
  'n8n-gong': 'https://api.gong.io',
  'n8n-npm': 'https://registry.npmjs.org',
  'n8n-zoho-crm': 'https://www.zohoapis.com/crm/v2',
  // credential-hosted apps whose templates hide behind local constants —
  // `{token}` placeholders become required path-fields on every endpoint
  'n8n-freshdesk': 'https://{domain}.freshdesk.com/api/v2',
  'n8n-chargebee': 'https://{accountName}.chargebee.com/api/v2',
  // /spaces/{spaceId} lives in the base so spaceId is synthesized as a
  // required path field on every endpoint (it comes from credentials in n8n)
  'n8n-contentful': 'https://cdn.contentful.com/spaces/{spaceId}',
};

/**
 * Self-hosted / credential-hosted apps with no static base URL: the preset is
 * emitted with `baseUrl: ''` and `auth.baseUrlFromCredential` set to the
 * credential data key carrying the instance URL. The runtime
 * (`app-presets/runtime/exec.ts#resolvePresetBaseUrl`) resolves it per call.
 * `credentialType` overrides the auto-derived snake(id) when a hand-written
 * credential schema already exists with a different/known shape.
 */
const CREDENTIAL_BASE_URL_APPS: Record<
  string,
  { credentialKey: string; credentialType?: string }
> = {
  'n8n-adalo': { credentialKey: 'baseUrl' },
  'n8n-citrix-adc': { credentialKey: 'baseUrl' },
  'n8n-databricks': { credentialKey: 'baseUrl' },
  'n8n-elasticsearch': { credentialKey: 'baseUrl' },
  'n8n-home-assistant': { credentialKey: 'baseUrl' },
  // hand-written 'line' credential has no URL field → fresh generated type
  'n8n-line': { credentialKey: 'baseUrl', credentialType: 'line_notify' },
  // hand-written 'matrix' schema already carries homeserverUrl + accessToken
  'n8n-matrix': { credentialKey: 'homeserverUrl', credentialType: 'matrix' },
  // hand-written 'mautic' schema already carries baseUrl + username/password
  'n8n-mautic': { credentialKey: 'baseUrl', credentialType: 'mautic' },
  'n8n-metabase': { credentialKey: 'baseUrl' },
  // hand-written 'n8n' credential is webhook-shaped → fresh generated type
  'n8n-n8n': { credentialKey: 'baseUrl', credentialType: 'n8n_api' },
  'n8n-next-cloud': { credentialKey: 'baseUrl' },
  'n8n-post-hog': { credentialKey: 'baseUrl' },
  'n8n-rundeck': { credentialKey: 'baseUrl' },
  'n8n-venafi-tls-protect-cloud': { credentialKey: 'baseUrl' },
  'n8n-zulip': { credentialKey: 'baseUrl' },
};

/**
 * AWS apps signed with SigV4: `auth.awsService` is the signing name, the host
 * is templated at run time as `{service}.{region}.amazonaws.com` from the
 * shared `aws` credential ({accessKeyId, secretAccessKey, region[,
 * sessionToken]}). Only JSON/REST-API services are listed — the query-API
 * XML services (SES, SQS, ELB) are out of scope for the JSON preset model.
 */
const AWS_SERVICE_BY_ID: Record<string, string> = {
  'n8n-aws-certificate-manager': 'acm',
  'n8n-aws-cognito': 'cognito-idp',
  'n8n-aws-comprehend': 'comprehend',
  'n8n-aws-dynamo-db': 'dynamodb',
  'n8n-aws-rekognition': 'rekognition',
  'n8n-aws-s3': 's3',
  'n8n-aws-textract': 'textract',
  'n8n-aws-transcribe': 'transcribe',
  // generic S3-compatible node — signs as s3 against the AWS host template
  'n8n-s3': 's3',
};

/**
 * Hand-verified endpoint corrections (survive every re-run — the extractor
 * applies them AFTER scanning, so they always win over heuristics).
 *
 * Keyed `presetId → endpointId` (the deterministic snake(resource_operation)
 * ids already present in the emitted JSON).
 *   - `null`  → DELETE the endpoint: the operation is genuinely non-HTTP for
 *     our runtime (SDK/RPC-only, or a protocol the preset dispatcher cannot
 *     sign/serialise — e.g. AWS JSON-1.1 X-Amz-Target RPC, multi-call
 *     compositions, raw-binary uploads).
 *   - `{ method?, path }` → the REAL verified method+path (path placeholders
 *     `{x}` must match field ids; fields gain `in: 'path'` automatically).
 * Every entry was read out of the corresponding n8n node source
 * (`n8n-master/packages/nodes-base/nodes/<App>/…`) — execute() blocks,
 * GenericFunctions and operation description files.
 */
type EndpointOverride = null | { method?: PresetHttpMethod; path: string };

const ENDPOINT_OVERRIDES: Record<string, Record<string, EndpointOverride>> = {
  // ── batch 1 ──────────────────────────────────────────────────────────────
  'n8n-action-network': {
    event_get_all: { method: 'GET', path: '/events' },
    person_get_all: { method: 'GET', path: '/people' },
    petition_get_all: { method: 'GET', path: '/petitions' },
    tag_get_all: { method: 'GET', path: '/tags' },
  },
  'n8n-agile-crm': {
    contact_create: { method: 'POST', path: '/api/contacts' },
    contact_get_all: { method: 'POST', path: '/api/filters/filter/dynamic-filter' },
    contact_update: { method: 'PUT', path: '/api/contacts/edit-properties' },
    company_create: { method: 'POST', path: '/api/contacts' },
    company_delete: { method: 'DELETE', path: '/api/contacts/{companyId}' },
    company_get: { method: 'GET', path: '/api/contacts/{companyId}' },
    company_get_all: { method: 'POST', path: '/api/filters/filter/dynamic-filter' },
    company_update: { method: 'PUT', path: '/api/contacts/edit-properties' },
  },
  'n8n-airtop': {
    agent_run: null, // webhook invocation composition on the hooks host (getAgentDetails → webhook POST)
    session_wait_for_download: null, // long-poll of the session event stream — not a single request
    file_load: null, // composition: POST /files/{id}/push + window file-input
    file_upload: null, // composition: create file record + presigned-URL binary upload
    file_delete_file: { method: 'DELETE', path: '/files/{fileId}' },
    extraction_query: { method: 'POST', path: '/sessions/{sessionId}/windows/{windowId}/page-query' },
    extraction_get_paginated: {
      method: 'POST',
      path: '/sessions/{sessionId}/windows/{windowId}/paginated-extraction',
    },
    extraction_scrape: { method: 'POST', path: '/sessions/{sessionId}/windows/{windowId}/scrape-content' },
  },
  'n8n-autopilot': {
    contact_list_add: { method: 'POST', path: '/list/{listId}/contact/{contactId}' },
    contact_list_exist: { method: 'GET', path: '/list/{listId}/contact/{contactId}' },
    contact_list_remove: { method: 'DELETE', path: '/list/{listId}/contact/{contactId}' },
  },
  // AWS JSON-1.x / Query RPC protocols put the operation in an X-Amz-Target
  // header (or form-encoded Action body) that the preset runtime cannot sign
  // (SigV4 here signs only host/date/content-sha256) — unrepresentable.
  'n8n-aws-certificate-manager': {
    certificate_delete: null,
    certificate_get: null,
    certificate_get_many: null,
    certificate_get_metadata: null,
    certificate_renew: null,
  },
  'n8n-aws-cognito': {
    group_create: null,
    group_delete: null,
    group_get: null,
    group_get_all: null,
    group_update: null,
    user_add_to_group: null,
    user_create: null,
    user_delete: null,
    user_get: null,
    user_get_all: null,
    user_remove_from_group: null,
    user_update: null,
    user_pool_get: null,
  },
  'n8n-aws-comprehend': {
    text_detect_dominant_language: null,
    text_detect_entities: null,
    text_detect_sentiment: null,
  },
  'n8n-aws-dynamo-db': { item_upsert: null, item_delete: null, item_get: null, item_get_all: null },
  'n8n-aws-iam': {
    user_add_to_group: null,
    user_create: null,
    user_delete: null,
    user_get: null,
    user_get_all: null,
    user_remove_from_group: null,
    user_update: null,
    group_create: null,
    group_delete: null,
    group_get: null,
    group_get_all: null,
    group_update: null,
  },
  'n8n-aws-lambda': { invoke: null }, // needs raw event body + X-Amz-Invocation-Type header
  'n8n-aws-rekognition': { image_analyze: null },
  'n8n-aws-textract': { analyze_expense: null }, // also requires raw binary document bytes
  'n8n-aws-transcribe': {
    transcription_job_create: null,
    transcription_job_delete: null,
    transcription_job_get: null,
    transcription_job_get_all: null,
  },
  // S3 is real REST (path-style addressing against s3.{region}.amazonaws.com)
  'n8n-aws-s3': {
    bucket_create: { method: 'PUT', path: '/{name}' },
    bucket_delete: { method: 'DELETE', path: '/{name}' },
    bucket_get_all: { method: 'GET', path: '/' },
    bucket_search: { method: 'GET', path: '/{bucketName}?list-type=2' },
    folder_get_all: { method: 'GET', path: '/{bucketName}?list-type=2' },
    file_get_all: { method: 'GET', path: '/{bucketName}?list-type=2' },
    file_copy: null, // CopyObject needs the x-amz-copy-source header (unsignable here)
  },
  'n8n-s3': {
    bucket_create: { method: 'PUT', path: '/{name}' },
    bucket_delete: { method: 'DELETE', path: '/{name}' },
    bucket_get_all: { method: 'GET', path: '/' },
    bucket_search: { method: 'GET', path: '/{bucketName}?list-type=2' },
    folder_get_all: { method: 'GET', path: '/{bucketName}?list-type=2' },
    file_get_all: { method: 'GET', path: '/{bucketName}?list-type=2' },
    file_copy: null, // x-amz-copy-source header
    file_upload: null, // raw binary body
  },
  'n8n-beeminder': {
    charge_create: { method: 'POST', path: '/charges.json' },
    datapoint_create: { method: 'POST', path: '/users/me/goals/{goalName}/datapoints.json' },
    datapoint_create_all: { method: 'POST', path: '/users/me/goals/{goalName}/datapoints/create_all.json' },
    datapoint_delete: { method: 'DELETE', path: '/users/me/goals/{goalName}/datapoints/{datapointId}.json' },
    datapoint_get: { method: 'GET', path: '/users/me/goals/{goalName}/datapoints/{datapointId}.json' },
    datapoint_get_all: { method: 'GET', path: '/users/me/goals/{goalName}/datapoints.json' },
    datapoint_update: { method: 'PUT', path: '/users/me/goals/{goalName}/datapoints/{datapointId}.json' },
    goal_create: { method: 'POST', path: '/users/me/goals.json' },
    goal_get: { method: 'GET', path: '/users/me/goals/{goalName}.json' },
    goal_get_all: { method: 'GET', path: '/users/me/goals.json' },
    goal_get_archived: { method: 'GET', path: '/users/me/goals/archived.json' },
    goal_update: { method: 'PUT', path: '/users/me/goals/{goalName}.json' },
    goal_refresh: { method: 'GET', path: '/users/me/goals/{goalName}/refresh_graph.json' },
    goal_short_circuit: { method: 'POST', path: '/users/me/goals/{goalName}/shortcircuit.json' },
    goal_step_down: { method: 'POST', path: '/users/me/goals/{goalName}/stepdown.json' },
    goal_cancel_step_down: { method: 'POST', path: '/users/me/goals/{goalName}/cancel_stepdown.json' },
    goal_uncle: { method: 'POST', path: '/users/me/goals/{goalName}/uncleme.json' },
    user_get: { method: 'GET', path: '/users/me.json' },
  },
  'n8n-box': {
    file_upload: null, // multipart binary upload against upload.box.com
  },
  'n8n-chargebee': {
    invoice_pdf_url: { method: 'POST', path: '/invoices/{invoiceId}/pdf' },
    subscription_cancel: { method: 'POST', path: '/subscriptions/{subscriptionId}/cancel' },
    subscription_delete: { method: 'POST', path: '/subscriptions/{subscriptionId}/delete' },
  },
  'n8n-citrix-adc': {
    file_delete: {
      method: 'DELETE',
      path: '/nitro/v1/config/systemfile?args=filename:{fileName},filelocation:{fileLocation}',
    },
    file_download: {
      method: 'GET',
      path: '/nitro/v1/config/systemfile?args=filename:{fileName},filelocation:{fileLocation}',
    },
  },
  'n8n-cockpit': {
    collection_create: { method: 'POST', path: '/collections/save/{collection}' },
    collection_get_all: { method: 'POST', path: '/collections/get/{collection}' },
    collection_update: { method: 'POST', path: '/collections/save/{collection}' },
    form_submit: { method: 'POST', path: '/forms/submit/{form}' },
    singleton_get: { method: 'GET', path: '/singletons/get/{singleton}' },
  },
  // ── batch 2 ──────────────────────────────────────────────────────────────
  'n8n-copper': {
    // getAll listings are POST /<plural>/search on the developer API
    company_get_all: { method: 'POST', path: '/companies/search' },
    customer_source_get_all: { method: 'GET', path: '/customer_sources' },
    lead_get_all: { method: 'POST', path: '/leads/search' },
    opportunity_get_all: { method: 'POST', path: '/opportunities/search' },
    person_get_all: { method: 'POST', path: '/people/search' },
    project_get_all: { method: 'POST', path: '/projects/search' },
    task_get_all: { method: 'POST', path: '/tasks/search' },
    user_get_all: { method: 'POST', path: '/users/search' },
  },
  'n8n-customer-io': {
    segment_remove: { method: 'POST', path: '/segments/{segmentId}/remove_customers' },
  },
  'n8n-databricks': {
    files_get_file_info: null, // HEAD request (unsupported) on a dot-split volume path
    files_list_directory: null, // volumePath 'catalog.schema.volume' must be split into path segments
  },
  'n8n-demio': {
    event_get: { method: 'GET', path: '/event/{eventId}' },
  },
  'n8n-discord': {
    message_send: { method: 'POST', path: '/channels/{channelId}/messages' },
    message_send_and_wait_operation: null, // send + wait-for-callback composition
    channel_send_legacy: null, // v1 node posts to the webhook URL stored in the credential
    message_send_legacy: null,
    member_send_legacy: null,
  },
  'n8n-dropbox': {
    file_copy: { method: 'POST', path: '/files/copy_v2' },
    file_delete: { method: 'POST', path: '/files/delete_v2' },
    file_move: { method: 'POST', path: '/files/move_v2' },
    folder_copy: { method: 'POST', path: '/files/copy_v2' },
    folder_delete: { method: 'POST', path: '/files/delete_v2' },
    folder_move: { method: 'POST', path: '/files/move_v2' },
  },
  'n8n-elastic-security': {
    case_get_all: { method: 'GET', path: '/cases/_find' },
  },
  // Emelia's public API is GraphQL-only (https://graphql.emelia.io) — every
  // operation is a query/mutation document the preset model cannot compose.
  'n8n-emelia': {
    campaign_add_contact: null,
    campaign_create: null,
    campaign_duplicate: null,
    campaign_get: null,
    campaign_get_all: null,
    campaign_pause: null,
    campaign_start: null,
    contact_list_add: null,
    contact_list_get_all: null,
  },
  'n8n-freshservice': {
    agent_get_all: { method: 'GET', path: '/agents' },
    agent_group_get_all: { method: 'GET', path: '/groups' },
    agent_role_get_all: { method: 'GET', path: '/roles' },
    announcement_get_all: { method: 'GET', path: '/announcements' },
    asset_type_get_all: { method: 'GET', path: '/asset_types' },
    change_get_all: { method: 'GET', path: '/changes' },
    department_get_all: { method: 'GET', path: '/departments' },
    location_get_all: { method: 'GET', path: '/locations' },
    problem_get_all: { method: 'GET', path: '/problems' },
    product_get_all: { method: 'GET', path: '/products' },
    release_get_all: { method: 'GET', path: '/releases' },
    requester_get_all: { method: 'GET', path: '/requesters' },
    requester_group_get_all: { method: 'GET', path: '/requester_groups' },
    software_get_all: { method: 'GET', path: '/applications' },
  },
  'n8n-freshworks-crm': {
    account_get_all: { method: 'GET', path: '/sales_accounts/view/{view}' },
    appointment_get_all: { method: 'GET', path: '/appointments' },
    contact_get_all: { method: 'GET', path: '/contacts/view/{view}' },
    deal_get_all: { method: 'GET', path: '/deals/view/{view}' },
    sales_activity_get_all: { method: 'GET', path: '/sales_activities' },
    task_get_all: { method: 'GET', path: '/tasks' },
  },
  'n8n-g-suite-admin': {
    device_get_all: { method: 'GET', path: '/directory/v1/customer/my_customer/devices/chromeos' },
  },
  'n8n-github': {
    file_create: { method: 'PUT', path: '/repos/{owner}/{repository}/contents/{filePath}' },
    file_delete: { method: 'DELETE', path: '/repos/{owner}/{repository}/contents/{filePath}' },
    file_edit: { method: 'PUT', path: '/repos/{owner}/{repository}/contents/{filePath}' },
    file_get: { method: 'GET', path: '/repos/{owner}/{repository}/contents/{filePath}' },
    file_list: { method: 'GET', path: '/repos/{owner}/{repository}/contents/{filePath}' },
    repository_get_profile: { method: 'GET', path: '/repos/{owner}/{repository}/community/profile' },
  },
  'n8n-gitlab': {
    file_create: { method: 'POST', path: '/projects/{owner}%2F{repository}/repository/files/{filePath}' },
    file_delete: { method: 'DELETE', path: '/projects/{owner}%2F{repository}/repository/files/{filePath}' },
    file_edit: { method: 'PUT', path: '/projects/{owner}%2F{repository}/repository/files/{filePath}' },
    file_get: { method: 'GET', path: '/projects/{owner}%2F{repository}/repository/files/{filePath}' },
  },
  'n8n-gmail': {
    message_reply: null, // builds a raw RFC-2822 MIME payload client-side
    message_send_and_wait_operation: null, // send + wait-for-callback composition
    thread_reply: null, // raw MIME composition
  },
  'n8n-google-analytics': {
    report_get: null, // dual-host GA4/UA dispatch with a programmatically-built report body
  },
  'n8n-google-business-profile': {
    review_delete: null, // review resource-name parsed apart (split/pop) to build the path
    review_get: null,
    review_reply: null,
  },
  'n8n-google-chat': {
    message_send_and_wait_operation: null, // send + wait-for-callback composition
  },
  'n8n-google-docs': {
    document_create: { method: 'POST', path: '/documents' },
  },
  'n8n-google-firebase-realtime-database': {
    create: { method: 'PUT', path: '/{path}.json' },
    delete: { method: 'DELETE', path: '/{path}.json' },
    get: { method: 'GET', path: '/{path}.json' },
    push: { method: 'POST', path: '/{path}.json' },
    update: { method: 'PATCH', path: '/{path}.json' },
  },
  'n8n-google-sheets': {
    sheet_append: { method: 'POST', path: '/v4/spreadsheets/{documentId}/values/{sheetName}:append' },
    sheet_append_or_update: null, // read-sheet + match-column + batchUpdate composition
    sheet_update: null, // find-matching-row composition
    sheet_clear: { method: 'POST', path: '/v4/spreadsheets/{documentId}/values/{range}:clear' },
    sheet_delete: { method: 'POST', path: '/v4/spreadsheets/{documentId}:batchUpdate' },
    sheet_read: { method: 'GET', path: '/v4/spreadsheets/{documentId}/values/{sheetName}' },
    sheet_create: { method: 'POST', path: '/v4/spreadsheets/{documentId}:batchUpdate' },
    sheet_remove: { method: 'POST', path: '/v4/spreadsheets/{documentId}:batchUpdate' },
    spreadsheet_delete_spreadsheet: null, // lives on the Drive API host (drive/v3/files)
  },
  // ── batch 3 ──────────────────────────────────────────────────────────────
  'n8n-harvest': {
    client_get_all: { method: 'GET', path: '/clients' },
    contact_get_all: { method: 'GET', path: '/contacts' },
    estimate_get_all: { method: 'GET', path: '/estimates' },
    expense_get_all: { method: 'GET', path: '/expenses' },
    invoice_get_all: { method: 'GET', path: '/invoices' },
    project_get_all: { method: 'GET', path: '/projects' },
    task_get_all: { method: 'GET', path: '/tasks' },
    time_entry_get_all: { method: 'GET', path: '/time_entries' },
    user_get_all: { method: 'GET', path: '/users' },
  },
  'n8n-intercom': {
    lead_create: { method: 'POST', path: '/contacts' },
    user_create: { method: 'POST', path: '/users' },
    company_create: { method: 'POST', path: '/companies' },
  },
  'n8n-invoice-ninja': {
    quote_create: { method: 'POST', path: '/quotes' },
    quote_get_all: { method: 'GET', path: '/quotes' },
    bank_transaction_create: { method: 'POST', path: '/bank_transactions' },
    bank_transaction_get_all: { method: 'GET', path: '/bank_transactions' },
  },
  'n8n-ko-bo-toolbox': {
    form_get: { method: 'GET', path: '/api/v2/assets/{formId}' },
    form_get_all: { method: 'GET', path: '/api/v2/assets/' },
    hook_get: { method: 'GET', path: '/api/v2/assets/{formId}/hooks/{hookId}' },
    hook_get_all: { method: 'GET', path: '/api/v2/assets/{formId}/hooks/' },
    hook_get_logs: { method: 'GET', path: '/api/v2/assets/{formId}/hooks/{hookId}/logs/' },
    submission_get: { method: 'GET', path: '/api/v2/assets/{formId}/data/{submissionId}' },
    submission_get_all: { method: 'GET', path: '/api/v2/assets/{formId}/data/' },
    submission_get_validation: {
      method: 'GET',
      path: '/api/v2/assets/{formId}/data/{submissionId}/validation_status/',
    },
    file_get: { method: 'GET', path: '/api/v2/assets/{formId}/files/{fileId}' },
    file_get_all: { method: 'GET', path: '/api/v2/assets/{formId}/files' },
  },
  'n8n-line': {
    notification_send: { method: 'POST', path: '/api/notify' },
  },
  // Linear's API is GraphQL-only — every operation is a query/mutation
  // document the preset model cannot compose.
  'n8n-linear': {
    comment_add_comment: null,
    issue_add_link: null,
    issue_create: null,
    issue_delete: null,
    issue_get: null,
    issue_get_all: null,
    issue_update: null,
  },
  // Matrix client-server API r0 (relative to the credential homeserver URL)
  'n8n-matrix': {
    account_me: { method: 'GET', path: '/_matrix/client/r0/account/whoami' },
    event_get: { method: 'GET', path: '/_matrix/client/r0/rooms/{roomId}/event/{eventId}' },
    media_upload: null, // binary upload to the media repo + follow-up m.room.message send
    message_create: { method: 'POST', path: '/_matrix/client/r0/rooms/{roomId}/send/m.room.message' },
    message_get_all: { method: 'GET', path: '/_matrix/client/r0/rooms/{roomId}/messages' },
    room_create: { method: 'POST', path: '/_matrix/client/r0/createRoom' },
    room_invite: { method: 'POST', path: '/_matrix/client/r0/rooms/{roomId}/invite' },
    room_join: { method: 'POST', path: '/_matrix/client/r0/rooms/{roomIdOrAlias}/join' },
    room_kick: { method: 'POST', path: '/_matrix/client/r0/rooms/{roomId}/kick' },
    room_leave: { method: 'POST', path: '/_matrix/client/r0/rooms/{roomId}/leave' },
    room_member_get_all: { method: 'GET', path: '/_matrix/client/r0/rooms/{roomId}/members' },
  },
  'n8n-message-bird': {
    balance_get: { method: 'GET', path: '/balance' },
  },
  'n8n-microsoft-graph-security': {
    secure_score_get_all: { method: 'GET', path: '/v1.0/security/secureScores' },
    secure_score_control_profile_get_all: {
      method: 'GET',
      path: '/v1.0/security/secureScoreControlProfiles',
    },
  },
  'n8n-microsoft-one-drive': {
    file_rename: { method: 'PATCH', path: '/v1.0/me/drive/items/{itemId}' },
  },
  'n8n-microsoft-outlook': {
    message_send_and_wait_operation: null, // send + wait-for-callback composition
  },
  'n8n-microsoft-teams': {
    chat_message_send_and_wait_operation: null, // send + wait-for-callback composition
  },
  'n8n-misp': {
    attribute_get_all: { method: 'GET', path: '/attributes' },
    attribute_search: { method: 'POST', path: '/attributes/restSearch' },
    event_get_all: { method: 'GET', path: '/events' },
    event_search: { method: 'POST', path: '/events/restSearch' },
    feed_get_all: { method: 'GET', path: '/feeds' },
    galaxy_get_all: { method: 'GET', path: '/galaxies' },
    noticelist_get_all: { method: 'GET', path: '/noticelists' },
    object_search: { method: 'POST', path: '/objects/restSearch' },
    organisation_get_all: { method: 'GET', path: '/organisations' },
    user_get_all: { method: 'GET', path: '/admin/users' },
  },
  'n8n-mocean': {
    sms_send: { method: 'POST', path: '/rest/2/sms' },
    voice_send: { method: 'POST', path: '/rest/2/voice/dial' },
  },
  // monday.com's API is GraphQL-only (POST /v2 with a query document)
  'n8n-monday-com': {
    board_archive: null,
    board_create: null,
    board_get: null,
    board_get_all: null,
    board_column_create: null,
    board_column_get_all: null,
    board_group_delete: null,
    board_group_create: null,
    board_group_get_all: null,
    board_item_add_update: null,
    board_item_change_column_value: null,
    board_item_change_multiple_column_values: null,
    board_item_create: null,
    board_item_delete: null,
    board_item_get: null,
    board_item_get_by_column_value: null,
    board_item_get_all: null,
    board_item_move: null,
  },
  'n8n-n8n': {
    workflow_activate: { method: 'POST', path: '/workflows/{workflowId}/activate' },
    workflow_deactivate: { method: 'POST', path: '/workflows/{workflowId}/deactivate' },
    workflow_delete: { method: 'DELETE', path: '/workflows/{workflowId}' },
    workflow_get: { method: 'GET', path: '/workflows/{workflowId}' },
    workflow_get_version: { method: 'GET', path: '/workflows/{workflowId}/{versionId}' },
    workflow_update: { method: 'PUT', path: '/workflows/{workflowId}' },
  },
  'n8n-nasa': {
    // n8n's own block carries a copy-paste path bug; the documented endpoint
    // (with its fixed feedtype/ver query) is:
    in_sight_mars_weather_service_get: { method: 'GET', path: '/insight_weather/?feedtype=json&ver=1.0' },
    image_and_video_library_get: null, // lives on images-api.nasa.gov (different host)
    tech_transfer_get: { method: 'GET', path: '/techtransfer/patent/' },
    two_line_element_set_get: null, // proxied third-party host (tle.ivanstanojevic.me)
  },
  'n8n-next-cloud': {
    // WebDAV verbs (COPY/MOVE/MKCOL/PROPFIND) and raw-binary upload are not
    // representable in the preset dispatcher
    file_copy: null,
    file_move: null,
    file_upload: null,
    folder_copy: null,
    folder_create: null,
    folder_delete: { method: 'DELETE', path: '/{path}' },
    folder_list: null,
    folder_move: null,
    file_delete: { method: 'DELETE', path: '/{path}' },
    file_download: { method: 'GET', path: '/{path}' },
    file_share: null, // OCS share API hangs off the server root, not the WebDAV credential base
  },
  // NocoDB v2 data API (single-record endpoints documented at /api/v1/db/data)
  'n8n-noco-db': {
    row_create: { method: 'POST', path: '/api/v1/db/data/noco/{projectId}/{table}' },
    row_delete: { method: 'DELETE', path: '/api/v1/db/data/noco/{projectId}/{table}/{id}' },
    row_get: { method: 'GET', path: '/api/v1/db/data/noco/{projectId}/{table}/{id}' },
    row_get_all: { method: 'GET', path: '/api/v1/db/data/noco/{projectId}/{table}' },
    row_update: { method: 'PATCH', path: '/api/v1/db/data/noco/{projectId}/{table}/{id}' },
  },
  'n8n-notion': {
    page_get: { method: 'GET', path: '/pages/{pageId}' },
  },
  // Odoo's external API is JSON-RPC (POST /jsonrpc with service/method
  // envelopes) — not representable as REST endpoints.
  'n8n-odoo': {
    custom_create: null,
    custom_delete: null,
    custom_get: null,
    custom_get_all: null,
    custom_update: null,
    opportunity_create: null,
    opportunity_delete: null,
    opportunity_get: null,
    opportunity_get_all: null,
    opportunity_update: null,
    contact_create: null,
    contact_delete: null,
    contact_get: null,
    contact_get_all: null,
    contact_update: null,
    note_create: null,
    note_delete: null,
    note_get: null,
    note_get_all: null,
    note_update: null,
  },
  // ── batch 4 ──────────────────────────────────────────────────────────────
  'n8n-npm': {
    package_get_metadata: { method: 'GET', path: '/{packageName}/{packageVersion}' },
    package_get_versions: { method: 'GET', path: '/{packageName}' },
    dist_tag_get_many: { method: 'GET', path: '/-/package/{packageName}/dist-tags' },
    dist_tag_update: { method: 'PUT', path: '/-/package/{packageName}/dist-tags/{distTagName}' },
  },
  'n8n-onfleet': {
    admin_create: { method: 'POST', path: '/admins' },
    admin_delete: { method: 'DELETE', path: '/admins/{id}' },
    admin_get_all: { method: 'GET', path: '/admins' },
    admin_update: { method: 'PUT', path: '/admins/{id}' },
    // containerType parameter defaults to 'workers' in the n8n node
    container_update_task: { method: 'PUT', path: '/containers/workers/{containerId}' },
    destination_create: { method: 'POST', path: '/destinations' },
    hub_create: { method: 'POST', path: '/hubs' },
    hub_get_all: { method: 'GET', path: '/hubs' },
    recipient_create: { method: 'POST', path: '/recipients' },
    recipient_get: { method: 'GET', path: '/recipients/{id}' },
    task_get: { method: 'GET', path: '/tasks/{id}' },
    team_create: { method: 'POST', path: '/teams' },
    team_get_all: { method: 'GET', path: '/teams' },
    worker_create: { method: 'POST', path: '/workers' },
  },
  // Orbit shut down in 2024 — n8n's execute() throws 'Service is deprecated'.
  'n8n-orbit': {
    activity_create: null,
    activity_get_all: null,
    member_upsert: null,
    member_delete: null,
    member_get: null,
    member_get_all: null,
    member_lookup: null,
    member_update: null,
    note_create: null,
    note_get_all: null,
    note_update: null,
    post_create: null,
    post_get_all: null,
    post_delete: null,
  },
  'n8n-post-bin': {
    bin_get: { method: 'GET', path: '/api/bin/{binId}' },
    bin_delete: { method: 'DELETE', path: '/api/bin/{binId}' },
    request_send: { method: 'POST', path: '/{binId}' },
  },
  'n8n-post-hog': {
    track_page: { method: 'POST', path: '/capture' },
  },
  'n8n-raindrop': {
    collection_get_all: { method: 'GET', path: '/collections' },
  },
  'n8n-rundeck': {
    job_execute: { method: 'POST', path: '/api/14/job/{jobid}/run' },
    job_get_metadata: { method: 'GET', path: '/api/18/job/{jobid}/info' },
  },
  'n8n-salesforce': {
    lead_create: { method: 'POST', path: '/sobjects/lead' },
    contact_create: { method: 'POST', path: '/sobjects/contact' },
    custom_object_create: { method: 'POST', path: '/sobjects/{customObject}' },
    opportunity_create: { method: 'POST', path: '/sobjects/opportunity' },
    account_create: { method: 'POST', path: '/sobjects/account' },
  },
  // SeaTable's API requires exchanging the API token for a per-base access
  // token (and base UUID) before every gateway call — a handshake the preset
  // dispatcher cannot perform.
  'n8n-sea-table': {
    row_create: null,
    row_remove: null,
    row_get: null,
    row_list: null,
    row_lock: null,
    row_search: null,
    row_unlock: null,
    row_update: null,
    base_snapshot: null,
    base_metadata: null,
    base_collaborator: null,
    link_add: null,
    link_list: null,
    link_remove: null,
    asset_get_public_url: null,
    asset_upload: null,
  },
  'n8n-security-scorecard': {
    report_download: null, // GETs a runtime download URL returned by a prior 'generate report' call
  },
  'n8n-send-in-blue': {
    attribute_create: { method: 'POST', path: '/v3/contacts/attributes/{attributeCategory}/{attributeName}' },
    attribute_update: {
      method: 'PUT',
      path: '/v3/contacts/attributes/{updateAttributeCategory}/{updateAttributeName}',
    },
    attribute_delete: {
      method: 'DELETE',
      path: '/v3/contacts/attributes/{deleteAttributeCategory}/{deleteAttributeName}',
    },
    sender_create: { method: 'POST', path: '/v3/senders' },
    contact_delete: { method: 'DELETE', path: '/v3/contacts/{identifier}' },
    contact_get: { method: 'GET', path: '/v3/contacts/{identifier}' },
    contact_update: { method: 'PUT', path: '/v3/contacts/{identifier}' },
    email_send: { method: 'POST', path: '/v3/smtp/email' },
    email_send_template: { method: 'POST', path: '/v3/smtp/email' },
  },
  // teamSecret moves into the base URL (becomes a required path field);
  // resolve additionally needs the X-S4-Status:resolved body constant.
  'n8n-signl4': {
    alert_send: { method: 'POST', path: '' },
    alert_resolve: null,
  },
  'n8n-slack': {
    message_send_and_wait_operation: null, // send + wait-for-callback composition
  },
  'n8n-strava': {
    activity_get_comments: { method: 'GET', path: '/activities/{activityId}/comments' },
    activity_get_kudos: { method: 'GET', path: '/activities/{activityId}/kudos' },
    activity_get_laps: { method: 'GET', path: '/activities/{activityId}/laps' },
    activity_get_zones: { method: 'GET', path: '/activities/{activityId}/zones' },
  },
  'n8n-stripe': {
    charge_get_all: { method: 'GET', path: '/charges' },
    coupon_get_all: { method: 'GET', path: '/coupons' },
    customer_get_all: { method: 'GET', path: '/customers' },
  },
  'n8n-taiga': {
    epic_get_all: { method: 'GET', path: '/epics' },
    issue_get_all: { method: 'GET', path: '/issues' },
    task_get_all: { method: 'GET', path: '/tasks' },
    user_story_get_all: { method: 'GET', path: '/userstories' },
  },
  'n8n-telegram': {
    message_send_and_wait_operation: null, // send + wait-for-callback composition
  },
  // TheHive 5 search operations all post a query-language envelope
  // ({query:[{_name:'listAlert'},…]}) to /v1/query — an RPC the preset
  // dispatcher cannot compose.
  'n8n-the-hive-project': {
    alert_search: null,
    case_search: null,
    comment_search: null,
    log_search: null,
    observable_search: null,
    page_search: null,
    task_search: null,
  },
  'n8n-todoist': {
    task_get_all: { method: 'GET', path: '/tasks' },
    task_move: null, // Sync-API command envelope (POST /sync/v9/sync)
    task_quick_add: null, // Sync-API endpoint (POST /sync/v9/quick/add)
    project_get_collaborators: { method: 'GET', path: '/projects/{projectId}/collaborators' },
    project_get_all: { method: 'GET', path: '/projects' },
    section_get_all: { method: 'GET', path: '/sections' },
    comment_get_all: { method: 'GET', path: '/comments' },
    label_get_all: { method: 'GET', path: '/labels' },
    reminder_get_all: null, // reminders exist only in the Sync API
  },
  'n8n-url-scan-io': {
    scan_get_all: { method: 'GET', path: '/search' },
  },
  // ── batch 5 ──────────────────────────────────────────────────────────────
  'n8n-vero': {
    user_add_tags: { method: 'PUT', path: '/users/tags/edit' },
    user_resubscribe: { method: 'POST', path: '/users/resubscribe' },
    user_unsubscribe: { method: 'POST', path: '/users/unsubscribe' },
  },
  'n8n-webflow': {
    item_create: { method: 'POST', path: '/collections/{collectionId}/items' },
    item_delete_item: { method: 'DELETE', path: '/collections/{collectionId}/items/{itemId}' },
    item_get: { method: 'GET', path: '/collections/{collectionId}/items/{itemId}' },
    item_get_all: { method: 'GET', path: '/collections/{collectionId}/items' },
    item_update: { method: 'PATCH', path: '/collections/{collectionId}/items/{itemId}' },
  },
  'n8n-whats-app': {
    message_send: { method: 'POST', path: '/{phoneNumberId}/messages' },
    message_send_and_wait_operation: null, // send + wait-for-callback composition
    message_send_template: { method: 'POST', path: '/{phoneNumberId}/messages' },
    media_media_upload: null, // multipart binary upload
    media_media_url_get: { method: 'GET', path: '/{mediaGetId}' },
    media_media_delete: { method: 'DELETE', path: '/{mediaDeleteId}' },
  },
  // YOURLS routes everything through yourls-api.php?action=…
  'n8n-yourls': {
    url_expand: { method: 'GET', path: '?action=expand&format=json' },
    url_shorten: { method: 'GET', path: '?action=shorturl&format=json' },
    url_stats: { method: 'GET', path: '?action=url-stats&format=json' },
  },
  'n8n-zammad': {
    user_get_all: { method: 'GET', path: '/users' },
  },
  'n8n-zendesk': {
    ticket_delete: { method: 'DELETE', path: '/tickets/{id}' },
    ticket_get: { method: 'GET', path: '/tickets/{id}' },
    ticket_get_all: { method: 'GET', path: '/tickets' },
  },
  'n8n-zoho-crm': {
    account_get_all: { method: 'GET', path: '/accounts' },
    contact_get_all: { method: 'GET', path: '/contacts' },
    deal_get_all: { method: 'GET', path: '/deals' },
    invoice_get_all: { method: 'GET', path: '/invoices' },
    lead_get_all: { method: 'GET', path: '/leads' },
    product_get_all: { method: 'GET', path: '/products' },
    purchase_order_get_all: { method: 'GET', path: '/purchase_orders' },
    quote_get_all: { method: 'GET', path: '/quotes' },
    sales_order_get_all: { method: 'GET', path: '/sales_orders' },
    vendor_get_all: { method: 'GET', path: '/vendors' },
  },
  // baseUrl override adds /spaces/{spaceId} (spaceId becomes a synthesized
  // required path field on every endpoint) — see BASE_URL_OVERRIDES.
  'n8n-contentful': {
    space_get: { method: 'GET', path: '' },
    content_type_get: { method: 'GET', path: '/environments/{environmentId}/content_types/{contentTypeId}' },
    entry_get: { method: 'GET', path: '/environments/{environmentId}/entries/{entryId}' },
    entry_get_all: { method: 'GET', path: '/environments/{environmentId}/entries' },
    asset_get: { method: 'GET', path: '/environments/{environmentId}/assets/{assetId}' },
    asset_get_all: { method: 'GET', path: '/environments/{environmentId}/assets' },
    locale_get_all: { method: 'GET', path: '/environments/{environmentId}/locales' },
  },
};

/**
 * Apply ENDPOINT_OVERRIDES for one app: fix method/path (clearing the
 * `[unverified path]` marker) or drop override-deleted endpoints, keeping the
 * verified/unverified counters truthful.
 */
function applyEndpointOverrides(
  id: string,
  endpoints: PresetEndpoint[],
  verified: number,
  unverified: number,
): { endpoints: PresetEndpoint[]; verified: number; unverified: number } {
  const ov = ENDPOINT_OVERRIDES[id];
  if (!ov) return { endpoints, verified, unverified };
  const out: PresetEndpoint[] = [];
  for (const ep of endpoints) {
    const o = ov[ep.id];
    const wasUnverified = Boolean(ep.description?.startsWith('[unverified path]'));
    if (o === undefined) {
      out.push(ep);
      continue;
    }
    if (o === null) {
      // drop: non-HTTP / unrepresentable operation
      if (wasUnverified) unverified--;
      else verified--;
      continue;
    }
    if (o.method) ep.method = o.method;
    ep.path = o.path;
    if (wasUnverified) {
      const d = (ep.description ?? '').replace(/^\[unverified path\]\s*/, '');
      if (d) ep.description = d;
      else delete ep.description;
      unverified--;
      verified++;
    }
    // placeholders introduced by the corrected path become path-located fields
    for (const f of ep.fields) {
      if (!f.in && ep.path.includes(`{${f.id}}`)) f.in = 'path';
    }
    out.push(ep);
  }
  return { endpoints: out, verified, unverified };
}

// ───────────────────────────────────────────────────────────────────────────
// String helpers
// ───────────────────────────────────────────────────────────────────────────

function kebab(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');
}

function snake(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .toLowerCase()
    .replace(/^_|_$/g, '');
}

function titleCase(s: string): string {
  if (!s) return s;
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// ───────────────────────────────────────────────────────────────────────────
// VM module evaluator
// ───────────────────────────────────────────────────────────────────────────

const IS_STUB = Symbol('n8n-extract-stub');
const realRequire = createRequire(path.join(REPO_ROOT, 'package.json'));

function makeStub(): any {
  const fn = function () {};
  const stub: any = new Proxy(fn, {
    get(_t, p) {
      if (p === IS_STUB) return true;
      if (p === Symbol.toPrimitive || p === 'toString' || p === 'valueOf') return () => '';
      if (p === Symbol.iterator) {
        return function* () {};
      }
      if (p === 'then') return undefined; // never thenable
      return makeStub();
    },
    apply() {
      return makeStub();
    },
    construct() {
      return makeStub();
    },
    has() {
      return true;
    },
  });
  return stub;
}

function isStub(v: unknown): boolean {
  try {
    return Boolean(v && (typeof v === 'object' || typeof v === 'function') && (v as any)[IS_STUB]);
  } catch {
    return false;
  }
}

/** A `VersionedNodeType` shim that just records its inputs. */
class VersionedNodeTypeShim {
  nodeVersions: Record<string, any>;
  baseDescription: any;
  constructor(nodeVersions: Record<string, any>, baseDescription: any) {
    this.nodeVersions = nodeVersions;
    this.baseDescription = baseDescription;
  }
}

function makeN8nWorkflowStub(): any {
  const base: Record<string, any> = {
    VersionedNodeType: VersionedNodeTypeShim,
    NodeConnectionType: new Proxy({}, { get: (_t, p) => String(p)[0].toLowerCase() + String(p).slice(1) }),
    NodeConnectionTypes: new Proxy({}, { get: (_t, p) => String(p)[0].toLowerCase() + String(p).slice(1) }),
    NodeOperationError: class extends Error {},
    NodeApiError: class extends Error {},
    ApplicationError: class extends Error {},
    WorkflowOperationError: class extends Error {},
    NodeSslError: class extends Error {},
    deepCopy: (x: unknown) => {
      try {
        return JSON.parse(JSON.stringify(x));
      } catch {
        return x;
      }
    },
    jsonParse: (s: string, opts?: any) => {
      try {
        return JSON.parse(s);
      } catch {
        return opts?.fallbackValue;
      }
    },
    randomInt: (a: number, b?: number) => (b === undefined ? 0 : a),
    sleep: async () => {},
  };
  return new Proxy(base, {
    get(t, p) {
      if (p in t) return (t as any)[p];
      if (p === IS_STUB) return false;
      if (p === 'then') return undefined;
      if (typeof p === 'string' && /^[A-Z_]+$/.test(p)) return p; // constants → their own name
      return makeStub();
    },
  });
}

const N8N_WORKFLOW_STUB = makeN8nWorkflowStub();

const moduleCache = new Map<string, { exports: any }>();
let vmLoadOk = 0;
let vmLoadFail = 0;

const sandbox: Record<string, any> = {
  console: { log() {}, warn() {}, error() {}, info() {}, debug() {}, trace() {} },
  process: { env: {}, platform: process.platform, cwd: () => REPO_ROOT, versions: process.versions },
  Buffer,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  setTimeout: (fn: () => void) => fn,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  structuredClone: (x: unknown) => {
    try {
      return JSON.parse(JSON.stringify(x));
    } catch {
      return x;
    }
  },
};
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
const VM_CONTEXT = vm.createContext(sandbox);

function resolveRelative(fromDir: string, spec: string): string | undefined {
  const base = path.resolve(fromDir, spec);
  const candidates = [base, `${base}.ts`, `${base}.js`, path.join(base, 'index.ts'), path.join(base, 'index.js')];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

/** Transpile + evaluate a TS module inside the sandbox; returns its exports. */
function loadModule(absPath: string, depth = 0): any {
  const key = absPath;
  const cached = moduleCache.get(key);
  if (cached) return cached.exports;
  if (depth > 40) return makeStub();

  const mod = { exports: {} as any };
  moduleCache.set(key, mod); // pre-register for circular imports

  let source: string;
  try {
    source = fs.readFileSync(absPath, 'utf-8');
  } catch {
    vmLoadFail++;
    mod.exports = makeStub();
    return mod.exports;
  }

  let js: string;
  try {
    js = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        verbatimModuleSyntax: false,
        importHelpers: false,
      },
      fileName: absPath,
    }).outputText;
  } catch {
    vmLoadFail++;
    mod.exports = makeStub();
    return mod.exports;
  }

  const dir = path.dirname(absPath);
  const requireShim = (spec: string): any => {
    if (spec === 'n8n-workflow') return N8N_WORKFLOW_STUB;
    if (spec.startsWith('.')) {
      const resolved = resolveRelative(dir, spec);
      if (!resolved) return makeStub();
      try {
        return loadModule(resolved, depth + 1);
      } catch {
        return makeStub();
      }
    }
    // bare import — try the repo's node_modules (lodash etc.), else stub
    try {
      return realRequire(spec);
    } catch {
      return makeStub();
    }
  };

  try {
    const wrapper = `(function (exports, require, module, __filename, __dirname) {\n${js}\n})`;
    const fn = vm.runInContext(wrapper, VM_CONTEXT, { filename: absPath, timeout: 10_000 });
    fn(mod.exports, requireShim, mod, absPath, dir);
    vmLoadOk++;
  } catch (err) {
    vmLoadFail++;
    if (VERBOSE) console.warn(`  [vm-fail] ${path.relative(REPO_ROOT, absPath)}: ${(err as Error).message.split('\n')[0]}`);
    mod.exports = makeStub();
  }
  return mod.exports;
}

// ───────────────────────────────────────────────────────────────────────────
// Sanitization of evaluated values (drop stubs / functions / cycles)
// ───────────────────────────────────────────────────────────────────────────

function sanitize(value: any, depth = 0): any {
  if (depth > 12) return undefined;
  if (value === null) return null;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return value;
  if (t === 'function' || t === 'symbol' || t === 'bigint' || t === 'undefined') return undefined;
  if (isStub(value)) return undefined;
  if (Array.isArray(value)) {
    const out: any[] = [];
    for (const v of value) {
      const s = sanitize(v, depth + 1);
      if (s !== undefined) out.push(s);
    }
    return out;
  }
  if (t === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) {
      let v: any;
      try {
        v = value[k];
      } catch {
        continue;
      }
      const s = sanitize(v, depth + 1);
      if (s !== undefined) out[k] = s;
    }
    return out;
  }
  return undefined;
}

// ───────────────────────────────────────────────────────────────────────────
// Node discovery + description acquisition
// ───────────────────────────────────────────────────────────────────────────

type NodeEntry = {
  appDir: string; // top-level app folder
  nodeFile: string; // main (wrapper) node file
  baseName: string; // file basename without .node.ts
};

/** Trigger-only node files skipped at discovery (recorded in the report). */
const triggerSkips: string[] = [];

function discoverNodes(): NodeEntry[] {
  const out: NodeEntry[] = [];
  const stack: string[] = [NODES_DIR];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (/^(test|tests|__tests?__|__schema__|__snapshots__|mock|mocks)$/i.test(e.name)) continue;
        if (/^[Vv]\d+$/.test(e.name)) continue; // version dirs reached via wrapper
        stack.push(full);
        continue;
      }
      if (!e.isFile() || !e.name.endsWith('.node.ts')) continue;
      if (/Trigger\.node\.ts$/.test(e.name)) {
        triggerSkips.push(path.relative(NODES_DIR, full));
        continue;
      }
      const baseName = e.name.replace(/\.node\.ts$/, '');
      if (!/^[A-Z]/.test(baseName)) continue;
      const rel = path.relative(NODES_DIR, full);
      const appDir = path.join(NODES_DIR, rel.split(path.sep)[0]);
      out.push({ appDir, nodeFile: full, baseName });
    }
  }
  return out.sort((a, b) => a.nodeFile.localeCompare(b.nodeFile));
}

type AcquiredDescription = {
  description: any; // sanitized full description (properties resolved)
  versionDir: string; // directory whose sources implement the active version
  loadMethod: 'vm-instantiate' | 'vm-versioned';
};

function pickExportedClass(exports: any): any | undefined {
  if (!exports || isStub(exports)) return undefined;
  const candidates: any[] = [];
  if (typeof exports === 'function') candidates.push(exports);
  if (typeof exports === 'object') {
    for (const k of Object.keys(exports)) {
      const v = exports[k];
      if (typeof v === 'function' && !isStub(v)) candidates.push(v);
    }
  }
  return candidates[0];
}

function acquireDescription(entry: NodeEntry): AcquiredDescription | undefined {
  const exports = loadModule(entry.nodeFile);
  const Cls = pickExportedClass(exports);
  if (!Cls) return undefined;
  let instance: any;
  try {
    instance = new Cls();
  } catch {
    return undefined;
  }
  if (!instance || isStub(instance)) return undefined;

  // Versioned wrapper?
  if (instance.nodeVersions && typeof instance.nodeVersions === 'object' && !isStub(instance.nodeVersions)) {
    const versions = Object.keys(instance.nodeVersions)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    if (!versions.length) return undefined;
    const def = instance.baseDescription?.defaultVersion;
    const chosen = typeof def === 'number' && instance.nodeVersions[def] ? def : Math.max(...versions);
    const verInstance = instance.nodeVersions[chosen];
    const rawDesc = verInstance?.description;
    if (!rawDesc || isStub(rawDesc)) return undefined;
    const description = sanitize(rawDesc);
    // find the version dir: the class of verInstance was loaded from V<major>/
    const major = Math.floor(chosen);
    const candidates = [path.join(entry.appDir, `V${major}`), path.join(entry.appDir, `v${major}`)];
    // node file may live in a subfolder of appDir (e.g. Aws/S3/AwsS3.node.ts → Aws/S3/V2)
    const nodeDir = path.dirname(entry.nodeFile);
    candidates.unshift(path.join(nodeDir, `V${major}`), path.join(nodeDir, `v${major}`));
    const versionDir = candidates.find((c) => fs.existsSync(c)) ?? nodeDir;
    return { description, versionDir, loadMethod: 'vm-versioned' };
  }

  const rawDesc = instance.description;
  if (!rawDesc || isStub(rawDesc) || typeof rawDesc !== 'object') return undefined;
  const description = sanitize(rawDesc);
  return { description, versionDir: path.dirname(entry.nodeFile), loadMethod: 'vm-instantiate' };
}

// ───────────────────────────────────────────────────────────────────────────
// n8n property semantics → endpoints + fields
// ───────────────────────────────────────────────────────────────────────────

type N8nProp = Record<string, any>;

function showArray(prop: N8nProp, axis: 'resource' | 'operation'): string[] | undefined {
  const arr = prop?.displayOptions?.show?.[axis];
  if (!Array.isArray(arr)) return undefined;
  const strs = arr.filter((v: unknown) => typeof v === 'string');
  return strs.length ? strs : undefined;
}

function hideArray(prop: N8nProp, axis: 'resource' | 'operation'): string[] | undefined {
  const arr = prop?.displayOptions?.hide?.[axis];
  if (!Array.isArray(arr)) return undefined;
  const strs = arr.filter((v: unknown) => typeof v === 'string');
  return strs.length ? strs : undefined;
}

function appliesTo(prop: N8nProp, resource: string, operation: string): boolean {
  const sr = showArray(prop, 'resource');
  const so = showArray(prop, 'operation');
  if (sr && !sr.includes(resource)) return false;
  if (so && !so.includes(operation)) return false;
  const hr = hideArray(prop, 'resource');
  const ho = hideArray(prop, 'operation');
  if (hr?.includes(resource)) return false;
  if (ho?.includes(operation)) return false;
  return true;
}

const SKIP_PROP_TYPES = new Set(['hidden', 'notice', 'callout', 'curlImport', 'credentialsSelect', 'button']);

/** n8n-internal plumbing properties that must not surface as preset fields. */
const SKIP_PROP_NAMES = new Set(['authentication', 'requestOptions', 'curlImport']);

function mapField(prop: N8nProp): PresetField | undefined {
  const name = typeof prop.name === 'string' ? prop.name : undefined;
  if (!name) return undefined;
  if (SKIP_PROP_NAMES.has(name)) return undefined;
  const n8nType = typeof prop.type === 'string' ? prop.type : 'string';
  if (SKIP_PROP_TYPES.has(n8nType)) return undefined;

  let type: PresetFieldType = 'text';
  let descSuffix = '';
  let placeholder = typeof prop.placeholder === 'string' ? prop.placeholder : undefined;

  switch (n8nType) {
    case 'string':
      type = prop?.typeOptions?.password ? 'password' : (prop?.typeOptions?.rows ?? 0) > 1 ? 'textarea' : 'text';
      break;
    case 'number':
      type = 'number';
      break;
    case 'boolean':
      type = 'toggle';
      break;
    case 'options':
      type = 'select';
      break;
    case 'multiOptions':
      type = 'select';
      descSuffix = ' (multiple values: comma-separated)';
      break;
    case 'json':
      type = 'json';
      break;
    case 'collection':
    case 'fixedCollection': {
      type = 'json';
      const inner: string[] = [];
      const walk = (opts: any[]) => {
        for (const o of opts ?? []) {
          if (typeof o?.name === 'string' && o.name) inner.push(o.name);
          if (Array.isArray(o?.values)) {
            for (const v of o.values) if (typeof v?.name === 'string') inner.push(`${o.name}.${v.name}`);
          }
        }
      };
      if (Array.isArray(prop.options)) walk(prop.options);
      const uniq = Array.from(new Set(inner)).slice(0, 30);
      if (uniq.length) descSuffix = ` (JSON object; supported keys: ${uniq.join(', ')})`;
      else descSuffix = ' (JSON object)';
      break;
    }
    case 'dateTime':
      type = 'text';
      placeholder = placeholder ?? '2024-01-01T00:00:00Z';
      descSuffix = ' (ISO 8601 date-time)';
      break;
    case 'color':
      type = 'text';
      break;
    case 'resourceLocator':
      type = 'text';
      descSuffix = ' (provide the ID)';
      break;
    case 'resourceMapper':
    case 'filter':
    case 'assignmentCollection':
      type = 'json';
      descSuffix = ' (JSON)';
      break;
    case 'workflowSelector':
      type = 'text';
      break;
    default:
      type = 'text';
      break;
  }

  const field: PresetField = {
    id: name,
    label: typeof prop.displayName === 'string' && prop.displayName ? prop.displayName : titleCase(name),
    type,
  };
  if (prop.required === true) field.required = true;
  if (placeholder) field.placeholder = placeholder;

  let description = typeof prop.description === 'string' ? stripHtml(prop.description) : '';
  if (descSuffix) description = (description + descSuffix).trim();
  if (description) field.description = description;

  const dv = prop.default;
  if (
    dv !== undefined &&
    dv !== null &&
    dv !== '' &&
    (typeof dv === 'string' || typeof dv === 'number' || typeof dv === 'boolean')
  ) {
    // skip n8n expression defaults
    if (!(typeof dv === 'string' && dv.startsWith('={{'))) field.defaultValue = dv;
  }

  if (type === 'select' && Array.isArray(prop.options)) {
    const opts = prop.options
      .filter((o: any) => o && (typeof o.value === 'string' || typeof o.value === 'number'))
      .map((o: any) => ({ value: String(o.value), label: typeof o.name === 'string' ? o.name : titleCase(String(o.value)) }));
    if (opts.length) field.options = opts;
    else field.type = 'text';
  }

  // routing.send → explicit location (declarative nodes); also wire-name remap
  const send = prop?.routing?.send;
  if (send && typeof send === 'object') {
    if (send.type === 'query') field.in = 'query';
    else if (send.type === 'body') field.in = 'body';
    else if (send.type === 'header') field.in = 'header';
    if (typeof send.property === 'string' && /^[A-Za-z0-9_.[\]-]+$/.test(send.property) && !send.property.includes('.')) {
      field.id = send.property;
    }
  }

  return field;
}

// ── URL expression → preset path ────────────────────────────────────────────

function convertUrlExpr(raw: string, ctx: { resource?: string; operation?: string }): { path: string; verified: boolean } {
  let s = raw.trim();
  let verified = true;

  // strip n8n `={{ ... }}` wrapper
  if (s.startsWith('={{') && s.endsWith('}}')) s = s.slice(3, -2).trim();
  else if (s.startsWith('=')) s = s.slice(1);

  // strip surrounding quotes/backticks
  const quoted = /^["'`]/.test(s);
  if (quoted) s = s.replace(/^["'`]|["'`]$/g, '');

  // handle `" /a/" + $parameter["x"] + "/b"` concatenations
  if (s.includes('+')) {
    s = s
      .split('+')
      .map((p) => p.trim().replace(/^["'`]|["'`]$/g, ''))
      .join('');
  }

  // {{ $parameter["x"] }} / {{ $parameter.x }}  →  {x}
  // (must run BEFORE the bare $parameter replaces, which would otherwise leave
  //  the surrounding `{{ }}` in place → `{{{x}}}` → false unverified)
  s = s.replace(/\{\{\s*\$parameter\[["']([^"']+)["']\]\s*\}\}/g, '{$1}');
  s = s.replace(/\{\{\s*\$parameter\.([a-zA-Z0-9_]+)\s*\}\}/g, '{$1}');

  // $parameter["x"] / $parameter.x  →  {x}
  s = s.replace(/\$parameter\[["']([^"']+)["']\]/g, '{$1}');
  s = s.replace(/\$parameter\.([a-zA-Z0-9_]+)/g, '{$1}');

  // template interpolations
  s = s.replace(/\$\{([^{}]*)\}/g, (_m, innerRaw: string) => {
    const inner = String(innerRaw).trim();
    if (/^[A-Za-z_$][\w$]*$/.test(inner)) {
      if (inner === 'resource' && ctx.resource) return ctx.resource;
      if (inner === 'operation' && ctx.operation) return ctx.operation;
      return `{${inner}}`;
    }
    const gp = inner.match(/getNodeParameter\(\s*['"]([^'"]+)['"]/);
    if (gp) return `{${gp[1]}}`;
    const member = inner.match(/^[A-Za-z_$][\w$]*\.(?:value|id)$/);
    if (member) return `{${inner.split('.')[0]}}`;
    verified = false;
    return `{${inner.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 40)}}`;
  });

  // leftover raw expressions (e.g. `{{ ... }}` from declarative urls)
  s = s.replace(/\{\{\s*\$parameter\[["']([^"']+)["']\]\s*\}\}/g, '{$1}');
  s = s.replace(/\{\{\s*\$parameter\.([a-zA-Z0-9_]+)\s*\}\}/g, '{$1}');
  if (/\{\{/.test(s)) verified = false;

  if (!s.startsWith('/')) s = '/' + s;
  s = s.replace(/\/{2,}/g, '/');
  // `${host}/api/...` style — programmatic helpers often prefix a credential
  // host themselves (Databricks `${host}/api/2.0/...`); the preset baseUrl
  // already carries the host, so strip the leading host-ish token.
  s = s.replace(
    /^\/\{(?:host|hostname|baseurl|apiurl|url|instanceurl|serverurl|websiteurl|domain|server|instance)\}(?=\/|$)/i,
    '',
  );
  if (!s.startsWith('/')) s = '/' + s;
  return { path: s, verified };
}

// ── Programmatic execute() scanning ─────────────────────────────────────────

type ScannedCall = { method: PresetHttpMethod; path: string; verified: boolean };

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Find the first api-request style call in `block` and resolve its method/url.
 * Handles:
 *   xApiRequest.call(this, 'METHOD', <url>, ...)
 *   xApiRequestAllItems.call(this, 'prop', 'METHOD', <url>, ...)
 *   apiRequest('METHOD', <url>)
 *   this.helpers.httpRequest({ method: 'GET', url: <url> })
 */
function scanBlockForCall(block: string, ctx: { resource?: string; operation?: string }): ScannedCall | undefined {
  const callRe = /\b\w*(?:[Aa]pi[Rr]equest|[Hh]ttp[Rr]equest)\w*(?:\.call)?\(\s*([^)]{0,400})/gs;
  let m: RegExpExecArray | null;
  const candidates: ScannedCall[] = [];
  while ((m = callRe.exec(block)) && candidates.length < 6) {
    const argsRaw = m[1];
    // split top-level args (rough: handle nesting of (), {}, [], ``)
    const args = splitTopLevelArgs(argsRaw);
    // object form — the sole arg OR positional among others, e.g.
    // `this.helpers.httpRequestWithAuthentication.call(this, credType, { method, url })`
    const objArg = args.find((a) => a.trim().startsWith('{'));
    if (objArg) {
      const obj = objArg.trim();
      const mm = obj.match(/method:\s*['"](\w+)['"]/);
      // quoted alternatives first: template urls contain `}` (`${host}/...`),
      // which a bare [^,}]+ would truncate.
      const mu = obj.match(/(?:url|uri):\s*(`[^`]*`|'[^']*'|"[^"]*"|[^,}\n]+)/);
      if (mm && mu && HTTP_METHODS.has(mm[1].toUpperCase())) {
        const r = resolveUrlArg(mu[1], block, ctx);
        if (r) {
          candidates.push({ method: mm[1].toUpperCase() as PresetHttpMethod, ...r });
          continue;
        }
      }
      if (args.length === 1) continue;
    }
    // positional form: find the first quoted HTTP verb among args
    for (let i = 0; i < args.length; i++) {
      const a = args[i].trim();
      const verb = a.match(/^['"](GET|POST|PUT|PATCH|DELETE)['"]$/i);
      if (!verb) continue;
      // url usually FOLLOWS the verb…
      let r = args[i + 1] !== undefined ? resolveUrlArg(args[i + 1], block, ctx) : undefined;
      // …but some helpers take it BEFORE
      // (`jiraSoftwareCloudApiRequest.call(this, endpoint, 'GET', …)`).
      // Only accept a path-looking literal or an url-ish identifier so the
      // AllItems property-name arg ('issues', 'values', …) can't slip in.
      if (!r && i > 0) {
        const prev = args[i - 1].trim();
        const prevIsPathLiteral = /^["'`]/.test(prev) && prev.includes('/');
        const prevIsUrlIdent = /^(endpoint|endPoint|uri|url|path|requestPath|resourcePath)$/i.test(prev);
        if (prevIsPathLiteral || prevIsUrlIdent) r = resolveUrlArg(prev, block, ctx);
      }
      if (r) candidates.push({ method: verb[1].toUpperCase() as PresetHttpMethod, ...r });
      break;
    }
  }
  if (!candidates.length) return undefined;
  // Prefer the call whose verb matches the operation-name heuristic — update
  // handlers often do a preliminary GET before the real PATCH/PUT/POST.
  if (ctx.operation) {
    const expected = methodHeuristic(ctx.operation);
    const exact = candidates.find((c) => c.method === expected);
    if (exact) return exact;
    if (expected === 'PATCH') {
      const put = candidates.find((c) => c.method === 'PUT' || c.method === 'POST');
      if (put) return put;
    }
    if (expected === 'POST') {
      const write = candidates.find((c) => c.method === 'PUT' || c.method === 'PATCH');
      if (write) return write;
    }
    // The op name implies a write but we only saw read calls (the real write
    // often hides in a helper like `batchUpdate(endpoint, …)` without a verb
    // literal) — keep the discovered path, trust the heuristic verb.
    if (expected !== 'GET' && candidates.every((c) => c.method === 'GET')) {
      return { method: expected, path: candidates[0].path, verified: candidates[0].verified };
    }
  }
  return candidates[0];
}

function splitTopLevelArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  let inStr: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      cur += c;
      if (c === inStr && s[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c;
      cur += c;
      continue;
    }
    if (c === '(' || c === '{' || c === '[') depth++;
    if (c === ')' || c === '}' || c === ']') depth--;
    if (c === ',' && depth === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function resolveUrlArg(
  argRaw: string,
  block: string,
  ctx: { resource?: string; operation?: string },
): { path: string; verified: boolean } | undefined {
  const arg = argRaw.trim();
  if (!arg) return undefined;
  // literal / template
  if (/^["'`]/.test(arg)) {
    const r = convertUrlExpr(arg, ctx);
    if (r.path === '/') return undefined;
    return r;
  }
  // simple identifier → chase `<ident> = <literal>` within the block
  const ident = arg.match(/^[A-Za-z_$][\w$]*$/);
  if (ident) {
    const assignRe = new RegExp(`\\b${ident[0]}\\s*=\\s*(["'\`])((?:\\\\.|(?!\\1).)*)\\1`);
    const am = block.match(assignRe);
    if (am) {
      const r = convertUrlExpr(am[1] + am[2] + am[1], ctx);
      if (r.path !== '/') return r;
    }
    return undefined;
  }
  // inline template expression without quotes (e.g. `${base}/${table}` captured bare)
  if (arg.includes('${') || arg.startsWith('/')) {
    const r = convertUrlExpr('`' + arg + '`', ctx);
    if (r.path !== '/') return r;
  }
  return undefined;
}

type ProgrammaticMap = Map<string, ScannedCall>; // key `${resource} ${operation}`

function mapKey(resource: string, operation: string): string {
  return `${resource} ${operation}`;
}

/** Scan a node-file execute() body using linear resource/operation markers. */
function scanExecuteText(text: string, map: ProgrammaticMap): void {
  const execIdx = text.search(/async\s+execute\s*\(/);
  const body = execIdx >= 0 ? text.slice(execIdx) : text;

  type Marker = { kind: 'resource' | 'operation'; value: string; index: number };
  const markers: Marker[] = [];
  const markerRe = /\b(resource|operation)\s*===\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(body))) {
    markers.push({ kind: m[1] as 'resource' | 'operation', value: m[2], index: m.index });
  }
  // per-resource dispatch methods (`static async executeTaskOperations(...)`)
  const fnRe = /(?:static\s+)?(?:async\s+)?execute([A-Z]\w*?)Operations?\s*\(/g;
  while ((m = fnRe.exec(body))) {
    const value = m[1][0].toLowerCase() + m[1].slice(1);
    markers.push({ kind: 'resource', value, index: m.index });
  }
  markers.sort((a, b) => a.index - b.index);
  // switch/case form
  const switchRe = /switch\s*\(\s*(resource|operation)\s*\)/g;
  const switches: Array<{ kind: 'resource' | 'operation'; index: number }> = [];
  while ((m = switchRe.exec(body))) switches.push({ kind: m[1] as 'resource' | 'operation', index: m.index });
  if (switches.length) {
    const caseRe = /case\s+['"]([^'"]+)['"]\s*:/g;
    while ((m = caseRe.exec(body))) {
      const sw = [...switches].reverse().find((s) => s.index < m!.index);
      if (sw) markers.push({ kind: sw.kind, value: m[1], index: m.index });
    }
    markers.sort((a, b) => a.index - b.index);
  }

  for (let i = 0; i < markers.length; i++) {
    const mk = markers[i];
    if (mk.kind !== 'operation') continue;
    // resource context = nearest resource marker before this one
    let resource = 'default';
    for (let j = i - 1; j >= 0; j--) {
      if (markers[j].kind === 'resource') {
        resource = markers[j].value;
        break;
      }
    }
    const next = markers.slice(i + 1).find((x) => x.index > mk.index);
    const region = body.slice(mk.index, next ? next.index : Math.min(body.length, mk.index + 12_000));
    const call =
      scanBlockForCall(region, { resource, operation: mk.value }) ??
      scanRegionVarAssignments(region, { resource, operation: mk.value });
    if (call) {
      const key = mapKey(resource, mk.value);
      if (!map.has(key)) map.set(key, call);
    }
  }
}

/**
 * Fallback for the very common dispatch shape where each operation block only
 * assigns `requestMethod = 'POST'; endpoint = `boards/${id}`;` and a single
 * shared api call fires after the dispatch (Trello, Harvest, GitHub, Telegram…).
 */
function scanRegionVarAssignments(
  region: string,
  ctx: { resource?: string; operation?: string },
): ScannedCall | undefined {
  const methodM = region.match(
    /\b(?:requestMethod|httpMethod|method)\s*=\s*['"](GET|POST|PUT|PATCH|DELETE)['"]/,
  );
  const urlM = region.match(
    /\b(?:endpoint|requestPath|resourcePath|requestUri|uri|url|path)\s*=\s*(["'`])((?:\\.|(?!\1).)+)\1/,
  );
  if (!urlM) return undefined;
  const conv = convertUrlExpr(urlM[1] + urlM[2] + urlM[1], ctx);
  if (conv.path === '/') return undefined;
  // The PATH is what we verify; a missing method literal falls back to the
  // operation-name heuristic without demoting the endpoint to unverified.
  const method = methodM
    ? (methodM[1].toUpperCase() as PresetHttpMethod)
    : methodHeuristic(ctx.operation ?? '');
  return { method, path: conv.path, verified: conv.verified };
}

/** Scan actions/<resource>/<operation>.operation.ts files. */
function scanOperationFiles(versionDir: string, map: ProgrammaticMap): void {
  const stack = [versionDir];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (/^(test|tests|__tests?__|__schema__)$/i.test(e.name)) continue;
        stack.push(full);
        continue;
      }
      if (!e.isFile()) continue;
      let operation: string;
      let resource: string;
      if (e.name.endsWith('.operation.ts')) {
        operation = e.name.replace(/\.operation\.ts$/, '');
        resource = path.basename(path.dirname(full));
      } else if (e.name === 'execute.ts') {
        // actions/<resource>/<operation>/execute.ts (Mattermost/SyncroMSP v1 style)
        operation = path.basename(path.dirname(full));
        resource = path.basename(path.dirname(path.dirname(full)));
        if (resource === 'actions' || operation === 'actions') continue;
      } else {
        continue;
      }
      let text: string;
      try {
        text = fs.readFileSync(full, 'utf-8');
      } catch {
        continue;
      }
      const call =
        scanBlockForCall(text, { resource, operation }) ??
        scanRegionVarAssignments(text, { resource, operation });
      if (call) {
        const key = mapKey(resource, operation);
        if (!map.has(key)) map.set(key, call);
        // operation value sometimes differs in case (deleteRecord vs delete)
        const alt = operation.replace(/^delete[A-Z].*$/, 'delete');
        if (alt !== operation && !map.has(mapKey(resource, alt))) map.set(mapKey(resource, alt), call);
        // folder name `del` ↔ operation value 'delete' (reserved word)
        if (operation === 'del' && !map.has(mapKey(resource, 'delete'))) {
          map.set(mapKey(resource, 'delete'), call);
        }
      }
    }
  }
}

/**
 * Operation-handler classes (`export class ProjectGetAllHandler …` — Todoist
 * style). Class name = optional resource prefix + operation, both camelCase.
 */
function scanHandlerClasses(text: string, resourceValues: string[], map: ProgrammaticMap): void {
  const classRe = /export\s+class\s+(\w+?)Handler\b/g;
  const matches: Array<{ name: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(text))) matches.push({ name: m[1], index: m.index });
  const byLen = [...resourceValues].sort((a, b) => b.length - a.length);
  for (let i = 0; i < matches.length; i++) {
    const { name, index } = matches[i];
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const block = text.slice(index, end);
    let resource = '*';
    let opPart = name;
    for (const r of byLen) {
      if (name.toLowerCase().startsWith(r.toLowerCase()) && name.length > r.length) {
        resource = r;
        opPart = name.slice(r.length);
        break;
      }
    }
    const operation = opPart[0] ? opPart[0].toLowerCase() + opPart.slice(1) : '';
    if (!operation) continue;
    const call = scanBlockForCall(block, { resource: resource === '*' ? undefined : resource, operation });
    if (!call) continue;
    const key = mapKey(resource, operation);
    if (!map.has(key)) map.set(key, call);
  }
}

function buildProgrammaticMap(versionDir: string, appDir: string, resourceValues: string[]): ProgrammaticMap {
  const map: ProgrammaticMap = new Map();
  // 1) per-operation action files (most precise)
  scanOperationFiles(versionDir, map);
  // 2) the version's node files + any execute-bearing siblings
  const files: string[] = [];
  const stack = [versionDir];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (/^(test|tests|__tests?__|__schema__)$/i.test(e.name)) continue;
        stack.push(full);
        continue;
      }
      if (e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') && !e.name.endsWith('.operation.ts')) {
        files.push(full);
      }
    }
  }
  // app root GenericFunctions can host shared execute helpers too
  const rootGeneric = path.join(appDir, 'GenericFunctions.ts');
  if (fs.existsSync(rootGeneric)) files.push(rootGeneric);
  for (const f of files) {
    let text: string;
    try {
      text = fs.readFileSync(f, 'utf-8');
    } catch {
      continue;
    }
    if (/export\s+class\s+\w+Handler\b/.test(text)) {
      scanHandlerClasses(text, resourceValues, map);
    }
    if (!/async\s+execute\w*\s*\(|export\s+async\s+function\s+execute/.test(text)) continue;
    scanExecuteText(text, map);
  }
  return map;
}

// ── Method heuristic ────────────────────────────────────────────────────────

function methodHeuristic(operation: string): PresetHttpMethod {
  const o = operation.toLowerCase();
  if (/^(get|list|search|find|fetch|read|download|lookup|retrieve|view|query|check|count|export|changelog)/.test(o)) return 'GET';
  if (/^(getall|getmany)/.test(o)) return 'GET';
  if (/^(delete|remove|del|deactivate|unregister|revoke|unsubscribe|archive)/.test(o)) return 'DELETE';
  if (/^(update|edit|rename|set|patch|modify|change|move|toggle)/.test(o)) return 'PATCH';
  return 'POST';
}

// ───────────────────────────────────────────────────────────────────────────
// baseUrl resolution
// ───────────────────────────────────────────────────────────────────────────

const BAD_BASE_URL_RE =
  /docs\.|documentation|developer|github\.com|npmjs|example\.|\.svg|w3\.org|schemas?\.|youtube\.com\/watch|\.md$|\.html?$|\.png$/i;

function collectTsFiles(dirs: string[], maxDepth = 3): string[] {
  const out = new Set<string>();
  for (const root of dirs) {
    const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
    while (stack.length) {
      const { dir, depth } = stack.pop()!;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (/^(test|tests|__tests?__|__schema__|__snapshots__)$/i.test(e.name)) continue;
          if (depth < maxDepth) stack.push({ dir: full, depth: depth + 1 });
          continue;
        }
        if (e.isFile() && e.name.endsWith('.ts') && !/\.test\.ts$/i.test(e.name)) out.add(full);
      }
    }
  }
  return Array.from(out);
}

function harvestUrls(text: string, candidates: Map<string, number>, weight: number): void {
  const urlRe = /[`'"](https:\/\/[^`'"\s]+)/g;
  for (const m of text.matchAll(urlRe)) {
    let url = m[1].split('${')[0].split('{{')[0];
    if (!/^https:\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/|$)/i.test(url)) continue;
    if (BAD_BASE_URL_RE.test(url)) continue;
    url = url.replace(/[/?#]+$/, '');
    candidates.set(url, (candidates.get(url) ?? 0) + weight);
  }
}

function scanDirForBaseUrl(dirs: string[], maxDepth = 3): string | undefined {
  const candidates = new Map<string, number>();
  const lineRe = /(?:uri|url|baseURL|endpoint)\s*[:=?]/i;
  const files = collectTsFiles(dirs, maxDepth);

  for (const file of files) {
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    // Pass 1 (strict): URL literals on uri/url/endpoint assignment lines.
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
      if (!lineRe.test(line) && !/^[?:]\s*[`'"]https:\/\//.test(trimmed)) continue;
      harvestUrls(line, candidates, 3);
    }
    // Pass 2 (relaxed): request-helper files rarely contain doc links — any
    // https literal in them is a credible API base (multi-line ternaries etc.).
    if (/(\w*Functions|transport|apiRequest|helpers?|utils?)\.ts$/i.test(file) || /\/transport\//.test(file)) {
      harvestUrls(text, candidates, 1);
    }
  }
  if (!candidates.size) return undefined;
  return Array.from(candidates.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Credential-templated hosts: find `https://${credentials.subdomain}.zendesk.com/api/v2`
 * style literals in helper files and convert them into `{placeholder}` base
 * URLs. exec.ts resolves `{x}` in `baseUrl + path` from `in:'path'` fields and
 * `encodeURIComponent` keeps dots/hyphens intact — so host tokens (subdomain,
 * domain) are safe, while full-URL credentials (contain `/`, `:`) are NOT and
 * stay skipped.
 */
function findTemplatedBaseUrl(
  dirs: string[],
): { baseUrl: string; placeholders: string[] } | undefined {
  const candidates = new Map<string, { count: number; placeholders: string[] }>();
  const litRe = /[`](https:\/\/[^`]*\$\{[^`]+?)[`]/g;
  for (const file of collectTsFiles(dirs)) {
    if (!/(\w*Functions|transport|apiRequest|helpers?|utils?)\.ts$/i.test(file) && !/\/transport\//.test(file)) {
      continue;
    }
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    for (const m of text.matchAll(litRe)) {
      const raw = m[1];
      const placeholders: string[] = [];
      let bad = false;
      // ${expr} → {token}; token = final identifier (skipping `credentials`/casts)
      let tpl = raw.replace(/\$\{([^}]+)\}/g, (_mm, exprRaw: string) => {
        let expr = String(exprRaw).replace(/\s+as\s+\w+/g, '').replace(/[()]/g, '').trim();
        const segs = expr.split('.').map((s) => s.trim());
        let token = segs[segs.length - 1];
        if (token === 'credentials' && segs.length > 1) token = segs[segs.length - 2];
        if (!/^[A-Za-z_][\w]*$/.test(token) || /credentials?$/i.test(token)) {
          bad = true;
          return '{?}';
        }
        placeholders.push(token);
        return `{${token}}`;
      });
      if (bad || !placeholders.length) continue;
      // host = up to first '/' after the protocol; placeholders allowed in the
      // host, the path is cut at its first placeholder.
      const after = tpl.slice('https://'.length);
      const slash = after.indexOf('/');
      const host = slash === -1 ? after : after.slice(0, slash);
      let pathPart = slash === -1 ? '' : after.slice(slash);
      if (!host || host.includes('{?}')) continue;
      const brace = pathPart.indexOf('{');
      if (brace !== -1) pathPart = pathPart.slice(0, brace);
      pathPart = pathPart.replace(/\/+$/, '').replace(/[/?#]+$/, '');
      tpl = `https://${host}${pathPart}`;
      // per-call variables (endpoint/resource/…) must not survive into the
      // final template — path-cutting above removes the legitimate ones.
      if (baseUrlTokens(tpl).some((t) => DENY_BASE_TOKENS.test(t))) continue;
      const used = placeholders.filter((p) => tpl.includes(`{${p}}`));
      if (!used.length) continue;
      const cur = candidates.get(tpl) ?? { count: 0, placeholders: used };
      cur.count++;
      candidates.set(tpl, cur);
    }
  }
  if (candidates.size) {
    const [baseUrl, info] = Array.from(candidates.entries()).sort(
      (a, b) => b[1].count - a[1].count || a[0].length - b[0].length,
    )[0];
    return { baseUrl, placeholders: Array.from(new Set(info.placeholders)) };
  }

  // Fallback: self-hosted apps where the WHOLE base comes from a credential —
  // `${credentials.baseUrl}/api/v4${endpoint}`. exec.ts can't substitute a
  // full URL (encodeURIComponent escapes `/` and `:`), so we pin `https://`
  // and expose the host as a `{host}` token (dots survive encoding).
  const prefixCandidates = new Map<string, number>();
  const prefixRe = /[`]\$\{([^}]{1,80})\}((?:\/[A-Za-z0-9_./-]*)?)/g;
  const HOSTY = /^(url|baseUrl|baseURL|apiUrl|siteUrl|serverUrl|instanceUrl|webhookUrl|host|hostname|domain|server|instance)$/i;
  for (const file of collectTsFiles(dirs)) {
    if (!/(\w*Functions|transport|apiRequest|helpers?|utils?)\.ts$/i.test(file) && !/\/transport\//.test(file)) {
      continue;
    }
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    for (const m of text.matchAll(prefixRe)) {
      let expr = m[1].replace(/\s+as\s+\w+/g, '').replace(/[()]/g, '').trim();
      const segs = expr.split('.').map((s) => s.trim());
      let token = segs[segs.length - 1];
      if (token === 'credentials' && segs.length > 1) token = segs[segs.length - 2];
      if (!HOSTY.test(token)) continue;
      let pathPart = (m[2] ?? '').replace(/\/+$/, '');
      const tpl = `https://{host}${pathPart}`;
      prefixCandidates.set(tpl, (prefixCandidates.get(tpl) ?? 0) + 1);
    }
  }
  if (prefixCandidates.size) {
    const [baseUrl] = Array.from(prefixCandidates.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].length - b[0].length,
    )[0];
    return { baseUrl, placeholders: ['host'] };
  }

  // Last resort: apps whose OPERATION files template the credential host into
  // each request url themselves (Databricks `url: `${host}/api/2.0/...``).
  // convertUrlExpr strips the leading host token from the endpoint paths, so
  // the matching base is the bare templated host.
  let hostHits = 0;
  for (const file of collectTsFiles(dirs)) {
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    for (const m of text.matchAll(/[`]\$\{([^}]{1,80})\}\//g)) {
      let expr = m[1].replace(/\s+as\s+\w+/g, '').replace(/[()]/g, '').trim();
      const segs = expr.split('.').map((s) => s.trim());
      let token = segs[segs.length - 1];
      if (token === 'credentials' && segs.length > 1) token = segs[segs.length - 2];
      if (!HOSTY.test(token)) continue;
      hostHits++;
    }
  }
  if (hostHits >= 2) return { baseUrl: 'https://{host}', placeholders: ['host'] };
  return undefined;
}

const DENY_BASE_TOKENS = /^(endpoint|resource|path|uri|url|query|qs|service|method|version|id)$/i;

function baseUrlTokens(u: string): string[] {
  return Array.from(u.matchAll(/\{(\w+)\}/g)).map((m) => m[1]);
}

/** A usable base URL: https?, no `{?}` residue, no per-call tokens. */
function isUsableBaseUrl(u: string | undefined): u is string {
  if (!u || !/^https?:\/\//.test(u)) return false;
  if (u.includes('{?}') || u.includes('{{')) return false;
  for (const t of baseUrlTokens(u)) if (DENY_BASE_TOKENS.test(t)) return false;
  return true;
}

function trimCredentialBaseUrl(u: string): string | undefined {
  try {
    const url = new URL(u);
    const segs = url.pathname.split('/').filter(Boolean);
    if (segs.length === 0) return url.origin;
    if (/^v\d+(\.\d+)?$/.test(segs[0])) return `${url.origin}/${segs[0]}`;
    return url.origin;
  } catch {
    return undefined;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Credentials → auth
// ───────────────────────────────────────────────────────────────────────────

type CredInfo = {
  name?: string;
  extendsList?: string[];
  authenticate?: any;
  testBaseUrl?: string;
  hasUserPass?: boolean;
};

const credentialFileIndex: Map<string, string> = new Map(); // lowercased cred name → file

function buildCredentialIndex(): void {
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(CREDENTIALS_DIR).filter((f) => f.endsWith('.credentials.ts'));
  } catch {
    return;
  }
  for (const f of entries) {
    const base = f.replace(/\.credentials\.ts$/, '');
    const credName = base[0].toLowerCase() + base.slice(1);
    credentialFileIndex.set(credName.toLowerCase(), path.join(CREDENTIALS_DIR, f));
  }
}

const credCache = new Map<string, CredInfo | undefined>();

function loadCredential(credName: string): CredInfo | undefined {
  const key = credName.toLowerCase();
  if (credCache.has(key)) return credCache.get(key);
  const file = credentialFileIndex.get(key);
  if (!file) {
    credCache.set(key, undefined);
    return undefined;
  }
  let info: CredInfo | undefined;
  try {
    const exports = loadModule(file);
    const Cls = pickExportedClass(exports);
    if (Cls) {
      const inst: any = new Cls();
      const sanitized = sanitize({
        name: inst.name,
        extends: inst.extends,
        authenticate: inst.authenticate,
        testBaseUrl: inst?.test?.request?.baseURL,
        properties: Array.isArray(inst.properties)
          ? inst.properties.map((p: any) => ({ name: p?.name, type: p?.type }))
          : [],
      });
      const props: Array<{ name?: string }> = sanitized.properties ?? [];
      info = {
        name: typeof sanitized.name === 'string' ? sanitized.name : undefined,
        extendsList: Array.isArray(sanitized.extends) ? sanitized.extends : undefined,
        authenticate: sanitized.authenticate,
        testBaseUrl: typeof sanitized.testBaseUrl === 'string' ? sanitized.testBaseUrl : undefined,
        hasUserPass:
          props.some((p) => p.name === 'username' || p.name === 'user' || p.name === 'email') &&
          props.some((p) => p.name === 'password'),
      };
    }
  } catch {
    info = undefined;
  }
  credCache.set(key, info);
  return info;
}

function deriveAuthFromCredential(credName: string, presetId: string): PresetAuth {
  const credType = snake(presetId.replace(/^n8n-/, ''));
  if (/oauth2/i.test(credName)) return { type: 'oauth2', credentialType: credType };
  const info = loadCredential(credName);
  if (!info) {
    return { type: 'bearer', credentialType: credType };
  }
  if (info.extendsList?.some((e) => /oAuth2/i.test(e))) return { type: 'oauth2', credentialType: credType };

  const auth = info.authenticate;
  const props = auth?.properties;
  if (props && typeof props === 'object') {
    const headers = props.headers;
    if (headers && typeof headers === 'object') {
      const keys = Object.keys(headers);
      if (keys.length) {
        const headerName = keys[0];
        const val = String(headers[headerName] ?? '');
        const schemeMatch = val.match(/^=?\s*([A-Za-z][A-Za-z-]*)\s+\{\{/);
        if (/basic/i.test(val)) return { type: 'basic', credentialType: credType };
        if (schemeMatch) {
          const scheme = schemeMatch[1];
          if (headerName === 'Authorization' && scheme === 'Bearer') {
            return { type: 'bearer', credentialType: credType };
          }
          return { type: 'bearer', credentialType: credType, header: headerName, scheme };
        }
        return { type: 'header', credentialType: credType, header: headerName };
      }
    }
    const qs = props.qs;
    if (qs && typeof qs === 'object') {
      const keys = Object.keys(qs);
      if (keys.length) return { type: 'query_token', credentialType: credType, queryParam: keys[0] };
    }
    const authObj = props.auth;
    if (authObj && typeof authObj === 'object') {
      return { type: 'basic', credentialType: credType };
    }
  }
  if (info.hasUserPass) return { type: 'basic', credentialType: credType };
  return { type: 'bearer', credentialType: credType };
}

// ───────────────────────────────────────────────────────────────────────────
// Per-app preset building
// ───────────────────────────────────────────────────────────────────────────

type AppReport = {
  id: string;
  app: string;
  loadMethod: string;
  endpoints: number;
  fields: number;
  verifiedPaths: number;
  unverifiedPaths: number;
  baseUrl: string;
  baseUrlSource: string;
  wrote: boolean;
  skipReason?: string;
};

function readExistingPreset(id: string): AppPreset | undefined {
  const p = path.join(PRESETS_DIR, `${id}.json`);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return undefined;
  }
}

const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  [/crm|sales|lead|pipedrive|hubspot/i, 'CRM'],
  [/mail|email|smtp|newsletter/i, 'Email'],
  [/chat|message|slack|discord|telegram|sms/i, 'Communication'],
  [/calendar|schedul|booking/i, 'Scheduling'],
  [/sheet|table|database|airtable|baserow/i, 'Data'],
  [/file|storage|drive|s3|drop/i, 'Storage'],
  [/pay|invoice|billing|stripe|finance|account/i, 'Finance'],
  [/market|ads|analytics|seo/i, 'Marketing'],
  [/develop|git|deploy|ci|code|issue/i, 'DevOps'],
  [/task|project|todo|productiv/i, 'Productivity'],
  [/form|survey/i, 'Forms'],
  [/social|twitter|facebook|linkedin|instagram/i, 'Social'],
  [/ecommerce|commerce|shop|order/i, 'Commerce'],
  [/support|ticket|desk/i, 'Support'],
  [/hr|recruit|people/i, 'HR'],
  [/ai|ml|vision|language|transcri/i, 'AI'],
];

function deriveCategory(name: string, description: string | undefined, existing?: string): string {
  if (existing && existing !== 'Imported (n8n)') return existing;
  const hay = `${name} ${description ?? ''}`;
  for (const [re, cat] of CATEGORY_KEYWORDS) if (re.test(hay)) return cat;
  return 'Imported (n8n)';
}

function buildEndpointsForApp(
  desc: any,
  programmatic: ProgrammaticMap,
): { endpoints: PresetEndpoint[]; verified: number; unverified: number } {
  const properties: N8nProp[] = Array.isArray(desc.properties) ? desc.properties : [];
  const resourceProp = properties.find((p) => p?.name === 'resource' && Array.isArray(p?.options));
  const resources: Array<{ value: string; name?: string }> = (resourceProp?.options ?? [])
    .filter((o: any) => typeof o?.value === 'string')
    .map((o: any) => ({ value: o.value, name: typeof o.name === 'string' ? o.name : undefined }));

  // hidden single-resource apps: resource prop type 'hidden' with string default
  let defaultResource = 'default';
  const hiddenResource = properties.find((p) => p?.name === 'resource' && p?.type === 'hidden');
  if (hiddenResource && typeof hiddenResource.default === 'string') defaultResource = hiddenResource.default;

  const opProps = properties.filter((p) => p?.name === 'operation' && Array.isArray(p?.options));
  const fieldProps = properties.filter((p) => p?.name !== 'resource' && p?.name !== 'operation');

  type Combo = {
    resource: string;
    resourceLabel?: string;
    operation: string;
    opMeta: N8nProp;
  };
  const combos: Combo[] = [];
  const seen = new Set<string>();

  for (const opProp of opProps) {
    const gated = showArray(opProp, 'resource');
    const applicable = gated ?? (resources.length ? resources.map((r) => r.value) : [defaultResource]);
    for (const op of opProp.options ?? []) {
      if (typeof op?.value !== 'string') continue;
      for (const res of applicable) {
        const k = `${res} ${op.value}`;
        if (seen.has(k)) continue;
        seen.add(k);
        combos.push({
          resource: res,
          resourceLabel: resources.find((r) => r.value === res)?.name,
          operation: op.value,
          opMeta: op,
        });
      }
    }
  }

  const endpoints: PresetEndpoint[] = [];
  let verified = 0;
  let unverified = 0;
  const usedIds = new Set<string>();

  for (const combo of combos) {
    const { resource, operation, opMeta } = combo;

    // HTTP mapping: declarative routing first
    let method: PresetHttpMethod | undefined;
    let epPath: string | undefined;
    let pathVerified = false;

    const routing = opMeta?.routing?.request;
    if (routing && typeof routing === 'object') {
      const rm = typeof routing.method === 'string' ? routing.method.toUpperCase() : undefined;
      const ru = typeof routing.url === 'string' ? routing.url : undefined;
      if (rm && HTTP_METHODS.has(rm) && ru) {
        method = rm as PresetHttpMethod;
        const conv = convertUrlExpr(ru, { resource, operation });
        epPath = conv.path;
        pathVerified = conv.verified;
      }
    }

    // programmatic map
    if (!epPath) {
      const hit =
        programmatic.get(mapKey(resource, operation)) ??
        // handler classes without a resource prefix apply to the app's
        // primary resource (Todoist's bare `CreateHandler` → task create)
        programmatic.get(mapKey('*', operation)) ??
        programmatic.get(mapKey('default', operation));
      if (hit) {
        method = hit.method;
        epPath = hit.path;
        pathVerified = hit.verified;
      }
    }

    // heuristic fallback
    if (!epPath) {
      method = methodHeuristic(operation);
      epPath = `/${kebab(resource === 'default' ? operation : resource)}`;
      pathVerified = false;
    }
    if (!method) method = methodHeuristic(operation);

    // fields
    const fields: PresetField[] = [];
    const fieldIds = new Set<string>();
    for (const fp of fieldProps) {
      if (!appliesTo(fp, resource, operation)) continue;
      const f = mapField(fp);
      if (!f) continue;
      if (fieldIds.has(f.id)) continue;
      fieldIds.add(f.id);
      // explicit path location when the placeholder appears in the path
      if (!f.in && epPath.includes(`{${f.id}}`)) f.in = 'path';
      fields.push(f);
    }

    // endpoint id
    let id = resource === 'default' ? snake(operation) : snake(`${resource}_${operation}`);
    if (!id) id = 'execute';
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}_${n}`)) n++;
      id = `${id}_${n}`;
    }
    usedIds.add(id);

    const opName = typeof opMeta.name === 'string' ? opMeta.name : titleCase(operation);
    const resourceLabel = combo.resourceLabel ?? (resource === 'default' ? undefined : titleCase(resource));
    const label = resourceLabel ? `${opName} ${resourceLabel}` : opName;

    const baseDesc =
      typeof opMeta.description === 'string'
        ? stripHtml(opMeta.description)
        : typeof opMeta.action === 'string'
          ? stripHtml(opMeta.action)
          : undefined;

    const ep: PresetEndpoint = {
      id,
      label,
      method,
      path: epPath,
      fields,
    };
    if (resourceLabel) ep.group = resourceLabel;
    if (pathVerified) {
      if (baseDesc) ep.description = baseDesc;
      verified++;
    } else {
      ep.description = `[unverified path] ${baseDesc ?? ''}`.trim();
      unverified++;
    }
    endpoints.push(ep);
  }

  return { endpoints, verified, unverified };
}

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────

function main(): void {
  if (!fs.existsSync(NODES_DIR)) throw new Error(`n8n nodes dir not found: ${NODES_DIR}`);
  if (!fs.existsSync(PRESETS_DIR)) throw new Error(`presets dir not found: ${PRESETS_DIR}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  buildCredentialIndex();

  let nodes = discoverNodes();
  if (ONLY_APPS) {
    nodes = nodes.filter(
      (n) =>
        ONLY_APPS.has(path.basename(n.appDir).toLowerCase()) || ONLY_APPS.has(n.baseName.toLowerCase()),
    );
  }
  if (Number.isFinite(LIMIT)) nodes = nodes.slice(0, LIMIT as number);
  console.log(`Discovered ${nodes.length} candidate node files.`);

  const today = new Date().toISOString().slice(0, 10);
  const reports: AppReport[] = [];
  const excluded: Array<{ app: string; reason: string }> = [];
  let processed = 0;

  for (const entry of nodes) {
    processed++;
    if (processed % 25 === 0) console.log(`  …${processed}/${nodes.length}`);
    const appLabel = path.relative(NODES_DIR, entry.nodeFile);

    if (EXCLUDED_NODES.has(entry.baseName.toLowerCase())) {
      excluded.push({ app: appLabel, reason: 'deny-list (non-REST / utility / protocol / db)' });
      continue;
    }

    let acquired: AcquiredDescription | undefined;
    try {
      acquired = acquireDescription(entry);
    } catch (err) {
      acquired = undefined;
      if (VERBOSE) console.warn(`  [acquire-fail] ${appLabel}: ${(err as Error).message.split('\n')[0]}`);
    }
    if (!acquired) {
      excluded.push({ app: appLabel, reason: 'description-load-failed' });
      continue;
    }
    const desc = acquired.description;
    const nodeName: string | undefined =
      typeof desc.name === 'string' && desc.name ? desc.name : typeof desc.displayName === 'string' ? desc.displayName : undefined;
    if (!nodeName) {
      excluded.push({ app: appLabel, reason: 'no-name' });
      continue;
    }
    const id = `n8n-${kebab(nodeName)}`;
    const existing = readExistingPreset(id);

    // REST check: must have credentials or a base URL trail
    const credName: string | undefined = Array.isArray(desc.credentials)
      ? desc.credentials.find((c: any) => typeof c?.name === 'string')?.name
      : undefined;

    // build endpoints
    const resourceValues: string[] = (
      (Array.isArray(desc.properties) ? desc.properties : []).find(
        (p: any) => p?.name === 'resource' && Array.isArray(p?.options),
      )?.options ?? []
    )
      .map((o: any) => o?.value)
      .filter((v: unknown): v is string => typeof v === 'string');
    const programmatic = buildProgrammaticMap(acquired.versionDir, entry.appDir, resourceValues);
    const built = buildEndpointsForApp(desc, programmatic);
    const { endpoints, verified, unverified } = applyEndpointOverrides(
      id,
      built.endpoints,
      built.verified,
      built.unverified,
    );

    if (endpoints.length === 0) {
      // either no operations at all, or every operation was override-deleted
      // as non-HTTP — remove any stale preset so nothing fake remains.
      const stale = path.join(PRESETS_DIR, `${id}.json`);
      if (built.endpoints.length > 0 && !DRY_RUN && fs.existsSync(stale)) fs.unlinkSync(stale);
      excluded.push({
        app: appLabel,
        reason:
          built.endpoints.length > 0
            ? 'all operations non-HTTP (override-deleted; preset removed)'
            : 'no-operations',
      });
      continue;
    }

    // baseUrl resolution
    let baseUrl = '';
    let baseUrlSource = 'none';
    const reqBase = desc?.requestDefaults?.baseURL;
    if (typeof reqBase === 'string' && reqBase.startsWith('https://') && !reqBase.includes('{{')) {
      baseUrl = reqBase.replace(/\/+$/, '');
      baseUrlSource = 'requestDefaults';
    }
    if (!baseUrl) {
      // Scan product-scoped dirs first (recursive); the top app folder can
      // host several products (Microsoft/*, Google/*) so it only contributes
      // its immediate files (shared GenericFunctions) as a last scan tier.
      const scanned =
        scanDirForBaseUrl([acquired.versionDir, path.dirname(entry.nodeFile)]) ??
        scanDirForBaseUrl([entry.appDir], 0);
      if (scanned) {
        baseUrl = scanned;
        baseUrlSource = 'generic-functions-scan';
      }
    }
    if (!baseUrl && credName) {
      const cred = loadCredential(credName);
      if (cred?.testBaseUrl) {
        const trimmed = trimCredentialBaseUrl(cred.testBaseUrl);
        if (trimmed) {
          baseUrl = trimmed;
          baseUrlSource = 'credentials-test';
        }
      }
    }
    // overrides beat scans for the curated big apps (scan can pick a sub-path)
    if (BASE_URL_OVERRIDES[id] && baseUrlSource !== 'requestDefaults') {
      baseUrl = BASE_URL_OVERRIDES[id];
      baseUrlSource = 'override';
    }
    // credential-templated host (e.g. `https://{subdomain}.zendesk.com/api/v2`)
    if (!baseUrl) {
      const templated = findTemplatedBaseUrl([acquired.versionDir, path.dirname(entry.nodeFile)]);
      if (templated && isUsableBaseUrl(templated.baseUrl)) {
        baseUrl = templated.baseUrl;
        baseUrlSource = 'templated-host';
      }
    }
    if (!baseUrl && isUsableBaseUrl(existing?.baseUrl)) {
      baseUrl = existing!.baseUrl;
      baseUrlSource = 'existing-preset';
    }
    if (!isUsableBaseUrl(baseUrl)) {
      baseUrl = '';
      baseUrlSource = 'none';
    }

    // Placeholder host tokens → synthesize a required path-field per token on
    // every endpoint (exec.ts resolves `{x}` across `baseUrl + path`).
    const hostTokens = baseUrl ? baseUrlTokens(baseUrl) : [];
    if (hostTokens.length) {
      const appTitle = typeof desc.displayName === 'string' ? desc.displayName : nodeName;
      for (const ep of endpoints) {
        for (const ph of hostTokens) {
          const existingField = ep.fields.find((x) => x.id === ph);
          if (existingField) {
            existingField.in = 'path';
            existingField.required = true;
            continue;
          }
          ep.fields.unshift({
            id: ph,
            label: titleCase(ph),
            type: 'text',
            required: true,
            in: 'path',
            description:
              ph === 'host'
                ? `Host of your ${appTitle} server, e.g. app.example.com (no https:// prefix)`
                : `${titleCase(ph)} of your ${appTitle} account (host token in the API base URL)`,
          });
        }
      }
    }

    // auth: AWS SigV4 services and credential-hosted apps get explicit wiring
    // (bypassing the preserve-existing rule — their old auth was a generic
    // placeholder); otherwise preserve curated auth when present, else derive.
    let auth: PresetAuth;
    const awsService = AWS_SERVICE_BY_ID[id];
    const credHosted = CREDENTIAL_BASE_URL_APPS[id];
    if (awsService) {
      auth = { type: 'aws_sigv4', credentialType: 'aws', awsService };
      baseUrl = '';
      baseUrlSource = 'aws-host-template';
    } else if (credHosted && !baseUrl) {
      auth = credName
        ? deriveAuthFromCredential(credName, id)
        : { type: 'bearer', credentialType: snake(id.replace(/^n8n-/, '')) };
      if (credHosted.credentialType) auth.credentialType = credHosted.credentialType;
      auth.baseUrlFromCredential = credHosted.credentialKey;
      baseUrlSource = 'credential-baseUrl';
    } else if (existing?.auth && existing.auth.type && existing.auth.type !== 'none') {
      auth = existing.auth;
    } else if (credName) {
      auth = deriveAuthFromCredential(credName, id);
    } else {
      auth = { type: 'none' };
    }

    const fieldsTotal = endpoints.reduce((acc, e) => acc + e.fields.length, 0);
    const report: AppReport = {
      id,
      app: appLabel,
      loadMethod: acquired.loadMethod,
      endpoints: endpoints.length,
      fields: fieldsTotal,
      verifiedPaths: verified,
      unverifiedPaths: unverified,
      baseUrl,
      baseUrlSource,
      wrote: false,
    };

    // Presets whose base URL resolves at RUN time (credential instance URL or
    // AWS service+region host template) are complete without a static baseUrl.
    const runtimeResolvableBase =
      Boolean(auth.baseUrlFromCredential) ||
      (auth.type === 'aws_sigv4' && Boolean(auth.awsService));

    if (!baseUrl && !runtimeResolvableBase) {
      report.skipReason = 'no-resolvable-baseUrl (credential-templated host or undiscoverable)';
      // Repair pollution: if a previous extractor run wrote an unusable
      // placeholder base into this preset, blank it so the audit reclassifies
      // it as repairable instead of falsely-live.
      if (existing && existing.baseUrl && !isUsableBaseUrl(existing.baseUrl) && !DRY_RUN) {
        existing.baseUrl = '';
        fs.writeFileSync(path.join(PRESETS_DIR, `${id}.json`), JSON.stringify(existing, null, 2) + '\n', 'utf-8');
      }
      reports.push(report);
      continue;
    }

    const preset: AppPreset = {
      id,
      name: typeof desc.displayName === 'string' && desc.displayName ? desc.displayName : titleCase(nodeName),
      description: typeof desc.description === 'string' ? desc.description : existing?.description,
      category: deriveCategory(
        String(desc.displayName ?? nodeName),
        typeof desc.description === 'string' ? desc.description : undefined,
        existing?.category,
      ),
      iconName: existing?.iconName ?? 'LuPackage',
      version: (existing?.version ?? 0) + 1,
      lastVerified: today,
      status: 'draft',
      auth,
      baseUrl,
      endpoints,
    };

    // Idempotent re-runs: if nothing changed besides version/lastVerified,
    // keep the existing stamp instead of churning every file on each run.
    if (existing) {
      const normalize = (p: any) => JSON.stringify({ ...p, version: 0, lastVerified: '' });
      if (normalize(preset) === normalize(existing)) {
        preset.version = existing.version;
        preset.lastVerified = existing.lastVerified;
      }
    }

    if (!DRY_RUN) {
      fs.writeFileSync(path.join(PRESETS_DIR, `${id}.json`), JSON.stringify(preset, null, 2) + '\n', 'utf-8');
    }
    report.wrote = true;
    reports.push(report);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const wrote = reports.filter((r) => r.wrote);
  const totalEndpoints = wrote.reduce((a, r) => a + r.endpoints, 0);
  const totalFields = wrote.reduce((a, r) => a + r.fields, 0);
  const totalVerified = wrote.reduce((a, r) => a + r.verifiedPaths, 0);
  const totalUnverified = wrote.reduce((a, r) => a + r.unverifiedPaths, 0);
  const biggest = [...wrote].sort((a, b) => b.endpoints - a.endpoints).slice(0, 10);

  const summary = {
    generatedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    appsProcessed: nodes.length,
    appsWritten: wrote.length,
    appsSkippedNoBaseUrl: reports.filter((r) => r.skipReason).length,
    appsExcluded: excluded.length,
    totalEndpoints,
    totalFields,
    avgEndpointsPerApp: wrote.length ? Number((totalEndpoints / wrote.length).toFixed(1)) : 0,
    verifiedPaths: totalVerified,
    unverifiedPaths: totalUnverified,
    unverifiedPct: totalEndpoints
      ? Number(((totalUnverified / (totalVerified + totalUnverified)) * 100).toFixed(1))
      : 0,
    vmModuleLoads: { ok: vmLoadOk, failed: vmLoadFail },
    biggestApps: biggest.map((b) => ({ id: b.id, endpoints: b.endpoints, fields: b.fields })),
  };

  for (const t of triggerSkips) {
    excluded.push({ app: t, reason: 'trigger-only (event source, not a REST action catalog)' });
  }
  (summary as any).appsExcluded = excluded.length;
  (summary as any).triggerOnlySkipped = triggerSkips.length;

  const fullReport = { summary, apps: reports, excluded };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(fullReport, null, 2) + '\n', 'utf-8');

  console.log('');
  console.log('── n8n-extract-full summary ──');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report: ${path.relative(REPO_ROOT, REPORT_PATH)}`);
}

main();
