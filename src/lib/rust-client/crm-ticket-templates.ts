import 'server-only';

/**
 * CRM Ticket Templates client — alias of `crm-reply-templates`.
 *
 * Reply templates ARE ticket templates: canned macro replies keyed by an
 * optional shortcut, with `{{variable}}` placeholders. The crate, route,
 * and collection are all named `crm-reply-templates`; this module
 * re-exports the same client under the helpdesk-facing "ticket templates"
 * name (the term Zoho Desk and Freshdesk use for the same concept).
 */
export {
  crmReplyTemplatesApi as crmTicketTemplatesApi,
  type CrmReplyTemplateDoc as CrmTicketTemplateDoc,
  type CrmReplyTemplateCreateInput as CrmTicketTemplateCreateInput,
  type CrmReplyTemplateUpdateInput as CrmTicketTemplateUpdateInput,
  type CrmReplyTemplateListParams as CrmTicketTemplateListParams,
  type CrmReplyTemplateListResponse as CrmTicketTemplateListResponse,
  type CrmReplyTemplateStatus as CrmTicketTemplateStatus,
} from './crm-reply-templates';
