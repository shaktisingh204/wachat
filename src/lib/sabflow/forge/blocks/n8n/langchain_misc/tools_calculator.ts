/**
 * Forge block: LangChain Tools (Calculator)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/tools/ToolCalculator/
 *
 * Evaluate an arithmetic expression with a restricted operator/identifier set.
 * The sanitiser only permits `+ - * / ( ) . , whitespace digits` and a small
 * allow-list of Math.* identifiers. Anything else throws before we hand the
 * sanitised string to `new Function('Math', 'return ' + expr)`.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const ALLOWED_MATH = new Set([
  'floor',
  'ceil',
  'round',
  'abs',
  'sqrt',
  'pow',
  'log',
  'exp',
  'sin',
  'cos',
  'tan',
  'PI',
  'E',
]);

/**
 * Sanitiser: tokenise the expression and reject anything outside the
 * allow-list. We do NOT use `eval` — the final evaluation is via
 * `new Function` with `Math` injected explicitly.
 */
function sanitise(expr: string): string {
  // Quick reject of any character that's not in the safe alphabet. We allow
  // letters only as part of `Math.<ident>` references; identifiers are
  // validated separately below.
  if (!/^[\s0-9+\-*/().,a-zA-Z_]+$/.test(expr)) {
    throw new Error('Calculator: expression contains disallowed characters');
  }

  // Find all identifier-like tokens — every one must be `Math` or a permitted
  // member after `Math.`.
  const idents = expr.match(/[a-zA-Z_][a-zA-Z_0-9]*/g) ?? [];
  for (let i = 0; i < idents.length; i++) {
    const tok = idents[i];
    if (tok === 'Math') continue;
    if (ALLOWED_MATH.has(tok)) {
      // Must be preceded by `Math.`
      const idx = expr.indexOf(tok);
      const before = expr.slice(Math.max(0, idx - 5), idx);
      if (!/Math\.$/.test(before)) {
        throw new Error(`Calculator: "${tok}" must be qualified as Math.${tok}`);
      }
      continue;
    }
    throw new Error(`Calculator: disallowed identifier "${tok}"`);
  }

  // Disallow consecutive operators (++, **, //) which often signal smuggling.
  if (/[+\-*/]{2,}/.test(expr.replace(/\s+/g, ''))) {
    // Allow `**` for exponent? n8n's calculator doesn't — keep it strict.
    throw new Error('Calculator: consecutive operators not allowed');
  }

  return expr;
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const expression = asString(ctx.options.expression).trim();
  if (!expression) throw new Error('Calculator: expression is required');

  const sanitised = sanitise(expression);
  let result: unknown;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('Math', `"use strict"; return (${sanitised});`) as (m: Math) => unknown;
    result = fn(Math);
  } catch (err) {
    throw new Error(`Calculator: evaluation failed — ${(err as Error).message}`);
  }

  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error(`Calculator: result is not a finite number (got ${String(result)})`);
  }

  return {
    outputs: { result, expression: sanitised },
    logs: [`Calculator → ${sanitised} = ${result}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_tools_calculator',
  name: 'LangChain Tools (Calculator)',
  description: 'Safe-eval arithmetic with + - * / ( ) and a small Math.* allow-list.',
  iconName: 'LuCalculator',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'compute',
      label: 'Evaluate expression',
      fields: [
        {
          id: 'expression',
          label: 'Expression',
          type: 'text',
          required: true,
          placeholder: '2 + 2 * Math.sqrt(16)',
          helperText: 'Allowed: + - * / ( ) and Math.{floor,ceil,round,abs,sqrt,pow,log,exp,sin,cos,tan,PI,E}',
        },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
