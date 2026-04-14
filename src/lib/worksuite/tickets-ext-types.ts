import type { ObjectId } from 'mongodb';

/**
 * Worksuite Tickets extensions — ported from PHP/Laravel models:
 * Ticket (extended), TicketActivity, TicketAgentGroups,
 * TicketChannel, TicketCustomForm, TicketEmailSetting, TicketFile,
 * TicketGroup, TicketReply, TicketReplyTemplate, TicketReplyUser,
 * TicketSettingForAgents, TicketTag, TicketTagList, TicketType.
 *
 * Every entity carries `userId` for tenant isolation.
 *
 * Collections:
 *   crm_ticket_channels, crm_ticket_groups, crm_ticket_types,
 *   crm_ticket_tags, crm_ticket_reply_templates,
 *   crm_ticket_custom_forms, crm_ticket_agent_groups,
 *   crm_ticket_replies, crm_ticket_activities.
 */

type Owned = {
  _id: ObjectId;
  userId: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export type WsTicketChannel = Owned & {
  name: string;
};

export type WsTicketGroup = Owned & {
  name: string;
  description?: string;
};

export type WsTicketType = Owned & {
  type: string;
  color?: string;
};

export type WsTicketTag = Owned & {
  tag_name: string;
};

export type WsTicketReplyTemplate = Owned & {
  heading: string;
  body: string;
};

export type WsTicketCustomFormFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'number'
  | 'date'
  | 'email'
  | 'url';

export type WsTicketCustomForm = Owned & {
  field_name: string;
  field_type: WsTicketCustomFormFieldType;
  field_values?: string;
  is_required?: boolean;
};

export type WsTicketAgentGroup = Owned & {
  agent_user_id: string;
  group_id: string;
};

export type WsTicketReply = Owned & {
  ticket_id: string;
  user_id?: string;
  user_name?: string;
  body: string;
  attachments?: string[];
};

export type WsTicketActivity = Owned & {
  ticket_id: string;
  user_id?: string;
  activity: string;
  timestamp?: Date;
};
