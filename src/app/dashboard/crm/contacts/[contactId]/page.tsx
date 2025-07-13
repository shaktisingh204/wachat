
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCrmContactById } from '@/app/actions/crm.actions';
import type { CrmContact, WithId } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Briefcase, Mail, Phone, MessageSquare, Plus, FileText, Calendar } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { CrmNotes } from '@/components/wabasimplify/crm-notes';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ComposeEmailDialog } from '@/components/wabasimplify/crm-compose-email-dialog';

function ContactDetailPageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-4">
                    <Skeleton className="h-64 w-full" />
                </div>
                <div className="md:col-span-2 space-y-4">
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        </div>
    );
}

export default function CrmContactDetailPage() {
    const params = useParams();
    const router = useRouter();
    const contactId = params.contactId as string;
    const [contact, setContact] = useState<WithId<CrmContact> | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [isComposeOpen, setIsComposeOpen] = useState(false);

    useEffect(() => {
        if (contactId) {
            startTransition(async () => {
                const fetchedContact = await getCrmContactById(contactId);
                setContact(fetchedContact);
            });
        }
    }, [contactId]);

    const handleWhatsAppMessage = () => {
        const waId = contact?.phone?.replace(/\D/g, '');
        if (waId) {
             router.push(`/dashboard/chat?waId=${waId}`);
        }
    };

    if (isLoading || !contact) {
        return <ContactDetailPageSkeleton />;
    }

    const leadScoreColor = (score: number) => {
        if (score > 75) return 'bg-green-500';
        if (score > 50) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <>
            <ComposeEmailDialog 
                isOpen={isComposeOpen} 
                onOpenChange={setIsComposeOpen}
                initialTo={contact.email}
                initialSubject={`Regarding your inquiry with ${contact.company || 'us'}`}
            />
            <div className="space-y-6">
                 <div>
                    <Button variant="ghost" asChild className="mb-2 -ml-4">
                        <Link href="/dashboard/crm/contacts"><ArrowLeft className="mr-2 h-4 w-4" />Back to All Contacts</Link>
                    </Button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-6">
                        <Card>
                            <CardHeader className="items-center text-center">
                                <Avatar className="h-24 w-24 mb-2">
                                    <AvatarImage src={contact.avatarUrl || ''} data-ai-hint="person avatar" />
                                    <AvatarFallback className="text-3xl">{contact.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <CardTitle>{contact.name}</CardTitle>
                                <CardDescription>{contact.jobTitle || 'N/A'}</CardDescription>
                            </CardHeader>
                            <CardContent className="text-sm space-y-4">
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsComposeOpen(true)}>
                                        <Mail className="h-4 w-4 mr-2"/> Email
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1" onClick={handleWhatsAppMessage} disabled={!contact.phone}>
                                         <MessageSquare className="h-4 w-4 mr-2"/> WhatsApp
                                    </Button>
                                     <Button asChild variant="outline" size="sm" className="flex-1" disabled={!contact.phone}>
                                        <a href={`tel:${contact.phone}`}><Phone className="h-4 w-4 mr-2"/> Call</a>
                                    </Button>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground"/><a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a></div>
                                    <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground"/><span>{contact.phone || 'N/A'}</span></div>
                                    <div className="flex items-center gap-3"><Briefcase className="h-4 w-4 text-muted-foreground"/><span>{contact.company || 'N/A'}</span></div>
                                </div>
                                <Separator />
                                 <div className="space-y-2">
                                    <Label className="text-muted-foreground">Lead Score</Label>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold" style={{backgroundColor: leadScoreColor(contact.leadScore || 0)}}>{contact.leadScore || 0}</div>
                                        <p className="text-sm">Hot Lead</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">Status</Label>
                                    <div><Badge>{contact.status}</Badge></div>
                                </div>
                            </CardContent>
                        </Card>
                         <CrmNotes recordId={contact._id.toString()} recordType="contact" notes={contact.notes || []} />
                    </div>
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
                            <CardContent>
                                <div className="relative pl-6">
                                    <div className="absolute left-[11px] top-0 h-full w-0.5 bg-border"></div>
                                     <div className="space-y-8">
                                        <div className="flex items-start gap-4 relative">
                                            <div className="absolute left-[-23px] top-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center ring-4 ring-background"><Calendar className="h-2 w-2 text-primary-foreground"/></div>
                                            <div><p className="font-medium">Lead Created</p><p className="text-xs text-muted-foreground">{new Date(contact.createdAt).toLocaleString()}</p></div>
                                        </div>
                                        <div className="flex items-start gap-4 relative">
                                            <div className="absolute left-[-23px] top-1.5 h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center ring-4 ring-background"><FileText className="h-2 w-2 text-white"/></div>
                                            <div><p className="font-medium">Note Added</p><p className="text-sm text-muted-foreground mt-1 bg-muted p-2 rounded-md">Followed up regarding pricing. Sent proposal.</p><p className="text-xs text-muted-foreground mt-1">2 days ago</p></div>
                                        </div>
                                         <div className="flex items-start gap-4 relative">
                                            <div className="absolute left-[-23px] top-1.5 h-4 w-4 rounded-full bg-green-500 flex items-center justify-center ring-4 ring-background"><MessageSquare className="h-2 w-2 text-white"/></div>
                                            <div><p className="font-medium">Conversation Started</p><p className="text-sm text-muted-foreground mt-1">Contact initiated a chat on WhatsApp.</p><p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), { addSuffix: true })}</p></div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
