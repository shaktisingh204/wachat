'use client';

import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruSkeleton,
  ZoruButton,
  ZoruInput,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruBadge,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useMemo } from 'react';
import type { WithId } from 'mongodb';
import { getEmailContacts } from '@/app/actions/email.actions';
import { getSession } from '@/app/actions/index.ts';
import type { EmailContact,
  Tag,
  User } from '@/lib/definitions';
import { Search, Plus, UserPlus, FileUp } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { EmailAddContactDialog } from '@/components/wabasimplify/email-add-contact-dialog';
import { EmailImportContactsDialog } from '@/components/wabasimplify/email-import-contacts-dialog';
import { formatDistanceToNow } from 'date-fns';

const CONTACTS_PER_PAGE = 20;

export default function EmailContactsPage() {
    const [contacts, setContacts] = useState<WithId<EmailContact>[]>([]);
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [isLoading, startTransition] = useTransition();

    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [contactsData, sessionData] = await Promise.all([
                getEmailContacts(currentPage, CONTACTS_PER_PAGE, searchQuery),
                getSession()
            ]);
            setContacts(contactsData.contacts);
            setTotalPages(Math.ceil(contactsData.total / CONTACTS_PER_PAGE));
            setUser(sessionData?.user as any);
        });
    }, [currentPage, searchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1);
    }, 300);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Email Contacts</h1>
                    <p className="text-muted-foreground">Manage your email subscriber lists.</p>
                </div>
                <div className="flex items-center gap-2">
                    <EmailImportContactsDialog onImported={fetchData} />
                    <EmailAddContactDialog onAdded={fetchData} availableTags={user?.tags || []} />
                </div>
            </div>
            
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>All Contacts</ZoruCardTitle>
                    <ZoruCardDescription>A list of all contacts for your email campaigns.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="mb-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <ZoruInput
                                placeholder="Search by name or email..."
                                className="pl-8"
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="border rounded-md">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Contact</ZoruTableHead>
                                    <ZoruTableHead>Tags</ZoruTableHead>
                                    <ZoruTableHead>Added</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <ZoruTableRow key={i}>
                                            <ZoruTableCell colSpan={3}><ZoruSkeleton className="h-10 w-full" /></ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                ) : contacts.length > 0 ? (
                                    contacts.map((contact) => (
                                        <ZoruTableRow key={contact._id.toString()} className="cursor-pointer">
                                            <ZoruTableCell>
                                                <div className="flex items-center gap-3">
                                                    <ZoruAvatar>
                                                        <ZoruAvatarFallback>{(contact.name || contact.email).charAt(0).toUpperCase()}</ZoruAvatarFallback>
                                                    </ZoruAvatar>
                                                    <div>
                                                        <div className="font-medium">{contact.name || 'N/A'}</div>
                                                        <div className="text-sm text-muted-foreground">{contact.email}</div>
                                                    </div>
                                                </div>
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {(contact.tags || []).map(tagId => {
                                                        const tag = user?.tags?.find(t => t._id === tagId);
                                                        return tag ? (
                                                            <ZoruBadge key={tagId} className="rounded" style={{ backgroundColor: tag.color, color: '#fff' }}>
                                                                {tag.name}
                                                            </ZoruBadge>
                                                        ) : null;
                                                    })}
                                                </div>
                                            </ZoruTableCell>
                                            <ZoruTableCell>{formatDistanceToNow(new Date(contact.createdAt), { addSuffix: true })}</ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                ) : (
                                    <ZoruTableRow>
                                        <ZoruTableCell colSpan={3} className="h-24 text-center">No contacts found.</ZoruTableCell>
                                    </ZoruTableRow>
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
