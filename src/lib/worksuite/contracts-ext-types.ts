import type { ObjectId } from 'mongodb';

/**
 * Worksuite Contracts extensions — ported from PHP/Laravel models:
 * Contract (extended), ContractDiscussion, ContractFile,
 * ContractRenew, ContractSign, ContractTemplate, ContractType.
 *
 * Every entity carries `userId` for tenant isolation.
 *
 * Collections:
 *   crm_contract_discussions, crm_contract_files,
 *   crm_contract_renews, crm_contract_signs,
 *   crm_contract_templates, crm_contract_types.
 */

type Owned = {
  _id: ObjectId;
  userId: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

/** Extension shape for an existing contract record. */
export type WsContractExt = Owned & {
  subject?: string;
  contract_type_id?: string;
  client_id?: string;
  value?: number;
  currency?: string;
  start_date?: Date;
  end_date?: Date;
  description?: string;
  signed?: boolean;
  company_signee?: string;
  alternate_address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  notes?: string;
};

export type WsContractDiscussion = Owned & {
  contract_id: string;
  user_id?: string;
  user_name?: string;
  body: string;
  parent_reply_id?: string;
};

export type WsContractFile = Owned & {
  contract_id: string;
  filename: string;
  url?: string;
  size?: number;
};

export type WsContractRenew = Owned & {
  contract_id: string;
  from_date?: Date;
  to_date?: Date;
  new_value?: number;
};

export type WsContractSign = Owned & {
  contract_id: string;
  signer_name: string;
  signer_email?: string;
  signed_at?: Date;
  signature_data_url?: string;
};

export type WsContractTemplate = Owned & {
  name: string;
  body: string;
};

export type WsContractType = Owned & {
  name: string;
};
