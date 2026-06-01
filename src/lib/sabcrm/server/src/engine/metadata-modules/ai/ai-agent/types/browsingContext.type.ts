// PORT-NOTE: Ported from twenty-server ai-agent/types/browsingContext.type.ts
// Plain TypeScript type — no NestJS or Mongo dependency.

export type BrowsingContextType =
  | {
      type: "recordPage";
      objectNameSingular: string;
      recordId: string;
      pageLayoutId?: string;
      activeTabId?: string | null;
    }
  | {
      type: "listView";
      objectNameSingular: string;
      viewId: string;
      viewName: string;
      filterDescriptions: string[];
    };
