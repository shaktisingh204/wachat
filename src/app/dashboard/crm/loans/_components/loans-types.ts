/**
 * Plain row shape consumed by the loans list client. The page
 * serialises Mongo docs into this safe-to-render type before handing
 * off.
 */

export interface LoanRow {
  _id: string;
  type?: string;
  borrowerId?: string;
  borrowerName?: string;
  borrowerType?: 'customer' | 'vendor' | 'employee' | string;
  principal?: number;
  interestRate?: number;
  tenureMonths?: number;
  emi?: number;
  outstanding?: number;
  status?: string;
  npa?: boolean;
  nextPaymentAt?: string | null;
  createdAt?: string | null;
}
