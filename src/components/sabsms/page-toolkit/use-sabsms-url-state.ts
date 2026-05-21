"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Sync arbitrary filter / sort / pagination state into the URL.
 *
 * Reading is purely from `searchParams` so the result is stable across
 * server-render → client-hydrate. Writing replaces the URL without
 * scrolling, debounced by the caller.
 */
export interface UrlStateAPI {
  get: (key: string) => string | undefined;
  getAll: (key: string) => string[];
  set: (next: Record<string, string | string[] | number | undefined | null>) => void;
  setOne: (key: string, value: string | number | undefined | null) => void;
  toggleInList: (key: string, value: string) => void;
  clear: (keys?: string[]) => void;
  toString: () => string;
}

export function useSabsmsUrlState(): UrlStateAPI {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const writeParams = useCallback(
    (next: URLSearchParams) => {
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const get = useCallback((key: string) => params.get(key) ?? undefined, [params]);

  const getAll = useCallback((key: string) => params.getAll(key), [params]);

  const set = useCallback<UrlStateAPI["set"]>(
    (next) => {
      const merged = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === null || value === "") {
          merged.delete(key);
        } else if (Array.isArray(value)) {
          merged.delete(key);
          for (const v of value) merged.append(key, String(v));
        } else {
          merged.set(key, String(value));
        }
      }
      writeParams(merged);
    },
    [params, writeParams],
  );

  const setOne = useCallback<UrlStateAPI["setOne"]>(
    (key, value) => set({ [key]: value }),
    [set],
  );

  const toggleInList = useCallback(
    (key: string, value: string) => {
      const current = new Set(params.getAll(key));
      if (current.has(value)) current.delete(value);
      else current.add(value);
      set({ [key]: Array.from(current) });
    },
    [params, set],
  );

  const clear = useCallback(
    (keys?: string[]) => {
      if (!keys) {
        writeParams(new URLSearchParams());
        return;
      }
      const merged = new URLSearchParams(params.toString());
      for (const k of keys) merged.delete(k);
      writeParams(merged);
    },
    [params, writeParams],
  );

  const toString = useCallback(() => params.toString(), [params]);

  return { get, getAll, set, setOne, toggleInList, clear, toString };
}
