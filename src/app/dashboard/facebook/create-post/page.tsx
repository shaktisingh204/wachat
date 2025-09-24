'use client';

import { useState, useActionState, useRef, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { handleCreateFacebookPost, getPageDetails } from '@/app/actions/facebook.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, X, Image as ImageIcon, LoaderCircle, Send, Video, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import type { FacebookPageDetails } from '@/lib/definitions';
import { Separator } from '@/components/ui/separator';
import { MessageSquare } from "lucide-react";

const initialState = { message: null, error: null };

function SubmitButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="sm" disabled={pending || disabled}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Post
        </Button>
    )
}

export default function CreateFacebookPostPage() {
    const [state, formAction] = useActionState(handleCreateFacebookPost, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [projectId, setProjectId] = useState<string | null>(null);
    const [pageDetails, setPageDetails] = useState<FacebookPageDetails | null>(null);
    
    // Form state
    const [message, setMessage] = useState('');
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [postType, setPostType] = useState<'text' | 'image' | 'video'>('text');
    
    // Scheduling state
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledDate, setScheduledDate] = useState<Date>();

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
        if (storedProjectId) {
            getPageDetails(storedProjectId).then(result => {
                if(result.page) setPageDetails(result.page);
            });
        }
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            formRef.current?.reset();
            setMessage('');
            setMediaFile(null);
            setMediaPreview(null);
            setPostType('text');
            setIsScheduled(false);
            setScheduledDate(undefined);
            if(fileInputRef.current) fileInputRef.current.value = '';
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setMediaFile(file);
            if (file.type.startsWith('image/')) {
                setPostType('image');
            } else if (file.type.startsWith('video/')) {
                setPostType('video');
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setMediaPreview(reader.result as string);
            }
            reader.readAsDataURL(file);
        }
    };
    
    const isPostButtonDisabled = message.trim() === '' && !mediaFile;

    if (!projectId) {
        return (
            <div className="flex justify-center p-4">
                 <Alert variant="destructive" className="max-w-xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>Please select a project with a connected Facebook Page to create a post.</AlertDescription>
                </Alert>
            </div>
        );
    }
    
    return (
        <div className="flex justify-center p-4">
            <form action={formAction} ref={formRef} className="w-full max-w-xl">
                <input type="hidden" name="projectId" value={projectId || ''} />
                <input type="hidden" name="postType" value={postType} />

                <Card className="card-gradient card-gradient-green">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/dashboard/facebook"><X className="h-5 w-5"/></Link>
                        </Button>
                        <h1 className="text-lg font-bold">Create Post</h1>
                        <SubmitButton disabled={isPostButtonDisabled} />
                    </CardHeader>

                    <CardContent className="space-y-4 min-h-[200px]">
                        <div className="flex gap-3">
                            <Avatar>
                                {pageDetails?.picture?.data.url && <AvatarImage src={pageDetails.picture.data.url} alt={pageDetails.name} />}
                                <AvatarFallback>{pageDetails?.name.charAt(0) || 'P'}</AvatarFallback>
                            </Avatar>
                            <Textarea
                                name="message"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="What do you want to talk about?"
                                className="min-h-32 border-none focus-visible:ring-0 shadow-none p-0 bg-transparent text-base"
                            />
                        </div>

                        {mediaPreview && (
                             <div className="relative mt-4">
                                {postType === 'image' ? (
                                    <Image src={mediaPreview} width={500} height={280} alt="Preview" className="rounded-lg object-cover w-full"/>
                                ) : (
                                    <video src={mediaPreview} controls className="rounded-lg w-full"></video>
                                )}
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    type="button"
                                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 text-white hover:bg-black/70"
                                    onClick={() => {
                                        setMediaFile(null);
                                        setMediaPreview(null);
                                        setPostType('text');
                                        if(fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                >
                                    <X className="h-4 w-4"/>
                                </Button>
                            </div>
                        )}
                        
                        <input type="file" name="mediaFile" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*"/>
                    </CardContent>
                    
                    <CardFooter className="flex-col items-start gap-4 border-t pt-4">
                        <div className="flex items-center justify-between w-full">
                           <Label className="font-semibold">Add to your post</Label>
                           <div className="flex items-center gap-2">
                               <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}><ImageIcon className="h-5 w-5 text-green-500"/></Button>
                               <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}><Video className="h-5 w-5 text-blue-500"/></Button>
                           </div>
                        </div>

                        <Separator/>
                        
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center space-x-2">
                                <Switch id="isScheduledSwitch" name="isScheduled" checked={isScheduled} onCheckedChange={setIsScheduled} />
                                <Label htmlFor="isScheduledSwitch" className="flex items-center gap-2 font-normal cursor-pointer">
                                    <Calendar className="h-4 w-4" />
                                    Schedule Post
                                </Label>
                            </div>
                            {isScheduled && (
                                <div className="flex flex-wrap gap-2">
                                    <DatePicker date={scheduledDate} setDate={setScheduledDate} />
                                    <Input name="scheduledTime" type="time" required className="w-28"/>
                                </div>
                            )}
                        </div>
                         {isScheduled && (
                            <>
                                <input type="hidden" name="isScheduled" value="on" />
                                <input type="hidden" name="scheduledDate" value={scheduledDate?.toISOString().split('T')[0]} />
                            </>
                         )}
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
