import { useState, useEffect, useRef } from "react";
import type { Item, Category } from "../types";
import * as api from "../api";
import Spinner from "./Spinner";
import ErrorMessage from "./ErrorMessage";

interface ItemFormData {
  name: string;
  description: string;
  category_id: number | null;
  color: string;
  size: string;
  brand: string;
}

const EMPTY_FORM: ItemFormData = {
  name: "",
  description: "",
  category_id: null,
  color: "",
  size: "",
  brand: "",
};

export default function ClosetView() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState<ItemFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileItemRef = useRef<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsData, catsData] = await Promise.all([
        api.getItems(),
        api.getCategories(),
      ]);
      setItems(itemsData);
      setCategories(catsData);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (item: Item) => {
    setEditItem(item);
    setForm({
      name: item.name,
      description: item.description ?? "",
      category_id: item.category_id,
      color: item.color ?? "",
      size: item.size ?? "",
      brand: item.brand ?? "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        category_id: form.category_id ?? undefined,
        color: form.color || undefined,
        size: form.size || undefined,
        brand: form.brand || undefined,
      };
      if (editItem) {
        const updated = await api.updateItem(editItem.id, payload);
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      } else {
        const created = await api.createItem(payload as Parameters<typeof api.createItem>[0]);
        setItems((prev) => [created, ...prev]);
      }
      setShowForm(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this item?")) return;
    await api.deleteItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleWear = async (id: number) => {
    const updated = await api.wearItem(id);
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const triggerUpload = (itemId: number) => {
    fileItemRef.current = itemId;
    fileRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const itemId = fileItemRef.current;
    if (!file || !itemId) return;
    setUploadingFor(itemId);
    try {
      const { image_key } = await api.uploadImage(itemId, file);
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, image_key } : i))
      );
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploadingFor(null);
      e.target.value = "";
    }
  };

  const filtered = filterCategory
    ? items.filter((i) => i.category_id === filterCategory)
    : items;

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory(null)}
            className={`px-3 py-1 rounded-full text-sm border ${
              filterCategory === null
                ? "bg-brand-600 text-white border-brand-600"
                : "border-gray-300 text-gray-600 hover:border-brand-400"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() =>
                setFilterCategory(cat.id === filterCategory ? null : cat.id)
              }
              className={`px-3 py-1 rounded-full text-sm border ${
                filterCategory === cat.id
                  ? "bg-brand-600 text-white border-brand-600"
                  : "border-gray-300 text-gray-600 hover:border-brand-400"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          + Add item
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-16">
          No items yet — add your first clothing piece!
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={openEdit}
              onDelete={handleDelete}
              onWear={handleWear}
              onUpload={triggerUpload}
              uploading={uploadingFor === item.id}
            />
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        ref={fileRef}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Add / Edit modal */}
      {showForm && (
        <Modal title={editItem ? "Edit item" : "Add item"} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Name *">
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input"
                placeholder="White linen shirt"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="input h-20 resize-none"
                placeholder="Optional notes…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <select
                  value={form.category_id ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      category_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="input"
                >
                  <option value="">— none —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Brand">
                <input
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  className="input"
                  placeholder="Zara"
                />
              </Field>
              <Field label="Color">
                <input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="input"
                  placeholder="White"
                />
              </Field>
              <Field label="Size">
                <input
                  value={form.size}
                  onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
                  className="input"
                  placeholder="M"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : editItem ? "Save changes" : "Add item"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onEdit,
  onDelete,
  onWear,
  onUpload,
  uploading,
}: {
  item: Item;
  onEdit: (item: Item) => void;
  onDelete: (id: number) => void;
  onWear: (id: number) => void;
  onUpload: (id: number) => void;
  uploading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Image */}
      <div
        className="relative bg-gray-100 aspect-square cursor-pointer group"
        onClick={() => onUpload(item.id)}
        title="Click to upload photo"
      >
        {item.image_key ? (
          <img
            src={api.imageUrl(item.image_key)}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300 text-4xl">
            👕
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
            Upload photo
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="font-medium text-gray-900 text-sm truncate" title={item.name}>
          {item.name}
        </p>
        {item.category_name && (
          <span className="text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full self-start">
            {item.category_name}
          </span>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          {item.brand && (
            <span className="text-xs text-gray-500">{item.brand}</span>
          )}
          {item.size && (
            <span className="text-xs text-gray-400">· {item.size}</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-auto">
          Worn {item.times_worn}×{item.last_worn ? ` · last ${item.last_worn}` : ""}
        </p>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-100 flex">
        <button
          onClick={() => onWear(item.id)}
          className="flex-1 py-2 text-xs text-gray-600 hover:bg-brand-50 hover:text-brand-600 transition-colors"
          title="Mark as worn today"
        >
          👗 Wear
        </button>
        <button
          onClick={() => onEdit(item)}
          className="flex-1 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors border-l border-gray-100"
        >
          ✏️ Edit
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="flex-1 py-2 text-xs text-gray-600 hover:bg-red-50 hover:text-red-500 transition-colors border-l border-gray-100"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
