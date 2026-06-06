import * as React from "react";
import { notFound } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { getPublicProposal } from "@/app/actions/public-proposal.actions";
import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from "@/components/sabcrm/20ui/zoru";
import { ProposalActionsPanel } from "./proposal-actions-panel";
import { fmtDate, fmtINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ hash: string }>;

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  accepted: "default",
  declined: "destructive",
  waiting: "secondary",
};

async function PublicProposalContainer({ hash }: { hash: string }) {
  const proposal = await getPublicProposal(hash);
  if (!proposal) notFound();

  // Configure sanitize-html to safely allow common rich text tags.
  const cleanBody = sanitizeHtml(proposal.body || "", {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "u", "s"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "title", "width", "height", "loading"],
      "*": ["style", "class"], // Allow basic styling from rich text editors
    },
    allowedStyles: {
      "*": {
        color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/],
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
        "font-size": [/^\d+(?:px|em|%)$/],
      },
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <ZoruCardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <ZoruCardTitle>{proposal.title || "Proposal"}</ZoruCardTitle>
            <p className="mt-1 text-sm text-[var(--st-text)]">
              Valid till {fmtDate(proposal.validTill)} &middot; Total{" "}
              {fmtINR(proposal.total)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[proposal.status] || "outline"}>
              {proposal.status}
            </Badge>
            <a
              href={`/share/proposal/${hash}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--st-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--st-text)] shadow-sm hover:bg-[var(--st-bg-muted)]"
            >
              Download PDF
            </a>
          </div>
        </ZoruCardHeader>
        <ZoruCardContent>
          {cleanBody ? (
            <article
              className="prose prose-sm max-w-none text-[var(--st-text)]"
              dangerouslySetInnerHTML={{ __html: cleanBody }}
            />
          ) : (
            <p className="text-sm text-[var(--st-text)]">No proposal body provided.</p>
          )}
        </ZoruCardContent>
      </Card>

      <ProposalActionsPanel
        hash={hash}
        status={proposal.status}
        signature={proposal.signature ?? null}
        declineReason={proposal.declineReason ?? null}
      />
    </div>
  );
}

export default async function PublicProposalPage({
  params,
}: {
  params: Params;
}) {
  const { hash } = await params;
  
  return (
    <React.Suspense fallback={<div>Loading proposal...</div>}>
      <PublicProposalContainer hash={hash} />
    </React.Suspense>
  );
}
