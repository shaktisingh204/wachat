"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  IconButton,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  Textarea,
  Label,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
  Badge,
  Checkbox,
  Switch,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/sabcrm/20ui";
import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  LifeBuoy,
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
  Code,
} from "lucide-react";

import {
  deleteSabChatQuickReply,
  saveSabChatQuickReply,
} from "@/app/actions/sabchat.actions";
import { useProject } from "@/context/project-context";
import type { SabChatQuickReply } from "@/lib/definitions";

/**
 * /dashboard/sabchat/quick-replies. Agent canned responses.
 */

const formInitialState: { message: string | null; error?: string } = {
  message: null,
  error: undefined,
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending}>
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
  const { toast } = useToast();
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
      toast.success({ title: "Saved", description: state.message });
      onSave();
      onOpenChange(false);
    }
    if (state.error) {
      toast.error({ title: "Error", description: state.error });
    }
  }, [state, toast, onSave, onOpenChange]);

  const insertVariable = (variable: string) => {
    setMessageText((prev) => prev + `{{${variable}}}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <form action={formAction}>
          {reply?._id && (
            <input type="hidden" name="id" value={reply._id.toString()} />
          )}
          <DialogHeader>
            <DialogTitle>{reply ? "Edit" : "Add"} quick reply</DialogTitle>
            <DialogDescription>
              Create a canned response for your agents to use in live chat.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Shortcut"
                required
                help="Must start with a forward slash (/) and contain no spaces."
              >
                <Input
                  name="shortcut"
                  defaultValue={reply?.shortcut}
                  required
                  placeholder="/welcome"
                  className="font-mono text-sm"
                />
              </Field>

              <div className="flex flex-col gap-2">
                <Label>Visibility scope</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    id="scope"
                    defaultChecked
                    label={
                      <span className="flex items-center gap-1.5 text-sm text-[var(--st-text)]">
                        <Users
                          className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                          aria-hidden="true"
                        />
                        Team (all agents)
                      </span>
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="message">Message template</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  iconLeft={Wand2}
                >
                  AI improve
                </Button>
              </div>

              {/* Dynamic variables toolbar */}
              <div className="flex flex-wrap gap-2 rounded-t-[var(--st-radius-sm)] border border-b-0 border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2">
                <span className="mr-2 flex items-center gap-1 text-xs text-[var(--st-text-secondary)]">
                  <Code className="h-3 w-3" aria-hidden="true" />
                  Insert variable
                </span>
                <Badge
                  variant="outline"
                  className="cursor-pointer text-[10px] hover:bg-[var(--st-bg-secondary)]"
                  onClick={() => insertVariable("visitor.name")}
                >
                  visitor.name
                </Badge>
                <Badge
                  variant="outline"
                  className="cursor-pointer text-[10px] hover:bg-[var(--st-bg-secondary)]"
                  onClick={() => insertVariable("agent.name")}
                >
                  agent.name
                </Badge>
                <Badge
                  variant="outline"
                  className="cursor-pointer text-[10px] hover:bg-[var(--st-bg-secondary)]"
                  onClick={() => insertVariable("company.name")}
                >
                  company.name
                </Badge>
              </div>

              <Textarea
                id="message"
                name="message"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                required
                className="min-h-32 rounded-t-none border-t-0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Category</Label>
                <Select defaultValue="general">
                  <SelectTrigger aria-label="Category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Keyboard shortcut</Label>
                <div className="flex items-center gap-2">
                  <kbd className="rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2 py-1 font-mono text-xs text-[var(--st-text-secondary)]">
                    Cmd
                  </kbd>
                  <span className="text-xs text-[var(--st-text-secondary)]">+</span>
                  <Input
                    aria-label="Shortcut key"
                    placeholder="Key"
                    className="h-8 w-16 text-center uppercase"
                    maxLength={1}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton isEditing={!!reply} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SabChatQuickRepliesPage() {
  const { sessionUser, reloadProject } = useProject();
  const [replies, setReplies] = useState<SabChatQuickReply[]>([]);
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<
    SabChatQuickReply | undefined
  >(undefined);

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
      toast.success({ title: "Deleted", description: "Quick reply deleted." });
      reloadProject();
    } else {
      toast.error({ title: "Error", description: result.error });
    }
  };

  const toggleBulk = (id: string) => {
    setSelectedBulk((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const filteredReplies = replies.filter(
    (r) =>
      !searchQuery ||
      r.shortcut.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.message.toLowerCase().includes(searchQuery.toLowerCase()),
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
            <BreadcrumbPage>Quick Replies</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Quick replies</PageTitle>
          <PageDescription>
            Canned responses for agents to use in live chat to speed up
            resolution times.
          </PageDescription>
        </PageHeading>
        <PageActions className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">More actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem iconLeft={Upload}>Import CSV</DropdownMenuItem>
              <DropdownMenuItem iconLeft={Download}>
                Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="primary" iconLeft={Plus} onClick={() => handleOpenDialog()}>
            Add reply
          </Button>
        </PageActions>
      </PageHeader>

      {/* Advanced filter toolbar */}
      {replies.length > 0 && (
        <div className="flex flex-col justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="w-72">
              <Input
                iconLeft={Search}
                aria-label="Search quick replies"
                placeholder="Search shortcuts or messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger aria-label="Scope" className="w-[160px]">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All replies</SelectItem>
                <SelectItem value="team">Team scope</SelectItem>
                <SelectItem value="personal">Personal scope</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedBulk.length > 0 && (
            <div className="flex items-center gap-3 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-1.5">
              <span className="text-xs font-medium text-[var(--st-text)]">
                {selectedBulk.length} selected
              </span>
              <Button variant="outline" size="sm" iconLeft={Trash2}>
                Delete
              </Button>
            </div>
          )}
        </div>
      )}

      {replies.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No quick replies yet"
          description="Create canned responses your agents can drop into a chat with a slash shortcut."
          action={
            <div className="flex items-center gap-3">
              <Button variant="outline" iconLeft={Upload}>
                Import CSV
              </Button>
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => handleOpenDialog()}
              >
                Add first reply
              </Button>
            </div>
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <Table>
            <THead>
              <Tr>
                <Th align="center" className="w-12">
                  <Checkbox
                    aria-label="Select all replies"
                    checked={
                      selectedBulk.length === filteredReplies.length &&
                      filteredReplies.length > 0
                    }
                    onChange={() =>
                      setSelectedBulk(
                        selectedBulk.length === filteredReplies.length
                          ? []
                          : filteredReplies.map((r) => r._id.toString()),
                      )
                    }
                  />
                </Th>
                <Th className="w-8">
                  <span className="sr-only">Reorder</span>
                </Th>
                <Th className="w-48">Shortcut</Th>
                <Th>Message template</Th>
                <Th>Scope</Th>
                <Th align="right">Usage</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredReplies.map((reply, index) => {
                const uses = Math.floor(Math.random() * 1000) + 10;
                const isTeam = index % 3 !== 0;

                return (
                  <Tr key={reply._id.toString()} className="group">
                    <Td align="center">
                      <Checkbox
                        aria-label={`Select ${reply.shortcut}`}
                        checked={selectedBulk.includes(reply._id.toString())}
                        onChange={() => toggleBulk(reply._id.toString())}
                      />
                    </Td>
                    <Td>
                      <IconButton
                        label="Drag to reorder"
                        icon={GripVertical}
                        variant="ghost"
                        size="sm"
                        className="cursor-grab text-[var(--st-text-tertiary)] active:cursor-grabbing hover:text-[var(--st-text)]"
                      />
                    </Td>
                    <Td className="font-mono text-sm font-medium text-[var(--st-text)]">
                      {reply.shortcut}
                    </Td>
                    <Td>
                      <span className="block max-w-lg truncate text-sm text-[var(--st-text-secondary)]">
                        {reply.message}
                      </span>
                    </Td>
                    <Td>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="gap-1.5">
                              {isTeam ? (
                                <Users className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <User className="h-3 w-3" aria-hidden="true" />
                              )}
                              {isTeam ? "Team" : "Personal"}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isTeam
                              ? "Available to all agents"
                              : "Only available to you"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Td>
                    <Td align="right">
                      <div className="flex flex-col items-end gap-1 text-xs text-[var(--st-text-secondary)]">
                        <span className="flex items-center gap-1.5 font-medium text-[var(--st-text)]">
                          <Activity className="h-3 w-3" aria-hidden="true" />
                          {uses}
                        </span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          2d ago
                        </span>
                      </div>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <IconButton
                          label="Edit reply"
                          icon={Pencil}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(reply)}
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <IconButton
                              label="Delete reply"
                              icon={Trash2}
                              variant="ghost"
                              size="sm"
                            />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete quick reply?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the "
                                {reply.shortcut}" reply? This action cannot be
                                undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                intent="danger"
                                onClick={() =>
                                  handleDelete(reply._id.toString())
                                }
                              >
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
