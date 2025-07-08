

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Metadata } from 'next';
import { getUsersForAdmin } from '@/app/actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AdminUserSearch } from '@/components/wabasimplify/admin-user-search';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'User Management | SabNode',
};

const USERS_PER_PAGE = 10;

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams?: {
        query?: string;
        page?: string;
    };
}) {
  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;
  
  const { users, total } = await getUsersForAdmin(currentPage, USERS_PER_PAGE, query);

  const totalPages = Math.ceil(total / USERS_PER_PAGE);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold font-headline">User Management</h1>
        <p className="text-muted-foreground">View all users on the platform. Plans and credits are managed per-project on the main admin dashboard.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Total users found: {total.toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <AdminUserSearch placeholder="Search users by name or email..." />
          </div>
          <div className="border rounded-md">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Joined</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {users.length > 0 ? (
                    users.map((user) => (
                    <TableRow key={user._id.toString()}>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <Avatar><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                <div>
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-sm text-muted-foreground">{user.email}</div>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center">
                        No users found.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
          </div>
           <div className="flex items-center justify-end space-x-2 py-4">
              <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages > 0 ? totalPages : 1}
              </span>
              <Button
                  variant="outline"
                  size="sm"
                  asChild
                  disabled={currentPage <= 1}
              >
                  <Link href={`/admin/dashboard/users?page=${currentPage - 1}${query ? `&query=${query}` : ''}`}>Previous</Link>
              </Button>
              <Button
                  variant="outline"
                  size="sm"
                  asChild
                  disabled={currentPage >= totalPages}
              >
                  <Link href={`/admin/dashboard/users?page=${currentPage + 1}${query ? `&query=${query}` : ''}`}>Next</Link>
              </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
