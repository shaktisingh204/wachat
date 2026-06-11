/**
 * /dashboard/sabflow/credentials — Connections is the credentials manager,
 * so this index simply forwards there. Deep routes like
 * /credentials/[id]/scopes still resolve normally.
 */

import { redirect } from 'next/navigation';

export default function CredentialsIndexPage() {
  redirect('/dashboard/sabflow/connections');
}
