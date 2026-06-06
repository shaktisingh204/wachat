'use client';

import { Input, Button } from '@/components/sabcrm/20ui/compat';
import { Filter } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense } from 'react';

function FilterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const path = searchParams.get('path') || '';
  const keyId = searchParams.get('keyId') || '';
  const minStatus = searchParams.get('minStatus') || '';

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    const formPath = formData.get('path') as string;
    const formKeyId = formData.get('keyId') as string;
    const formMinStatus = formData.get('minStatus') as string;

    if (formPath) params.set('path', formPath);
    if (formKeyId) params.set('keyId', formKeyId);
    if (formMinStatus) params.set('minStatus', formMinStatus);

    router.push(`/dashboard/api/logs?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
      <Input
        name="path"
        defaultValue={path}
        placeholder="path (e.g. /api/v1/me)"
        className="font-mono"
      />
      <Input
        name="keyId"
        defaultValue={keyId}
        placeholder="key id"
        className="font-mono"
      />
      <Input
        name="minStatus"
        type="number"
        defaultValue={minStatus}
        placeholder="min status (e.g. 400)"
      />
      <Button type="submit">
        <Filter className="h-4 w-4 mr-1" /> Filter
      </Button>
    </form>
  );
}

export function LogFilter() {
  return (
    <Suspense fallback={<div className="h-10 w-full animate-pulse bg-zoru-surface/50 rounded-md"></div>}>
      <FilterForm />
    </Suspense>
  );
}
