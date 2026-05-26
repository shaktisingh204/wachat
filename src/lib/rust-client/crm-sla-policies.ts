import 'server-only';

/**
 * CRM SLA Policies client — alias of `crm-slas`.
 *
 * The Rust crate, the BFF route, and the on-disk Mongo collection are all
 * named `crm-slas` / `crm_slas`. This module re-exports the same client
 * under the helpdesk-facing "policies" name so call sites in the
 * `/dashboard/sabdesk/settings/sla-policies` surface can read clean.
 */
export {
  crmSlasApi as crmSlaPoliciesApi,
  type CrmSlaDoc as CrmSlaPolicyDoc,
  type CrmSlaCreateInput as CrmSlaPolicyCreateInput,
  type CrmSlaUpdateInput as CrmSlaPolicyUpdateInput,
  type CrmSlaListParams as CrmSlaPolicyListParams,
  type CrmSlaListResponse as CrmSlaPolicyListResponse,
  type CrmSlaPriority as CrmSlaPolicyPriority,
  type CrmSlaStatus as CrmSlaPolicyStatus,
} from './crm-slas';
