/**
 * Plain shape the service-contracts list client consumes. We keep this
 * loose because the source page reads directly from the Mongo
 * `crm_amc_contracts` collection — fields are best-effort. The list
 * page serialises rows to this row type before handing them off.
 */

export interface ServiceContractRow {
  _id: string;
  contractNo?: string;
  customerId?: string;
  customerName?: string;
  technicianId?: string;
  technicianName?: string;
  coverage?: string;
  frequency?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  status?: string;
  renewalDue?: boolean;
  billedAmount?: number;
  value?: number;
}
