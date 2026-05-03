/**
 * Agent evaluation harness.
 *
 * Datasets are JSON arrays of `{ input, expected, judge }` examples. We
 * support three judges:
 *  - `exact`    — string equality after trim/lowercase
 *  - `contains` — substring match (case-insensitive)
 *  - `llm`      — ask the model whether `actual` satisfies `expected`
 */

import 'server-only';

import { ai } from '@/ai/genkit';
import { runAgent } from './runner';
import type { Agent, AgentEval, EvalResult } from './types';

const LLM_JUDGE_MODEL = 'googleai/gemini-1.5-flash';

export interface RunEvalOptions {
  /** Override eval-time model (e.g. cheaper one). */
  model?: string;
  tenantId?: string;
  userId?: string;
  /** Stop on first failure (useful for CI). */
  stopOnFailure?: boolean;
}

export async function runEval(
  agent: Agent,
  dataset: AgentEval[],
  options: RunEvalOptions = {},
): Promise<EvalResult> {
  const startedAt = Date.now();
  const details: EvalResult['details'] = [];
  let passed = 0;
  let failed = 0;

  for (const ex of dataset) {
    const run = await runAgent(agent.id, ex.input, {
      model: options.model,
      tenantId: options.tenantId,
      userId: options.userId,
    });
    const actual = run.output ?? '';
    const judgement = await judge(ex, actual);
    if (judgement.pass) passed += 1;
    else failed += 1;
    details.push({
      input: ex.input,
      expected: ex.expected,
      actual,
      pass: judgement.pass,
      reason: judgement.reason,
    });
    if (options.stopOnFailure && !judgement.pass) break;
  }

  return {
    agentId: agent.id,
    total: dataset.length,
    passed,
    failed,
    durationMs: Date.now() - startedAt,
    details,
  };
}

async function judge(
  example: AgentEval,
  actual: string,
): Promise<{ pass: boolean; reason?: string }> {
  switch (example.judge) {
    case 'exact':
      return {
        pass: actual.trim().toLowerCase() === example.expected.trim().toLowerCase(),
      };
    case 'contains':
      return {
        pass: actual.toLowerCase().includes(example.expected.toLowerCase()),
      };
    case 'llm': {
      try {
        const verdict = await ai.generate({
          model: LLM_JUDGE_MODEL,
          system:
            'You are a strict evaluator. Reply with exactly "PASS" or "FAIL" on the first line, then a short reason.',
          prompt:
            `Expected behavior: ${example.expected}\n\n` +
            `Actual response: ${actual}\n\n` +
            `Does the actual response satisfy the expected behavior?`,
        });
        const text = verdict.text ?? '';
        const first = text.trim().split(/\r?\n/)[0]?.toUpperCase() ?? '';
        return {
          pass: first.startsWith('PASS'),
          reason: text.trim().slice(0, 280),
        };
      } catch (e) {
        return {
          pass: false,
          reason: `judge error: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }
  }
}
