"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import {
  Plus, Search, Pencil, Trash2, Package, Loader2,
  BoxesIcon, X,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_urls: string[] | null;
  is_active: boolean;
  allows_shipping: boolean;
  allows_pickup: boolean;
  category_id: string | null;
  category_name: string | null;
}

interface Category {
  id: string;
  name: string;
}

// ── Page ────────────────────────────────────────────────────
export default function TiendaProductosPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);

  // ── Auth ──────────────────────────────────────────────────
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

  // ── Fetch ─────────────────────────────────────────────────
  const fetchProducts = useCallback(async (q = "") => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const qs = q ? `?search=${encodeURIComponent(q)}&limit=100` : "?limit=100";
      const res = await fetchAPI(`/products${qs}`, { headers });
      setProducts(res.data.products);
    } catch { /* keep current */ }
    finally { setIsLoading(false); }
  }, [getHeaders]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetchAPI("/categories");
      setCategories(res.data.categories);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchProducts(); fetchCategories(); }, [fetchProducts, fetchCategories]);

  // ── Search debounce ───────────────────────────────────────
  const handleSearch = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchProducts(val), 400);
  };

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = async (p: Product) => {
    if (!window.confirm(`¿Eliminar "${p.name}"?`)) return;
    const headers = getHeaders();
    if (!headers) return;
    try {
      await fetchAPI(`/products/${p.id}`, { method: "DELETE", headers });
      fetchProducts(search);
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  };

  // ── Loading ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">Cargando productos...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Catálogo de Productos</h1>
          <p className="text-sm text-text-secondary mt-1">
            {products.length} producto{products.length !== 1 && "s"}
          </p>
        </div>
        <button
          onClick={() => { setEditingProduct(null); setShowProductModal(true); }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold
                     text-white shadow-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} /> Nuevo Producto
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nombre o descripción..."
          className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm
                     text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl shadow-sm border border-border/50 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-text-muted">Imagen</th>
              <th className="px-4 py-3 font-medium text-text-muted">Producto</th>
              <th className="px-4 py-3 font-medium text-text-muted">Precio</th>
              <th className="px-4 py-3 font-medium text-text-muted">Stock</th>
              <th className="px-4 py-3 font-medium text-text-muted">Estado</th>
              <th className="px-4 py-3 font-medium text-text-muted text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-text-muted">
                  No hay productos.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-background transition-colors">
                  <td className="px-4 py-3">
                    {p.image_urls && p.image_urls.length > 0 ? (
                      <img
                        src={p.image_urls[0]}
                        alt={p.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Package size={16} className="text-text-muted" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{p.name}</p>
                    {p.category_name && (
                      <p className="text-xs text-text-muted mt-0.5">{p.category_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-primary font-medium">
                    ${p.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${p.stock <= 5 ? "text-red-600" : "text-text-primary"}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      p.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {p.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditingProduct(p); setShowProductModal(true); }}
                        title="Editar"
                        className="rounded-lg p-2 text-text-secondary hover:bg-background hover:text-primary transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => { setStockProduct(p); setShowStockModal(true); }}
                        title="Gestionar Stock"
                        className="rounded-lg p-2 text-text-secondary hover:bg-background hover:text-amber-600 transition-colors"
                      >
                        <BoxesIcon size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        title="Eliminar"
                        className="rounded-lg p-2 text-text-secondary hover:bg-danger-light hover:text-danger transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Product Modal */}
      {showProductModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          getHeaders={getHeaders}
          onClose={() => setShowProductModal(false)}
          onSaved={() => { setShowProductModal(false); fetchProducts(search); }}
        />
      )}

      {/* Stock Modal */}
      {showStockModal && stockProduct && (
        <StockModal
          product={stockProduct}
          getHeaders={getHeaders}
          onClose={() => setShowStockModal(false)}
          onSaved={() => { setShowStockModal(false); fetchProducts(search); }}
        />
      )}
    </div>
  );
}

// ── Product Modal ───────────────────────────────────────────
function ProductModal({
  product,
  categories,
  getHeaders,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  getHeaders: () => Record<string, string> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(product);
  const [form, setForm] = useState({
    name: product?.name || "",
    description: product?.description || "",
    price: product?.price?.toString() || "",
    stock: product?.stock?.toString() || "0",
    category_id: product?.category_id || "",
    allows_shipping: product?.allows_shipping ?? true,
    allows_pickup: product?.allows_pickup ?? true,
    is_active: product?.is_active ?? true,
    image_urls_text: product?.image_urls?.join("\n") || "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.price) return alert("Nombre y precio son obligatorios");
    if (!isEdit && !form.stock) return alert("Stock es obligatorio");

    const headers = getHeaders();
    if (!headers) return;

    const imageUrls = form.image_urls_text
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    const body: any = {
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      category_id: form.category_id || null,
      allows_shipping: form.allows_shipping,
      allows_pickup: form.allows_pickup,
      image_urls: imageUrls.length > 0 ? imageUrls : null,
    };

    if (isEdit) body.is_active = form.is_active;
    else body.stock = parseInt(form.stock, 10);

    setIsSaving(true);
    try {
      if (isEdit) {
        await fetchAPI(`/products/${product!.id}`, {
          method: "PUT", headers, body: JSON.stringify(body),
        });
      } else {
        await fetchAPI("/products", {
          method: "POST", headers, body: JSON.stringify(body),
        });
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
        className="bg-surface rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">
            {isEdit ? "Editar Producto" : "Nuevo Producto"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-background hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Price + Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Precio *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            {!isEdit && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Stock *</label>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Categoría</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Image URLs */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">URLs de imágenes (una por línea)</label>
            <textarea
              value={form.image_urls_text}
              onChange={(e) => setForm({ ...form, image_urls_text: e.target.value })}
              rows={2}
              placeholder="https://ejemplo.com/imagen1.jpg"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={form.allows_shipping}
                onChange={(e) => setForm({ ...form, allows_shipping: e.target.checked })}
                className="rounded border-border"
              />
              Permite envío
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={form.allows_pickup}
                onChange={(e) => setForm({ ...form, allows_pickup: e.target.checked })}
                className="rounded border-border"
              />
              Permite recoger
            </label>
            {isEdit && (
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-border"
                />
                Activo
              </label>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold
                       text-white hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
            {isSaving ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Producto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stock Modal ─────────────────────────────────────────────
function StockModal({
  product,
  getHeaders,
  onClose,
  onSaved,
}: {
  product: Product;
  getHeaders: () => Record<string, string> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [operation, setOperation] = useState<"add" | "subtract" | "set">("add");
  const [quantity, setQuantity] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleApply = async () => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) return alert("Ingresa una cantidad válida");

    const headers = getHeaders();
    if (!headers) return;

    setIsSaving(true);
    try {
      await fetchAPI(`/products/${product.id}/stock`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ operation, quantity: qty }),
      });
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al actualizar stock");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-xl p-6 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">Gestionar Stock</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-background hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-text-secondary mb-1">{product.name}</p>
        <p className="text-2xl font-bold text-text-primary mb-5">
          Stock actual: <span className={product.stock <= 5 ? "text-red-600" : ""}>{product.stock}</span>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Operación</label>
            <select
              value={operation}
              onChange={(e) => setOperation(e.target.value as any)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="add">Agregar unidades</option>
              <option value="subtract">Retirar unidades</option>
              <option value="set">Establecer cantidad exacta</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Cantidad</label>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold
                       text-white hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
            {isSaving ? "Aplicando..." : "Aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}
