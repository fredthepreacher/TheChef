import { menuCategories } from "@/data/menu";

/**
 * Selectable menu catalog for "Build My Event". A selection key is the
 * human-readable "Category: Item" string — it is what Chef reads in the CRM,
 * and the server only accepts keys that exist in this catalog.
 */
export type CatalogItem = { key: string; category: string; categoryId: string; name: string; note: string };

export const MAX_MENU_SELECTIONS = 60;

export const menuCatalog: CatalogItem[] = menuCategories.flatMap((cat) =>
  (cat.columns ?? []).flat().map((item) => ({
    key: `${cat.title}: ${item.name}`,
    category: cat.title,
    categoryId: cat.id,
    name: item.name,
    note: item.note,
  })),
);

export const catalogKeys = new Set(menuCatalog.map((i) => i.key));

export const itemKey = (categoryTitle: string, itemName: string) => `${categoryTitle}: ${itemName}`;

/** Keep only known catalog keys, de-duplicated, in catalog order, capped. */
export function normalizeSelection(keys: readonly unknown[]): string[] {
  const wanted = new Set(keys.filter((k): k is string => typeof k === "string" && catalogKeys.has(k)));
  return menuCatalog.filter((i) => wanted.has(i.key)).map((i) => i.key).slice(0, MAX_MENU_SELECTIONS);
}

/** Group selected keys by category title, preserving catalog order. */
export function groupSelection(keys: readonly string[]): { category: string; items: CatalogItem[] }[] {
  const selected = new Set(keys);
  const groups = new Map<string, CatalogItem[]>();
  for (const item of menuCatalog) {
    if (!selected.has(item.key)) continue;
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return [...groups].map(([category, items]) => ({ category, items }));
}
