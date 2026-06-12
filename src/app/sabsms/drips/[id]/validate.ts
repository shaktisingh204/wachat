/**
 * Journey builder — pure validator (V2.9).
 *
 * Validates the linear-with-branches journey draft before save and
 * (strictly) before activation. Side-effect free so it runs in the
 * browser (live builder feedback), in server actions (refuse to
 * activate an invalid journey), and under `node:test`.
 *
 * Errors block activation; warnings surface in the builder but don't
 * block (drafts may save with errors — they just can't go active).
 */

import {
  nextStepIdAfter,
  type JourneyExitRules,
  type JourneyGoal,
  type JourneyStep,
  type JourneyTrigger,
} from '@/lib/sabsms/journeys/types';

export interface JourneyDraft {
  name: string;
  trigger: JourneyTrigger;
  steps: JourneyStep[];
  exitRules: JourneyExitRules;
  goal?: JourneyGoal;
  /** Per-journey A/B auto-winner sample gate (default 200 per arm). */
  abSampleThreshold?: number;
}

export interface JourneyValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function stepLabel(step: JourneyStep, index: number): string {
  return `Step ${index + 1} (${step.kind})`;
}

export function validateJourney(draft: JourneyDraft): JourneyValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.name?.trim()) errors.push('Journey name is required.');

  if (draft.trigger.kind === 'inbound_keyword' && !draft.trigger.keyword?.trim()) {
    errors.push('The inbound-keyword trigger needs a keyword.');
  }

  const steps = draft.steps ?? [];
  if (steps.length === 0) {
    errors.push('Add at least one step.');
    return { ok: false, errors, warnings };
  }

  // Unique, non-empty ids — every jump target depends on them.
  const ids = new Set<string>();
  steps.forEach((step, i) => {
    if (!step.id?.trim()) errors.push(`${stepLabel(step, i)} has no id.`);
    else if (ids.has(step.id)) errors.push(`Duplicate step id "${step.id}".`);
    ids.add(step.id);
  });

  const requireTarget = (owner: string, target: string | undefined, what: string) => {
    if (target !== undefined && !ids.has(target)) {
      errors.push(`${owner}: ${what} points to missing step "${target}".`);
    }
  };

  steps.forEach((step, i) => {
    const label = stepLabel(step, i);
    switch (step.kind) {
      case 'send': {
        if (!step.templateId?.trim()) errors.push(`${label}: pick a template.`);
        if (step.abVariants) {
          if (step.abVariants.length === 1) {
            warnings.push(`${label}: a single A/B variant has no effect — add a second arm or remove it.`);
          }
          step.abVariants.forEach((v, vi) => {
            if (!v.templateId?.trim()) errors.push(`${label}: variant ${vi + 1} needs a template.`);
            if (!(v.weight > 0)) errors.push(`${label}: variant ${vi + 1} needs a positive weight.`);
          });
        }
        break;
      }
      case 'wait': {
        if (!(step.durationMs > 0)) errors.push(`${label}: wait duration must be positive.`);
        break;
      }
      case 'waitUntil': {
        if (!(step.timeoutMs > 0)) errors.push(`${label}: timeout must be positive.`);
        requireTarget(label, step.onEventStepId, 'the on-event branch');
        requireTarget(label, step.onTimeoutStepId, 'the on-timeout branch');
        break;
      }
      case 'branch': {
        if (!step.condition?.field?.trim()) errors.push(`${label}: condition field is required.`);
        if (!step.trueStepId) errors.push(`${label}: the true branch needs a target step.`);
        else requireTarget(label, step.trueStepId, 'the true branch');
        if (!step.falseStepId) errors.push(`${label}: the false branch needs a target step.`);
        else requireTarget(label, step.falseStepId, 'the false branch');
        if (step.condition?.field === '__pinpoint_unmapped') {
          warnings.push(`${label}: imported Pinpoint condition could not be mapped — edit it before activating.`);
        }
        break;
      }
      case 'exit':
        break;
    }
  });

  if (steps[0]?.kind === 'exit') {
    warnings.push('The first step is an exit — every contact leaves immediately.');
  }

  // Reachability sweep (warnings): follow fallthrough + jump edges from
  // the first step.
  if (errors.length === 0) {
    const reachable = new Set<string>();
    const queue = [steps[0].id];
    while (queue.length > 0) {
      const id = queue.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      const step = steps.find((s) => s.id === id);
      if (!step) continue;
      const targets: Array<string | undefined> = [];
      switch (step.kind) {
        case 'send':
        case 'wait':
          targets.push(nextStepIdAfter(steps, step.id));
          break;
        case 'waitUntil':
          targets.push(step.onEventStepId ?? nextStepIdAfter(steps, step.id));
          targets.push(step.onTimeoutStepId ?? nextStepIdAfter(steps, step.id));
          break;
        case 'branch':
          targets.push(step.trueStepId, step.falseStepId);
          break;
        case 'exit':
          break;
      }
      for (const t of targets) if (t && !reachable.has(t)) queue.push(t);
    }
    for (const step of steps) {
      if (!reachable.has(step.id)) {
        warnings.push(`Step "${step.id}" (${step.kind}) is unreachable.`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
