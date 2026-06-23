import { useState, useEffect } from "react";
import type { Category } from "../types";
import * as api from "../api";
import Spinner from "./Spinner";
import ErrorMessage from "./ErrorMessage";

export default function CategoriesView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setCategories(await api.getCategories());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const created = await api.createCategory(newName.trim());
      setCategories((prev) => [...prev, created]);
      setNewName("");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this category? Items in this category will become uncategorized."))
      return;
    await api.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div className="max-w-md">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Categories</h2>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="input flex-1"
          placeholder="New category name…"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </form>

      {/* List */}
      {categories.length === 0 ? (
        <p className="text-gray-400 text-sm">No categories yet.</p>
      ) : (
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm"
            >
              <span className="font-medium text-gray-800">{cat.name}</span>
              <button
                onClick={() => handleDelete(cat.id)}
                className="text-gray-400 hover:text-red-500 transition-colors text-sm"
                title="Delete category"
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
