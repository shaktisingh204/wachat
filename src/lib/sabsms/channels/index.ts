/**
 * SabSMS v3 omnichannel dispatch — public barrel.
 *
 * Callers (Verify orchestrator, journeys executor, campaigns, AI agent)
 * import `dispatch` from here and never touch individual adapters.
 */

export { dispatch } from './dispatcher';
export type { DispatchDeps } from './dispatcher';
export {
  compliancePreflight,
  phoneHash,
  type PreflightVerdict,
  type PreflightDeps,
} from './compliance-preflight';
export {
  PHONE_BASED_CHANNELS,
  type ChannelAdapter,
  type DispatchContext,
  type DispatchPayload,
  type DispatchRecipient,
  type DispatchResult,
  type DispatchStatus,
  type SabsmsDispatchChannel,
} from './types';
