import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type FormatFileProps =
  | "doc"
  | "pdf"
  | "md"
  | "mdx"
  | "csv"
  | "xls"
  | "xlsx"
  | "txt"
  | "ppt"
  | "pptx"
  | "zip"
  | "rar"
  | "tar"
  | "gz"
  | "code"
  | "html"
  | "js"
  | "jsx"
  | "tsx"
  | "css"
  | "json"
  | "img"
  | "png"
  | "jpg"
  | "jpeg"
  | "video";

type FileCardProps = {
  formatFile: FormatFileProps;
};

const DefaultPlaceholder = () => {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="bg-[var(--st-text)]/20 h-0.5 w-1/2 rounded-full" />
      </div>
      <div className="flex gap-1">
        <div className="bg-[var(--st-text)]/10 h-0.5 w-1/3 rounded-full" />
        <div className="bg-[var(--st-text)]/10 h-0.5 w-1/3 rounded-full" />
      </div>
      <div className="flex gap-1">
        <div className="bg-[var(--st-text)]/10 h-0.5 w-1/2 rounded-full" />
        <div className="bg-[var(--st-text)]/10 h-0.5 w-1/3 rounded-full" />
      </div>
      <div className="flex gap-1">
        <div className="bg-[var(--st-text)]/10 h-0.5 w-1/3 rounded-full" />
        <div className="bg-[var(--st-text)]/10 h-0.5 w-1/3 rounded-full" />
      </div>
      <div className="flex gap-1">
        <div className="bg-[var(--st-text)]/10 h-0.5 w-1/3 rounded-full" />
        <div className="bg-[var(--st-text)]/10 h-0.5 w-1/2 rounded-full" />
      </div>
      <div className="flex gap-1">
        <div className="bg-[var(--st-text)]/10 h-0.5 w-1/3 rounded-full" />
      </div>
    </div>
  );
};

const colorBannerMap: Record<FormatFileProps, string> = {
  doc: "bg-[var(--st-text)] text-white",
  pdf: "bg-[var(--st-text)] text-white",
  md: "bg-[var(--st-text)] text-white",
  mdx: "bg-[var(--st-text)] text-white",
  txt: "bg-[var(--st-text)] text-white",
  csv: "bg-[var(--st-text)] text-white",
  xls: "bg-[var(--st-text)] text-white",
  xlsx: "bg-[var(--st-text)] text-white",
  ppt: "bg-[var(--st-text)] text-white",
  pptx: "bg-[var(--st-text)] text-white",
  zip: "bg-[var(--st-text)] text-white",
  rar: "bg-[var(--st-text)] text-white",
  tar: "bg-[var(--st-text)] text-white",
  gz: "bg-[var(--st-text)] text-white",
  html: "bg-[var(--st-text)] text-white",
  js: "bg-[var(--st-text)] text-white",
  jsx: "bg-[var(--st-text)] text-white",
  css: "bg-[var(--st-text)] text-white",
  json: "bg-[var(--st-text)] text-white",
  tsx: "bg-[var(--st-text)] text-white",
  code: "bg-[var(--st-text)] text-white",
  img: "bg-[var(--st-text)] text-white",
  png: "bg-[var(--st-text)] text-white",
  jpg: "bg-[var(--st-text)] text-white",
  jpeg: "bg-[var(--st-text)] text-white",
  video: "bg-[var(--st-text)] text-white",
};

export const FileCard = ({ formatFile }: FileCardProps) => {
  const colorBannerClass = colorBannerMap[formatFile];
  let filePlaceholder: ReactNode = null;

  filePlaceholder = <DefaultPlaceholder />;

  if (formatFile === "md" || formatFile === "mdx") {
    filePlaceholder = (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <div className="text-[var(--st-text)]/30 text-[10px] font-bold">#</div>
          <div className="bg-[var(--st-text)]/20 h-0.5 w-6 rounded-full" />
        </div>
        <div className="space-y-1">
          <div className="bg-[var(--st-text)]/10 h-0.5 w-1/3 rounded-full" />
          <div className="bg-[var(--st-text)]/10 h-0.5 w-7 rounded-full" />
        </div>
        <div className="space-y-1">
          <div className="bg-[var(--st-text)]/10 h-0.5 w-8 rounded-full" />
          <div className="bg-[var(--st-text)]/10 h-0.5 w-4 rounded-full" />
          <div className="bg-[var(--st-text)]/10 h-0.5 w-1/3 rounded-full" />
        </div>
      </div>
    );
  }

  if (formatFile === "xls" || formatFile === "xlsx") {
    filePlaceholder = (
      <div className="space-y-0.5">
        <div className="grid grid-cols-3 gap-0.5">
          <div className="bg-[var(--st-text)]/20 h-2" />
          <div className="bg-[var(--st-text)]/20 h-2" />
          <div className="bg-[var(--st-text)]/20 h-2" />
        </div>
        <div className="grid grid-cols-3 gap-0.5">
          <div className="bg-[var(--st-text)]/5 h-2" />
          <div className="bg-[var(--st-text)]/5 h-2" />
          <div className="bg-[var(--st-text)]/5 h-2" />
          <div className="bg-[var(--st-text)]/5 h-2" />
          <div className="bg-[var(--st-text)]/5 h-2" />
          <div className="bg-[var(--st-text)]/5 h-2" />
        </div>
        <div className="grid grid-cols-3 gap-0.5">
          <div className="bg-[var(--st-text)]/5 h-2" />
          <div className="bg-[var(--st-text)]/5 h-2" />
        </div>
        <div className="grid grid-cols-3 gap-0.5">
          <div className="bg-[var(--st-text)]/5 h-2" />
        </div>
      </div>
    );
  }

  if (formatFile === "csv") {
    filePlaceholder = (
      <>
        <div className="mb-2">
          <div className="grid grid-cols-3 gap-0.5">
            <div className="bg-[var(--st-text)]/20 h-1.5 rounded-full" />
            <div className="bg-[var(--st-text)]/20 h-1.5 rounded-full" />
            <div className="bg-[var(--st-text)]/20 h-1.5 rounded-full" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-0.5">
            <div className="bg-[var(--st-text)]/5 h-1 rounded-full" />
            <div className="bg-[var(--st-text)]/5 h-1 rounded-full" />
            <div className="bg-[var(--st-text)]/5 h-1 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-0.5">
            <div className="bg-[var(--st-text)]/5 h-1 rounded-full" />
            <div className="bg-[var(--st-text)]/5 h-1 rounded-full" />
            <div className="bg-[var(--st-text)]/5 h-1 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-0.5">
            <div className="bg-[var(--st-text)]/5 h-1 rounded-full" />
            <div className="bg-[var(--st-text)]/5 h-1 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-0.5">
            <div className="bg-[var(--st-text)]/5 h-1 rounded-full" />
          </div>
        </div>
      </>
    );
  }

  if (
    formatFile === "zip" ||
    formatFile === "rar" ||
    formatFile === "tar" ||
    formatFile === "gz"
  ) {
    filePlaceholder = (
      <div className="relative flex h-full flex-col items-center justify-center">
        <div className="space-y-0">
          {Array.from({ length: 9 }).map((_, i) => (
            <div className="flex overflow-hidden rounded-full" key={i}>
              {i % 2 === 0 ? (
                <>
                  <div className="bg-[var(--st-text)]/20 size-1.5" />
                  <div className="bg-[var(--st-text)]/5 size-1.5" />
                </>
              ) : (
                <>
                  <div className="bg-[var(--st-text)]/5 size-1.5" />
                  <div className="bg-[var(--st-text)]/20 size-1.5" />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (formatFile === "ppt" || formatFile === "pptx") {
    filePlaceholder = (
      <>
        <div className="bg-[var(--st-text)]/5 mb-1.5 space-y-1 rounded p-1">
          <div className="flex justify-center gap-1">
            <div className="size-3 rounded-sm bg-[var(--st-bg-muted)]/40" />
          </div>
          <div className="bg-[var(--st-text)]/15 mx-auto h-[3px] w-8 rounded-full" />
        </div>
        <div className="mb-1 flex justify-center gap-1">
          <div className="bg-[var(--st-text)]/15 h-[3px] w-8 rounded-full" />
          <div className="bg-[var(--st-text)]/15 h-[3px] w-4 rounded-full" />
        </div>
        <div className="space-y-1">
          <div className="bg-[var(--st-text)]/15 h-[3px] w-4 rounded-full" />
          <div className="bg-[var(--st-text)]/15 h-[3px] w-5 rounded-full" />
        </div>
      </>
    );
  }

  if (
    formatFile === "img" ||
    formatFile === "png" ||
    formatFile === "jpg" ||
    formatFile === "jpeg"
  ) {
    filePlaceholder = (
      <>
        <div className="bg-[var(--st-text)]/5 mb-1.5 space-y-1 rounded p-1">
          <div className="flex justify-center gap-1">
            <div className="size-3 rounded-sm bg-[var(--st-bg-muted)]/40" />
          </div>
          <div className="bg-[var(--st-text)]/15 mx-auto mt-1 h-[3px] w-4 rounded-full" />
          <div className="bg-[var(--st-text)]/15 mx-auto h-[3px] w-8 rounded-full" />
        </div>
      </>
    );
  }

  if (formatFile === "video") {
    filePlaceholder = (
      <>
        <div className="bg-[var(--st-text)]/5 mb-1.5 space-y-1 rounded p-1">
          <div className="flex justify-center gap-1">
            <div className="size-0 border-y-[5px] border-l-8 border-y-transparent border-l-green-400/60" />
          </div>
          <div className="bg-[var(--st-text)]/15 mx-auto mt-1 h-[3px] w-4 rounded-full" />
          <div className="bg-[var(--st-text)]/15 mx-auto h-[3px] w-8 rounded-full" />
        </div>
      </>
    );
  }

  if (
    formatFile === "html" ||
    formatFile === "js" ||
    formatFile === "jsx" ||
    formatFile === "tsx" ||
    formatFile === "code"
  ) {
    filePlaceholder = (
      <div className="space-y-1">
        <div className="flex items-center gap-0.5">
          <div className="text-[var(--st-text)]/30 font-mono text-[5px]">&lt;</div>
          <div className="h-[3px] w-3 rounded-full bg-[var(--st-bg-muted)]/60" />
          <div className="text-[var(--st-text)]/30 font-mono text-[5px]">&gt;</div>
        </div>
        <div className="flex items-center gap-0.5 pl-1">
          <div className="text-[var(--st-text)]/30 font-mono text-[5px]">&lt;</div>
          <div className="h-[3px] w-2.5 rounded-full bg-[var(--st-bg-muted)]/60" />
          <div className="text-[var(--st-text)]/30 font-mono text-[5px]">&gt;</div>
        </div>
        <div className="flex items-center gap-0.5 pl-1">
          <div className="text-[var(--st-text)]/30 font-mono text-[5px]">&lt;/</div>
          <div className="h-[3px] w-2.5 rounded-full bg-[var(--st-bg-muted)]/60" />
          <div className="text-[var(--st-text)]/30 font-mono text-[5px]">&gt;</div>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="text-[var(--st-text)]/30 font-mono text-[5px]">&lt;</div>
          <div className="h-[3px] w-1 rounded-full bg-[var(--st-bg-muted)]/60" />
          <div className="text-[var(--st-text)]/30 font-mono text-[5px]">/&gt;</div>
        </div>
      </div>
    );
  }

  if (formatFile === "css") {
    filePlaceholder = (
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <div className="text-[var(--st-text)]/40 font-mono text-[6px]">{"{"}</div>
        </div>
        <div className="flex items-center gap-1 pl-1.5">
          <div className="h-[3px] w-3 rounded-full bg-[var(--st-bg-muted)]/60" />
          <div className="h-[3px] w-4 rounded-full bg-[var(--st-bg-muted)]/60" />
        </div>
        <div className="flex items-center gap-1 pl-1.5">
          <div className="h-[3px] w-4 rounded-full bg-[var(--st-bg-muted)]/60" />
          <div className="h-[3px] w-2 rounded-full bg-[var(--st-bg-muted)]/60" />
        </div>
        <div className="flex items-center gap-1 pl-1.5">
          <div className="h-[3px] w-3 rounded-full bg-[var(--st-bg-muted)]/60" />
          <div className="h-[3px] w-4 rounded-full bg-[var(--st-bg-muted)]/60" />
        </div>
        <div className="flex items-center gap-1">
          <div className="text-[var(--st-text)]/40 font-mono text-[6px]">{"}"}</div>
        </div>
      </div>
    );
  }

  if (formatFile === "json") {
    filePlaceholder = (
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <div className="text-[var(--st-text)]/40 font-mono text-[6px]">{"{"}</div>
        </div>
        <div className="flex items-center gap-1 pl-1.5">
          <div className="bg-[var(--st-text)]/20 h-[3px] w-3 rounded-full" />
          <div className="bg-[var(--st-text)]/20 h-[3px] w-4 rounded-full" />
        </div>
        <div className="flex items-center gap-1 pl-1.5">
          <div className="bg-[var(--st-text)]/10 h-[3px] w-4 rounded-full" />
          <div className="bg-[var(--st-text)]/10 h-[3px] w-2 rounded-full" />
        </div>
        <div className="flex items-center gap-1 pl-1.5">
          <div className="bg-[var(--st-text)]/10 h-[3px] w-3 rounded-full" />
          <div className="bg-[var(--st-text)]/10 h-[3px] w-4 rounded-full" />
        </div>
        <div className="flex items-center gap-1 pl-1.5">
          <div className="bg-[var(--st-text)]/10 h-[3px] w-3 rounded-full" />
        </div>
        <div className="flex items-center gap-1">
          <div className="text-[var(--st-text)]/40 font-mono text-[6px]">{"}"}</div>
        </div>
      </div>
    );
  }

  const sizeClass = "w-14 h-[4.5rem]";

  return (
    <div aria-hidden className="relative size-fit">
      <div
        className={cn(
          "absolute -right-2 bottom-1.5 z-2 rounded px-1.5 py-0.5 text-[8px] font-medium uppercase",
          colorBannerClass
        )}
      >
        {formatFile}
      </div>
      <div
        className={cn(
          "dark:bg-[var(--st-bg-muted)] relative z-1 space-y-3 rounded-md bg-[var(--st-surface)] p-2 shadow-sm",
          sizeClass
        )}
      >
        {filePlaceholder}
      </div>
    </div>
  );
};

export default FileCard;
