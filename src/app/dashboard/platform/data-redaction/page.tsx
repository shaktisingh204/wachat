import { getRedactionPolicies } from '@/app/actions/platform/data-redaction.actions';
import { DataRedactionClient } from './client';

export default async function DataRedactionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  
  const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page, 10) : 1;
  const search = typeof resolvedSearchParams.search === 'string' ? resolvedSearchParams.search : undefined;
  const status = typeof resolvedSearchParams.status === 'string' ? resolvedSearchParams.status : undefined;
  const targetField = typeof resolvedSearchParams.targetField === 'string' ? resolvedSearchParams.targetField : undefined;

  const result = await getRedactionPolicies({
    page,
    limit: 10,
    search,
    status,
    targetField,
  });

  return (
    <DataRedactionClient
      initialData={result.data}
      total={result.total}
      currentPage={result.page}
      totalPages={result.totalPages}
    />
  );
}
