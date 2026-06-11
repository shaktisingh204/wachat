/**
 * SabFlow — n8n descriptor → app-preset bulk importer (Wave A3).
 *
 * Reads every `*.node.ts` under `n8n-master/packages/nodes-base/nodes/` and
 * emits a draft `AppPreset` JSON for each one into
 * `src/lib/sabflow/app-presets/n8n-<id>.json`.
 *
 * Output presets are flagged `status: "draft"` and prefixed `n8n-` so they
 * never collide with the hand-curated catalog. Triggers and test files are
 * skipped. AST parsing (TypeScript Compiler API) is preferred; failures fall
 * back to a regex parser before being logged as a failure.
 *
 * Usage:
 *   npx tsx scripts/n8n-to-preset.ts                # default: skip-existing
 *   npx tsx scripts/n8n-to-preset.ts --dry-run      # count only
 *   npx tsx scripts/n8n-to-preset.ts --limit 50     # cap to first N
 *   npx tsx scripts/n8n-to-preset.ts --overwrite    # overwrite existing
 *   npx tsx scripts/n8n-to-preset.ts --ids a,b,c    # re-emit ONLY these preset
 *       ids (implies overwrite; only writes when the rebuilt preset gained a
 *       non-empty baseUrl, so a failed repair never clobbers a file)
 *   npx tsx scripts/n8n-to-preset.ts --ids-file scripts/output/sabflow-catalog-audit.json
 *       # same, reading ids from `residualRepairIds` (or a plain JSON array)
 *
 * Base-URL extraction order:
 *   1. `description.requestDefaults.baseURL` (declarative nodes)
 *   2. Hardcoded `https://…` constants in sibling non-test .ts files
 *      (GenericFunctions.ts etc.) on `uri:` / `url:` / `baseURL:` lines —
 *      template literals are cut at the first `${`; candidates must still
 *      carry a complete hostname after the cut.
 */

/* eslint-disable no-console */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

// ───────────────────────────────────────────────────────────────────────────
// Types (mirror src/lib/sabflow/app-presets/types.ts, not imported to keep
// this script standalone — runs via tsx, no compile step).
// ───────────────────────────────────────────────────────────────────────────

type PresetFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'toggle'
  | 'select'
  | 'json'
  | 'password';

type PresetFieldLocation = 'path' | 'query' | 'body' | 'header';

type PresetSelectOption = { value: string; label: string };

type PresetField = {
  id: string;
  label: string;
  type: PresetFieldType;
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  description?: string;
  in?: PresetFieldLocation;
  options?: PresetSelectOption[];
};

type PresetHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type PresetEndpoint = {
  id: string;
  label: string;
  description?: string;
  method: PresetHttpMethod;
  path: string;
  fields: PresetField[];
  outputPath?: string;
};

type PresetAuth = {
  type:
    | 'bearer'
    | 'basic'
    | 'header'
    | 'query_token'
    | 'oauth2'
    | 'aws_sigv4'
    | 'none';
  credentialType?: string;
  header?: string;
  scheme?: string;
  queryParam?: string;
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
// CLI args
// ───────────────────────────────────────────────────────────────────────────

const ARGV = process.argv.slice(2);
const DRY_RUN = ARGV.includes('--dry-run');
const OVERWRITE = ARGV.includes('--overwrite');
const LIMIT = (() => {
  const i = ARGV.indexOf('--limit');
  if (i === -1) return Infinity;
  const n = Number(ARGV[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
})();

/** `--ids a,b,c` / `--ids-file <json>` — re-emit ONLY these preset ids. */
const ONLY_IDS: Set<string> | null = (() => {
  const ids: string[] = [];
  const i = ARGV.indexOf('--ids');
  if (i !== -1 && ARGV[i + 1]) {
    ids.push(...ARGV[i + 1].split(',').map((s) => s.trim()).filter(Boolean));
  }
  const j = ARGV.indexOf('--ids-file');
  if (j !== -1 && ARGV[j + 1]) {
    const raw = JSON.parse(fs.readFileSync(ARGV[j + 1], 'utf-8'));
    const list = Array.isArray(raw) ? raw : raw.residualRepairIds;
    if (!Array.isArray(list)) {
      throw new Error(`--ids-file: expected a JSON array or { residualRepairIds: [...] }`);
    }
    ids.push(...list);
  }
  return ids.length ? new Set(ids) : null;
})();

// ───────────────────────────────────────────────────────────────────────────
// Discovery
// ───────────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..');
const PRESETS_DIR = path.join(REPO_ROOT, 'src/lib/sabflow/app-presets');

function locateN8nNodesDir(): string {
  const candidates = [
    path.join(REPO_ROOT, 'n8n-master/packages/nodes-base/nodes'),
    path.join(REPO_ROOT, '../n8n-master/packages/nodes-base/nodes'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
  }
  throw new Error(
    `Could not locate n8n nodes dir. Tried:\n${candidates.map((c) => '  ' + c).join('\n')}`,
  );
}

function discoverNodeFiles(nodesDir: string): string[] {
  const out: string[] = [];
  const stack: string[] = [nodesDir];
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
        // Skip test dirs, schema dirs, version dirs are kept (they may contain V2 nodes — but those have their own .node.ts; OK).
        if (e.name === '__schema__' || e.name === 'test' || e.name === '__tests__') continue;
        stack.push(full);
        continue;
      }
      if (!e.isFile()) continue;
      if (!e.name.endsWith('.node.ts')) continue;
      if (e.name.endsWith('.test.ts')) continue;
      if (/Trigger\.node\.ts$/.test(e.name)) continue;
      // Skip "credentials-only" descriptors — they don't have a class.
      // Heuristic: filename starts with a capital letter (n8n convention).
      const base = e.name.replace(/\.node\.ts$/, '');
      if (!/^[A-Z]/.test(base)) continue;
      out.push(full);
    }
  }
  return out.sort();
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
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function n8nUrlToPresetPath(url: string): string {
  // Strip n8n-expression wrapper if any.
  let s = url.trim();
  if (s.startsWith('={{') && s.endsWith('}}')) {
    s = s.slice(3, -2);
    // Try to extract a plain "/path/" + $parameter chunks.
    // Common patterns:
    //   "/api/v1/users/" + $parameter["userId"]
    //   `/items/${$parameter.id}`
    s = s.replace(/\$parameter\[["']([^"']+)["']\]/g, '{$1}');
    s = s.replace(/\$parameter\.([a-zA-Z0-9_]+)/g, '{$1}');
    s = s.replace(/\$\{([^}]+)\}/g, (_, inner) => '{' + inner.trim() + '}');
    // Concatenated string literals: "/foo/" + "{x}" + "/bar"
    s = s
      .split('+')
      .map((p) => p.trim().replace(/^["'`]|["'`]$/g, ''))
      .join('');
  } else {
    s = s.replace(/^["'`]|["'`]$/g, '');
  }
  if (!s.startsWith('/')) s = '/' + s;
  return s;
}

// ───────────────────────────────────────────────────────────────────────────
// AST parsing
// ───────────────────────────────────────────────────────────────────────────

type ParsedNodeProperty = {
  name: string;
  displayName?: string;
  description?: string;
  type?: string;
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  options?: Array<{ name?: string; value?: string; routing?: ParsedRouting }>;
  resourceShow?: string[];
  operationShow?: string[];
  routing?: ParsedRouting;
};

type ParsedRouting = {
  request?: {
    method?: string;
    url?: string;
    baseURL?: string;
  };
  send?: {
    type?: string; // 'query' | 'body' | 'header'
    property?: string;
  };
};

type ParsedDescription = {
  displayName?: string;
  name?: string;
  description?: string;
  group?: string[];
  baseURL?: string;
  credentials?: Array<{ name?: string; required?: boolean }>;
  properties: ParsedNodeProperty[];
};

function getStringLiteral(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    // Reconstruct the template literal verbatim so downstream regex (e.g.
    // n8nUrlToPresetPath) can substitute `${...}` → `{...}`.
    let out = node.head.text;
    for (const span of node.templateSpans) {
      out += '${' + span.expression.getText() + '}' + span.literal.text;
    }
    return out;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const l = getStringLiteral(node.left);
    const r = getStringLiteral(node.right);
    if (l !== undefined && r !== undefined) return l + r;
    // Try to render as expression-string for path interpolation downstream.
    return node.getText();
  }
  return undefined;
}

function getBooleanLiteral(node: ts.Node | undefined): boolean | undefined {
  if (!node) return undefined;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

function getNumberLiteral(node: ts.Node | undefined): number | undefined {
  if (!node) return undefined;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  return undefined;
}

function getArrayOfStrings(node: ts.Node | undefined): string[] | undefined {
  if (!node || !ts.isArrayLiteralExpression(node)) return undefined;
  const out: string[] = [];
  for (const el of node.elements) {
    const s = getStringLiteral(el);
    if (s !== undefined) out.push(s);
  }
  return out;
}

function getObjectProperty(
  node: ts.ObjectLiteralExpression,
  name: string,
): ts.Expression | undefined {
  for (const p of node.properties) {
    if (ts.isPropertyAssignment(p)) {
      const key =
        ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)
          ? p.name.text
          : undefined;
      if (key === name) return p.initializer;
    }
    if (ts.isShorthandPropertyAssignment(p) && p.name.text === name) return p.name;
  }
  return undefined;
}

function parseRouting(node: ts.Expression | undefined): ParsedRouting | undefined {
  if (!node || !ts.isObjectLiteralExpression(node)) return undefined;
  const out: ParsedRouting = {};
  const reqExpr = getObjectProperty(node, 'request');
  if (reqExpr && ts.isObjectLiteralExpression(reqExpr)) {
    out.request = {};
    const m = getStringLiteral(getObjectProperty(reqExpr, 'method'));
    if (m) out.request.method = m;
    const u = getStringLiteral(getObjectProperty(reqExpr, 'url'));
    if (u) out.request.url = u;
    const b = getStringLiteral(getObjectProperty(reqExpr, 'baseURL'));
    if (b) out.request.baseURL = b;
  }
  const sendExpr = getObjectProperty(node, 'send');
  if (sendExpr && ts.isObjectLiteralExpression(sendExpr)) {
    out.send = {};
    const t = getStringLiteral(getObjectProperty(sendExpr, 'type'));
    if (t) out.send.type = t;
    const p = getStringLiteral(getObjectProperty(sendExpr, 'property'));
    if (p) out.send.property = p;
  }
  return out;
}

function parsePropertyObject(node: ts.ObjectLiteralExpression): ParsedNodeProperty | undefined {
  const name = getStringLiteral(getObjectProperty(node, 'name'));
  if (!name) return undefined;
  const out: ParsedNodeProperty = { name };
  out.displayName = getStringLiteral(getObjectProperty(node, 'displayName'));
  out.description = getStringLiteral(getObjectProperty(node, 'description'));
  out.type = getStringLiteral(getObjectProperty(node, 'type'));
  out.required = getBooleanLiteral(getObjectProperty(node, 'required'));
  out.placeholder = getStringLiteral(getObjectProperty(node, 'placeholder'));

  const defExpr = getObjectProperty(node, 'default');
  if (defExpr) {
    const s = getStringLiteral(defExpr);
    if (s !== undefined) out.defaultValue = s;
    else {
      const n = getNumberLiteral(defExpr);
      if (n !== undefined) out.defaultValue = n;
      else {
        const b = getBooleanLiteral(defExpr);
        if (b !== undefined) out.defaultValue = b;
      }
    }
  }

  // displayOptions.show.resource / operation
  const displayOpts = getObjectProperty(node, 'displayOptions');
  if (displayOpts && ts.isObjectLiteralExpression(displayOpts)) {
    const show = getObjectProperty(displayOpts, 'show');
    if (show && ts.isObjectLiteralExpression(show)) {
      const res = getObjectProperty(show, 'resource');
      const op = getObjectProperty(show, 'operation');
      const resArr = getArrayOfStrings(res);
      const opArr = getArrayOfStrings(op);
      if (resArr) out.resourceShow = resArr;
      if (opArr) out.operationShow = opArr;
    }
  }

  // routing for fields
  out.routing = parseRouting(getObjectProperty(node, 'routing'));

  // options array (for type === 'options')
  const optsExpr = getObjectProperty(node, 'options');
  if (optsExpr && ts.isArrayLiteralExpression(optsExpr)) {
    const opts: Array<{ name?: string; value?: string; routing?: ParsedRouting }> = [];
    for (const el of optsExpr.elements) {
      if (!ts.isObjectLiteralExpression(el)) continue;
      const o: { name?: string; value?: string; routing?: ParsedRouting } = {};
      const n = getStringLiteral(getObjectProperty(el, 'name'));
      const v = getStringLiteral(getObjectProperty(el, 'value'));
      if (n) o.name = n;
      if (v) o.value = v;
      o.routing = parseRouting(getObjectProperty(el, 'routing'));
      if (o.name !== undefined || o.value !== undefined) opts.push(o);
    }
    out.options = opts;
  }

  return out;
}

function parseDescriptionObject(node: ts.ObjectLiteralExpression): ParsedDescription {
  const out: ParsedDescription = { properties: [] };
  out.displayName = getStringLiteral(getObjectProperty(node, 'displayName'));
  out.name = getStringLiteral(getObjectProperty(node, 'name'));
  out.description = getStringLiteral(getObjectProperty(node, 'description'));

  const group = getObjectProperty(node, 'group');
  if (group && ts.isArrayLiteralExpression(group)) {
    out.group = getArrayOfStrings(group);
  }

  const reqDefaults = getObjectProperty(node, 'requestDefaults');
  if (reqDefaults && ts.isObjectLiteralExpression(reqDefaults)) {
    out.baseURL = getStringLiteral(getObjectProperty(reqDefaults, 'baseURL'));
  }

  const creds = getObjectProperty(node, 'credentials');
  if (creds && ts.isArrayLiteralExpression(creds)) {
    out.credentials = [];
    for (const el of creds.elements) {
      if (!ts.isObjectLiteralExpression(el)) continue;
      const c: { name?: string; required?: boolean } = {};
      const n = getStringLiteral(getObjectProperty(el, 'name'));
      const r = getBooleanLiteral(getObjectProperty(el, 'required'));
      if (n) c.name = n;
      if (r !== undefined) c.required = r;
      out.credentials.push(c);
    }
  }

  const props = getObjectProperty(node, 'properties');
  if (props && ts.isArrayLiteralExpression(props)) {
    for (const el of props.elements) {
      if (!ts.isObjectLiteralExpression(el)) continue;
      const p = parsePropertyObject(el);
      if (p) out.properties.push(p);
    }
  }

  return out;
}

/** Find `description: INodeTypeDescription = { ... }` in a node file. */
function findDescriptionLiteral(source: ts.SourceFile): ts.ObjectLiteralExpression | undefined {
  let found: ts.ObjectLiteralExpression | undefined;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isPropertyDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.name.text === 'description') {
      if (n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
        found = n.initializer;
        return;
      }
    }
    // Some declarative nodes use: `description: INodeTypeDescription = { … }` inside a class.
    // The PropertyDeclaration branch above handles this.
    n.forEachChild(visit);
  };
  visit(source);
  return found;
}

function parseFileAst(filePath: string): ParsedDescription | undefined {
  const sourceText = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const lit = findDescriptionLiteral(sourceFile);
  if (!lit) return undefined;
  return parseDescriptionObject(lit);
}

// ───────────────────────────────────────────────────────────────────────────
// Regex fallback (minimal — just enough to extract displayName + description)
// ───────────────────────────────────────────────────────────────────────────

function parseFileRegex(filePath: string): ParsedDescription | undefined {
  const t = fs.readFileSync(filePath, 'utf-8');
  const dn = t.match(/displayName:\s*['"]([^'"]+)['"]/);
  const nm = t.match(/\n\s*name:\s*['"]([a-zA-Z0-9_]+)['"]/);
  const desc = t.match(/\n\s*description:\s*['"]([^'"]+)['"]/);
  const grp = t.match(/group:\s*\[\s*['"]([^'"]+)['"]/);
  if (!dn && !nm) return undefined;
  return {
    displayName: dn?.[1],
    name: nm?.[1],
    description: desc?.[1],
    group: grp ? [grp[1]] : undefined,
    properties: [],
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Preset builder
// ───────────────────────────────────────────────────────────────────────────

function mapFieldType(n8nType: string | undefined): PresetFieldType {
  switch (n8nType) {
    case 'string':
      return 'text';
    case 'number':
      return 'number';
    case 'boolean':
      return 'toggle';
    case 'options':
    case 'multiOptions':
      return 'select';
    case 'json':
    case 'fixedCollection':
    case 'collection':
      return 'json';
    case 'password':
      return 'password';
    default:
      return 'text';
  }
}

function pickFieldLocation(
  prop: ParsedNodeProperty,
  method: PresetHttpMethod,
  path: string,
): PresetFieldLocation {
  if (prop.routing?.send?.type === 'query') return 'query';
  if (prop.routing?.send?.type === 'body') return 'body';
  if (prop.routing?.send?.type === 'header') return 'header';
  const placeholderToken = '{' + prop.name + '}';
  if (path.includes(placeholderToken)) return 'path';
  if (method === 'POST' || method === 'PATCH' || method === 'PUT') return 'body';
  return 'query';
}

function deriveAuth(parsed: ParsedDescription): PresetAuth {
  const c = parsed.credentials?.[0];
  if (!c?.name) return { type: 'none' };
  const cred = c.name.toLowerCase();
  if (/oauth2/.test(cred)) {
    return { type: 'oauth2', credentialType: 'oauth2' };
  }
  if (/basic/.test(cred)) {
    return { type: 'basic', credentialType: 'http_basic_auth' };
  }
  if (/apikey|api_key|token|bearer|httpheader|http_header/.test(cred)) {
    return { type: 'bearer', credentialType: 'http_header_auth' };
  }
  return { type: 'header', credentialType: 'http_header_auth' };
}

function deriveCategory(parsed: ParsedDescription): string {
  const g = parsed.group?.[0];
  if (!g) return 'Imported (n8n)';
  return titleCase(g);
}

function buildEndpoints(parsed: ParsedDescription): PresetEndpoint[] {
  // Walk the resource and operation matrices.
  // Resource options live on a property with name === 'resource'.
  // Operation options live on each property with name === 'operation', each
  // gated by displayOptions.show.resource = [<resource>].
  const resourceProp = parsed.properties.find((p) => p.name === 'resource');
  const opProps = parsed.properties.filter((p) => p.name === 'operation');

  // (resource, operation) -> { method, path, op metadata }
  type Combo = {
    resource: string;
    operation: string;
    label: string;
    method: PresetHttpMethod;
    path: string;
    fields: PresetField[];
  };
  const combos: Combo[] = [];

  const resources = resourceProp?.options?.map((o) => o.value).filter(Boolean) as
    | string[]
    | undefined;

  if (opProps.length === 0 && (!resources || resources.length === 0)) {
    return [];
  }

  // For each operation property, determine which resources gate it.
  for (const opProp of opProps) {
    const gatedResources = opProp.resourceShow?.length
      ? opProp.resourceShow
      : resources && resources.length
        ? resources
        : ['default'];
    const ops = opProp.options ?? [];
    for (const op of ops) {
      if (!op.value) continue;
      const r = op.routing?.request;
      const method = ((r?.method ?? 'GET').toUpperCase() as PresetHttpMethod) as PresetHttpMethod;
      const validMethods: PresetHttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      const safeMethod: PresetHttpMethod = validMethods.includes(method) ? method : 'GET';
      const rawPath = r?.url ?? '/';
      const presetPath = n8nUrlToPresetPath(rawPath);
      for (const res of gatedResources) {
        const label =
          (op.name ? op.name : titleCase(op.value)) +
          (res && res !== 'default' ? ` ${titleCase(res)}` : '');
        combos.push({
          resource: res,
          operation: op.value,
          label,
          method: safeMethod,
          path: presetPath,
          fields: [],
        });
      }
    }
  }

  // Special-case: when no operations are declared but resources exist, emit a
  // bare "list" endpoint per resource. Better than nothing for the picker.
  if (combos.length === 0 && resources?.length) {
    for (const res of resources) {
      combos.push({
        resource: res,
        operation: 'default',
        label: `List ${titleCase(res)}`,
        method: 'GET',
        path: '/' + res,
        fields: [],
      });
    }
  }

  // Attach fields per combo.
  // A property belongs to (R, O) if its displayOptions either match or are
  // unspecified for that axis.
  const fieldProps = parsed.properties.filter(
    (p) => p.name !== 'resource' && p.name !== 'operation',
  );
  for (const combo of combos) {
    for (const fp of fieldProps) {
      const resOk = !fp.resourceShow || fp.resourceShow.includes(combo.resource);
      const opOk = !fp.operationShow || fp.operationShow.includes(combo.operation);
      if (!resOk || !opOk) continue;

      const ftype = mapFieldType(fp.type);
      const field: PresetField = {
        id: fp.name,
        label: fp.displayName ?? titleCase(fp.name),
        type: ftype,
        in: pickFieldLocation(fp, combo.method, combo.path),
      };
      if (fp.required) field.required = true;
      if (fp.placeholder) field.placeholder = fp.placeholder;
      if (fp.description) field.description = fp.description;
      if (fp.defaultValue !== undefined && fp.defaultValue !== '') {
        field.defaultValue = fp.defaultValue;
      }
      if (ftype === 'select' && fp.options) {
        field.options = fp.options
          .filter((o) => o.value !== undefined)
          .map((o) => ({
            value: String(o.value),
            label: o.name ?? titleCase(String(o.value)),
          }));
      }
      combo.fields.push(field);
    }
  }

  // Reduce to endpoint list. Use snake_case `<resource>_<operation>` id.
  const endpoints: PresetEndpoint[] = combos.map((c) => ({
    id: snake(`${c.resource}_${c.operation}`) || snake(c.operation) || 'execute',
    label: c.label,
    method: c.method,
    path: c.path,
    fields: c.fields,
  }));

  // Dedupe by id (last wins) to avoid clashes when resource axis is single-valued.
  const byId = new Map<string, PresetEndpoint>();
  for (const ep of endpoints) {
    byId.set(ep.id, ep);
  }
  return Array.from(byId.values());
}

/**
 * Fallback base-URL extraction — scan the node's directory (plus a parent
 * `GenericFunctions.ts`, the common n8n layout) for hardcoded `https://…`
 * constants on `uri:` / `url:` / `baseURL:` / `baseUrl =` lines. Template
 * literals are cut at the first `${`; a candidate survives only when the
 * remaining string still carries a complete hostname. The most frequent
 * candidate wins.
 */
function extractFallbackBaseUrl(nodeFilePath: string): string | undefined {
  const dir = path.dirname(nodeFilePath);
  const candidates = new Map<string, number>();
  const files: string[] = [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.ts') && !/test/i.test(e.name)) {
        files.push(path.join(dir, e.name));
      }
    }
  } catch {
    return undefined;
  }
  const parentGeneric = path.join(path.dirname(dir), 'GenericFunctions.ts');
  if (fs.existsSync(parentGeneric)) files.push(parentGeneric);

  const lineRe = /(?:uri|url|baseURL|baseUrl)\s*[:=]/;
  const urlRe = /[`'"](https:\/\/[^`'"]+)[`'"]/g;
  for (const file of files) {
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
      if (!lineRe.test(line)) continue;
      for (const m of line.matchAll(urlRe)) {
        // Cut template interpolation; what remains must still be a full host.
        let url = m[1].split('${')[0];
        if (!/^https:\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/|$)/i.test(url)) continue;
        url = url.replace(/\/+$/, '');
        candidates.set(url, (candidates.get(url) ?? 0) + 1);
      }
    }
  }
  if (!candidates.size) return undefined;
  return Array.from(candidates.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

function buildPreset(parsed: ParsedDescription, nodeFilePath: string): AppPreset | undefined {
  const nodeName = parsed.name ?? parsed.displayName;
  if (!nodeName) return undefined;
  const id = `n8n-${kebab(nodeName)}`;
  const today = new Date().toISOString().slice(0, 10);
  let baseUrl = parsed.baseURL ? sanitizeBaseUrl(parsed.baseURL) : '';
  if (!baseUrl) baseUrl = extractFallbackBaseUrl(nodeFilePath) ?? '';
  return {
    id,
    name: parsed.displayName ?? titleCase(nodeName),
    description: parsed.description,
    category: deriveCategory(parsed),
    iconName: 'LuPackage',
    version: 1,
    lastVerified: today,
    status: 'draft',
    auth: deriveAuth(parsed),
    baseUrl,
    endpoints: buildEndpoints(parsed),
  };
}

function sanitizeBaseUrl(u: string): string {
  // Drop n8n expressions; caller fills in. Keep simple https:// URLs.
  if (u.startsWith('={{')) return '';
  return u.replace(/\/+$/, '');
}

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────

type Failure = { file: string; reason: string };

function main() {
  const nodesDir = locateN8nNodesDir();
  const files = discoverNodeFiles(nodesDir);
  const capped = Number.isFinite(LIMIT) ? files.slice(0, LIMIT) : files;
  console.log(`Discovered ${files.length} node files in ${nodesDir}`);
  if (capped.length < files.length) {
    console.log(`  (processing first ${capped.length} due to --limit)`);
  }
  if (DRY_RUN) console.log(`[DRY-RUN] no files will be written.`);

  if (!fs.existsSync(PRESETS_DIR)) {
    throw new Error(`Presets dir not found: ${PRESETS_DIR}`);
  }

  let parsed = 0;
  let generated = 0;
  let skipped = 0;
  const failures: Failure[] = [];
  const reasonCounts = new Map<string, number>();

  let processed = 0;
  for (const file of capped) {
    processed++;
    if (processed % 50 === 0) {
      console.log(`  …${processed}/${capped.length}`);
    }
    let desc: ParsedDescription | undefined;
    try {
      desc = parseFileAst(file);
    } catch (err) {
      desc = undefined;
    }
    if (!desc) {
      try {
        desc = parseFileRegex(file);
      } catch {
        desc = undefined;
      }
    }
    if (!desc || (!desc.name && !desc.displayName)) {
      failures.push({ file, reason: 'no_description' });
      reasonCounts.set('no_description', (reasonCounts.get('no_description') ?? 0) + 1);
      continue;
    }
    parsed++;

    let preset: AppPreset | undefined;
    try {
      preset = buildPreset(desc, file);
    } catch (err) {
      const reason = `build_error:${(err as Error).message.split('\n')[0]}`;
      failures.push({ file, reason });
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      continue;
    }
    if (!preset) {
      failures.push({ file, reason: 'preset_undefined' });
      reasonCounts.set('preset_undefined', (reasonCounts.get('preset_undefined') ?? 0) + 1);
      continue;
    }

    // --ids mode: re-emit only the requested presets, and only when the
    // rebuild actually produced a usable baseUrl (never clobber otherwise).
    if (ONLY_IDS) {
      if (!ONLY_IDS.has(preset.id)) continue;
      if (!preset.baseUrl) {
        console.log(`  ✗ ${preset.id} — still no extractable baseUrl, leaving as-is`);
        skipped++;
        continue;
      }
      if (!DRY_RUN) {
        const idsOutPath = path.join(PRESETS_DIR, `${preset.id}.json`);
        fs.writeFileSync(idsOutPath, JSON.stringify(preset, null, 2) + '\n', 'utf-8');
      }
      console.log(`  ✓ ${preset.id} — repaired with baseUrl ${preset.baseUrl}`);
      generated++;
      continue;
    }

    const outPath = path.join(PRESETS_DIR, `${preset.id}.json`);
    const exists = fs.existsSync(outPath);
    if (exists && !OVERWRITE) {
      skipped++;
      continue;
    }
    if (!DRY_RUN) {
      fs.writeFileSync(outPath, JSON.stringify(preset, null, 2) + '\n', 'utf-8');
    }
    generated++;
  }

  if (ONLY_IDS) {
    console.log(`--ids mode: requested ${ONLY_IDS.size}, repaired ${generated}, unrepairable ${skipped}.`);
  }

  console.log('');
  console.log(`✓ Parsed ${parsed} node files.`);
  console.log(
    `✓ Generated ${generated} new draft presets (skipped ${skipped} existing, ${failures.length} failures).`,
  );
  if (failures.length) {
    console.log('⚠ Failures by reason:');
    const entries = Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1]);
    for (const [reason, count] of entries) {
      console.log(`    ${reason}: ${count}`);
    }
    console.log('  First 5 failing files:');
    for (const f of failures.slice(0, 5)) {
      console.log(`    ${f.file} (${f.reason})`);
    }
  }
}

main();
