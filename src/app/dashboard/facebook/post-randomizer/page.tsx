
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { getProjectById } from '@/app/actions/index.ts';
import { saveRandomizerSettings, getRandomizerPosts, deleteRandomizerPost } from '@/app/actions/facebook.actions';
import type { WithId, Project, RandomizerPost, PostRandomizerSettings } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, Repeat, Save, LoaderCircle, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateRandomizerPostDialog } from '@/components/wabasimplify/create-randomizer-post-dialog';
import Image from 'next/image';

function PageSkeleton() {
    return (
        <div className="space-y-8">
            <div><Skeleton className="h-8 w-1/3" /><Skeleton className="h-4 w-2/3 mt-2" /></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Skeleton className="h-48" />
                <div className="lg:col-span-2"><Skeleton className="h-64" /></div>
            </div>
        </div>
    );
}

function RandomizerPostCard({ post, onDelete }: { post: WithId<RandomizerPost>, onDelete: (postId: string) => void }) {
    return (
        <Card>
            <CardContent className="p-4 flex gap-4">
                {post.imageUrl && (
                    <div className="relative w-24 h-24 flex-shrink-0">
                        <Image src={post.imageUrl} alt="Post image" layout="fill" objectFit="cover" className="rounded-md" data-ai-hint="social media post"/>
                    </div>
                )}
                <div className="flex-1 space-y-2">
                    <p className="text-sm text-muted-foreground line-clamp-4">{post.message}</p>
                </div>
                <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(post._id.toString())}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default function PostRandomizerPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [posts, setPosts] = useState<WithId<RandomizerPost>[]>([]);
    const [settings, setSettings] = useState<PostRandomizerSettings>({ enabled: false, frequencyHours: 24 });
    const [isLoading, startLoading] = useTransition();
    const [isSaving, startSaving] = useTransition();
    const [isDeleting, startDeleting] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    const fetchData = useCallback(() => {
        if (!projectId) return;
        startLoading(async () => {
            const [projectData, postsData] = await Promise.all([
                getProjectById(projectId),
                getRandomizerPosts(projectId)
            ]);
            setProject(projectData);
            setPosts(postsData);
            if (projectData?.postRandomizer) {
                setSettings(projectData.postRandomizer);
            }
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (projectId) fetchData();
    }, [projectId, fetchData]);

    const handleSettingsChange = (field: keyof PostRandomizerSettings, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveSettings = () => {
        if (!projectId) return;
        
        const formData = new FormData();
        formData.append('projectId', projectId);
        formData.append('enabled', settings.enabled ? 'on' : 'off');
        formData.append('frequencyHours', String(settings.frequencyHours));

        startSaving(async () => {
            const result = await saveRandomizerSettings(null, formData);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: 'Randomizer settings saved.' });
                fetchData();
            }
        });
    };
    
    const handleDeletePost = (postId: string) => {
        if (!projectId) return;
        startDeleting(async () => {
            const result = await deleteRandomizerPost(postId, projectId);
            if (result.success) {
                toast({ title: 'Success', description: 'Post removed from pool.' });
                fetchData();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }

    if (isLoading && !project) return <PageSkeleton />;
    
    return (
        <>
            {project && <CreateRandomizerPostDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} project={project} onPostAdded={fetchData} />}
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Repeat className="h-8 w-8" />
                        Post Randomizer
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Automatically publish a random post from your content pool at a set interval.
                    </p>
                </div>

                {!projectId ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No Project Selected</AlertTitle>
                        <AlertDescription>Please select a project to manage its Post Randomizer.</AlertDescription>
                    </Alert>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle>Settings</CardTitle>
                                <CardDescription>Configure the randomizer schedule.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <Label htmlFor="enabled-switch" className="flex flex-col space-y-1">
                                        <span>Enable Randomizer</span>
                                        <span className="font-normal leading-snug text-muted-foreground text-sm">Turn on automatic posting.</span>
                                    </Label>
                                    <Switch id="enabled-switch" checked={settings.enabled} onCheckedChange={(checked) => handleSettingsChange('enabled', checked)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="frequency">Post every (hours)</Label>
                                    <Input id="frequency" type="number" min="1" value={settings.frequencyHours} onChange={(e) => handleSettingsChange('frequencyHours', parseInt(e.target.value, 10))} />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" onClick={handleSaveSettings} disabled={isSaving}>
                                    {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Save Settings
                                </Button>
                            </CardFooter>
                        </Card>

                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle>Content Pool</CardTitle>
                                        <CardDescription>Posts that will be randomly selected for publishing.</CardDescription>
                                    </div>
                                    <Button onClick={() => setIsDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/>Add Post</Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? <Skeleton className="h-48 w-full"/> : (
                                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                        {posts.length > 0 ? (
                                            posts.map(post => <RandomizerPostCard key={post._id.toString()} post={post} onDelete={handleDeletePost} />)
                                        ) : (
                                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                                <p className="font-semibold">Your content pool is empty.</p>
                                                <p className="text-sm">Add some posts to get started.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </>
    );
}
