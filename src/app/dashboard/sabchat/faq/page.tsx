"use client";

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  useZoruToast,
  Badge,
  Checkbox,
  ZoruDropdownMenu,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  Switch,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
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
  const { toast } = useZoruToast();
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
      <ZoruDialogContent className="sm:max-w-[600px]">
        <form action={formAction}>
          {faqItem?._id && (
            <input type="hidden" name="id" value={faqItem._id.toString()} />
          )}
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {faqItem ? "Edit FAQ Article" : "Create FAQ Article"}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              This article will be used by the AI to answer customer questions automatically.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-5 py-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select defaultValue="general">
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Select category" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="general">General</ZoruSelectItem>
                    <ZoruSelectItem value="billing">Billing</ZoruSelectItem>
                    <ZoruSelectItem value="technical">Technical Support</ZoruSelectItem>
                  </ZoruSelectContent>
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
                  {isGenerating ? <LoaderCircle className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1 text-zoru-ink" />}
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
              <p className="text-[10px] text-zoru-ink-muted">Markdown formatting is supported (bold, italics, links, lists).</p>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton isEditing={!!faqItem} />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

export default function SabChatFaqPage() {
  const { sessionUser, reloadProject } = useProject();
  const [faqs, setFaqs] = useState<SabChatFaqItem[]>([]);
  const { toast } = useZoruToast();
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
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/sabchat/inbox">
              SabChat
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Knowledge Base</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Knowledge Base FAQs</ZoruPageTitle>
          <ZoruPageDescription>
            Manage articles used by the AI assistant to resolve customer queries instantly.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions className="flex items-center gap-3">
          <ZoruDropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline">More Actions</Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuItem><Upload className="h-4 w-4 mr-2" /> Import CSV</ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem><Download className="h-4 w-4 mr-2" /> Export CSV</ZoruDropdownMenuItem>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem><FolderOpen className="h-4 w-4 mr-2" /> Manage Categories</ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </ZoruDropdownMenu>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Article
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {/* Advanced Filter Toolbar */}
      {faqs.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
              <Input 
                placeholder="Search articles..." 
                className="pl-9 h-9" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select defaultValue="all">
              <ZoruSelectTrigger className="w-[140px] h-9">
                <ZoruSelectValue placeholder="Category" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All Categories</ZoruSelectItem>
                <ZoruSelectItem value="general">General</ZoruSelectItem>
                <ZoruSelectItem value="billing">Billing</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
          
          {selectedBulk.length > 0 && (
            <div className="flex items-center gap-3 bg-zoru-surface-2 px-3 py-1.5 rounded-[var(--zoru-radius-sm)] border border-zoru-line">
              <span className="text-xs font-medium">{selectedBulk.length} selected</span>
              <Button variant="outline" size="sm" className="h-7 text-xs text-zoru-ink border-zoru-line hover:bg-zoru-surface-2 hover:text-zoru-ink">
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
            <ZoruTableHeader className="bg-zoru-surface-2/50">
              <ZoruTableRow>
                <ZoruTableHead className="w-12 text-center">
                  <Checkbox checked={selectedBulk.length === filteredFaqs.length && filteredFaqs.length > 0} 
                            onCheckedChange={() => setSelectedBulk(selectedBulk.length === filteredFaqs.length ? [] : filteredFaqs.map(f => f._id.toString()))} />
                </ZoruTableHead>
                <ZoruTableHead className="w-8"></ZoruTableHead>
                <ZoruTableHead className="w-[40%]">Article</ZoruTableHead>
                <ZoruTableHead>Category</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead className="text-right">Performance</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filteredFaqs.map((faq, index) => {
                // Mock metrics
                const views = Math.floor(Math.random() * 500) + 10;
                const helpful = Math.floor(Math.random() * 90) + 5;
                const isGeneral = index % 2 === 0;

                return (
                  <ZoruTableRow key={faq._id.toString()} className="group">
                    <ZoruTableCell className="text-center">
                      <Checkbox checked={selectedBulk.includes(faq._id.toString())} onCheckedChange={() => toggleBulk(faq._id.toString())} />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Button variant="ghost" size="icon-sm" className="h-6 w-6 cursor-grab active:cursor-grabbing text-zoru-ink-subtle hover:text-zoru-ink">
                        <GripVertical className="h-4 w-4" />
                      </Button>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex flex-col gap-1 pr-4">
                        <span className="font-medium text-sm text-zoru-ink line-clamp-1">{faq.question}</span>
                        <span className="text-xs text-zoru-ink-muted line-clamp-1">{faq.answer}</span>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant="outline" className="bg-zoru-surface-2 text-zoru-ink-muted">
                        {isGeneral ? "General" : "Billing"}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant="success" className="bg-zoru-surface-2 text-zoru-ink border-zoru-line">
                        Published
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex flex-col items-end gap-1 text-xs text-zoru-ink-muted">
                        <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {views}</span>
                        <span className="flex items-center gap-1.5 text-zoru-ink"><ThumbsUp className="h-3 w-3" /> {helpful}%</span>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon-sm" onClick={() => handleOpenDialog(faq)} aria-label="Edit FAQ">
                          <Pencil />
                        </Button>
                        <ZoruAlertDialog>
                          <ZoruAlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="text-zoru-ink hover:text-zoru-ink hover:bg-zoru-surface-2">
                              <Trash2 />
                            </Button>
                          </ZoruAlertDialogTrigger>
                          <ZoruAlertDialogContent>
                            <ZoruAlertDialogHeader>
                              <ZoruAlertDialogTitle>Delete Article?</ZoruAlertDialogTitle>
                              <ZoruAlertDialogDescription>
                                Are you sure you want to delete this FAQ? The AI will no longer use it for resolving chats.
                              </ZoruAlertDialogDescription>
                            </ZoruAlertDialogHeader>
                            <ZoruAlertDialogFooter>
                              <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                              <ZoruAlertDialogAction destructive onClick={() => handleDelete(faq._id.toString())}>
                                Delete
                              </ZoruAlertDialogAction>
                            </ZoruAlertDialogFooter>
                          </ZoruAlertDialogContent>
                        </ZoruAlertDialog>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })}
            </ZoruTableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
