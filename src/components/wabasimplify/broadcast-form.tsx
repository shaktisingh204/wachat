
'use client';

import { useFormStatus } from 'react-dom';
import { useActionState, useEffect, useRef, useState } from 'react';
import { handleStartBroadcast } from '@/app/actions/broadcast.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { LoaderCircle, Send, AlertCircle, UploadCloud, Link, Check, ChevronsUpDown } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import type { Project, Template, Tag, MetaFlow } from '@/lib/definitions';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <Send className="mr-2 h-4 w-4" />
          Start Broadcast
        </>
      )}
    </Button>
  );
}

interface BroadcastFormProps {
    templates: WithId<Template>[];
    project: Pick<WithId<Project>, '_id' | 'phoneNumbers' | 'tags'> | null;
    metaFlows: WithId<MetaFlow>[];
}

export function BroadcastForm({ templates, project, metaFlows }: BroadcastFormProps) {
  const [state, formAction] = useActionState(handleStartBroadcast, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  
  const [audienceType, setAudienceType] = useState<'file' | 'tags'>('file');
  const [selectedTemplate, setSelectedTemplate] = useState<WithId<Template> | null>(null);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const [headerMediaSource, setHeaderMediaSource] = useState<'url' | 'file'>('url');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);


  useEffect(() => {
    if (state?.message) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      setFileInputKey(Date.now()); // Resets both file inputs
      formRef.current?.reset();
      setSelectedTemplate(null);
      setSelectedPhoneNumber('');
      setSelectedTagIds([]);
      setAudienceType('file');
    }
    if (state?.error) {
      toast({
        title: 'Broadcast Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);


  if (!project) {
    return (
        <Card className="card-gradient card-gradient-green">
            <CardHeader>
                <CardTitle>No Project Selected</CardTitle>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Action Required</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard page before sending a broadcast.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    )
  }

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t._id.toString() === templateId);
    setSelectedTemplate(template || null);
  };

  const showImageUpload = selectedTemplate?.components?.some(c => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format));

  const approvedTemplates = templates.filter(t => t.status?.toUpperCase() === 'APPROVED');

  return (
    <Card className="card-gradient card-gradient-green">
      <form ref={formRef} action={formAction}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          {selectedTagIds.map(id => <input key={id} type="hidden" name="tagIds" value={id} />)}
          <CardHeader>
          <CardTitle>New Broadcast Campaign</CardTitle>
          <CardDescription>Select a phone number, a message template, and your audience.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <Label>1. Broadcast Type</Label>
                <div className="flex items-center space-x-2 pt-1">
                    <RadioGroup defaultValue="template">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="template" id="type-template" checked readOnly/>
                            <Label htmlFor="type-template">Campaign</Label>
                        </div>
                    </RadioGroup>
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="phoneNumberId">2. Select Phone Number</Label>
                <Select name="phoneNumberId" required value={selectedPhoneNumber} onValueChange={setSelectedPhoneNumber}>
                <SelectTrigger id="phoneNumberId">
                    <SelectValue placeholder="Choose a number..." />
                </SelectTrigger>
                <SelectContent>
                    {(project?.phoneNumbers || []).map((phone) => (
                    <SelectItem key={phone.id} value={phone.id}>
                        {phone.display_phone_number}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
                <Label htmlFor="templateId">3. Select Message Template</Label>
                <Select name="templateId" required value={selectedTemplate?._id.toString() || ''} onValueChange={handleTemplateChange}>
                    <SelectTrigger id="templateId"><SelectValue placeholder="Choose an approved template..." /></SelectTrigger>
                    <SelectContent searchable>
                    {approvedTemplates.length > 0 ? (
                        approvedTemplates.map((template) => (
                        <SelectItem key={template._id.toString()} value={template._id.toString()}>{template.name} (<span className="capitalize">{template.status ? template.status.replace(/_/g, " ").toLowerCase() : 'N/A'}</span>)</SelectItem>
                        ))
                    ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">No approved templates found. <br/> Please sync with Meta or create a new one.</div>
                    )}
                    </SelectContent>
                </Select>
            </div>

            <div className="md:col-span-2 grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label>4. Select Audience</Label>
                    <RadioGroup name="audienceType" value={audienceType} onValueChange={(val) => setAudienceType(val as any)} className="flex gap-4 pt-1">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="file" id="audience-file" /><Label htmlFor="audience-file">Upload File</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="tags" id="audience-tags" /><Label htmlFor="audience-tags">From Tags</Label></div>
                    </RadioGroup>
                </div>
                {audienceType === 'file' ? (
                    <div className="space-y-2">
                        <Label htmlFor="csvFile">Upload Contacts</Label>
                        <Input
                        key={fileInputKey}
                        id="csvFile"
                        name="csvFile"
                        type="file"
                        accept=".csv,.xlsx"
                        required
                        className="file:text-primary file:font-medium"
                        />
                        <p className="text-xs text-muted-foreground">
                        For variables, use column names that match your template (e.g., 'variable1').
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor="contactTags">Select Contact Tags</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                    <span className="truncate">
                                        {selectedTagIds.length > 0 ? `${selectedTagIds.length} tag(s) selected` : "Select tags..."}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search tags..." />
                                    <CommandList>
                                        <CommandEmpty>No tags found.</CommandEmpty>
                                        <CommandGroup>
                                            {(project?.tags || []).map((tag) => (
                                                <CommandItem
                                                    key={tag._id}
                                                    value={tag.name}
                                                    onSelect={() => {
                                                        const newSelected = selectedTagIds.includes(tag._id)
                                                            ? selectedTagIds.filter(id => id !== tag._id)
                                                            : [...selectedTagIds, tag._id];
                                                        setSelectedTagIds(newSelected);
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", selectedTagIds.includes(tag._id) ? "opacity-100" : "opacity-0")} />
                                                    <Badge className="mr-2" style={{ backgroundColor: tag.color }}> </Badge>
                                                    <span>{tag.name}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <p className="text-xs text-muted-foreground">
                            Select one or more tags to send this broadcast to all contacts with those tags.
                        </p>
                    </div>
                )}
            </div>
          
            {showImageUpload && (
                <>
                    <div className="md:col-span-2">
                        <Separator className="my-2" />
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <Label>Header Media (Required)</Label>
                        <RadioGroup name="mediaSource" value={headerMediaSource} onValueChange={(val) => setHeaderMediaSource(val as any)} className="flex gap-4 pt-1">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="url" id="source-url" /><Label htmlFor="source-url" className="flex items-center gap-2"><Link className="h-4 w-4"/>Use public URL</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="file" id="source-file" /><Label htmlFor="source-file" className="flex items-center gap-2"><UploadCloud className="h-4 w-4"/>Upload file</Label></div>
                        </RadioGroup>
                        
                        {headerMediaSource === 'url' ? (
                             <Input
                                id="headerImageUrl"
                                name="headerImageUrl"
                                type="url"
                                placeholder="https://example.com/image.png"
                                required
                            />
                        ) : (
                            <Input
                                id="headerImageFile"
                                name="headerImageFile"
                                type="file"
                                accept="image/*,video/*,application/pdf"
                                required
                                className="file:text-primary file:font-medium"
                            />
                        )}
                    </div>
                </>
            )}

          </CardContent>
          <CardFooter className="flex justify-end">
          <SubmitButton />
          </CardFooter>
      </form>
    </Card>
  );
}
