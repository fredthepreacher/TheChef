"use client";

import { useCallback, useSyncExternalStore } from "react";
import { MAX_MENU_SELECTIONS, normalizeSelection } from "./menu-catalog";

/**
 * Client-side "event menu" selection shared by the homepage menu and the
 * Build My Event form. Persisted in localStorage so a guest can browse the
 * menu, leave, and come back. Holds menu item names only — never contact
 * details or other personal data.
 */
const KEY = "thechef.eventMenu.v1";
const EVENT = "thechef:event-menu";
const EMPTY: string[] = [];

let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? normalizeSelection(JSON.parse(raw)) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: string[]) {
  cache = normalizeSelection(next);
  try {
    if (cache.length) window.localStorage.setItem(KEY, JSON.stringify(cache));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode / storage full — selection still works for this page view */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) { cache = null; onChange(); }
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useEventMenu() {
  const selected = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggle = useCallback((key: string) => {
    const cur = read();
    if (cur.includes(key)) write(cur.filter((k) => k !== key));
    else if (cur.length < MAX_MENU_SELECTIONS) write([...cur, key]);
  }, []);

  const remove = useCallback((key: string) => write(read().filter((k) => k !== key)), []);
  const clear = useCallback(() => write([]), []);

  return { selected, toggle, remove, clear, isFull: selected.length >= MAX_MENU_SELECTIONS };
}
