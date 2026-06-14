"use client";

/**
 * WhatsApp live preview
 *
 * A render-only phone-frame preview of any WhatsApp message type. Builders
 * (Templates, Broadcasts, Flows, Carousel, Chat composer) map their editor
 * state to a {@link WaPreviewMessage} and pass it here; the preview updates
 * live as the user types. Styling lives in preview.css (self-contained
 * `.wa-preview` scope — faithful WhatsApp skin, theme-toggleable).
 *
 * Lucide icons are used as plain JSX leaves here (NOT passed into a 20ui
 * `icon` prop), so direct `<Icon/>` usage is correct.
 */

import * as React from "react";
import {
  Check,
  CheckCheck,
  Clock,
  FileText,
  Image as ImageIcon,
  List as ListIcon,
  MapPin,
  Mic,
  Phone,
  Play,
  ShoppingBag,
  SquareArrowOutUpRight,
  Workflow,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type {
  WaButton,
  WaCarouselCard,
  WaMedia,
  WaPreviewMessage,
  WaProduct,
} from "./types";

import "./preview.css";

export type * from "./types";

function bytes(n?: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/* ---- delivery ticks (static; the animated version lives in motion/) --- */
function Ticks({ status }: { status?: WaPreviewMessage["status"] }) {
  if (!status || status === "pending")
    return <Clock size={13} className="wa-bubble__tick" aria-label="Pending" />;
  if (status === "failed") return <span style={{ color: "#dc2626" }}>!</span>;
  if (status === "sent") return <Check size={14} aria-label="Sent" />;
  return (
    <CheckCheck
      size={15}
      aria-label={status === "read" ? "Read" : "Delivered"}
      style={{ color: status === "read" ? "#53bdeb" : undefined }}
    />
  );
}

/* ---- media block ----------------------------------------------------- */
function MediaBlock({ media }: { media: WaMedia }) {
  if (media.kind === "document") {
    return (
      <div className="wa-doc">
        <span className="wa-doc__icon">
          <FileText size={18} />
        </span>
        <div className="min-w-0">
          <div className="wa-doc__name truncate">{media.name ?? "Document.pdf"}</div>
          <div className="wa-doc__sub">{bytes(media.size) || "PDF"}</div>
        </div>
      </div>
    );
  }
  if (media.kind === "audio") {
    return (
      <div className="wa-audio">
        <Mic size={18} style={{ color: "var(--wa-meta)" }} />
        <span className="wa-audio__track" />
        <span style={{ fontSize: 11, color: "var(--wa-meta)" }}>
          {media.durationSec ? `0:${String(media.durationSec).padStart(2, "0")}` : "0:08"}
        </span>
      </div>
    );
  }
  // image / video / sticker
  return (
    <div className="wa-media">
      {media.url ? (
        media.kind === "video" ? (
          <div style={{ position: "relative" }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={media.url} muted />
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                color: "#fff",
              }}
            >
              <Play size={32} fill="currentColor" />
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.url} alt={media.caption ?? "Media"} />
        )
      ) : (
        <div className="wa-media__placeholder">
          {media.kind === "video" ? <Play size={28} /> : <ImageIcon size={28} />}
        </div>
      )}
    </div>
  );
}

/* ---- under-bubble action buttons ------------------------------------- */
function ButtonIcon({ type }: { type: WaButton["type"] }) {
  if (type === "url") return <SquareArrowOutUpRight size={14} />;
  if (type === "phone") return <Phone size={14} />;
  if (type === "flow") return <Workflow size={14} />;
  if (type === "catalog" || type === "spm") return <ShoppingBag size={14} />;
  return null;
}
function Actions({ buttons }: { buttons?: WaButton[] }) {
  if (!buttons?.length) return null;
  return (
    <div className="wa-actions">
      {buttons.slice(0, 3).map((b, i) => (
        <div key={i} className="wa-action">
          <ButtonIcon type={b.type} />
          <span>{b.text || "Button"}</span>
        </div>
      ))}
    </div>
  );
}

/* ---- carousel cards -------------------------------------------------- */
function CarouselCard({ card }: { card: WaCarouselCard }) {
  return (
    <div className="wa-carousel__card">
      {card.media ? <MediaBlock media={card.media} /> : null}
      <div className="wa-carousel__body">{card.body || "Card text"}</div>
      <div style={{ padding: "0 8px 8px" }}>
        <Actions buttons={card.buttons} />
      </div>
    </div>
  );
}

/* ---- catalog product ------------------------------------------------- */
function Product({ p }: { p: WaProduct }) {
  return (
    <div className="wa-product">
      {p.image?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="wa-product__thumb" src={p.image.url} alt={p.title} />
      ) : (
        <span className="wa-product__thumb">
          <ShoppingBag size={20} />
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>
          {p.title}
        </div>
        {p.price ? <div className="wa-product__price">{p.price}</div> : null}
        {p.description ? (
          <div className="truncate" style={{ fontSize: 11.5, color: "var(--wa-meta)" }}>
            {p.description}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ===================================================================
 * Single message bubble
 * =================================================================== */
export function WaMessageBubble({ message }: { message: WaPreviewMessage }) {
  const dir = message.direction ?? "out";
  const m = message;

  const inner = (() => {
    switch (m.type) {
      case "media":
        return (
          <>
            {m.media ? <MediaBlock media={m.media} /> : null}
            {m.media?.caption || m.body ? <span>{m.media?.caption || m.body}</span> : null}
          </>
        );
      case "location":
      case "location_request":
        return (
          <>
            <div className="wa-loc">
              <div className="wa-loc__map">
                <MapPin size={26} />
              </div>
            </div>
            {m.location?.name ? <div style={{ fontWeight: 600 }}>{m.location.name}</div> : null}
            {m.location?.address ? (
              <div style={{ fontSize: 12, color: "var(--wa-meta)" }}>{m.location.address}</div>
            ) : null}
            {m.type === "location_request" ? (
              <div className="wa-action" style={{ marginTop: 6 }}>
                <MapPin size={14} /> <span>Send location</span>
              </div>
            ) : null}
          </>
        );
      case "cta_url":
        return (
          <>
            {m.body ? <span>{m.body}</span> : null}
            {m.cta ? (
              <div className="wa-actions">
                <div className="wa-action">
                  <SquareArrowOutUpRight size={14} />
                  <span>{m.cta.displayText || "Visit"}</span>
                </div>
              </div>
            ) : null}
          </>
        );
      case "buttons":
        return (
          <>
            {m.header?.media ? <MediaBlock media={m.header.media} /> : null}
            {m.header?.text ? <div className="wa-bubble__header">{m.header.text}</div> : null}
            {m.body ? <span>{m.body}</span> : null}
            {m.footer ? <div className="wa-bubble__footer">{m.footer}</div> : null}
            <Actions buttons={m.buttons} />
          </>
        );
      case "list":
        return (
          <>
            {m.header?.text ? <div className="wa-bubble__header">{m.header.text}</div> : null}
            {m.body ? <span>{m.body}</span> : null}
            {m.footer ? <div className="wa-bubble__footer">{m.footer}</div> : null}
            <div className="wa-listbtn">
              <ListIcon size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
              {m.listButtonText || "Menu"}
            </div>
            {m.sections?.length ? (
              <div className="wa-listpanel">
                {m.sections.map((s, si) => (
                  <div key={si}>
                    {s.title ? <div className="wa-listsection__title">{s.title}</div> : null}
                    {s.rows.map((r, ri) => (
                      <div key={ri} className="wa-listrow">
                        <div className="wa-listrow__title">{r.title || "Option"}</div>
                        {r.description ? (
                          <div className="wa-listrow__desc">{r.description}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        );
      case "carousel":
        return (
          <>
            {m.body ? <span>{m.body}</span> : null}
            <div className="wa-carousel" style={{ marginTop: 6 }}>
              {(m.cards ?? []).map((c, i) => (
                <CarouselCard key={i} card={c} />
              ))}
            </div>
          </>
        );
      case "catalog":
        return (
          <>
            {m.catalogTitle ? <div className="wa-bubble__header">{m.catalogTitle}</div> : null}
            {m.body ? <span>{m.body}</span> : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {(m.products ?? []).slice(0, 4).map((p, i) => (
                <Product key={i} p={p} />
              ))}
            </div>
            <div className="wa-action" style={{ marginTop: 6 }}>
              <ShoppingBag size={14} /> <span>View catalog</span>
            </div>
          </>
        );
      case "flow":
        return (
          <>
            {m.header?.text ? <div className="wa-bubble__header">{m.header.text}</div> : null}
            {m.body ? <span>{m.body}</span> : null}
            {m.footer ? <div className="wa-bubble__footer">{m.footer}</div> : null}
            <div className="wa-action" style={{ marginTop: 6 }}>
              <Workflow size={14} /> <span>{m.flow?.cta || "Open"}</span>
            </div>
          </>
        );
      case "template":
        return (
          <>
            {m.category ? <span className="wa-tplbadge">{m.category}</span> : null}
            {m.header?.media ? <MediaBlock media={m.header.media} /> : null}
            {m.header?.text ? <div className="wa-bubble__header">{m.header.text}</div> : null}
            {m.body ? <span>{m.body}</span> : null}
            {m.footer ? <div className="wa-bubble__footer">{m.footer}</div> : null}
            <Actions buttons={m.buttons} />
          </>
        );
      case "text":
      default:
        return <span>{m.body || "Your message preview appears here."}</span>;
    }
  })();

  return (
    <div className={cn("wa-row", dir === "out" ? "wa-row--out" : "wa-row--in")}>
      <div className={cn("wa-bubble", dir === "out" ? "wa-bubble--out" : "wa-bubble--in")}>
        {inner}
        <div className="wa-bubble__meta">
          <span>{m.time ?? "10:24"}</span>
          {dir === "out" ? <Ticks status={m.status ?? "read"} /> : null}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
 * Phone frame
 * =================================================================== */
export function WaPhoneFrame({
  contactName = "Acme Co.",
  contactStatus = "online",
  theme = "light",
  showComposer = true,
  className,
  children,
}: {
  contactName?: string;
  contactStatus?: string;
  theme?: "light" | "dark";
  showComposer?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const initials = contactName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className={cn("wa-preview", className)} data-theme={theme}>
      <div className="wa-phone">
        <span className="wa-phone__notch" aria-hidden />
        <div className="wa-phone__screen">
          <div className="wa-topbar">
            <span className="wa-topbar__avatar">{initials || "A"}</span>
            <div>
              <div className="wa-topbar__name">{contactName}</div>
              <div className="wa-topbar__status">{contactStatus}</div>
            </div>
          </div>
          <div className="wa-msgs">{children}</div>
          {showComposer ? (
            <div className="wa-composer">
              <div className="wa-composer__field">Type a message</div>
              <span className="wa-composer__send">
                <Play size={16} fill="currentColor" />
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
 * Public preview — frame + one or many messages
 * =================================================================== */
export function WhatsAppPreview({
  message,
  messages,
  contactName,
  contactStatus,
  theme = "light",
  showComposer = true,
  className,
}: {
  /** A single message to preview. */
  message?: WaPreviewMessage;
  /** Or a thread of messages. */
  messages?: WaPreviewMessage[];
  contactName?: string;
  contactStatus?: string;
  theme?: "light" | "dark";
  showComposer?: boolean;
  className?: string;
}) {
  const list = messages ?? (message ? [message] : []);
  return (
    <WaPhoneFrame
      contactName={contactName}
      contactStatus={contactStatus}
      theme={theme}
      showComposer={showComposer}
      className={className}
    >
      {list.map((m, i) => (
        <WaMessageBubble key={i} message={m} />
      ))}
    </WaPhoneFrame>
  );
}

export default WhatsAppPreview;
