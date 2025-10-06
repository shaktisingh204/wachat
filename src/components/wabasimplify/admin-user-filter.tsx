
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    <Select
      onValueChange={handleFilter}
      defaultValue={searchParams.get('userId')?.toString() || 'all'}
    >
      <SelectTrigger className="w-full sm:w-[200px]">
        <SelectValue placeholder="Filter by user..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Users</SelectItem>
        {users.map((user) => (
          <SelectItem key={user._id.toString()} value={user._id.toString()}>
            {user.name} ({user.email})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
