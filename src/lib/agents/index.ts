/**
 * Public surface for the SabNode AI Agent Ecosystem.
 *
 * Importing this module also wires up the built-in tools and the three
 * pre-built agents (sales-sdr, support-triage, copywriter) into the global
 * registry.
 */

// Side-effect imports must come first: tools register themselves, then
// agents register themselves and reference tools by name.
import './tools';
import './agents/sales-sdr';
import './agents/support-triage';
import './agents/copywriter';

export type {
  Agent,
  AgentBudget,
  AgentEval,
  AgentMemoryConfig,
  AgentMessage,
  AgentRun,
  AgentRunContext,
  AnyTool,
  EvalResult,
  Tool,
} from './types';

export {
  registerAgent,
  getAgent,
  listAgents,
  unregisterAgent,
  registerTool,
  getTool,
  listTools,
} from './registry';

export { runAgent } from './runner';
export type { RunOptions } from './runner';

export { runEval } from './evals';
export type { RunEvalOptions } from './evals';

export {
  ShortTermMemory,
  rememberLongTerm,
  recallLongTerm,
  listLongTerm,
  forgetLongTerm,
} from './memory';
export type { AgentMemoryRow } from './memory';

export {
  builtInTools,
  searchContactsTool,
  sendWhatsappTool,
  createCrmDealTool,
  queryAnalyticsTool,
  updateVariableTool,
} from './tools';

export { salesSdrAgent } from './agents/sales-sdr';
export { supportTriageAgent } from './agents/support-triage';
export { copywriterAgent } from './agents/copywriter';
