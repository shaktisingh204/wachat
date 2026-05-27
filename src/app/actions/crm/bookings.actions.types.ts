/**
 * Types extracted from bookings.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface BookingKpis {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  today: number;
}
