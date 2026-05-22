'use client';

import { Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import {
  usePathname,
  useRouter,
  useSearchParams } from 'next/navigation';

import type { User } from '@/lib/definitions';
import type { WithId } from 'mongodb';

interface AdminUserFilterProps {
  users: WithId<User>[];
}

export function AdminUserFilter({ users }: AdminUserFilterProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const handleFilter = (userId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (userId && userId !== 'all') {
      params.set('userId', userId);
    } else {
      params.delete('userId');
    }
    replace(`${pathname}?${params.toString()}`);
  };

  return (
    <ZoruSelect
      onValueChange={handleFilter}
      defaultValue={searchParams.get('userId')?.toString() || 'all'}
    >
      <ZoruSelectTrigger className="w-full sm:w-[200px]">
        <ZoruSelectValue placeholder="Filter by user..." />
      </ZoruSelectTrigger>
      <ZoruSelectContent>
        <ZoruSelectItem value="all">All Users</ZoruSelectItem>
        {users.map((user) => (
          <ZoruSelectItem key={user._id.toString()} value={user._id.toString()}>
            {user.name} ({user.email})
          </ZoruSelectItem>
        ))}
      </ZoruSelectContent>
    </ZoruSelect>
  );
}
