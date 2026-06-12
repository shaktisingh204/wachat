import type { ReactNode } from "react";
import { Flex, Text, css, theme } from "@webstudio-is/design-system";
import {
  WebstudioIcon, // rebranded SabSites mark
  HomeIcon,
  ImageIcon,
  FolderIcon,
  EmailIcon,
  CloudIcon,
  ContentIcon,
  ExternalLinkIcon,
} from "@webstudio-is/icons";

/**
 * SabNode chrome for the SabSites dashboard (project list).
 *
 * The dashboard is served by the embedded builder under the /sites basename,
 * but it lives on the SabNode apex origin, so links to the real SabNode app
 * use plain <a href="/dashboard/…"> (NOT Remix <Link>, which would prepend the
 * /sites basename) — a full-page navigation out of the embedded app into the
 * Next.js SabNode shell. The editor/canvas routes never render this chrome.
 */

const SABNODE_BRAND = "linear-gradient(135deg, #6366F1 0%, #A855F7 100%)";

// ── Top header ──────────────────────────────────────────────────────────────

const headerStyle = css({
  position: "sticky",
  top: 0,
  zIndex: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: 56,
  paddingInline: theme.spacing[9],
  background: theme.colors.backgroundPanel,
  borderBottom: `1px solid ${theme.colors.borderMain}`,
});

const brandMarkStyle = css({
  width: 26,
  height: 26,
  borderRadius: 7,
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(99,102,241,0.35)",
});

const openSabNodeStyle = css({
  all: "unset",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing[3],
  height: 32,
  paddingInline: theme.spacing[5],
  borderRadius: 8,
  fontSize: theme.deprecatedFontSize[3],
  fontWeight: 500,
  color: theme.colors.foregroundMain,
  border: `1px solid ${theme.colors.borderMain}`,
  background: theme.colors.backgroundPanel,
  "&:hover": { background: theme.colors.backgroundHover },
});

export const SabNodeTopHeader = () => {
  return (
    <header className={headerStyle()}>
      <Flex align="center" gap="2">
        <span className={brandMarkStyle()}>
          <WebstudioIcon size={26} />
        </span>
        <Text css={{ fontWeight: 700, fontSize: theme.deprecatedFontSize[4] }}>
          SabSites
        </Text>
        <Text
          variant="labels"
          color="subtle"
          css={{
            marginInlineStart: theme.spacing[3],
            paddingInlineStart: theme.spacing[5],
            borderInlineStart: `1px solid ${theme.colors.borderMain}`,
          }}
        >
          Website Builder
        </Text>
      </Flex>
      <a className={openSabNodeStyle()} href="/dashboard">
        Open SabNode
        <ExternalLinkIcon size={14} />
      </a>
    </header>
  );
};

// ── Floating dock ───────────────────────────────────────────────────────────

const dockWrapStyle = css({
  position: "fixed",
  insetInline: 0,
  bottom: theme.spacing[7],
  zIndex: 20,
  display: "flex",
  justifyContent: "center",
  pointerEvents: "none",
});

const dockStyle = css({
  pointerEvents: "auto",
  display: "flex",
  alignItems: "center",
  gap: theme.spacing[3],
  padding: theme.spacing[3],
  borderRadius: 18,
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(0,0,0,0.06)",
  boxShadow:
    "0 12px 32px rgba(17,24,39,0.18), 0 2px 8px rgba(17,24,39,0.10)",
});

const dockItemStyle = css({
  all: "unset",
  cursor: "pointer",
  width: 44,
  height: 44,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  color: "#374151",
  transition: "transform 120ms ease, background 120ms ease",
  "&:hover": {
    transform: "translateY(-6px) scale(1.08)",
    background: "rgba(99,102,241,0.10)",
    color: "#4338CA",
  },
  "&[data-active=true]": {
    background: SABNODE_BRAND,
    color: "#fff",
    boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
  },
});

const dockSeparatorStyle = css({
  width: 1,
  height: 28,
  background: "rgba(0,0,0,0.08)",
  marginInline: theme.spacing[2],
});

const DockItem = ({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active?: boolean;
  children: ReactNode;
}) => (
  <a
    className={dockItemStyle()}
    href={href}
    title={label}
    aria-label={label}
    data-active={active ? "true" : undefined}
  >
    {children}
  </a>
);

export const SabNodeDock = () => {
  return (
    <div className={dockWrapStyle()}>
      <div className={dockStyle()}>
        <DockItem href="/dashboard" label="SabNode Home">
          <HomeIcon size={22} />
        </DockItem>
        <span className={dockSeparatorStyle()} />
        <DockItem href="/sites/dashboard" label="SabSites" active>
          <ImageIcon size={22} />
        </DockItem>
        <DockItem href="/dashboard/sabflow/flow-builder" label="SabFlow">
          <CloudIcon size={22} />
        </DockItem>
        <DockItem href="/dashboard/sabfiles" label="SabFiles">
          <FolderIcon size={22} />
        </DockItem>
        <DockItem href="/dashboard/email" label="Email">
          <EmailIcon size={22} />
        </DockItem>
        <DockItem href="/dashboard/sabsheet" label="SabSheet">
          <ContentIcon size={22} />
        </DockItem>
      </div>
    </div>
  );
};
