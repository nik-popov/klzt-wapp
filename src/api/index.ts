import type { Category, Item, Outfit } from "../types";

const BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Categories ──────────────────────────────────────────────────────────────

export const getCategories = (): Promise<Category[]> =>
  request("/categories");

export const createCategory = (name: string): Promise<Category> =>
  request("/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export const deleteCategory = (id: number): Promise<{ success: boolean }> =>
  request(`/categories/${id}`, { method: "DELETE" });

// ─── Items ────────────────────────────────────────────────────────────────────

export const getItems = (): Promise<Item[]> => request("/items");

export const getItem = (id: number): Promise<Item> => request(`/items/${id}`);

export const createItem = (
  data: Omit<Item, "id" | "image_key" | "times_worn" | "last_worn" | "created_at" | "updated_at" | "category_name">
): Promise<Item> =>
  request("/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const updateItem = (
  id: number,
  data: Partial<Omit<Item, "id" | "image_key" | "times_worn" | "last_worn" | "created_at" | "updated_at" | "category_name">>
): Promise<Item> =>
  request(`/items/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const deleteItem = (id: number): Promise<{ success: boolean }> =>
  request(`/items/${id}`, { method: "DELETE" });

export const wearItem = (id: number): Promise<Item> =>
  request(`/items/${id}/wear`, { method: "POST" });

export const uploadImage = async (
  itemId: number,
  file: File
): Promise<{ image_key: string }> => {
  const form = new FormData();
  form.append("image", file);
  return request(`/items/${itemId}/image`, { method: "POST", body: form });
};

export const imageUrl = (key: string): string => `/api/images/${key}`;

// ─── Outfits ──────────────────────────────────────────────────────────────────

export const getOutfits = (): Promise<Outfit[]> => request("/outfits");

export const getOutfit = (id: number): Promise<Outfit> =>
  request(`/outfits/${id}`);

export const createOutfit = (data: {
  name: string;
  notes?: string;
  item_ids?: number[];
}): Promise<Outfit> =>
  request("/outfits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const updateOutfit = (
  id: number,
  data: { name?: string; notes?: string; item_ids?: number[] }
): Promise<Outfit> =>
  request(`/outfits/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const deleteOutfit = (id: number): Promise<{ success: boolean }> =>
  request(`/outfits/${id}`, { method: "DELETE" });
