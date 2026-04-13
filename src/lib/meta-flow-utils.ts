/**
 * Meta Flow JSON sanitiser.
 *
 * Strips builder-only fields, drops empty optional strings (Meta's
 * validator rejects empty strings on many optional properties),
 * normalises routing_model, and ensures required containers are kept.
 *
 * Targets Flow JSON v7.3 / data_api_version 3.0 but is forward-compatible
 * — it preserves any unknown keys as-is so future components pass through.
 */

const BUILDER_ONLY_KEYS = new Set(['_id', '_builderMeta', '_uiHint']);

// Keys that Meta rejects when sent as "" — strip instead of sending empty.
const STRIP_WHEN_EMPTY = new Set<string>([
    'label', 'description', 'helper-text', 'error-message',
    'title', 'text', 'placeholder', 'alt-text', 'badge',
    'left-caption', 'center-caption', 'right-caption',
    'endpoint_uri',
]);

function isPlainObject(v: unknown): v is Record<string, any> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanNode(node: any): any {
    if (Array.isArray(node)) {
        return node.map(cleanNode).filter((n) => n !== undefined);
    }
    if (!isPlainObject(node)) return node;

    const out: Record<string, any> = {};
    for (const [key, rawValue] of Object.entries(node)) {
        if (BUILDER_ONLY_KEYS.has(key)) continue;

        const value = cleanNode(rawValue);

        if (value === undefined || value === null) continue;
        if (typeof value === 'string' && value === '' && STRIP_WHEN_EMPTY.has(key)) continue;
        if (Array.isArray(value) && value.length === 0) {
            // Keep `children` even when empty — containers require the key.
            // Drop all other empty arrays (data-source, tags, include-days, etc.)
            if (key !== 'children') continue;
        }

        out[key] = value;
    }
    return out;
}

function ensureDefaults(flow: any): any {
    if (!isPlainObject(flow)) return flow;

    const result: Record<string, any> = { ...flow };

    // Default to the newest stable Flow JSON schema if caller forgot.
    if (!result.version) result.version = '7.3';

    // data_api_version is required when any screen uses data_exchange.
    const usesEndpoint = Array.isArray(result.screens) && result.screens.some(screenUsesEndpoint);
    if (usesEndpoint && !result.data_api_version) result.data_api_version = '3.0';

    // Normalise routing_model: every referenced screen should appear as a key.
    if (Array.isArray(result.screens)) {
        const existing = isPlainObject(result.routing_model) ? { ...result.routing_model } : {};
        for (const screen of result.screens) {
            if (screen?.id && !(screen.id in existing)) existing[screen.id] = [];
        }
        result.routing_model = existing;
    }

    return result;
}

function screenUsesEndpoint(screen: any): boolean {
    const stack: any[] = [screen?.layout];
    while (stack.length) {
        const node = stack.pop();
        if (!isPlainObject(node)) continue;
        for (const [k, v] of Object.entries(node)) {
            if (k === 'on-click-action' || k === 'on-select-action' || k === 'on-unselect-action' || k === 'on-blur-action') {
                if (isPlainObject(v) && v.name === 'data_exchange') return true;
            }
            if (Array.isArray(v)) v.forEach((c) => stack.push(c));
            else if (isPlainObject(v)) stack.push(v);
        }
    }
    return false;
}

export function cleanMetaFlowData(flowData: any): any {
    if (!flowData) return flowData;
    const cloned = JSON.parse(JSON.stringify(flowData));
    return ensureDefaults(cleanNode(cloned));
}

/**
 * Light structural check done client-side before hitting Meta.
 * Meta's own validator is authoritative — this is a fast-fail for
 * obvious mistakes (missing terminal screen, unknown version).
 */
export function quickValidateFlow(flowData: any): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!isPlainObject(flowData)) { errors.push('flow JSON must be an object'); return { ok: false, errors }; }
    if (!flowData.version) errors.push('missing "version"');
    if (!Array.isArray(flowData.screens) || flowData.screens.length === 0) errors.push('at least one screen is required');
    if (Array.isArray(flowData.screens)) {
        const terminal = flowData.screens.filter((s: any) => s?.terminal === true);
        if (terminal.length === 0) errors.push('at least one screen must be marked terminal: true');
        if (terminal.length > 1) errors.push('only one screen can be terminal');
        const ids = new Set<string>();
        for (const s of flowData.screens) {
            if (!s?.id) { errors.push('screen missing id'); continue; }
            if (ids.has(s.id)) errors.push(`duplicate screen id: ${s.id}`);
            ids.add(s.id);
        }
    }
    return { ok: errors.length === 0, errors };
}
