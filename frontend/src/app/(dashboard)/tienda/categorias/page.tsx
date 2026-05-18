"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import { Plus, Pencil, Trash2, Loader2, Tag, X } from "lucide-react";

// ── Types ───────────────────────────────────────────────────
interface Category {
  id: string;
  name: string;
  description: string | null;
}

// ── Page ────────────────────────────────────────────────────
export default function CategoriasPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === 'therapist') {
          router.replace('/agenda');
        }
      } catch (e) {}
    }
  }, [router]);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return null; }
    return { Authorization: "Bearer " + token };
  }, [router]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetchAPI("/categories");
      setCategories(res.data.categories);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleDelete = async (c: Category) => {
    if (!window.confirm(`¿Eliminar categoría "${c.name}"?`)) return;
    const headers = getHeaders();
    if (!headers) return;
    try {
      await fetchAPI(`/categories/${c.id}`, { method: "DELETE", headers });
      fetchCategories();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">Cargando categorías...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Categorías</h1>
          <p className="text-sm text-text-secondary mt-1">
            {categories.length} categoría{categories.length !== 1 && "s"}
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold
                     text-white shadow-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} /> Nueva Categoría
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {categories.length === 0 ? (
          <div className="bg-surface rounded-xl shadow-sm border border-border/50 px-6 py-12 text-center text-text-muted">
            No hay categorías creadas.
          </div>
        ) : (
          categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between bg-surface rounded-xl shadow-sm border border-border/50 px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <Tag size={18} className="text-primary shrink-0" />
                <div>
                  <p className="font-medium text-text-primary">{c.name}</p>
                  {c.description && (
                    <p className="text-xs text-text-muted mt-0.5">{c.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditing(c); setShowModal(true); }}
                  className="rounded-lg p-2 text-text-secondary hover:bg-background hover:text-primary transition-colors"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className="rounded-lg p-2 text-text-secondary hover:bg-danger-light hover:text-danger transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <CategoryModal
          category={editing}
          getHeaders={getHeaders}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchCategories(); }}
        />
      )}
    </div>
  );
}

// ── Category Modal ──────────────────────────────────────────
function CategoryModal({
  category,
  getHeaders,
  onClose,
  onSaved,
}: {
  category: Category | null;
  getHeaders: () => Record<string, string> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(category);
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return alert("El nombre es obligatorio");
    const headers = getHeaders();
    if (!headers) return;

    setIsSaving(true);
    try {
      const body = JSON.stringify({ name: name.trim(), description: description.trim() || null });
      if (isEdit) {
        await fetchAPI(`/categories/${category!.id}`, { method: "PUT", headers, body });
      } else {
        await fetchAPI("/categories", { method: "POST", headers, body });
      }
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-xl p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">
            {isEdit ? "Editar Categoría" : "Nueva Categoría"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-background hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-border">
          <button onClick={onClose} className="flex-1 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
            {isSaving ? "Guardando..." : isEdit ? "Guardar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
