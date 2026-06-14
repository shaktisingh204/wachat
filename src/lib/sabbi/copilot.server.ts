import 'server-only';

/**
 * SabBI AI copilot — natural language → MetricQuery, grounded on a governed
 * model.
 *
 * The model's measure/dimension/segment KEYS are the only vocabulary the LLM is
 * allowed to use, and the output is validated against them before it ever runs.
 * This is the semantic-layer-grounding pattern: a failure is an explicit error,
 * never a plausible-but-wrong query against raw columns. Reuses the suite's
 * provider ladder (`generateSabcrmText`: AI Gateway → Anthropic → OpenAI).
 */
import { generateSabcrmText } from '@/lib/sabcrm/ai-llm.server';
import type { BiModelDoc, MetricQueryInput } from '@/lib/rust-client/bi-models';

export type CopilotResult =
  | { ok: true; query: MetricQueryInput; answer: string }
  | { ok: false; error: string };

function buildSystem(model: BiModelDoc): string {
  const measures = (model.measures ?? [])
    .map((m) => `- ${m.key}: ${m.label} (${m.agg}${m.column ? ` of ${m.column}` : ''})`)
    .join('\n');
  const dimensions = (model.dimensions ?? [])
    .map((d) => `- ${d.key}: ${d.label} (${d.kind}, column "${d.column}")`)
    .join('\n');
  const segments = (model.segments ?? []).map((s) => `- ${s.key}: ${s.label}`).join('\n') || '(none)';

  return [
    "You are SabBI's analytics copilot. Translate the user's question into a MetricQuery against ONE governed model.",
    `Model: "${model.name}" over collection "${model.collection}".`,
    '',
    'MEASURES (use these keys in "measures"):',
    measures || '(none)',
    '',
    'DIMENSIONS (use these keys in "dimensions"; use the column for filters):',
    dimensions || '(none)',
    '',
    'SEGMENTS (named reusable filters; use these keys in "segments"):',
    segments,
    '',
    'Output ONLY a JSON object, no prose, no code fences:',
    '{"measures":[keys],"dimensions":[keys],"segments":[keys],"filters":[{"column":"<dimension column>","op":"eq|ne|gt|gte|lt|lte|contains","value":<value>}],"chartType":"bar|line|pie|kpi|table","answer":"one short sentence describing the chart"}',
    '',
    'Rules:',
    '- Use ONLY the keys listed above. Never invent keys or columns.',
    '- Pick a sensible chartType: a date dimension → "line"; one category dimension → "bar"; no dimension → "kpi"; a ranking/top-N → "bar"; raw rows → "table".',
    '- Include at least one measure (or a count measure) unless the user explicitly wants raw rows.',
    '- If the question cannot be answered with this model, output {"error":"<reason>"}.',
  ].join('\n');
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in response');
  return JSON.parse(body.slice(start, end + 1));
}

/** Translate a NL question into a validated MetricQuery for `model`. */
export async function nlToMetricQuery(
  model: BiModelDoc,
  question: string,
): Promise<CopilotResult> {
  const res = await generateSabcrmText({
    system: buildSystem(model),
    prompt: question,
    maxTokens: 700,
  });
  if (!res.ok) return { ok: false, error: res.error };

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(res.text) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Couldn't parse the AI response into a query." };
  }
  if (typeof parsed.error === 'string') return { ok: false, error: parsed.error };

  const measureKeys = new Set((model.measures ?? []).map((m) => m.key));
  const dimKeys = new Set((model.dimensions ?? []).map((d) => d.key));
  const segKeys = new Set((model.segments ?? []).map((s) => s.key));

  const measures = (Array.isArray(parsed.measures) ? parsed.measures : []).filter(
    (k): k is string => typeof k === 'string' && measureKeys.has(k),
  );
  const dimensions = (Array.isArray(parsed.dimensions) ? parsed.dimensions : []).filter(
    (k): k is string => typeof k === 'string' && dimKeys.has(k),
  );
  const segments = (Array.isArray(parsed.segments) ? parsed.segments : []).filter(
    (k): k is string => typeof k === 'string' && segKeys.has(k),
  );
  const filters = (Array.isArray(parsed.filters) ? parsed.filters : []).filter(
    (f): f is { column: string; op: string; value: unknown } =>
      !!f && typeof (f as { column?: unknown }).column === 'string',
  );
  const allowedTypes = new Set(['bar', 'line', 'pie', 'kpi', 'table']);
  const chartType = (typeof parsed.chartType === 'string' && allowedTypes.has(parsed.chartType)
    ? parsed.chartType
    : 'bar') as MetricQueryInput['chartType'];

  if (measures.length === 0 && dimensions.length === 0) {
    return { ok: false, error: 'The AI did not produce a usable query for this model.' };
  }

  return {
    ok: true,
    query: { modelId: model._id, measures, dimensions, segments, filters, chartType, limit: 100 },
    answer: typeof parsed.answer === 'string' ? parsed.answer : 'Here is the chart.',
  };
}
