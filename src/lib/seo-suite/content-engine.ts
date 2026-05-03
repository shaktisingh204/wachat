/**
 * Content engine: brief → outline → draft pipeline.
 *
 * Heavy lifting is delegated to the existing genkit `ai` instance
 * (see `src/ai/genkit.ts`). When no model is reachable (tests, CI),
 * deterministic fallbacks keep the pipeline functional.
 */
import type { ContentBrief, ContentBriefSection, KeywordIntent } from './types';
import { classifyIntent } from './keyword-research';

export type GenerateBriefInput = {
  topic: string;
  primaryKeyword: string;
  secondaryKeywords?: string[];
  competitors?: string[];
  targetWordCount?: number;
};

export type Outline = {
  brief: ContentBrief;
  headings: { level: 2 | 3; text: string }[];
};

export type Draft = {
  brief: ContentBrief;
  title: string;
  metaDescription: string;
  body: string;
};

/**
 * Optional hook to override the generator (used by tests and to swap genkit
 * for another provider). When null, the pipeline uses a deterministic fallback.
 */
let generator: ((prompt: string) => Promise<string>) | null = null;

export function setContentGenerator(fn: ((prompt: string) => Promise<string>) | null): void {
  generator = fn;
}

async function generate(prompt: string): Promise<string | null> {
  if (generator) return generator(prompt);
  try {
    const { ai } = await import('@/ai/genkit');
    const { output } = await ai.generate(prompt);
    return output?.text ?? null;
  } catch {
    return null;
  }
}

/** Step 1: synthesize a structured brief. */
export async function buildBrief(input: GenerateBriefInput): Promise<ContentBrief> {
  const intent: KeywordIntent = classifyIntent(input.primaryKeyword);
  const targetWordCount = input.targetWordCount ?? defaultWordCount(intent);
  const secondary = (input.secondaryKeywords ?? []).filter(Boolean);
  const competitors = input.competitors ?? [];

  const sections: ContentBriefSection[] = [
    { heading: 'Introduction', level: 2, bullets: [`Hook the reader on "${input.topic}"`, 'State the value proposition'] },
    {
      heading: `What is ${input.primaryKeyword}?`,
      level: 2,
      bullets: ['Define the term plainly', 'Address common misconceptions'],
    },
    {
      heading: `Key benefits of ${input.primaryKeyword}`,
      level: 2,
      bullets: secondary.length ? secondary.map((s) => `Highlight: ${s}`) : ['List 3-5 concrete benefits'],
    },
    { heading: 'How to get started', level: 2, bullets: ['Step-by-step', 'Tools required', 'Common pitfalls'] },
    { heading: 'FAQs', level: 2, bullets: ['Answer 3-5 People-Also-Ask style questions'] },
    { heading: 'Conclusion', level: 2, bullets: ['Recap', 'Call to action'] },
  ];

  return {
    topic: input.topic,
    primaryKeyword: input.primaryKeyword,
    secondaryKeywords: secondary,
    intent,
    targetWordCount,
    sections,
    questions: [
      `What is ${input.primaryKeyword}?`,
      `How does ${input.primaryKeyword} work?`,
      `Why is ${input.primaryKeyword} important?`,
      `Is ${input.primaryKeyword} worth it?`,
    ],
    competitors,
    outline: sections.map((s) => s.heading),
  };
}

/** Step 2: turn the brief into a heading outline. */
export function buildOutline(brief: ContentBrief): Outline {
  const headings: { level: 2 | 3; text: string }[] = [];
  for (const s of brief.sections) {
    headings.push({ level: 2, text: s.heading });
    for (const b of s.bullets) {
      headings.push({ level: 3, text: b });
    }
  }
  return { brief, headings };
}

/** Step 3: generate the draft. Uses the AI generator when available. */
export async function buildDraft(brief: ContentBrief): Promise<Draft> {
  const prompt = renderDraftPrompt(brief);
  const generated = await generate(prompt);
  const body = generated && generated.length > 200 ? generated : fallbackBody(brief);
  return {
    brief,
    title: `${capitalize(brief.primaryKeyword)}: ${brief.topic}`,
    metaDescription: `Learn about ${brief.primaryKeyword}. ${brief.topic} explained in plain language with examples.`.slice(0, 160),
    body,
  };
}

/** Convenience: run the full brief → outline → draft pipeline. */
export async function runContentPipeline(input: GenerateBriefInput): Promise<{ brief: ContentBrief; outline: Outline; draft: Draft }> {
  const brief = await buildBrief(input);
  const outline = buildOutline(brief);
  const draft = await buildDraft(brief);
  return { brief, outline, draft };
}

function renderDraftPrompt(brief: ContentBrief): string {
  return [
    `Write a comprehensive article about "${brief.topic}".`,
    `Primary keyword: ${brief.primaryKeyword}.`,
    brief.secondaryKeywords.length ? `Secondary keywords: ${brief.secondaryKeywords.join(', ')}.` : '',
    `Target word count: ~${brief.targetWordCount}.`,
    `Search intent: ${brief.intent}.`,
    'Use the following outline:',
    ...brief.sections.map((s) => `## ${s.heading}\n${s.bullets.map((b) => `- ${b}`).join('\n')}`),
    '',
    'Write in clear, friendly, expert prose. Avoid filler.',
  ].filter(Boolean).join('\n');
}

function fallbackBody(brief: ContentBrief): string {
  return brief.sections
    .map((s) => `## ${s.heading}\n\n${s.bullets.map((b) => `- ${b}`).join('\n')}\n`)
    .join('\n');
}

function defaultWordCount(intent: KeywordIntent): number {
  switch (intent) {
    case 'transactional': return 800;
    case 'commercial': return 1500;
    case 'navigational': return 400;
    case 'informational':
    default: return 1800;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
