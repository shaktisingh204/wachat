"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, Input, Label, PageActions, PageDescription, PageHeader, PageHeading, PageTitle, Table, TBody, Td, Th, THead, Tr, Textarea, useToast, Badge, Checkbox, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  HelpCircle,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Download,
  GripVertical,
  Wand2,
  Search,
  Eye,
  ThumbsUp,
  FolderOpen
  } from "lucide-react";

import {
  deleteSabChatFaq,
  saveSabChatFaq,
  } from "@/app/actions/sabchat.actions";
import { useProject } from "@/context/project-context";
import type { SabChatFaqItem } from "@/lib/definitions";

/**
 * /dashboard/sabchat/faq — FAQ knowledge base for the AI assistant.
 */

const formInitialState: { message: string | null; error?: string } = {
  message: null,
  error: undefined,
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <LoaderCircle className="animate-spin mr-2 h-4 w-4" />}
      {isEditing ? "Save changes" : "Add FAQ"}
    </Button>
  );
}

function FaqFormDialog({
  isOpen,
  onOpenChange,
  faqItem,
  onSave,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  faqItem?: SabChatFaqItem;
  onSave: () => void;
}) {
  const { toast } = useToast();
  // @ts-expect-error - sabchat action signature
  const [state, formAction] = useActionState(saveSabChatFaq, formInitialState);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (state.message) {
      toast({ title: "Saved", description: state.message });
      onSave();
      onOpenChange(false);
    }
    if (state.error) {
      toast({
        title: "Error",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast, onSave, onOpenChange]);

  const handleAIGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 1500); // Mock AI generation
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form action={formAction}>
          {faqItem?._id && (
            <input type="hidden" name="id" value={faqItem._id.toString()} />
          )}
          <DialogHeader>
            <DialogTitle>
              {faqItem ? "Edit FAQ Article" : "Create FAQ Article"}
            </DialogTitle>
            <DialogDescription>
              This article will be used by the AI to answer customer questions automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select defaultValue="general">
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="technical">Technical Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex flex-col justify-center pt-6">
                <div className="flex items-center gap-2">
                  <Switch id="published" defaultChecked={true} />
                  <Label htmlFor="published">Published (Visible to AI)</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="question">Question / Title</Label>
              <Input
                id="question"
                name="question"
                defaultValue={faqItem?.question}
                placeholder="e.g. How do I reset my password?"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="answer">Answer Body</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAIGenerate} disabled={isGenerating}>
                  {isGenerating ? <LoaderCircle className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1 text-[var(--st-text)]" />}
                  {isGenerating ? "Drafting..." : "AI Draft Answer"}
                </Button>
              </div>
              <Textarea
                id="answer"
                name="answer"
                defaultValue={faqItem?.answer}
                placeholder="Write a clear, comprehensive answer..."
                required
                className="min-h-[160px]"
              />
              <p className="text-[10px] text-[var(--st-text-secondary)]">Markdown formatting is supported (bold, italics, links, lists).</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton isEditing={!!faqItem} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SabChatFaqPage() {
  const { sessionUser, reloadProject } = useProject();
  const [faqs, setFaqs] = useState<SabChatFaqItem[]>([]);
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<SabChatFaqItem | undefined>(undefined);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBulk, setSelectedBulk] = useState<string[]>([]);

  useEffect(() => {
    setFaqs(sessionUser?.sabChatSettings?.faqs || []);
  }, [sessionUser]);

  const handleOpenDialog = (faqItem?: SabChatFaqItem) => {
    setEditingFaq(faqItem);
    setIsFormOpen(true);
  };

  const handleDelete = async (faqId: string) => {
    const result = await deleteSabChatFaq(faqId);
    if (result.success) {
      toast({ title: "Deleted", description: "FAQ deleted." });
      reloadProject();
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const toggleBulk = (id: string) => {
    setSelectedBulk(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const filteredFaqs = faqs.filter(f => 
    !searchQuery || 
    f.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <FaqFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        faqItem={editingFaq}
        onSave={reloadProject}
      />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/sabchat/inbox">
              SabChat
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Knowledge Base</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Knowledge Base FAQs</PageTitle>
          <PageDescription>
            Manage articles used by the AI assistant to resolve customer queries instantly.
          </PageDescription>
        </PageHeading>
        <PageActions className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">More Actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem><Upload className="h-4 w-4 mr-2" /> Import CSV</DropdownMenuItem>
              <DropdownMenuItem><Download className="h-4 w-4 mr-2" /> Export CSV</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem><FolderOpen className="h-4 w-4 mr-2" /> Manage Categories</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Article
          </Button>
        </PageActions>
      </PageHeader>

      {/* Advanced Filter Toolbar */}
      {faqs.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
              <Input 
                placeholder="Search articles..." 
                className="pl-9 h-9" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {selectedBulk.length > 0 && (
            <div className="flex items-center gap-3 bg-[var(--st-bg-muted)] px-3 py-1.5 rounded-[var(--st-radius-sm)] border border-[var(--st-border)]">
              <span className="text-xs font-medium">{selectedBulk.length} selected</span>
              <Button variant="outline" size="sm" className="h-7 text-xs text-[var(--st-text)] border-[var(--st-border)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]">
                <Trash2 className="h-3 w-3 mr-1.5" /> Delete
              </Button>
            </div>
          )}
        </div>
      )}

      {faqs.length === 0 ? (
        <EmptyState
          icon={<HelpCircle />}
          title="No articles in your knowledge base"
          description="Train your AI assistant with frequently asked questions so it can deflect tickets automatically."
          action={
            <div className="flex items-center gap-3">
              <Button variant="outline"><Upload className="h-4 w-4 mr-2" /> Import CSV</Button>
              <Button onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 mr-2" /> Add first article</Button>
            </div>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0 shadow-sm">
          <Table>
            <THead className="bg-[var(--st-bg-muted)]/50">
              <Tr>
                <Th className="w-12 text-center">
                  <Checkbox checked={selectedBulk.length === filteredFaqs.length && filteredFaqs.length > 0} 
                            onCheckedChange={() => setSelectedBulk(selectedBulk.length === filteredFaqs.length ? [] : filteredFaqs.map(f => f._id.toString()))} />
                </Th>
                <Th className="w-8"></Th>
                <Th className="w-[40%]">Article</Th>
                <Th>Category</Th>
                <Th>Status</Th>
                <Th className="text-right">Performance</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredFaqs.map((faq, index) => {
                // Mock metrics
                const views = Math.floor(Math.random() * 500) + 10;
                const helpful = Math.floor(Math.random() * 90) + 5;
                const isGeneral = index % 2 === 0;

                return (
                  <Tr key={faq._id.toString()} className="group">
                    <Td className="text-center">
                      <Checkbox checked={selectedBulk.includes(faq._id.toString())} onCheckedChange={() => toggleBulk(faq._id.toString())} />
                    </Td>
                    <Td>
                      <Button variant="ghost" size="icon-sm" className="h-6 w-6 cursor-grab active:cursor-grabbing text-[var(--st-text-tertiary)] hover:text-[var(--st-text)]">
                        <GripVertical className="h-4 w-4" />
                      </Button>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1 pr-4">
                        <span className="font-medium text-sm text-[var(--st-text)] line-clamp-1">{faq.question}</span>
                        <span className="text-xs text-[var(--st-text-secondary)] line-clamp-1">{faq.answer}</span>
                      </div>
                    </Td>
                    <Td>
                      <Badge variant="outline" className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                        {isGeneral ? "General" : "Billing"}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge variant="success" className="bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]">
                        Published
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex flex-col items-end gap-1 text-xs text-[var(--st-text-secondary)]">
                        <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {views}</span>
                        <span className="flex items-center gap-1.5 text-[var(--st-text)]"><ThumbsUp className="h-3 w-3" /> {helpful}%</span>
                      </div>
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon-sm" onClick={() => handleOpenDialog(faq)} aria-label="Edit FAQ">
                          <Pencil />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="text-[var(--st-text)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]">
                              <Trash2 />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Article?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this FAQ? The AI will no longer use it for resolving chats.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction destructive onClick={() => handleDelete(faq._id.toString())}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
