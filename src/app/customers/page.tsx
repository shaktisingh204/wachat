import type { Metadata } from 'next';
import { CustomersClient } from './customers-client';

export const metadata: Metadata = {
  title: 'Customers | SabNode',
  description: 'Technical case studies and architecture implementations of SabNode.',
};

export default function CustomersPage() {
  return <CustomersClient />;
}
