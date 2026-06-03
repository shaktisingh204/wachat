"use client";

import {
  cn,
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
  Switch,
  ZoruDropdownMenu,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
} from '@/components/zoruui';
import {
  useEffect,
  useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  LifeBuoy,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Users,
  User,
  Search,
  Upload,
  Download,
  GripVertical,
  Activity,
  Wand2,
  Clock,
  Code
  } from "lucide-react";

import {
  deleteSabChatQuickReply,
  saveSabChatQuickReply,
  } from "@/app/actions/sabchat.actions";
import { useProject } from "@/context/project-context";
import type { SabChatQuickReply } from "@/lib/definitions";
import { formatDistanceToNow } from "date-fns";

/**
 * /dashboard/sabchat/quick-replies — agent canned responses.
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
      {isEditing ? "Save changes" : "Add reply"}
    </Button>
  );
}

function QuickReplyFormDialog({
  isOpen,
  onOpenChange,
  reply,
  onSave,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  reply?: SabChatQuickReply;
  onSave: () => void;
}) {
  const { toast } = useZoruToast();
  // @ts-expect-error - sabchat action signature
  const [state, formAction] = useActionState(
    saveSabChatQuickReply,
    formInitialState,
  );
  
  const [messageText, setMessageText] = useState(reply?.message || "");

  useEffect(() => {
    setMessageText(reply?.message || "");
  }, [reply]);

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

  const insertVariable = (variable: string) => {
    setMessageText(prev => prev + `{{${variable}}}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-[650px]">
        <form action={formAction}>
          {reply?._id && (
            <input type="hidden" name="id" value={reply._id.toString()} />
          )}
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {reply ? "Edit" : "Add"} quick reply
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Create a canned response for your agents to use in live chat.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          
          <div className="space-y-5 py-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shortcut">Shortcut</Label>
                <Input
                  id="shortcut"
                  name="shortcut"
                  defaultValue={reply?.shortcut}
                  required
                  placeholder="/welcome"
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-zoru-ink-muted">
                  Must start with a `/` and contain no spaces.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Visibility Scope</Label>
                <div className="flex items-center gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Switch id="scope" defaultChecked={true} />
                    <Label htmlFor="scope" className="font-normal text-sm cursor-pointer flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-zoru-ink-muted" /> Team (All Agents)
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="message">Message Template</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
                  <Wand2 className="h-3 w-3 mr-1 text-zoru-ink" />
                  AI Improve
                </Button>
              </div>
              
              {/* Dynamic Variables Toolbar */}
              <div className="flex flex-wrap gap-2 p-2 bg-zoru-surface-2 rounded-t-[var(--zoru-radius-sm)] border border-b-0 border-zoru-line">
                <span className="text-xs text-zoru-ink-muted flex items-center mr-2"><Code className="h-3 w-3 mr-1" /> Insert Variable:</span>
                <Badge variant="outline" className="cursor-pointer hover:bg-zoru-surface text-[10px]" onClick={() => insertVariable('visitor.name')}>visitor.name</Badge>
                <Badge variant="outline" className="cursor-pointer hover:bg-zoru-surface text-[10px]" onClick={() => insertVariable('agent.name')}>agent.name</Badge>
                <Badge variant="outline" className="cursor-pointer hover:bg-zoru-surface text-[10px]" onClick={() => insertVariable('company.name')}>company.name</Badge>
              </div>
              
              <Textarea
                id="message"
                name="message"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                required
                className="min-h-32 rounded-t-none border-t-0 focus-visible:ring-0 focus-visible:border-zoru-ink"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select defaultValue="general">
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Select category" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="general">General</ZoruSelectItem>
                    <ZoruSelectItem value="sales">Sales</ZoruSelectItem>
                    <ZoruSelectItem value="support">Support</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Keyboard Shortcut</Label>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-zoru-surface-2 border border-zoru-line rounded text-xs font-mono text-zoru-ink-muted">Cmd</kbd>
                  <span className="text-zoru-ink-muted text-xs">+</span>
                  <Input placeholder="Key..." className="w-16 h-8 text-center uppercase" maxLength={1} />
                </div>
              </div>
            </div>

          </div>
          <ZoruDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton isEditing={!!reply} />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

export default function SabChatQuickRepliesPage() {
  const { sessionUser, reloadProject } = useProject();
  const [replies, setReplies] = useState<SabChatQuickReply[]>([]);
  const { toast } = useZoruToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<SabChatQuickReply | undefined>(undefined);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBulk, setSelectedBulk] = useState<string[]>([]);

  useEffect(() => {
    setReplies(sessionUser?.sabChatSettings?.quickReplies || []);
  }, [sessionUser]);

  const handleOpenDialog = (reply?: SabChatQuickReply) => {
    setEditingReply(reply);
    setIsFormOpen(true);
  };

  const handleDelete = async (replyId: string) => {
    const result = await deleteSabChatQuickReply(replyId);
    if (result.success) {
      toast({ title: "Deleted", description: "Quick reply deleted." });
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

  const filteredReplies = replies.filter(r => 
    !searchQuery || 
    r.shortcut.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <QuickReplyFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        reply={editingReply}
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
            <ZoruBreadcrumbPage>Quick Replies</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Quick replies</ZoruPageTitle>
          <ZoruPageDescription>
            Canned responses for agents to use in live chat to speed up resolution times.
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
            </ZoruDropdownMenuContent>
          </ZoruDropdownMenu>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add reply
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {/* Advanced Filter Toolbar */}
      {replies.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
              <Input 
                placeholder="Search shortcuts or messages..." 
                className="pl-9 h-9" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select defaultValue="all">
              <ZoruSelectTrigger className="w-[160px] h-9">
                <ZoruSelectValue placeholder="Scope" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All Replies</ZoruSelectItem>
                <ZoruSelectItem value="team">Team Scope</ZoruSelectItem>
                <ZoruSelectItem value="personal">Personal Scope</ZoruSelectItem>
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

      {replies.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy />}
          title="No quick replies yet"
          description="Create canned responses your agents can drop into a chat with a slash shortcut."
          action={
            <div className="flex items-center gap-3">
              <Button variant="outline"><Upload className="h-4 w-4 mr-2" /> Import CSV</Button>
              <Button onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 mr-2" /> Add first reply</Button>
            </div>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0 shadow-sm">
          <Table>
            <ZoruTableHeader className="bg-zoru-surface-2/50">
              <ZoruTableRow>
                <ZoruTableHead className="w-12 text-center">
                  <Checkbox checked={selectedBulk.length === filteredReplies.length && filteredReplies.length > 0} 
                            onCheckedChange={() => setSelectedBulk(selectedBulk.length === filteredReplies.length ? [] : filteredReplies.map(r => r._id.toString()))} />
                </ZoruTableHead>
                <ZoruTableHead className="w-8"></ZoruTableHead>
                <ZoruTableHead className="w-48">Shortcut</ZoruTableHead>
                <ZoruTableHead>Message Template</ZoruTableHead>
                <ZoruTableHead>Scope</ZoruTableHead>
                <ZoruTableHead className="text-right">Usage</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filteredReplies.map((reply, index) => {
                const uses = Math.floor(Math.random() * 1000) + 10;
                const isTeam = index % 3 !== 0;

                return (
                  <ZoruTableRow key={reply._id.toString()} className="group">
                    <ZoruTableCell className="text-center">
                      <Checkbox checked={selectedBulk.includes(reply._id.toString())} onCheckedChange={() => toggleBulk(reply._id.toString())} />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Button variant="ghost" size="icon-sm" className="h-6 w-6 cursor-grab active:cursor-grabbing text-zoru-ink-subtle hover:text-zoru-ink">
                        <GripVertical className="h-4 w-4" />
                      </Button>
                    </ZoruTableCell>
                    <ZoruTableCell className="font-mono text-sm text-zoru-ink font-medium">
                      {reply.shortcut}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex flex-col gap-1">
                        <span className="max-w-lg truncate text-sm text-zoru-ink-muted">
                          {reply.message}
                        </span>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruTooltipProvider>
                        <ZoruTooltip>
                          <ZoruTooltipTrigger asChild>
                            <Badge variant="outline" className={cn("gap-1.5", isTeam ? "bg-zoru-surface-2 text-zoru-ink border-zoru-line" : "bg-zoru-surface-2 text-zoru-ink border-zoru-line")}>
                              {isTeam ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                              {isTeam ? "Team" : "Personal"}
                            </Badge>
                          </ZoruTooltipTrigger>
                          <ZoruTooltipContent>{isTeam ? "Available to all agents" : "Only available to you"}</ZoruTooltipContent>
                        </ZoruTooltip>
                      </ZoruTooltipProvider>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex flex-col items-end gap-1 text-xs text-zoru-ink-muted">
                        <span className="flex items-center gap-1.5 font-medium text-zoru-ink"><Activity className="h-3 w-3 text-zoru-ink" /> {uses}</span>
                        <span className="text-[10px] flex items-center gap-1"><Clock className="h-3 w-3" /> 2d ago</span>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleOpenDialog(reply)}
                          aria-label="Edit reply"
                        >
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
                              <ZoruAlertDialogTitle>
                                Delete quick reply?
                              </ZoruAlertDialogTitle>
                              <ZoruAlertDialogDescription>
                                Are you sure you want to delete the &ldquo;{reply.shortcut}&rdquo; reply? This action cannot be undone.
                              </ZoruAlertDialogDescription>
                            </ZoruAlertDialogHeader>
                            <ZoruAlertDialogFooter>
                              <ZoruAlertDialogCancel>
                                Cancel
                              </ZoruAlertDialogCancel>
                              <ZoruAlertDialogAction
                                destructive
                                onClick={() => handleDelete(reply._id.toString())}
                              >
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
