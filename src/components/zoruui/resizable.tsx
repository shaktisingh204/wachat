"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import * as ResizablePanelsImport from "react-resizable-panels";

import { cn } from "./lib/cn";

// react-resizable-panels v4 ships ESM-only typings that older TS configs
// occasionally trip over. The repo's existing wrapper uses an `any` cast;
// mirror that to stay compatible with the project's tsconfig.
const ResizablePanels: any = ResizablePanelsImport;

export const ZoruResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePanels.PanelGroup>) => (
  <ResizablePanels.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className,
    )}
    {...props}
  />
);

export const ZoruResizablePanel = ResizablePanels.Panel;

export const ZoruResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePanels.PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <ResizablePanels.PanelResizeHandle
    className={cn(
      "relative flex w-px items-center justify-center bg-zoru-line",
      "after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2",
      "focus-visible:outline-none",
      "data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0",
      "[&[data-panel-group-direction=vertical]>div]:rotate-90",
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-[2px] border border-zoru-line bg-zoru-bg">
        <GripVertical className="h-2.5 w-2.5 text-zoru-ink-muted" />
      </div>
    )}
  </ResizablePanels.PanelResizeHandle>
);
