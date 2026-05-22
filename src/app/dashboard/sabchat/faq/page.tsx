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
  } from "lucide-react";

import {
  deleteSabChatFaq,
  saveSabChatFaq,
  } from "@/app/actions/sabchat.actions";
import { useProject } from "@/context/project-context";
import type { SabChatFaqItem } from "@/lib/definitions";

/**
 * /dashboard/sabchat/faq — FAQ knowledge base for the AI assistant.
 *
 * Same `saveSabChatFaq` and `deleteSabChatFaq` server actions. Visual
 * layer fully Zoru.
 */

const formInitialState: { message: string | null; error?: string } = {
  message: null,
  error: undefined,
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <LoaderCircle className="animate-spin" />}
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <form action={formAction}>
          {faqItem?._id && (
            <input
              type="hidden"
              name="id"
              value={faqItem._id.toString()}
            />
          )}
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {faqItem ? "Edit" : "Add"} FAQ
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Add a question and answer to your AI&apos;s knowledge base.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                name="question"
                defaultValue={faqItem?.question}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="answer">Answer</Label>
              <Textarea
                id="answer"
                name="answer"
                defaultValue={faqItem?.answer}
                required
                className="min-h-32"
              />
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
  const [editingFaq, setEditingFaq] = useState<SabChatFaqItem | undefined>(
    undefined,
  );

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
            <ZoruBreadcrumbPage>FAQ</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>FAQ</ZoruPageTitle>
          <ZoruPageDescription>
            Knowledge base used by the AI assistant.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button onClick={() => handleOpenDialog()}>
            <Plus />
            Add FAQ
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {faqs.length === 0 ? (
        <EmptyState
          icon={<HelpCircle />}
          title="No FAQs yet"
          description="Train your AI assistant with frequently asked questions and their answers."
          action={
            <Button onClick={() => handleOpenDialog()}>
              <Plus />
              Add your first FAQ
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Question</ZoruTableHead>
                <ZoruTableHead>Answer</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {faqs.map((faq) => (
                <ZoruTableRow key={faq._id.toString()}>
                  <ZoruTableCell className="max-w-sm truncate text-zoru-ink">
                    {faq.question}
                  </ZoruTableCell>
                  <ZoruTableCell className="max-w-sm truncate text-zoru-ink-muted">
                    {faq.answer}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleOpenDialog(faq)}
                        aria-label="Edit FAQ"
                      >
                        <Pencil />
                      </Button>
                      <ZoruAlertDialog>
                        <ZoruAlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete FAQ"
                          >
                            <Trash2 />
                          </Button>
                        </ZoruAlertDialogTrigger>
                        <ZoruAlertDialogContent>
                          <ZoruAlertDialogHeader>
                            <ZoruAlertDialogTitle>
                              Delete FAQ?
                            </ZoruAlertDialogTitle>
                            <ZoruAlertDialogDescription>
                              Are you sure you want to delete this FAQ? This
                              action cannot be undone.
                            </ZoruAlertDialogDescription>
                          </ZoruAlertDialogHeader>
                          <ZoruAlertDialogFooter>
                            <ZoruAlertDialogCancel>
                              Cancel
                            </ZoruAlertDialogCancel>
                            <ZoruAlertDialogAction
                              destructive
                              onClick={() => handleDelete(faq._id.toString())}
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
          </Table>
        </Card>
      )}
    </div>
  );
}
