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
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
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
  } from "lucide-react";

import {
  deleteSabChatQuickReply,
  saveSabChatQuickReply,
  } from "@/app/actions/sabchat.actions";
import { useProject } from "@/context/project-context";
import type { SabChatQuickReply } from "@/lib/definitions";

/**
 * /dashboard/sabchat/quick-replies — agent canned responses.
 *
 * Same `saveSabChatQuickReply` and `deleteSabChatQuickReply` server
 * actions. Visual layer fully Zoru.
 */

const formInitialState: { message: string | null; error?: string } = {
  message: null,
  error: undefined,
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending && <LoaderCircle className="animate-spin" />}
      {isEditing ? "Save changes" : "Add reply"}
    </ZoruButton>
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

  return (
    <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
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
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <ZoruLabel htmlFor="shortcut">Shortcut</ZoruLabel>
              <ZoruInput
                id="shortcut"
                name="shortcut"
                defaultValue={reply?.shortcut}
                required
                placeholder="/welcome"
              />
              <p className="text-xs text-zoru-ink-muted">
                Must start with a `/` and contain no spaces.
              </p>
            </div>
            <div className="space-y-2">
              <ZoruLabel htmlFor="message">Message</ZoruLabel>
              <ZoruTextarea
                id="message"
                name="message"
                defaultValue={reply?.message}
                required
                className="min-h-32"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <SubmitButton isEditing={!!reply} />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

export default function SabChatQuickRepliesPage() {
  const { sessionUser, reloadProject } = useProject();
  const [replies, setReplies] = useState<SabChatQuickReply[]>([]);
  const { toast } = useZoruToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<
    SabChatQuickReply | undefined
  >(undefined);

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

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <QuickReplyFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        reply={editingReply}
        onSave={reloadProject}
      />

      <ZoruBreadcrumb>
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
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Quick replies</ZoruPageTitle>
          <ZoruPageDescription>
            Canned responses for agents to use in live chat.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton onClick={() => handleOpenDialog()}>
            <Plus />
            Add reply
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {replies.length === 0 ? (
        <ZoruEmptyState
          icon={<LifeBuoy />}
          title="No quick replies yet"
          description="Create canned responses your agents can drop into a chat with a slash shortcut."
          action={
            <ZoruButton onClick={() => handleOpenDialog()}>
              <Plus />
              Add your first reply
            </ZoruButton>
          }
        />
      ) : (
        <ZoruCard className="overflow-hidden p-0">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Shortcut</ZoruTableHead>
                <ZoruTableHead>Message</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {replies.map((reply) => (
                <ZoruTableRow key={reply._id.toString()}>
                  <ZoruTableCell className="font-mono text-zoru-ink">
                    {reply.shortcut}
                  </ZoruTableCell>
                  <ZoruTableCell className="max-w-lg truncate text-zoru-ink-muted">
                    {reply.message}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ZoruButton
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleOpenDialog(reply)}
                        aria-label="Edit reply"
                      >
                        <Pencil />
                      </ZoruButton>
                      <ZoruAlertDialog>
                        <ZoruAlertDialogTrigger asChild>
                          <ZoruButton
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete reply"
                          >
                            <Trash2 />
                          </ZoruButton>
                        </ZoruAlertDialogTrigger>
                        <ZoruAlertDialogContent>
                          <ZoruAlertDialogHeader>
                            <ZoruAlertDialogTitle>
                              Delete quick reply?
                            </ZoruAlertDialogTitle>
                            <ZoruAlertDialogDescription>
                              Are you sure you want to delete the &ldquo;
                              {reply.shortcut}&rdquo; reply? This action
                              cannot be undone.
                            </ZoruAlertDialogDescription>
                          </ZoruAlertDialogHeader>
                          <ZoruAlertDialogFooter>
                            <ZoruAlertDialogCancel>
                              Cancel
                            </ZoruAlertDialogCancel>
                            <ZoruAlertDialogAction
                              destructive
                              onClick={() =>
                                handleDelete(reply._id.toString())
                              }
                            >
                              Delete
                            </ZoruAlertDialogAction>
                          </ZoruAlertDialogFooter>
                        </ZoruAlertDialogContent>
                      </ZoruAlertDialog>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </ZoruTable>
        </ZoruCard>
      )}
    </div>
  );
}
