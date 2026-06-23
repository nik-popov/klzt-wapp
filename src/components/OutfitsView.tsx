import { useState, useEffect } from "react";
import type { Item, Outfit } from "../types";
import * as api from "../api";
import Spinner from "./Spinner";
import ErrorMessage from "./ErrorMessage";

interface OutfitFormData {
  name: string;
  notes: string;
  item_ids: number[];
}

const EMPTY_FORM: OutfitFormData = { name: "", notes: "", item_ids: [] };

export default function OutfitsView() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editOutfit, setEditOutfit] = useState<Outfit | null>(null);
  const [form, setForm] = useState<OutfitFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [outfitsData, itemsData] = await Promise.all([
        api.getOutfits(),
        api.getItems(),
      ]);
      setOutfits(outfitsData);
      setAllItems(itemsData);
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
    setEditOutfit(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (outfit: Outfit) => {
    setEditOutfit(outfit);
    setForm({
      name: outfit.name,
      notes: outfit.notes ?? "",
      item_ids: outfit.items.map((i) => i.id),
    });
    setShowForm(true);
  };

  const toggleItem = (id: number) => {
    setForm((f) => ({
      ...f,
      item_ids: f.item_ids.includes(id)
        ? f.item_ids.filter((x) => x !== id)
        : [...f.item_ids, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        notes: form.notes || undefined,
        item_ids: form.item_ids,
      };
      if (editOutfit) {
        const updated = await api.updateOutfit(editOutfit.id, payload);
        // Refetch to get populated items list
        const full = await api.getOutfit(updated.id);
        setOutfits((prev) =>
          prev.map((o) => (o.id === full.id ? full : o))
        );
      } else {
        const created = await api.createOutfit(payload);
        const full = await api.getOutfit(created.id);
        setOutfits((prev) => [full, ...prev]);
      }
      setShowForm(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this outfit?")) return;
    await api.deleteOutfit(id);
    setOutfits((prev) => prev.filter((o) => o.id !== id));
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Outfits</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          + New outfit
        </button>
      </div>

      {outfits.length === 0 ? (
        <p className="text-center text-gray-400 py-16">
          No outfits yet — create your first outfit!
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outfits.map((outfit) => (
            <OutfitCard
              key={outfit.id}
              outfit={outfit}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">
                {editOutfit ? "Edit outfit" : "New outfit"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-1 block">
                  Outfit name *
                </span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="input"
                  placeholder="Sunday brunch look"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-1 block">
                  Notes
                </span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="input h-20 resize-none"
                  placeholder="Occasion, weather, mood…"
                />
              </label>

              <div>
                <span className="text-sm font-medium text-gray-700 mb-2 block">
                  Items ({form.item_ids.length} selected)
                </span>
                {allItems.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    Add items to your closet first.
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    {allItems.map((item) => {
                      const selected = form.item_ids.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                            selected
                              ? "bg-brand-50 text-brand-700"
                              : "hover:bg-gray-50 text-gray-700"
                          } border-b border-gray-100 last:border-0`}
                        >
                          <span
                            className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${
                              selected
                                ? "bg-brand-600 border-brand-600 text-white"
                                : "border-gray-300"
                            }`}
                          >
                            {selected && "✓"}
                          </span>
                          <span className="text-sm truncate">{item.name}</span>
                          {item.category_name && (
                            <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
                              {item.category_name}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
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
                  {saving ? "Saving…" : editOutfit ? "Save changes" : "Create outfit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Outfit Card ──────────────────────────────────────────────────────────────

function OutfitCard({
  outfit,
  onEdit,
  onDelete,
}: {
  outfit: Outfit;
  onEdit: (o: Outfit) => void;
  onDelete: (id: number) => void;
}) {
  const previewItems = outfit.items.slice(0, 4);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Item thumbnails */}
      <div className="grid grid-cols-2 gap-0.5 bg-gray-100">
        {Array.from({ length: 4 }).map((_, i) => {
          const item = previewItems[i];
          return (
            <div key={i} className="aspect-square bg-gray-100 flex items-center justify-center">
              {item?.image_key ? (
                <img
                  src={api.imageUrl(item.image_key)}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : item ? (
                <span className="text-2xl">👕</span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="p-4 flex flex-col gap-1 flex-1">
        <p className="font-medium text-gray-900">{outfit.name}</p>
        {outfit.notes && (
          <p className="text-sm text-gray-500 line-clamp-2">{outfit.notes}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          {outfit.items.length} item{outfit.items.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="border-t border-gray-100 flex">
        <button
          onClick={() => onEdit(outfit)}
          className="flex-1 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ✏️ Edit
        </button>
        <button
          onClick={() => onDelete(outfit.id)}
          className="flex-1 py-2 text-xs text-gray-600 hover:bg-red-50 hover:text-red-500 transition-colors border-l border-gray-100"
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  );
}
