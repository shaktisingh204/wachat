'use strict';

/**
 * Pure WhatsApp send helper used by the broadcast send worker.
 *
 * Extracted from the legacy worker.js (sendWhatsAppMessage) so the same code
 * path can be unit-tested and reused. The most important addition vs. the
 * legacy version is structured error classification:
 *
 *   - PERMANENT  : the contact will never succeed (mark FAILED, don't retry)
 *   - RATE_LIMIT : we are being throttled (back off the whole batch)
 *   - TRANSIENT  : network blip / 5xx (retry the contact, up to MAX_RETRIES)
 *
 * The send worker uses these classes to decide whether to bump the contact's
 * attempts counter and re-enqueue, or to give up immediately.
 */

const undici = require('undici');

const API_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';

// Meta error codes that mean "this contact will never succeed".
// Sourced from https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
const PERMANENT_CODES = new Set([
  100,    // Invalid parameter
  131000, // Generic user error
  131008, // Required parameter missing
  131009, // Parameter value invalid
  131026, // Receiver not on WhatsApp / message undeliverable
  131047, // Re-engagement message (24h window expired)
  131051, // Unsupported message type
  131058, // Media too large
  132000, // Template name does not exist
  132001, // Template language does not exist
  132005, // Translated text too long
  132007, // Character policy violated
  132012, // Parameter format mismatch
  132015, // Template paused
  132016, // Template disabled
  132068, // Flow blocked
  132069, // Flow throttled (treated as permanent — fix the flow, not the broadcast)
  133000, // Re-registration needed
]);

const RATE_LIMIT_CODES = new Set([
  4,      // Application request limit reached
  17,     // User request limit reached
  368,    // Temporarily blocked for policies
  80007,  // Rate limit issues
  130429, // Throughput limit
  131048, // Spam rate limit hit
  131056, // Pair rate limit hit
]);

function interpolateText(text, vars) {
  if (!text || !vars) return text;
  return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (_, k) => {
    const val = vars[k];
    // Zero-width space fallback prevents Meta error #100 on empty params.
    return val !== undefined && val !== null && String(val).trim() !== ''
      ? String(val)
      : '\u200B';
  });
}

function buildPayload(job, contact) {
  const {
    templateName,
    language = 'en_US',
    components,
    headerMediaId,
    headerMediaType,
    broadcastType,
    flowMetaId,
    flowConfig,
    flowName,
    globalBodyVars,
  } = job;

  if (broadcastType === 'flow') {
    return {
      messaging_product: 'whatsapp',
      to: contact.phone,
      recipient_type: 'individual',
      type: 'interactive',
      interactive: {
        type: 'flow',
        header: flowConfig?.header
          ? { type: 'text', text: flowConfig.header }
          : undefined,
        body: { text: flowConfig?.body || 'Open Flow' },
        footer: flowConfig?.footer ? { text: flowConfig.footer } : undefined,
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: contact._id.toString(),
            flow_id: flowMetaId,
            flow_cta: flowConfig?.cta || 'Open App',
            flow_action: 'navigate',
            flow_action_payload: { screen: 'INIT' },
          },
        },
      },
    };
  }

  // Template path. Deep-clone components per contact so per-contact variable
  // interpolation never mutates a shared object across the batch.
  const finalComponents = (components || [])
    .map((c) => (c && c.type === 'BUTTONS' ? { ...c, type: 'BUTTON' } : c))
    .filter((c) => {
      const t = (c && c.type ? String(c.type) : '').toUpperCase();
      return ['HEADER', 'BODY', 'FOOTER', 'BUTTON', 'CAROUSEL'].includes(t);
    })
    .map((c) => JSON.parse(JSON.stringify(c)));

  if (headerMediaId && headerMediaType) {
    const headerIdx = finalComponents.findIndex(
      (c) => c.type === 'HEADER' || c.type === 'header',
    );
    const lower = headerMediaType.toLowerCase();
    const mediaParam = { type: lower, [lower]: { id: headerMediaId } };
    if (headerIdx > -1) {
      finalComponents[headerIdx] = { type: 'header', parameters: [mediaParam] };
    } else {
      finalComponents.unshift({ type: 'header', parameters: [mediaParam] });
    }
  }

  for (const c of finalComponents) {
    delete c.format;
    delete c.text;
    delete c.example;
    delete c.buttons;
    const effectiveVars = { ...(globalBodyVars || {}), ...(contact.variables || {}) };
    for (const p of c.parameters || []) {
      if (p && p.type === 'text') {
        p.text = interpolateText(p.text, effectiveVars);
      }
    }
  }

  return {
    messaging_product: 'whatsapp',
    to: contact.phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: finalComponents,
    },
  };
}

function classifyError(statusCode, apiError) {
  const code = apiError && apiError.code != null ? apiError.code : null;
  if (code != null) {
    if (PERMANENT_CODES.has(code)) return 'PERMANENT';
    if (RATE_LIMIT_CODES.has(code)) return 'RATE_LIMIT';
  }
  if (statusCode === 429) return 'RATE_LIMIT';
  if (statusCode >= 500) return 'TRANSIENT';
  if (statusCode >= 400) return 'PERMANENT';
  return 'TRANSIENT';
}

/**
 * Send one WhatsApp message via the Meta Cloud API.
 *
 * @param {object} job      broadcast document fields used by the sender
 * @param {object} contact  one broadcast_contacts row
 * @param {import('undici').Agent} agent  shared keep-alive dispatcher
 * @returns {Promise<{ok:true,messageId:string,sentPayload:object} | {ok:false,kind:'PERMANENT'|'TRANSIENT'|'RATE_LIMIT',error:string,retryAfterMs?:number}>}
 */
async function sendWhatsAppMessage(job, contact, agent) {
  let payload;
  try {
    payload = buildPayload(job, contact);
  } catch (e) {
    return { ok: false, kind: 'PERMANENT', error: `Payload build failed: ${e.message || e}` };
  }

  let res;
  try {
    res = await undici.request(
      `https://graph.facebook.com/${API_VERSION}/${job.phoneNumberId}/messages`,
      {
        method: 'POST',
        dispatcher: agent,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${job.accessToken}`,
        },
        body: JSON.stringify(payload),
        bodyTimeout: 30000,
        headersTimeout: 30000,
      },
    );
  } catch (e) {
    return { ok: false, kind: 'TRANSIENT', error: `Network: ${e.message || e}` };
  }

  // Honor explicit Retry-After hints from Meta.
  const retryAfterHeader = res.headers && res.headers['retry-after'];
  let retryAfterMs;
  if (retryAfterHeader) {
    const n = Number(Array.isArray(retryAfterHeader) ? retryAfterHeader[0] : retryAfterHeader);
    if (!Number.isNaN(n)) retryAfterMs = n * 1000;
  }

  const text = await res.body.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      kind: res.statusCode >= 500 ? 'TRANSIENT' : 'PERMANENT',
      error: `Non-JSON (${res.statusCode}): ${text.substring(0, 200)}`,
      retryAfterMs,
    };
  }

  if (res.statusCode >= 400 || !data || !data.messages || !data.messages[0] || !data.messages[0].id) {
    const apiError = data && data.error;
    let message;
    if (apiError && typeof apiError === 'object') {
      message = apiError.error_user_title
        ? `${apiError.error_user_title}: ${apiError.error_user_msg}`
        : apiError.message || JSON.stringify(apiError);
      if (apiError.code != null) message += ` (Code: ${apiError.code})`;
      if (apiError.fbtrace_id) message += ` (Trace: ${apiError.fbtrace_id})`;
    } else {
      message = `Meta API error (${res.statusCode}): ${JSON.stringify(data).substring(0, 300)}`;
    }
    return {
      ok: false,
      kind: classifyError(res.statusCode, apiError),
      error: message,
      retryAfterMs,
    };
  }

  return {
    ok: true,
    messageId: data.messages[0].id,
    sentPayload: payload.template || payload.interactive,
  };
}

module.exports = {
  sendWhatsAppMessage,
  buildPayload,
  interpolateText,
  classifyError,
  PERMANENT_CODES,
  RATE_LIMIT_CODES,
  API_VERSION,
};
