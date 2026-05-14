/**
 * Row shape consumed by the portal users list client.
 */

export interface PortalUserRow {
  _id: string;
  name?: string;
  email?: string;
  portalType?: 'customer' | 'vendor' | 'employee' | string;
  capabilities?: string[];
  linkedEntityId?: string;
  linkedEntityLabel?: string;
  lastLoginAt?: string | null;
  status?: string;
}
